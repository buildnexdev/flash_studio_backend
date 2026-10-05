import { mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { config } from '../config/env.js';
import { hmacHex, safeEqual } from '../utils/crypto.js';

export interface SignOptions {
    ttlSeconds?: number;
    /** Force a download with this file name (Content-Disposition: attachment). */
    downloadName?: string;
}

export interface StorageDriver {
    readonly name: 'local' | 's3';
    put(key: string, body: Buffer, contentType: string): Promise<void>;
    get(key: string): Promise<Buffer>;
    delete(key: string): Promise<void>;
    exists(key: string): Promise<boolean>;
    signedUrl(key: string, opts?: SignOptions): Promise<string>;
}

const MIME: Record<string, string> = {
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.webp': 'image/webp',
    '.heic': 'image/heic',
    '.tif': 'image/tiff',
    '.tiff': 'image/tiff',
    '.pdf': 'application/pdf',
};

export const contentTypeFor = (key: string) => MIME[path.extname(key).toLowerCase()] ?? 'application/octet-stream';

/** Keys are generated server-side; still reject anything that could escape the storage root. */
export function assertSafeKey(key: string): string {
    if (!/^[A-Za-z0-9/_.-]{1,250}$/.test(key) || key.includes('..') || key.startsWith('/')) throw new Error(`Unsafe storage key: ${key}`);
    return key;
}

const safeName = (name: string) => name.replace(/[^A-Za-z0-9._-]+/g, '_').slice(0, 120) || 'photo';

class LocalStorage implements StorageDriver {
    readonly name = 'local' as const;
    private readonly root = path.resolve(config.LOCAL_STORAGE_DIR);

    private file(key: string) {
        return path.join(this.root, ...assertSafeKey(key).split('/'));
    }

    async put(key: string, body: Buffer): Promise<void> {
        const file = this.file(key);
        await mkdir(path.dirname(file), { recursive: true });
        await writeFile(file, body);
    }

    get(key: string): Promise<Buffer> {
        return readFile(this.file(key));
    }

    async delete(key: string): Promise<void> {
        await rm(this.file(key), { force: true });
    }

    async exists(key: string): Promise<boolean> {
        return stat(this.file(key)).then(() => true, () => false);
    }

    async signedUrl(key: string, opts: SignOptions = {}): Promise<string> {
        // Expiry is rounded up to a 5-minute bucket so repeated listings return identical, browser-cacheable URLs.
        const exp = Math.ceil((Math.floor(Date.now() / 1000) + (opts.ttlSeconds ?? config.SIGNED_URL_TTL_SECONDS)) / 300) * 300;
        const dn = opts.downloadName ? safeName(opts.downloadName) : '';
        const sig = signLocal(key, exp, dn);
        const qs = new URLSearchParams({ exp: String(exp), sig, ...(dn ? { dn } : {}) });
        return `${config.BACKEND_URL}/api/files/${key.split('/').map(encodeURIComponent).join('/')}?${qs}`;
    }

    /** Absolute path for streaming by the /api/files route. */
    resolve(key: string): string {
        return this.file(key);
    }
}

export const signLocal = (key: string, exp: number, dn: string) => hmacHex(`files:${config.APP_SECRET}`, `${key}|${exp}|${dn}`);

export function verifyLocalSignature(key: string, exp: number, dn: string, sig: string): boolean {
    if (!Number.isFinite(exp) || exp < Math.floor(Date.now() / 1000)) return false;
    return safeEqual(signLocal(key, exp, dn), sig);
}

class S3Storage implements StorageDriver {
    readonly name = 's3' as const;
    private readonly client = new S3Client({
        region: config.AWS_REGION,
        endpoint: config.S3_ENDPOINT || undefined,
        forcePathStyle: config.S3_FORCE_PATH_STYLE,
        credentials: config.AWS_ACCESS_KEY ? { accessKeyId: config.AWS_ACCESS_KEY, secretAccessKey: config.AWS_SECRET_KEY } : undefined,
    });

    async put(key: string, body: Buffer, contentType: string): Promise<void> {
        await this.client.send(
            new PutObjectCommand({ Bucket: config.AWS_BUCKET, Key: assertSafeKey(key), Body: body, ContentType: contentType, ServerSideEncryption: config.S3_ENDPOINT ? undefined : 'AES256' }),
        );
    }

    async get(key: string): Promise<Buffer> {
        const out = await this.client.send(new GetObjectCommand({ Bucket: config.AWS_BUCKET, Key: assertSafeKey(key) }));
        return Buffer.from(await out.Body!.transformToByteArray());
    }

    async delete(key: string): Promise<void> {
        await this.client.send(new DeleteObjectCommand({ Bucket: config.AWS_BUCKET, Key: assertSafeKey(key) }));
    }

    async exists(key: string): Promise<boolean> {
        try {
            await this.client.send(new GetObjectCommand({ Bucket: config.AWS_BUCKET, Key: assertSafeKey(key), Range: 'bytes=0-0' }));
            return true;
        } catch {
            return false;
        }
    }

    signedUrl(key: string, opts: SignOptions = {}): Promise<string> {
        const command = new GetObjectCommand({
            Bucket: config.AWS_BUCKET,
            Key: assertSafeKey(key),
            ResponseContentDisposition: opts.downloadName ? `attachment; filename="${safeName(opts.downloadName)}"` : undefined,
            ResponseCacheControl: 'private, max-age=300',
        });
        return getSignedUrl(this.client, command, { expiresIn: opts.ttlSeconds ?? config.SIGNED_URL_TTL_SECONDS });
    }
}

export const storage: StorageDriver = config.STORAGE_DRIVER === 's3' ? new S3Storage() : new LocalStorage();
export const localStorageDriver = storage instanceof LocalStorage ? storage : null;

/** Sign a list of keys at once, preserving nulls. */
export async function signMany<T extends Record<string, unknown>>(rows: T[], fields: (keyof T)[], ttlSeconds?: number): Promise<T[]> {
    return Promise.all(
        rows.map(async (row) => {
            const out: Record<string, unknown> = { ...row };
            for (const f of fields) {
                const key = row[f];
                out[`${String(f).replace(/_key$/, '')}_url`] = typeof key === 'string' && key ? await storage.signedUrl(key, { ttlSeconds }) : null;
                delete out[f as string];
            }
            return out as T;
        }),
    );
}

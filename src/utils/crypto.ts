import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, randomInt, randomUUID, timingSafeEqual } from 'node:crypto';
import { config } from '../config/env.js';

export const sha256 = (value: string | Buffer): string => createHash('sha256').update(value).digest('hex');

export const hmacHex = (secret: string, value: string): string => createHmac('sha256', secret).update(value).digest('hex');

export function safeEqual(a: string, b: string): boolean {
    const ab = Buffer.from(a);
    const bb = Buffer.from(b);
    return ab.length === bb.length && timingSafeEqual(ab, bb);
}

/** URL-safe random token (default 32 bytes = 256 bits). */
export const randomToken = (bytes = 32): string => randomBytes(bytes).toString('base64url');

export const uuid = (): string => randomUUID();

export const numericCode = (digits = 6): string => String(randomInt(0, 10 ** digits)).padStart(digits, '0');

const encKey = () => createHash('sha256').update(`enc:${config.APP_SECRET}`).digest();

/** AES-256-GCM encrypt a short secret (used to re-display QR tokens without storing them in plain text). */
export function encrypt(plain: string): string {
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', encKey(), iv);
    const data = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return [iv, tag, data].map((b) => b.toString('base64url')).join('.');
}

export function decrypt(payload: string): string {
    const [iv, tag, data] = payload.split('.').map((p) => Buffer.from(p, 'base64url'));
    const decipher = createDecipheriv('aes-256-gcm', encKey(), iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8');
}

// Developer by: Buildnexdev.in
// Devevloper : Nandhakumar@gmail.com
// Last Edited : 06-10-2026
import sharp from 'sharp';
import exifReader from 'exif-reader';

export const ACCEPTED_FORMATS = ['jpeg', 'png', 'webp', 'heif', 'tiff'] as const;
export const ACCEPTED_MIME = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif', 'image/tiff'];

export interface ImageInfo {
    format: string;
    width: number;
    height: number;
    mime: string;
    exif: ExifSummary;
}

export interface ExifSummary {
    takenAt: Date | null;
    make: string | null;
    model: string | null;
    lens: string | null;
    iso: number | null;
    exposure: string | null;
    aperture: string | null;
    focalLength: string | null;
}

const FORMAT_MIME: Record<string, string> = { jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', heif: 'image/heic', tiff: 'image/tiff' };

function readExif(buf?: Buffer): ExifSummary {
    const empty: ExifSummary = { takenAt: null, make: null, model: null, lens: null, iso: null, exposure: null, aperture: null, focalLength: null };
    if (!buf) return empty;
    try {
        const e = exifReader(buf) as any;
        const photo = e.Photo ?? e.exif ?? {};
        const image = e.Image ?? e.image ?? {};
        const exposure = photo.ExposureTime;
        const takenAt = photo.DateTimeOriginal instanceof Date ? photo.DateTimeOriginal : null;
        return {
            takenAt: takenAt && !Number.isNaN(takenAt.getTime()) ? takenAt : null,
            make: image.Make ? String(image.Make).trim().slice(0, 80) : null,
            model: image.Model ? String(image.Model).trim().slice(0, 120) : null,
            lens: photo.LensModel ? String(photo.LensModel).trim().slice(0, 120) : null,
            iso: typeof photo.ISOSpeedRatings === 'number' ? photo.ISOSpeedRatings : Array.isArray(photo.ISOSpeedRatings) ? photo.ISOSpeedRatings[0] : null,
            exposure: typeof exposure === 'number' ? (exposure < 1 ? `1/${Math.round(1 / exposure)}` : `${exposure}s`) : null,
            aperture: typeof photo.FNumber === 'number' ? `f/${photo.FNumber}` : null,
            focalLength: typeof photo.FocalLength === 'number' ? `${photo.FocalLength}mm` : null,
        };
    } catch {
        return empty;
    }
}

/** Validate by decoding the actual bytes (not the client supplied mime type / extension). */
export async function inspectImage(input: Buffer): Promise<ImageInfo> {
    const meta = await sharp(input, { failOn: 'error' }).metadata();
    if (!meta.format || !(ACCEPTED_FORMATS as readonly string[]).includes(meta.format)) {
        throw new Error(`Unsupported image format${meta.format ? ` (${meta.format})` : ''}. Use JPEG, PNG, WebP, HEIC or TIFF.`);
    }
    if (!meta.width || !meta.height) throw new Error('Could not read image dimensions.');
    if (meta.width * meta.height > 120_000_000) throw new Error('Image resolution is too large.');
    const rotated = (meta.orientation ?? 1) >= 5;
    return {
        format: meta.format,
        width: rotated ? meta.height : meta.width,
        height: rotated ? meta.width : meta.height,
        mime: FORMAT_MIME[meta.format] ?? 'application/octet-stream',
        exif: readExif(meta.exif),
    };
}

const escapeXml = (s: string) => s.replace(/[<>&"']/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&apos;' })[c]!);

export interface WatermarkBrand {
    /** Company / studio name shown on the mark. */
    name: string;
    /** Studio phone under the name (optional). */
    phone?: string | null;
}

function watermarkMetrics(width: number, height: number, hasPhone: boolean) {
    const nameSize = Math.max(16, Math.min(48, Math.round(width * 0.038)));
    const phoneSize = Math.max(12, Math.min(28, Math.round(width * 0.026)));
    const bottomPad = Math.max(14, Math.round(height * 0.03));
    const lineGap = Math.round(nameSize * 1.15);
    const textBlock = hasPhone ? nameSize + lineGap : nameSize;
    return { nameSize, phoneSize, bottomPad, lineGap, textBlock };
}

/**
 * Bottom-centre brand: company name + phone (logo composited separately above).
 */
function watermarkSvg(width: number, height: number, brand: WatermarkBrand): Buffer {
    const name = escapeXml((brand.name || 'STUDIO').trim() || 'STUDIO');
    const phoneRaw = (brand.phone || '').trim();
    const phone = phoneRaw ? escapeXml(phoneRaw) : '';
    const { nameSize, phoneSize, bottomPad, lineGap } = watermarkMetrics(width, height, !!phone);
    const phoneY = height - bottomPad;
    const nameY = phone ? phoneY - lineGap : phoneY;
    const dual = (y: number, size: number, label: string) => `
  <text x="50%" y="${y}" text-anchor="middle" dominant-baseline="alphabetic"
        font-family="Georgia, 'Times New Roman', Times, serif" font-size="${size}" font-weight="700"
        fill="#000000" fill-opacity="0.35">${label}</text>
  <text x="50%" y="${y - 1}" text-anchor="middle" dominant-baseline="alphabetic"
        font-family="Georgia, 'Times New Roman', Times, serif" font-size="${size}" font-weight="700"
        fill="#ffffff" fill-opacity="0.9">${label}</text>`;
    return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
${dual(nameY, nameSize, name)}
${phone ? dual(phoneY, phoneSize, phone) : ''}
</svg>`);
}

/** Studio logo sits bottom-centre above the name / phone lines. */
async function prepareLogo(
    width: number,
    height: number,
    logo: Buffer,
    textBlock: number,
): Promise<{ input: Buffer; left: number; top: number }> {
    const maxW = Math.max(56, Math.round(width * 0.14));
    const resized = await sharp(logo)
        .resize({ width: maxW, height: Math.round(maxW * 0.75), fit: 'inside', withoutEnlargement: true })
        .ensureAlpha()
        .raw()
        .toBuffer({ resolveWithObject: true });
    const data = Buffer.from(resized.data);
    for (let i = 3; i < data.length; i += 4) data[i] = Math.round(data[i] * 0.8);
    const input = await sharp(data, { raw: { width: resized.info.width, height: resized.info.height, channels: 4 } }).png().toBuffer();
    const bottomPad = Math.max(14, Math.round(height * 0.03));
    const gap = Math.max(6, Math.round(height * 0.01));
    return {
        input,
        left: Math.max(0, Math.round((width - resized.info.width) / 2)),
        top: Math.max(0, height - bottomPad - textBlock - gap - resized.info.height),
    };
}

async function renderVariant(
    input: Buffer,
    size: number,
    brand: WatermarkBrand | null,
    logo: Buffer | null,
    quality: number,
): Promise<Buffer> {
    const resized = await sharp(input).rotate().resize({ width: size, height: size, fit: 'inside', withoutEnlargement: true }).toBuffer({ resolveWithObject: true });
    let pipeline = sharp(resized.data);
    const layers: { input: Buffer; top?: number; left?: number }[] = [];
    if (brand) {
        const hasPhone = !!(brand.phone || '').trim();
        const { textBlock } = watermarkMetrics(resized.info.width, resized.info.height, hasPhone);
        layers.push({ input: watermarkSvg(resized.info.width, resized.info.height, brand), top: 0, left: 0 });
        if (logo) layers.push(await prepareLogo(resized.info.width, resized.info.height, logo, textBlock));
    } else if (logo) {
        layers.push(await prepareLogo(resized.info.width, resized.info.height, logo, 0));
    }
    if (layers.length) pipeline = pipeline.composite(layers);
    // Previews never carry EXIF/GPS data (sharp strips metadata unless withMetadata() is called)
    return pipeline.jpeg({ quality, mozjpeg: true, progressive: true }).toBuffer();
}

export interface Variants {
    preview: Buffer;
    thumb: Buffer;
}

export async function makeVariants(
    input: Buffer,
    opts: {
        watermark: string | null;
        watermarkPhone?: string | null;
        watermarkLogo?: Buffer | null;
        previewSize: number;
        thumbSize: number;
    },
): Promise<Variants> {
    const logo = opts.watermarkLogo ?? null;
    const brand: WatermarkBrand | null = opts.watermark
        ? { name: opts.watermark, phone: opts.watermarkPhone ?? null }
        : null;
    const [preview, thumb] = await Promise.all([
        renderVariant(input, opts.previewSize, brand, logo, 78),
        renderVariant(input, opts.thumbSize, brand, logo, 72),
    ]);
    return { preview, thumb };
}

/** Plain (un-watermarked) resized JPEG, used for edited deliverables and proof pages. */
export async function normalizeJpeg(input: Buffer, maxSize = 4000, quality = 90): Promise<Buffer> {
    return sharp(input).rotate().resize({ width: maxSize, height: maxSize, fit: 'inside', withoutEnlargement: true }).jpeg({ quality, mozjpeg: true }).toBuffer();
}

/** 64-bit difference hash for near-duplicate detection. */
export async function dHash(input: Buffer): Promise<string> {
    const { data } = await sharp(input).rotate().greyscale().resize(9, 8, { fit: 'fill' }).raw().toBuffer({ resolveWithObject: true });
    let bits = '';
    for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) bits += data[y * 9 + x] > data[y * 9 + x + 1] ? '1' : '0';
    return BigInt(`0b${bits}`).toString(16).padStart(16, '0');
}

export function hamming(a: string, b: string): number {
    let x = BigInt(`0x${a}`) ^ BigInt(`0x${b}`);
    let n = 0;
    while (x) {
        n += Number(x & 1n);
        x >>= 1n;
    }
    return n;
}

/** Sharpness score: standard deviation of the Laplacian (low = likely blurry). */
export async function blurScore(input: Buffer): Promise<number> {
    const stats = await sharp(input)
        .rotate()
        .greyscale()
        .resize(640, 640, { fit: 'inside' })
        .convolve({ width: 3, height: 3, kernel: [0, 1, 0, 1, -4, 1, 0, 1, 0], offset: 128 })
        .stats();
    const sd = stats.channels[0]?.stdev ?? 0;
    return Math.round(sd * sd * 100) / 100;
}

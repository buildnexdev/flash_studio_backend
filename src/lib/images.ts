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

/** Diagonal repeating watermark tile plus a centred label, rendered as SVG and composited by sharp. */
function watermarkSvg(width: number, height: number, text: string): Buffer {
    const label = escapeXml(text);
    const tileW = Math.max(260, Math.round(width / 3.2));
    const tileH = Math.round(tileW * 0.55);
    const fontSize = Math.max(16, Math.round(tileW / 11));
    const bigSize = Math.max(28, Math.round(width / 16));
    return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
  <defs>
    <pattern id="wm" width="${tileW}" height="${tileH}" patternUnits="userSpaceOnUse" patternTransform="rotate(-30)">
      <text x="0" y="${Math.round(tileH / 2)}" font-family="Arial, Helvetica, sans-serif" font-size="${fontSize}" font-weight="700"
            fill="#ffffff" fill-opacity="0.32" stroke="#000000" stroke-opacity="0.18" stroke-width="1">${label}</text>
    </pattern>
  </defs>
  <rect width="100%" height="100%" fill="url(#wm)"/>
  <text x="50%" y="50%" text-anchor="middle" dominant-baseline="middle" font-family="Arial, Helvetica, sans-serif"
        font-size="${bigSize}" font-weight="800" fill="#ffffff" fill-opacity="0.45" stroke="#000000" stroke-opacity="0.25" stroke-width="2">${label}</text>
  <text x="50%" y="${height - Math.round(bigSize * 0.6)}" text-anchor="middle" font-family="Arial, Helvetica, sans-serif"
        font-size="${Math.round(bigSize / 2.4)}" fill="#ffffff" fill-opacity="0.7">PREVIEW - purchase to download HD</text>
</svg>`);
}

async function prepareLogo(width: number, height: number, logo: Buffer): Promise<{ input: Buffer; left: number; top: number }> {
    const maxW = Math.max(72, Math.round(width * 0.2));
    const resized = await sharp(logo)
        .resize({ width: maxW, height: Math.round(maxW * 0.75), fit: 'inside', withoutEnlargement: true })
        .ensureAlpha()
        .raw()
        .toBuffer({ resolveWithObject: true });
    const data = Buffer.from(resized.data);
    for (let i = 3; i < data.length; i += 4) data[i] = Math.round(data[i] * 0.62);
    const input = await sharp(data, { raw: { width: resized.info.width, height: resized.info.height, channels: 4 } }).png().toBuffer();
    const pad = Math.max(10, Math.round(width * 0.028));
    return {
        input,
        left: Math.max(0, width - resized.info.width - pad),
        top: Math.max(0, height - resized.info.height - pad),
    };
}

async function renderVariant(input: Buffer, size: number, watermark: string | null, logo: Buffer | null, quality: number): Promise<Buffer> {
    const resized = await sharp(input).rotate().resize({ width: size, height: size, fit: 'inside', withoutEnlargement: true }).toBuffer({ resolveWithObject: true });
    let pipeline = sharp(resized.data);
    const layers: { input: Buffer; top?: number; left?: number }[] = [];
    if (watermark) layers.push({ input: watermarkSvg(resized.info.width, resized.info.height, watermark), top: 0, left: 0 });
    if (logo) layers.push(await prepareLogo(resized.info.width, resized.info.height, logo));
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
    opts: { watermark: string | null; watermarkLogo?: Buffer | null; previewSize: number; thumbSize: number },
): Promise<Variants> {
    const logo = opts.watermarkLogo ?? null;
    const [preview, thumb] = await Promise.all([
        renderVariant(input, opts.previewSize, opts.watermark, logo, 78),
        renderVariant(input, opts.thumbSize, opts.watermark, logo, 72),
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

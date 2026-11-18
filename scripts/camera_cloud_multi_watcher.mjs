// Buildnex Studio - Multi-Company Cloud Camera Auto-Sync (Pure AWS S3 Cloud Storage)
// Developer: Buildnexdev.in
// Dynamically creates company folders (e.g. FTPImages/companyid<ID>/<EventTitle>/...) in AWS S3
// Scales automatically to unlimited companies without code changes.

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import mysql from 'mysql2/promise';
import sharp from 'sharp';
import dotenv from 'dotenv';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

dotenv.config();

const BASE_WATCH_DIR = process.env.LIVE_SHOOTS_DIR || '/var/www/live_shoots';

// Storage directories (used only as fallback if S3 is not configured)
const LOCAL_STORAGE_ROOT = path.resolve(process.env.LOCAL_STORAGE_DIR || './storage');

// AWS S3 Configuration
const s3Bucket = process.env.AWS_BUCKET || process.env.AWS_S3_BUCKET || process.env.S3_BUCKET || 'buildndexdev-bucket';
const s3Region = process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || 'ap-southeast-2';
const s3AccessKey = process.env.AWS_ACCESS_KEY || process.env.AWS_ACCESS_KEY_ID;
const s3SecretKey = process.env.AWS_SECRET_KEY || process.env.AWS_SECRET_ACCESS_KEY;
const s3Endpoint = process.env.S3_ENDPOINT;
const s3ForcePathStyle = process.env.S3_FORCE_PATH_STYLE === 'true';

const isS3Enabled = Boolean(s3Bucket && s3AccessKey && s3SecretKey);
let s3Client = null;

if (isS3Enabled) {
    s3Client = new S3Client({
        region: s3Region,
        endpoint: s3Endpoint || undefined,
        forcePathStyle: s3ForcePathStyle,
        credentials: {
            accessKeyId: s3AccessKey,
            secretAccessKey: s3SecretKey,
        },
    });
}

// Setup MySQL Pool
const pool = mysql.createPool({
    host: process.env.DB_HOST || '127.0.0.1',
    port: Number(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD ?? '',
    database: process.env.DB_NAME || 'photo_lab',
    waitForConnections: true,
    connectionLimit: 10,
    timezone: '+00:00',
});

function sha256(buf) {
    return crypto.createHash('sha256').update(buf).digest('hex');
}

function sanitizeForS3(str) {
    return (str || 'Event')
        .trim()
        .replace(/\s+/g, '_')
        .replace(/[^A-Za-z0-9._-]/g, '')
        .slice(0, 80);
}

// Dynamic Company Cache from Database (Refreshes every 30s)
let companyCache = [];
let lastCompanyFetch = 0;

async function getCompanies() {
    const now = Date.now();
    if (now - lastCompanyFetch < 30000 && companyCache.length > 0) {
        return companyCache;
    }
    try {
        const [rows] = await pool.query(
            'SELECT companyID, slug, name FROM tblCompany WHERE status = "ACTIVE"'
        );
        companyCache = rows;
        lastCompanyFetch = now;
    } catch (err) {
        console.error('[DB ERROR] Failed fetching companies:', err.message);
    }
    return companyCache;
}

// Dynamically resolve Company ID from FTP folder path (Supports unlimited companies!)
async function resolveCompanyFromPath(filePath) {
    const relative = path.relative(BASE_WATCH_DIR, filePath);
    const topFolder = relative.split(/[\\/]/)[0].toLowerCase().trim();

    // 1. Direct number check: e.g. /1/, /2/, /company_1/, /companyid2/, /company3/
    const numericMatch = topFolder.match(/^(?:company(?:_?id)?)?(\d+)$/i);
    if (numericMatch) {
        const id = parseInt(numericMatch[1], 10);
        return id;
    }

    // 2. Lookup company slug or name in database
    const companies = await getCompanies();
    for (const c of companies) {
        const slug = (c.slug || '').toLowerCase();
        const nameClean = (c.name || '').toLowerCase().replace(/[^a-z0-9]/g, '');
        const topClean = topFolder.replace(/[^a-z0-9]/g, '');

        if (slug === topFolder || topClean === nameClean || topFolder.includes(slug) || slug.includes(topFolder)) {
            return c.companyID;
        }
    }

    // 3. Substring match across path
    for (const c of companies) {
        const slug = (c.slug || '').toLowerCase();
        if (slug && relative.toLowerCase().includes(slug)) {
            return c.companyID;
        }
    }

    // Default to first available company if unmatched
    return companies[0]?.companyID || 1;
}

async function uploadToS3(key, buffer, contentType) {
    if (!s3Client || !s3Bucket) throw new Error('S3 client not initialized');
    await s3Client.send(
        new PutObjectCommand({
            Bucket: s3Bucket,
            Key: key,
            Body: buffer,
            ContentType: contentType,
        })
    );
}

// Quick check if file is ready without blocking other photos
async function isFileReadyAndNonZero(filePath) {
    try {
        if (!fs.existsSync(filePath)) return false;
        const initialStat = fs.statSync(filePath);
        if (initialStat.size === 0) {
            await new Promise((r) => setTimeout(r, 1200));
            if (!fs.existsSync(filePath)) return false;
            const secondStat = fs.statSync(filePath);
            return secondStat.size > 0;
        }

        const size1 = initialStat.size;
        await new Promise((r) => setTimeout(r, 500));
        if (!fs.existsSync(filePath)) return false;
        const size2 = fs.statSync(filePath).size;
        return size1 > 0 && size1 === size2;
    } catch {
        return false;
    }
}

async function processPhoto(filePath) {
    const filename = path.basename(filePath);
    if (!/\.(jpe?g|png|webp|heic)$/i.test(filename)) return;
    if (filename.startsWith('.') || filePath.includes('/processed/') || filePath.includes('\\processed\\')) return;

    // Dynamically find company ID
    const companyId = await resolveCompanyFromPath(filePath);

    // Fast check: is file ready & non-zero?
    const ready = await isFileReadyAndNonZero(filePath);
    if (!ready) {
        try {
            const stat = fs.statSync(filePath);
            if (stat.size === 0) {
                const ageSeconds = (Date.now() - stat.mtimeMs) / 1000;
                if (ageSeconds > 15) {
                    fs.unlinkSync(filePath);
                    console.log(`[CLEANUP] Deleted empty 0-byte file: ${filename}`);
                }
            }
        } catch {}
        return;
    }

    console.log(`\n[INGEST] Detected camera photo: ${filename} (Resolved to Company ID #${companyId})`);

    try {
        // 1. Find active event for this company
        let [eventRows] = await pool.query(
            `SELECT e.eventID, e.company_id, g.galleryID, e.title, e.status, c.slug AS company_slug, c.name AS company_name
             FROM tblEvent e
             JOIN tblGallery g ON g.event_id = e.eventID
             LEFT JOIN tblCompany c ON c.companyID = e.company_id
             WHERE e.company_id = ?
               AND e.status IN ('LIVE', 'UPLOADING', 'PROCESSING', 'UPCOMING')
               AND e.deleted_at IS NULL
             ORDER BY (e.status = 'LIVE') DESC, e.event_date DESC, e.eventID DESC
             LIMIT 1`,
            [companyId]
        );

        // Fallback: If no event under this company, find any active 'LIVE' event across the system
        if (!eventRows.length) {
            console.log(`[INGEST] No active event for Company #${companyId}. Falling back to any LIVE event...`);
            [eventRows] = await pool.query(
                `SELECT e.eventID, e.company_id, g.galleryID, e.title, e.status, c.slug AS company_slug, c.name AS company_name
                 FROM tblEvent e
                 JOIN tblGallery g ON g.event_id = e.eventID
                 LEFT JOIN tblCompany c ON c.companyID = e.company_id
                 WHERE e.status = 'LIVE'
                   AND e.deleted_at IS NULL
                 ORDER BY e.event_date DESC, e.eventID DESC
                 LIMIT 1`
            );
        }

        if (!eventRows.length) {
            console.warn(`[INGEST] No active events found in database! Please create an event in the admin portal.`);
            return;
        }

        const event = eventRows[0];
        const eventId = event.eventID;
        const galleryId = event.galleryID;
        const targetCompanyId = event.company_id;
        const safeEventTitle = sanitizeForS3(event.title);

        // 2. Read image buffer & verify integrity
        const rawBuffer = fs.readFileSync(filePath);
        if (rawBuffer.length === 0) return;

        const checksum = sha256(rawBuffer);

        const [dupRows] = await pool.query(
            `SELECT photoID FROM tblPhoto WHERE event_id = ? AND checksum = ? AND deleted_at IS NULL`,
            [eventId, checksum]
        );

        if (dupRows.length) {
            console.log(`[INGEST] Duplicate photo skipped (Photo ID: ${dupRows[0].photoID})`);
            try { fs.unlinkSync(filePath); } catch {}
            return;
        }

        // 3. Inspect image and prepare paths (Dynamic FTPImages/companyid<ID>/<EventTitle>/...)
        const image = sharp(rawBuffer);
        const meta = await image.metadata();
        const width = meta.width || 1920;
        const height = meta.height || 1080;
        const uuid = crypto.randomUUID();

        // Exact S3 key hierarchy requested:
        // FTPImages/companyid<companyId>/<eventTitle>/originals/...
        const companyFolder = `companyid${targetCompanyId}`;
        const s3Prefix = `FTPImages/${companyFolder}/${safeEventTitle}`;

        const origKey = `${s3Prefix}/originals/${uuid}.jpg`;
        const thumbKey = `${s3Prefix}/thumbs/${uuid}.webp`;
        const prevKey = `${s3Prefix}/previews/${uuid}.webp`;

        // Generate thumb & preview directly in RAM
        const thumbBuffer = await sharp(rawBuffer)
            .rotate()
            .resize({ width: 400, height: 400, fit: 'inside', withoutEnlargement: true })
            .webp({ quality: 80 })
            .toBuffer();

        const prevBuffer = await sharp(rawBuffer)
            .rotate()
            .resize({ width: 1600, height: 1600, fit: 'inside', withoutEnlargement: true })
            .webp({ quality: 85 })
            .toBuffer();

        if (isS3Enabled) {
            // ========================================================
            // PURE S3 MODE: Zero Server Disk Usage!
            // ========================================================
            console.log(`[S3 UPLOAD] Uploading directly to s3://${s3Bucket}/${s3Prefix}/...`);
            await Promise.all([
                uploadToS3(origKey, rawBuffer, 'image/jpeg'),
                uploadToS3(thumbKey, thumbBuffer, 'image/webp'),
                uploadToS3(prevKey, prevBuffer, 'image/webp'),
            ]);
            console.log(`\x1b[36m☁ [S3 CLOUD] Saved to: s3://${s3Bucket}/${s3Prefix}/\x1b[0m`);

            // Delete original file from server disk immediately
            try {
                fs.unlinkSync(filePath);
                console.log(`[SERVER CLEAN] Deleted local temporary file ${filename}. Server disk usage: 0 bytes.`);
            } catch {}
        } else {
            // Local fallback only if AWS S3 credentials are not yet entered
            const absOrig = path.join(LOCAL_STORAGE_ROOT, ...origKey.split('/'));
            const absThumb = path.join(LOCAL_STORAGE_ROOT, ...thumbKey.split('/'));
            const absPrev = path.join(LOCAL_STORAGE_ROOT, ...prevKey.split('/'));

            fs.mkdirSync(path.dirname(absOrig), { recursive: true });
            fs.mkdirSync(path.dirname(absThumb), { recursive: true });
            fs.mkdirSync(path.dirname(absPrev), { recursive: true });

            fs.writeFileSync(absOrig, rawBuffer);
            fs.writeFileSync(absThumb, thumbBuffer);
            fs.writeFileSync(absPrev, prevBuffer);

            const processedDir = path.join(path.dirname(filePath), 'processed');
            if (!fs.existsSync(processedDir)) fs.mkdirSync(processedDir, { recursive: true });
            fs.renameSync(filePath, path.join(processedDir, filename));
        }

        // 4. Insert into tblPhoto (pointing to S3 keys)
        const [insertRes] = await pool.query(
            `INSERT INTO tblPhoto (
                company_id, event_id, gallery_id, camera_label, file_name, 
                mime_type, size_bytes, checksum, width, height, 
                original_key, thumb_key, preview_key, is_published, status
            ) VALUES (?, ?, ?, 'Live Camera', ?, 'image/jpeg', ?, ?, ?, ?, ?, ?, ?, 1, 'READY')`,
            [
                targetCompanyId, eventId, galleryId, filename.slice(0, 255),
                rawBuffer.length, checksum, width, height,
                origKey, thumbKey, prevKey
            ]
        );

        const storageLocation = isS3Enabled ? `AWS S3 (s3://${s3Bucket}/${s3Prefix}/)` : 'Local Disk';
        console.log(`\x1b[32m✔ [LIVE ON QR] Photo #${insertRes.insertId} (${filename}) -> Event "${event.title}" -> Storage: [${storageLocation}] -> PUBLISHED TO QR & WEBSITE!\x1b[0m`);
    } catch (err) {
        console.error(`[ERROR] Processing failed for ${filename}:`, err);
    }
}

// Recursively find and process all image files
async function scanDirectory(dir) {
    if (!fs.existsSync(dir)) return;
    try {
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        for (const entry of entries) {
            const fullPath = path.join(dir, entry.name);
            if (entry.isDirectory()) {
                if (entry.name !== 'processed') {
                    await scanDirectory(fullPath);
                }
            } else if (entry.isFile()) {
                await processPhoto(fullPath);
            }
        }
    } catch (err) {
        console.error(`[SCAN ERROR] at ${dir}:`, err);
    }
}

console.log('\x1b[32m================================================================\x1b[0m');
console.log('\x1b[1m\x1b[36m   ⚡ BUILDNEX STUDIO - DYNAMIC S3 LIVE CAMERA SYNC ⚡   \x1b[0m');
console.log('\x1b[32m================================================================\x1b[0m');
console.log(`Watching Root   : \x1b[33m${BASE_WATCH_DIR}\x1b[0m`);
console.log(`S3 Bucket       : \x1b[35m${s3Bucket} (${s3Region})\x1b[0m`);
console.log(`Folder Structure: \x1b[36mFTPImages/companyid<ID>/<EventTitle>/...\x1b[0m`);
console.log(`Storage Status  : \x1b[32m${isS3Enabled ? 'Pure AWS S3 Cloud (Zero Server Disk Usage)' : 'Local Fallback (Set AWS credentials in .env)'}\x1b[0m\n`);

async function startPolling() {
    await scanDirectory(BASE_WATCH_DIR);
    setTimeout(startPolling, 2500);
}

startPolling();
console.log('✔ Polling active (checking every 2.5s). Photos arriving via FTP publish to QR & website automatically!\n');

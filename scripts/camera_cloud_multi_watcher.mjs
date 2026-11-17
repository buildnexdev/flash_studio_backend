// Buildnex Studio - Multi-Company Cloud Camera Auto-Sync
// Developer: Buildnexdev.in
// Ingests photos from /var/www/live_shoots/<company>/ into the company's active event & QR gallery

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import mysql from 'mysql2/promise';
import sharp from 'sharp';
import dotenv from 'dotenv';

dotenv.config();

const BASE_WATCH_DIR = process.env.LIVE_SHOOTS_DIR || '/var/www/live_shoots';

// Storage directories: backend serves from ./storage by default, mirror to ./uploads as well
const STORAGE_ROOT = path.resolve(process.env.LOCAL_STORAGE_DIR || './storage');
const FALLBACK_STORAGE_ROOT = path.resolve('./uploads');

// Company folder mappings (folder name -> companyID)
// Supports /flash/ -> 1, /waas/ -> 2, /wass/ -> 2
const COMPANY_MAP = {
    flash: 1,
    flashlight: 1,
    waas: 2,
    wass: 2,
};

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

// Quick check if file is ready without blocking other photos
async function isFileReadyAndNonZero(filePath) {
    try {
        if (!fs.existsSync(filePath)) return false;
        const initialStat = fs.statSync(filePath);
        if (initialStat.size === 0) {
            // Wait 1.5 seconds once to see if camera is just beginning to write
            await new Promise((r) => setTimeout(r, 1500));
            if (!fs.existsSync(filePath)) return false;
            const secondStat = fs.statSync(filePath);
            return secondStat.size > 0;
        }

        // Has size, verify it's finished writing (size stable for 600ms)
        const size1 = initialStat.size;
        await new Promise((r) => setTimeout(r, 600));
        if (!fs.existsSync(filePath)) return false;
        const size2 = fs.statSync(filePath).size;
        return size1 > 0 && size1 === size2;
    } catch {
        return false;
    }
}

// Find companyID from folder path
function getCompanyIdFromPath(filePath) {
    const relative = path.relative(BASE_WATCH_DIR, filePath).toLowerCase();
    const segments = relative.split(/[\\/]/);
    const topFolder = segments[0];

    if (COMPANY_MAP[topFolder]) return COMPANY_MAP[topFolder];

    // Fallback keyword checks
    if (relative.includes('waas') || relative.includes('wass')) return 2;
    if (relative.includes('flash')) return 1;

    return 1; // default company
}

async function processPhoto(filePath) {
    const filename = path.basename(filePath);
    if (!/\.(jpe?g|png|webp|heic)$/i.test(filename)) return;
    if (filename.startsWith('.') || filePath.includes('/processed/') || filePath.includes('\\processed\\')) return;

    const companyId = getCompanyIdFromPath(filePath);

    // Fast check: is file ready & non-zero?
    const ready = await isFileReadyAndNonZero(filePath);
    if (!ready) {
        // Check if 0 byte; if older than 30s, move to processed to avoid clogging
        try {
            const stat = fs.statSync(filePath);
            if (stat.size === 0) {
                const ageSeconds = (Date.now() - stat.mtimeMs) / 1000;
                if (ageSeconds > 15) {
                    const dir = path.dirname(filePath);
                    const zeroDir = path.join(dir, 'processed', 'zero_bytes');
                    if (!fs.existsSync(zeroDir)) fs.mkdirSync(zeroDir, { recursive: true });
                    fs.renameSync(filePath, path.join(zeroDir, filename));
                    console.log(`[CLEANUP] Moved empty 0-byte file ${filename} to ${zeroDir}`);
                }
            }
        } catch {}
        return;
    }

    console.log(`\n[INGEST] Detected photo: ${filename} (Company #${companyId}) from ${filePath}`);

    try {
        // 1. Find active event for this company
        let [eventRows] = await pool.query(
            `SELECT e.eventID, e.company_id, g.galleryID, e.title, e.status
             FROM tblEvent e
             JOIN tblGallery g ON g.event_id = e.eventID
             WHERE e.company_id = ?
               AND e.status IN ('LIVE', 'UPLOADING', 'PROCESSING', 'UPCOMING')
               AND e.deleted_at IS NULL
             ORDER BY (e.status = 'LIVE') DESC, e.event_date DESC, e.eventID DESC
             LIMIT 1`,
            [companyId]
        );

        // Fallback 1: If no event under this company, find any active 'LIVE' event across the whole system
        if (!eventRows.length) {
            console.log(`[INGEST] No active event found for Company #${companyId}. Falling back to any LIVE event...`);
            [eventRows] = await pool.query(
                `SELECT e.eventID, e.company_id, g.galleryID, e.title, e.status
                 FROM tblEvent e
                 JOIN tblGallery g ON g.event_id = e.eventID
                 WHERE e.status = 'LIVE'
                   AND e.deleted_at IS NULL
                 ORDER BY e.event_date DESC, e.eventID DESC
                 LIMIT 1`
            );
        }

        // Fallback 2: Any recent event
        if (!eventRows.length) {
            [eventRows] = await pool.query(
                `SELECT e.eventID, e.company_id, g.galleryID, e.title, e.status
                 FROM tblEvent e
                 JOIN tblGallery g ON g.event_id = e.eventID
                 WHERE e.deleted_at IS NULL
                 ORDER BY (e.status = 'LIVE') DESC, (e.status = 'UPCOMING') DESC, e.eventID DESC
                 LIMIT 1`
            );
        }

        if (!eventRows.length) {
            console.warn(`[INGEST] No events found in database! Please create an event in the admin portal.`);
            return;
        }

        const event = eventRows[0];
        const eventId = event.eventID;
        const galleryId = event.galleryID;
        const targetCompanyId = event.company_id;

        // 2. Read image buffer & verify integrity
        const rawBuffer = fs.readFileSync(filePath);
        if (rawBuffer.length === 0) return;

        const checksum = sha256(rawBuffer);

        const [dupRows] = await pool.query(
            `SELECT photoID FROM tblPhoto WHERE event_id = ? AND checksum = ? AND deleted_at IS NULL`,
            [eventId, checksum]
        );

        const dir = path.dirname(filePath);
        const processedDir = path.join(dir, 'processed');
        if (!fs.existsSync(processedDir)) fs.mkdirSync(processedDir, { recursive: true });

        if (dupRows.length) {
            console.log(`[INGEST] Duplicate photo skipped (Photo ID: ${dupRows[0].photoID})`);
            fs.renameSync(filePath, path.join(processedDir, `${Date.now()}_${filename}`));
            return;
        }

        // 3. Inspect image and prepare storage paths
        const image = sharp(rawBuffer);
        const meta = await image.metadata();
        const width = meta.width || 1920;
        const height = meta.height || 1080;
        const uuid = crypto.randomUUID();

        const origKey = `events/${eventId}/originals/${uuid}.jpg`;
        const thumbKey = `events/${eventId}/thumbs/${uuid}.webp`;
        const prevKey = `events/${eventId}/previews/${uuid}.webp`;

        // Generate files in memory first
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

        // Helper to save to a storage target directory
        const saveToStorageDir = (root) => {
            try {
                const absOrig = path.join(root, ...origKey.split('/'));
                const absThumb = path.join(root, ...thumbKey.split('/'));
                const absPrev = path.join(root, ...prevKey.split('/'));

                fs.mkdirSync(path.dirname(absOrig), { recursive: true });
                fs.mkdirSync(path.dirname(absThumb), { recursive: true });
                fs.mkdirSync(path.dirname(absPrev), { recursive: true });

                fs.writeFileSync(absOrig, rawBuffer);
                fs.writeFileSync(absThumb, thumbBuffer);
                fs.writeFileSync(absPrev, prevBuffer);
            } catch (err) {
                console.error(`[STORAGE WRITE ERROR] Failed writing to ${root}:`, err.message);
            }
        };

        // Write to primary (./storage) and fallback (./uploads)
        saveToStorageDir(STORAGE_ROOT);
        saveToStorageDir(FALLBACK_STORAGE_ROOT);

        // 4. Insert into tblPhoto
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

        // 5. Move original to processed folder
        fs.renameSync(filePath, path.join(processedDir, `${insertRes.insertId}_${filename}`));

        console.log(`\x1b[32m✔ [LIVE ON QR] Photo #${insertRes.insertId} (${filename}) -> Linked to Event "${event.title}" (#${eventId}) Gallery #${galleryId} -> PUBLISHED!\x1b[0m`);
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
console.log('\x1b[1m\x1b[36m   ⚡ BUILDNEX STUDIO - MULTI-COMPANY LIVE CAMERA SYNC ⚡   \x1b[0m');
console.log('\x1b[32m================================================================\x1b[0m');
console.log(`Watching Root   : \x1b[33${BASE_WATCH_DIR}\x1b[0m`);
console.log(`Primary Storage : \x1b[33m${STORAGE_ROOT}\x1b[0m`);
console.log(`Backup Storage  : \x1b[33m${FALLBACK_STORAGE_ROOT}\x1b[0m\n`);

async function startPolling() {
    await scanDirectory(BASE_WATCH_DIR);
    setTimeout(startPolling, 2500);
}

startPolling();
console.log('✔ Polling active (checking every 2.5s). Photos arriving via FTP publish to QR automatically!\n');

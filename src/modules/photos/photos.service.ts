// Developer by: Buildnexdev.in
// Devevloper : Nandhakumar@gmail.com
// Last Edited : 06-10-2026
import path from 'node:path';
import { config } from '../../config/env.js';
import { execute, query, queryOne } from '../../db/pool.js';
import { inspectImage, makeVariants, normalizeJpeg } from '../../lib/images.js';
import { JobQueue } from '../../lib/job-queue.js';
import { emitTo, rooms } from '../../lib/realtime.js';
import { storage } from '../../lib/storage.js';
import { hasPermission, type AuthUser } from '../../middleware/auth.js';
import { sha256, uuid } from '../../utils/crypto.js';
import { toSqlDateTime } from '../../utils/dates.js';
import { badRequest, conflict, forbidden, notFound } from '../../utils/errors.js';
import { likeTerm, offsetOf, paged } from '../../utils/pagination.js';
import { analyseForCulling, indexFaces, setTags, type PhotoCategory } from '../ai/ai.service.js';
import { audit, type AuditContext } from '../audit/audit.service.js';
import { assertEventAccess } from '../events/events.service.js';
import { scopeFilter, type GalleryAccess } from '../galleries/galleries.service.js';
import { notifyCustomer, notifyUser } from '../notifications/notifications.service.js';
import { entitledPhotoIds } from '../orders/entitlements.js';
import { getSetting } from '../settings/settings.service.js';

export const PHOTO_STATUSES = ['UPLOADED', 'PROCESSING', 'PREVIEW', 'SELECTED', 'EDITING', 'EDITED', 'APPROVED', 'DELIVERED'] as const;
export type PhotoStatus = (typeof PHOTO_STATUSES)[number];

const EXT: Record<string, string> = { jpeg: '.jpg', png: '.png', webp: '.webp', heif: '.heic', tiff: '.tif' };

/* ---------------- Processing queue ---------------- */

const lastNewPhotoNotice = new Map<number, number>();

async function processPhoto(photoId: number): Promise<void> {
    const p = await queryOne<{ id: number; event_id: number; gallery_id: number; original_key: string; edited_key: string | null; is_published: number; status: PhotoStatus }>(
        'SELECT id, event_id, gallery_id, original_key, edited_key, is_published, status FROM tblPhoto WHERE id = ? AND deleted_at IS NULL',
        [photoId],
    );
    if (!p) return;
    const g = await queryOne<{ watermark_enabled: number; auto_publish: number; status: string }>('SELECT watermark_enabled, auto_publish, status FROM tblGallery WHERE id = ?', [p.gallery_id]);
    const gs = await getSetting('gallery');
    const isFirstPass = p.status === 'UPLOADED' || p.status === 'PROCESSING';
    if (isFirstPass) await execute("UPDATE tblPhoto SET status = 'PROCESSING', processing_error = NULL WHERE id = ?", [photoId]);

    try {
        const source = await storage.get(p.edited_key ?? p.original_key);
        const variants = await makeVariants(source, { watermark: g?.watermark_enabled ? gs.watermarkText : null, previewSize: gs.previewSize, thumbSize: gs.thumbSize });
        const base = `events/${p.event_id}/previews/${uuid()}`;
        const previewKey = `${base}.jpg`;
        const thumbKey = `${base}_t.jpg`;
        await storage.put(previewKey, variants.preview, 'image/jpeg');
        await storage.put(thumbKey, variants.thumb, 'image/jpeg');

        const old = await queryOne<{ preview_key: string | null; thumb_key: string | null }>('SELECT preview_key, thumb_key FROM tblPhoto WHERE id = ?', [photoId]);
        const publish = isFirstPass ? (g?.auto_publish ? 1 : 0) : p.is_published;
        await execute(`UPDATE tblPhoto SET preview_key = ?, thumb_key = ?, is_published = ?${isFirstPass ? ", status = 'PREVIEW'" : ''}, processing_error = NULL WHERE id = ?`, [previewKey, thumbKey, publish, photoId]);
        for (const k of [old?.preview_key, old?.thumb_key]) if (k) await storage.delete(k).catch(() => undefined);

        if (isFirstPass) {
            const original = p.edited_key ? await storage.get(p.original_key) : source;
            await analyseForCulling(photoId, p.event_id, original).catch((err) => console.error('[ai] culling failed', photoId, err.message));
            indexFaces(photoId, p.event_id, original).catch((err) => console.error('[ai] face indexing failed', photoId, err.message));
        }

        const thumbUrl = await storage.signedUrl(thumbKey);
        emitTo(rooms.event(p.event_id), 'photo:processed', { photoId, eventId: p.event_id, thumbUrl });
        if (publish && isFirstPass) {
            emitTo(rooms.gallery(p.gallery_id), 'photo:new', { id: photoId, galleryId: p.gallery_id });
            await maybeNotifyNewPhotos(p.event_id);
        }
    } catch (err) {
        const message = (err as Error).message.slice(0, 250);
        await execute("UPDATE tblPhoto SET processing_error = ?, status = IF(status = 'PROCESSING', 'UPLOADED', status) WHERE id = ?", [message, photoId]);
        emitTo(rooms.event(p.event_id), 'photo:failed', { photoId, eventId: p.event_id, error: message });
        throw err;
    }
}

/** At most one "new photos" message per event every 15 minutes. */
async function maybeNotifyNewPhotos(eventId: number) {
    const last = lastNewPhotoNotice.get(eventId) ?? 0;
    if (Date.now() - last < 15 * 60_000) return;
    lastNewPhotoNotice.set(eventId, Date.now());
    const e = await queryOne<{ customer_id: number; title: string; status: string }>('SELECT customer_id, title, status FROM tblEvent WHERE id = ?', [eventId]);
    if (e && e.status !== 'UPCOMING') {
        await notifyCustomer(e.customer_id, { type: 'NEW_PHOTOS', title: 'New photos available', body: `New photos from ${e.title} are in your gallery.`, link: '/customer/galleries', external: false });
    }
}

export const photoQueue = new JobQueue<number>('photos', processPhoto, config.UPLOAD_CONCURRENCY, 3, (id) => String(id));

/** Re-queue photos left unprocessed by a restart. */
export async function recoverPendingPhotos(): Promise<number> {
    const rows = await query<{ id: number }>("SELECT id FROM tblPhoto WHERE deleted_at IS NULL AND (status IN ('UPLOADED','PROCESSING') OR preview_key IS NULL) ORDER BY id LIMIT 5000");
    rows.forEach((r) => photoQueue.enqueue(r.id));
    return rows.length;
}

/* ---------------- Upload ---------------- */

export interface UploadMeta {
    eventId: number;
    albumId?: number | null;
    cameraLabel?: string | null;
    clientUploadIds?: string[];
}

export interface UploadResult {
    fileName: string;
    ok: boolean;
    photoId?: number;
    duplicate?: boolean;
    error?: string;
    clientUploadId?: string | null;
}

export async function uploadPhotos(files: Express.Multer.File[], meta: UploadMeta, actor: AuthUser, ctx: AuditContext): Promise<UploadResult[]> {
    if (!files.length) throw badRequest('Choose at least one photo.', [{ field: 'files', message: 'Required' }]);
    await assertEventAccess(actor, meta.eventId, 'work');
    const event = await queryOne<{ id: number; status: string }>('SELECT id, status FROM tblEvent WHERE id = ? AND deleted_at IS NULL', [meta.eventId]);
    if (!event) throw notFound('Event');
    const isManager = hasPermission(actor, 'photos.manage', 'events.manage');
    if (event.status === 'CANCELLED') throw conflict('This event was cancelled.');
    if (!isManager && !['LIVE', 'UPLOADING', 'PROCESSING'].includes(event.status)) throw conflict('Start the event before uploading photos.');
    const gallery = await queryOne<{ id: number }>('SELECT id FROM tblGallery WHERE event_id = ? AND deleted_at IS NULL ORDER BY id LIMIT 1', [meta.eventId]);
    if (!gallery) throw conflict('This event has no gallery.');
    if (meta.albumId) {
        const album = await queryOne('SELECT id FROM tblAlbum WHERE id = ? AND gallery_id = ? AND deleted_at IS NULL', [meta.albumId, gallery.id]);
        if (!album) throw badRequest('Album not found for this event.', [{ field: 'albumId', message: 'Not found' }]);
    }

    const results: UploadResult[] = [];
    for (const [i, file] of files.entries()) {
        const clientUploadId = meta.clientUploadIds?.[i]?.slice(0, 64) || null;
        try {
            if (clientUploadId) {
                const existing = await queryOne<{ id: number }>('SELECT id FROM tblPhoto WHERE event_id = ? AND client_upload_id = ?', [meta.eventId, clientUploadId]);
                if (existing) {
                    results.push({ fileName: file.originalname, ok: true, photoId: existing.id, duplicate: true, clientUploadId });
                    continue;
                }
            }
            const info = await inspectImage(file.buffer).catch((err: Error) => {
                throw badRequest(err.message);
            });
            const checksum = sha256(file.buffer);
            const dup = await queryOne<{ id: number }>('SELECT id FROM tblPhoto WHERE event_id = ? AND checksum = ? AND deleted_at IS NULL', [meta.eventId, checksum]);
            if (dup) {
                results.push({ fileName: file.originalname, ok: true, photoId: dup.id, duplicate: true, clientUploadId });
                continue;
            }
            const key = `events/${meta.eventId}/originals/${uuid()}${EXT[info.format] ?? path.extname(file.originalname).toLowerCase()}`;
            await storage.put(key, file.buffer, info.mime);
            const res = await execute(
                `INSERT INTO tblPhoto (event_id, gallery_id, album_id, uploaded_by, client_upload_id, camera_label, file_name, mime_type, size_bytes, checksum, width, height, original_key)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [meta.eventId, gallery.id, meta.albumId ?? null, actor.id, clientUploadId, meta.cameraLabel ?? null, file.originalname.slice(0, 255), info.mime, file.size, checksum, info.width, info.height, key],
            );
            const e = info.exif;
            await execute(
                'INSERT INTO tblPhotoMetadata (photo_id, taken_at, camera_make, camera_model, lens, iso, exposure, aperture, focal_length) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
                [res.insertId, e.takenAt ? toSqlDateTime(e.takenAt) : null, e.make, e.model, e.lens, e.iso, e.exposure, e.aperture, e.focalLength],
            );
            photoQueue.enqueue(res.insertId);
            results.push({ fileName: file.originalname, ok: true, photoId: res.insertId, clientUploadId });
        } catch (err) {
            results.push({ fileName: file.originalname, ok: false, error: (err as Error).message, clientUploadId });
        }
    }
    const okCount = results.filter((r) => r.ok && !r.duplicate).length;
    if (okCount) {
        await audit(ctx, 'PHOTO_UPLOAD', 'photos', meta.eventId, { count: okCount, camera: meta.cameraLabel ?? null });
        emitTo(rooms.event(meta.eventId), 'photo:uploaded', { eventId: meta.eventId, count: okCount, by: actor.name });
    }
    return results;
}

/** Upload progress for the photographer dashboard. */
export async function uploadStatus(eventId: number) {
    const [counts, failed, recent, cameras] = await Promise.all([
        query('SELECT status, COUNT(*) AS n FROM tblPhoto WHERE event_id = ? AND deleted_at IS NULL GROUP BY status', [eventId]),
        query('SELECT id, file_name, processing_error, created_at FROM tblPhoto WHERE event_id = ? AND deleted_at IS NULL AND processing_error IS NOT NULL ORDER BY id DESC LIMIT 50', [eventId]),
        query('SELECT p.id, p.file_name, p.status, p.thumb_key, p.camera_label, p.created_at, u.name AS uploaded_by FROM tblPhoto p LEFT JOIN tblUser u ON u.id = p.uploaded_by WHERE p.event_id = ? AND p.deleted_at IS NULL ORDER BY p.id DESC LIMIT 24', [eventId]),
        query("SELECT COALESCE(camera_label, 'Unlabelled') AS camera, COUNT(*) AS n, MAX(created_at) AS last_upload FROM tblPhoto WHERE event_id = ? AND deleted_at IS NULL GROUP BY camera_label", [eventId]),
    ]);
    return {
        counts: Object.fromEntries(counts.map((c) => [c.status, c.n])),
        total: counts.reduce((s, c) => s + Number(c.n), 0),
        queue: photoQueue.size,
        failed,
        cameras,
        recent: await Promise.all(recent.map(async ({ thumb_key, ...r }) => ({ ...r, thumb_url: thumb_key ? await storage.signedUrl(thumb_key) : null }))),
    };
}

export async function retryProcessing(photoId: number, actor: AuthUser) {
    const p = await queryOne<{ event_id: number }>('SELECT event_id FROM tblPhoto WHERE id = ? AND deleted_at IS NULL', [photoId]);
    if (!p) throw notFound('Photo');
    await assertEventAccess(actor, p.event_id, 'work');
    await execute("UPDATE tblPhoto SET processing_error = NULL, status = IF(preview_key IS NULL, 'UPLOADED', status) WHERE id = ?", [photoId]);
    photoQueue.enqueue(photoId);
}

/* ---------------- Staff listing & management ---------------- */

export interface PhotoFilter {
    page: number;
    pageSize: number;
    eventId?: number;
    galleryId?: number;
    albumId?: number | 'none';
    status?: PhotoStatus;
    published?: boolean;
    rejected?: boolean;
    trash?: boolean;
    editorId?: number;
    search?: string;
    flag?: 'blurry' | 'duplicate' | 'eyes_closed';
    category?: PhotoCategory;
    selected?: boolean;
}

export async function listPhotos(f: PhotoFilter) {
    const where = [f.trash ? 'p.deleted_at IS NOT NULL' : 'p.deleted_at IS NULL'];
    const params: unknown[] = [];
    if (f.eventId) { where.push('p.event_id = ?'); params.push(f.eventId); }
    if (f.galleryId) { where.push('p.gallery_id = ?'); params.push(f.galleryId); }
    if (f.albumId === 'none') where.push('p.album_id IS NULL');
    else if (f.albumId) { where.push('p.album_id = ?'); params.push(f.albumId); }
    if (f.status) { where.push('p.status = ?'); params.push(f.status); }
    if (f.published !== undefined) { where.push('p.is_published = ?'); params.push(f.published ? 1 : 0); }
    if (f.rejected !== undefined) { where.push('p.is_rejected = ?'); params.push(f.rejected ? 1 : 0); }
    if (f.editorId) { where.push('p.editor_id = ?'); params.push(f.editorId); }
    if (f.search) { where.push('p.file_name LIKE ?'); params.push(likeTerm(f.search)); }
    if (f.flag === 'blurry') where.push('m.is_blurry = 1');
    if (f.flag === 'duplicate') where.push('m.duplicate_of IS NOT NULL');
    if (f.flag === 'eyes_closed') where.push('m.eyes_closed = 1');
    if (f.category) { where.push('m.category = ?'); params.push(f.category); }
    if (f.selected) where.push('EXISTS (SELECT 1 FROM tblPhotoSelection s WHERE s.photo_id = p.id)');
    const w = where.join(' AND ');
    const from = 'FROM tblPhoto p LEFT JOIN tblPhotoMetadata m ON m.photo_id = p.id';
    const total = (await queryOne<{ n: number }>(`SELECT COUNT(*) AS n ${from} WHERE ${w}`, params))?.n ?? 0;
    const rows = await query(
        `SELECT p.id, p.event_id, p.gallery_id, p.album_id, p.file_name, p.width, p.height, p.size_bytes, p.status, p.is_published, p.is_rejected, p.processing_error,
                p.camera_label, p.editor_id, p.thumb_key, p.edited_key IS NOT NULL AS has_edit, p.created_at, p.deleted_at,
                m.blur_score, m.is_blurry, m.duplicate_of, m.eyes_closed, m.faces_count, m.category, m.tags,
                (SELECT COUNT(*) FROM tblPhotoSelection s WHERE s.photo_id = p.id) AS selected_count,
                (SELECT COUNT(*) FROM tblPhotoFavourite f WHERE f.photo_id = p.id) AS favourite_count,
                (SELECT COUNT(*) FROM tblPhotoComment c WHERE c.photo_id = p.id AND c.deleted_at IS NULL) AS comment_count
           ${from} WHERE ${w} ORDER BY p.sort_order, p.id DESC LIMIT ? OFFSET ?`,
        [...params, f.pageSize, offsetOf(f)],
    );
    const items = await Promise.all(rows.map(async ({ thumb_key, ...r }) => ({ ...r, thumb_url: thumb_key ? await storage.signedUrl(thumb_key) : null })));
    return paged(items, total, f);
}

export async function getPhotoForStaff(id: number, actor: AuthUser) {
    const p = await queryOne(
        `SELECT p.*, m.taken_at, m.camera_make, m.camera_model, m.lens, m.iso, m.exposure, m.aperture, m.focal_length, m.blur_score, m.is_blurry,
                m.duplicate_of, m.faces_count, m.eyes_closed, m.category, m.tags, u.name AS uploaded_by_name, ed.name AS editor_name, e.title AS event_title
           FROM tblPhoto p LEFT JOIN tblPhotoMetadata m ON m.photo_id = p.id LEFT JOIN tblUser u ON u.id = p.uploaded_by LEFT JOIN tblUser ed ON ed.id = p.editor_id
           JOIN tblEvent e ON e.id = p.event_id WHERE p.id = ?`,
        [id],
    );
    if (!p) throw notFound('Photo');
    await assertEventAccess(actor, p.event_id, 'work');
    const comments = await query('SELECT c.id, c.body, c.is_staff, c.created_at, u.name AS user_name FROM tblPhotoComment c JOIN tblUser u ON u.id = c.user_id WHERE c.photo_id = ? AND c.deleted_at IS NULL ORDER BY c.id', [id]);
    const canOriginal = hasPermission(actor, 'galleries.manage', 'photos.manage', 'photos.edit');
    const { original_key, preview_key, thumb_key, edited_key, checksum, ...rest } = p;
    return {
        ...rest,
        comments,
        preview_url: preview_key ? await storage.signedUrl(preview_key) : null,
        thumb_url: thumb_key ? await storage.signedUrl(thumb_key) : null,
        original_url: canOriginal ? await storage.signedUrl(original_key, { downloadName: p.file_name }) : null,
        edited_url: canOriginal && edited_key ? await storage.signedUrl(edited_key, { downloadName: `edited_${p.file_name.replace(/\.\w+$/, '')}.jpg` }) : null,
    };
}

export type BulkAction =
    | { action: 'publish' | 'unpublish' | 'approve' | 'reject' | 'unreject' | 'delete' | 'restore' | 'purge' | 'reprocess' | 'deliver' }
    | { action: 'move'; albumId: number | null }
    | { action: 'status'; status: PhotoStatus };

export async function bulkUpdate(photoIds: number[], op: BulkAction, ctx: AuditContext) {
    if (!photoIds.length) throw badRequest('Select at least one photo.');
    const rows = await query<{ id: number; event_id: number; gallery_id: number; original_key: string; preview_key: string | null; thumb_key: string | null; edited_key: string | null }>(
        'SELECT id, event_id, gallery_id, original_key, preview_key, thumb_key, edited_key FROM tblPhoto WHERE id IN (?)',
        [photoIds],
    );
    if (!rows.length) throw notFound('Photos');
    const ids = rows.map((r) => r.id);
    let affected = 0;
    switch (op.action) {
        case 'publish':
            affected = (await execute("UPDATE tblPhoto SET is_published = 1 WHERE id IN (?) AND deleted_at IS NULL AND preview_key IS NOT NULL", [ids])).affectedRows;
            for (const r of rows) emitTo(rooms.gallery(r.gallery_id), 'photo:new', { id: r.id, galleryId: r.gallery_id });
            break;
        case 'unpublish':
            affected = (await execute('UPDATE tblPhoto SET is_published = 0 WHERE id IN (?)', [ids])).affectedRows;
            for (const r of rows) emitTo(rooms.gallery(r.gallery_id), 'photo:removed', { id: r.id });
            break;
        case 'approve':
            affected = (await execute("UPDATE tblPhoto SET status = 'APPROVED', is_rejected = 0 WHERE id IN (?) AND deleted_at IS NULL", [ids])).affectedRows;
            break;
        case 'deliver':
            affected = (await execute("UPDATE tblPhoto SET status = 'DELIVERED' WHERE id IN (?) AND deleted_at IS NULL", [ids])).affectedRows;
            break;
        case 'reject':
            affected = (await execute('UPDATE tblPhoto SET is_rejected = 1, is_published = 0 WHERE id IN (?)', [ids])).affectedRows;
            for (const r of rows) emitTo(rooms.gallery(r.gallery_id), 'photo:removed', { id: r.id });
            break;
        case 'unreject':
            affected = (await execute('UPDATE tblPhoto SET is_rejected = 0 WHERE id IN (?)', [ids])).affectedRows;
            break;
        case 'delete':
            affected = (await execute('UPDATE tblPhoto SET deleted_at = UTC_TIMESTAMP(), is_published = 0 WHERE id IN (?) AND deleted_at IS NULL', [ids])).affectedRows;
            for (const r of rows) emitTo(rooms.gallery(r.gallery_id), 'photo:removed', { id: r.id });
            break;
        case 'restore':
            affected = (await execute('UPDATE tblPhoto SET deleted_at = NULL WHERE id IN (?)', [ids])).affectedRows;
            break;
        case 'purge': {
            const purgeable = await query<{ id: number }>('SELECT id FROM tblPhoto WHERE id IN (?) AND deleted_at IS NOT NULL', [ids]);
            const purgeIds = new Set(purgeable.map((p) => p.id));
            for (const r of rows.filter((t) => purgeIds.has(t.id))) {
                for (const k of [r.original_key, r.preview_key, r.thumb_key, r.edited_key]) if (k) await storage.delete(k).catch(() => undefined);
            }
            if (purgeIds.size) affected = (await execute('DELETE FROM tblPhoto WHERE id IN (?)', [[...purgeIds]])).affectedRows;
            break;
        }
        case 'move': {
            if (op.albumId) {
                const galleries = new Set(rows.map((r) => r.gallery_id));
                const album = await queryOne<{ gallery_id: number }>('SELECT gallery_id FROM tblAlbum WHERE id = ? AND deleted_at IS NULL', [op.albumId]);
                if (!album || galleries.size !== 1 || !galleries.has(album.gallery_id)) throw badRequest('Photos can only be moved to an album in the same gallery.');
            }
            affected = (await execute('UPDATE tblPhoto SET album_id = ? WHERE id IN (?)', [op.albumId, ids])).affectedRows;
            break;
        }
        case 'status':
            affected = (await execute('UPDATE tblPhoto SET status = ? WHERE id IN (?) AND deleted_at IS NULL', [op.status, ids])).affectedRows;
            break;
        case 'reprocess':
            ids.forEach((id) => photoQueue.enqueue(id));
            affected = ids.length;
            break;
    }
    await audit(ctx, `PHOTO_${op.action.toUpperCase()}`, 'photos', rows[0].event_id, { count: affected, ids: ids.slice(0, 100), ...('albumId' in op ? { albumId: op.albumId } : {}), ...('status' in op ? { status: op.status } : {}) });
    return { affected };
}

/** Regenerate previews for a whole gallery (after the watermark setting changes). */
export async function reprocessGallery(galleryId: number, ctx: AuditContext) {
    const rows = await query<{ id: number }>('SELECT id FROM tblPhoto WHERE gallery_id = ? AND deleted_at IS NULL', [galleryId]);
    rows.forEach((r) => photoQueue.enqueue(r.id));
    await audit(ctx, 'GALLERY_REPROCESS', 'galleries', galleryId, { count: rows.length });
    return { queued: rows.length };
}

/* ---------------- Editing workflow ---------------- */

export async function assignEditor(photoIds: number[], editorId: number, ctx: AuditContext) {
    const editor = await queryOne<{ id: number; name: string }>(
        "SELECT u.id, u.name FROM tblUser u JOIN tblUserRole ur ON ur.user_id = u.id JOIN tblRole r ON r.id = ur.role_id WHERE u.id = ? AND r.code IN ('EDITOR_DESIGNER','MANAGER','STUDIO_OWNER','SUPER_ADMIN') AND u.status = 'ACTIVE' LIMIT 1",
        [editorId],
    );
    if (!editor) throw badRequest('Choose an active editor.', [{ field: 'editorId', message: 'Not an editor' }]);
    const rows = await query<{ id: number; event_id: number }>('SELECT id, event_id FROM tblPhoto WHERE id IN (?) AND deleted_at IS NULL', [photoIds]);
    if (!rows.length) throw notFound('Photos');
    await execute("UPDATE tblPhoto SET editor_id = ?, status = 'EDITING' WHERE id IN (?)", [editorId, rows.map((r) => r.id)]);
    for (const eventId of new Set(rows.map((r) => r.event_id))) {
        await execute("INSERT IGNORE INTO tblEventStaff (event_id, user_id, role, assigned_by) VALUES (?, ?, 'EDITOR', ?)", [eventId, editorId, ctx.userId]);
    }
    await audit(ctx, 'EDIT_ASSIGNED', 'photos', rows[0].event_id, { editorId, count: rows.length });
    await notifyUser(editorId, { type: 'EDIT_ASSIGNED', title: 'New editing work', body: `${rows.length} photo(s) were added to your editing queue.`, link: '/editor/tasks' });
    return { assigned: rows.length };
}

export async function editorQueue(editorId: number, status?: PhotoStatus) {
    return query(
        `SELECT p.event_id, e.title AS event_title, e.event_code, e.event_date, c.name AS customer_name,
                SUM(p.status = 'EDITING') AS editing, SUM(p.status = 'EDITED') AS edited, SUM(p.status = 'APPROVED') AS approved, COUNT(*) AS total
           FROM tblPhoto p JOIN tblEvent e ON e.id = p.event_id JOIN tblCustomer c ON c.id = e.customer_id
          WHERE p.editor_id = ? AND p.deleted_at IS NULL ${status ? 'AND p.status = ?' : ''}
          GROUP BY p.event_id ORDER BY MIN(p.status = 'EDITING') DESC, e.event_date DESC`,
        status ? [editorId, status] : [editorId],
    );
}

/** Editor uploads the retouched version; previews are regenerated from it. */
export async function uploadEdited(photoId: number, file: Express.Multer.File, actor: AuthUser, ctx: AuditContext) {
    const p = await queryOne<{ id: number; event_id: number; editor_id: number | null; edited_key: string | null; status: PhotoStatus }>('SELECT id, event_id, editor_id, edited_key, status FROM tblPhoto WHERE id = ? AND deleted_at IS NULL', [photoId]);
    if (!p) throw notFound('Photo');
    if (p.editor_id !== actor.id && !hasPermission(actor, 'photos.manage')) throw forbidden('This photo is not in your editing queue.');
    try {
        await inspectImage(file.buffer);
    } catch (err) {
        throw badRequest((err as Error).message);
    }
    const key = `events/${p.event_id}/edited/${uuid()}.jpg`;
    await storage.put(key, await normalizeJpeg(file.buffer, 6000, 92), 'image/jpeg');
    await execute("UPDATE tblPhoto SET edited_key = ?, status = 'EDITED' WHERE id = ?", [key, photoId]);
    if (p.edited_key) await storage.delete(p.edited_key).catch(() => undefined);
    photoQueue.enqueue(photoId);
    await audit(ctx, 'PHOTO_EDITED', 'photos', p.event_id, { photoId });
    return { photoId, status: 'EDITED' };
}

/* ---------------- Customer / QR gallery ---------------- */

export interface GalleryPhotoQuery {
    page: number;
    pageSize: number;
    albumId?: number;
    view?: 'all' | 'favourites' | 'selected' | 'purchased';
    category?: PhotoCategory;
    tag?: string;
    ids?: number[];
    since?: number;
}

export async function listGalleryPhotos(access: GalleryAccess, user: AuthUser | undefined, q: GalleryPhotoQuery) {
    const scope = scopeFilter(access);
    const where = ['p.gallery_id = ?', 'p.deleted_at IS NULL', 'p.is_rejected = 0', 'p.preview_key IS NOT NULL'];
    const params: unknown[] = [access.gallery.id];
    if (!access.isStaff) where.push('p.is_published = 1');
    where.push(scope.sql.replace(/^ AND /, '') || '1=1');
    params.push(...scope.params);
    if (q.albumId) { where.push('p.album_id = ?'); params.push(q.albumId); }
    if (q.category) { where.push('m.category = ?'); params.push(q.category); }
    if (q.tag) { where.push('JSON_CONTAINS(m.tags, ?)'); params.push(JSON.stringify(q.tag.toLowerCase())); }
    if (q.ids?.length) { where.push('p.id IN (?)'); params.push(q.ids); }
    if (q.since) { where.push('p.id > ?'); params.push(q.since); }
    if (q.view === 'favourites') {
        if (!user) return paged([], 0, q);
        where.push('EXISTS (SELECT 1 FROM tblPhotoFavourite f WHERE f.photo_id = p.id AND f.user_id = ?)');
        params.push(user.id);
    }
    if (q.view === 'selected') {
        if (!user?.customerId) return paged([], 0, q);
        where.push('EXISTS (SELECT 1 FROM tblPhotoSelection s WHERE s.photo_id = p.id AND s.customer_id = ?)');
        params.push(user.customerId);
    }
    const w = where.join(' AND ');
    const from = 'FROM tblPhoto p LEFT JOIN tblPhotoMetadata m ON m.photo_id = p.id';
    let rows = await query(
        `SELECT p.id, p.album_id, p.width, p.height, p.status, p.thumb_key, p.preview_key, p.price, p.created_at, m.category, m.tags
           ${from} WHERE ${w} ORDER BY p.sort_order, COALESCE(m.taken_at, p.created_at), p.id`,
        params,
    );
    const customerId = user?.customerId ?? null;
    const entitled = customerId ? await entitledPhotoIds(customerId, rows.map((r) => r.id)) : new Set<number>();
    if (q.view === 'purchased') rows = rows.filter((r) => entitled.has(r.id));
    const total = rows.length;
    const pageRows = rows.slice(offsetOf(q), offsetOf(q) + q.pageSize);
    const ids = pageRows.map((r) => r.id);
    const [favs, sels, counts] = await Promise.all([
        user && ids.length ? query<{ photo_id: number }>('SELECT photo_id FROM tblPhotoFavourite WHERE user_id = ? AND photo_id IN (?)', [user.id, ids]) : [],
        customerId && ids.length ? query<{ photo_id: number }>('SELECT photo_id FROM tblPhotoSelection WHERE customer_id = ? AND photo_id IN (?)', [customerId, ids]) : [],
        ids.length ? query<{ photo_id: number; n: number }>('SELECT photo_id, COUNT(*) AS n FROM tblPhotoComment WHERE photo_id IN (?) AND deleted_at IS NULL GROUP BY photo_id', [ids]) : [],
    ]);
    const favSet = new Set(favs.map((f) => f.photo_id));
    const selSet = new Set(sels.map((s) => s.photo_id));
    const commentMap = new Map(counts.map((c) => [c.photo_id, c.n]));
    const pricing = await getSetting('pricing');
    const price = access.gallery.photo_price ?? pricing.photoDownload;
    const items = await Promise.all(
        pageRows.map(async ({ thumb_key, preview_key, ...r }) => ({
            ...r,
            thumb_url: await storage.signedUrl(thumb_key ?? preview_key),
            price: r.price ?? price,
            favourite: favSet.has(r.id),
            selected: selSet.has(r.id),
            purchased: entitled.has(r.id),
            comments: commentMap.get(r.id) ?? 0,
        })),
    );
    return paged(items, total, q);
}

/** Open one photo in the viewer: logs a view and returns a fresh signed (watermarked) preview URL. */
export async function openGalleryPhoto(access: GalleryAccess, user: AuthUser | undefined, photoId: number, ip: string) {
    const scope = scopeFilter(access);
    const p = await queryOne<{ id: number; event_id: number; preview_key: string; width: number; height: number; file_name: string; price: number | null; album_id: number | null }>(
        `SELECT p.id, p.event_id, p.preview_key, p.width, p.height, p.file_name, p.price, p.album_id FROM tblPhoto p
          WHERE p.id = ? AND p.gallery_id = ? AND p.deleted_at IS NULL AND p.is_rejected = 0 AND p.preview_key IS NOT NULL ${access.isStaff ? '' : 'AND p.is_published = 1'}${scope.sql}`,
        [photoId, access.gallery.id, ...scope.params],
    );
    if (!p) throw notFound('Photo');
    await execute('INSERT INTO tblPhotoView (photo_id, gallery_id, event_id, user_id, session_id, ip) VALUES (?, ?, ?, ?, ?, ?)', [p.id, access.gallery.id, p.event_id, user?.id ?? null, access.sessionId, ip]);
    const customerId = user?.customerId ?? null;
    const [entitled, fav, sel, comments] = await Promise.all([
        customerId ? entitledPhotoIds(customerId, [p.id]) : Promise.resolve(new Set<number>()),
        user ? queryOne('SELECT 1 FROM tblPhotoFavourite WHERE user_id = ? AND photo_id = ?', [user.id, p.id]) : null,
        customerId ? queryOne('SELECT 1 FROM tblPhotoSelection WHERE customer_id = ? AND photo_id = ?', [customerId, p.id]) : null,
        user
            ? query('SELECT c.id, c.body, c.is_staff, c.created_at, u.name AS user_name, c.user_id = ? AS mine FROM tblPhotoComment c JOIN tblUser u ON u.id = c.user_id WHERE c.photo_id = ? AND c.deleted_at IS NULL AND (c.user_id = ? OR c.is_staff = 1) ORDER BY c.id', [user.id, p.id, user.id])
            : [],
    ]);
    const pricing = await getSetting('pricing');
    return {
        id: p.id,
        width: p.width,
        height: p.height,
        album_id: p.album_id,
        preview_url: await storage.signedUrl(p.preview_key),
        price: p.price ?? access.gallery.photo_price ?? pricing.photoDownload,
        purchased: entitled.has(p.id),
        favourite: !!fav,
        selected: !!sel,
        comments,
        can_download: entitled.has(p.id) && !!access.gallery.allow_download,
    };
}

export async function setPhotoTags(photoIds: number[], tags: string[], category: PhotoCategory | null | undefined, ctx: AuditContext) {
    await setTags(photoIds, tags, category);
    await audit(ctx, 'PHOTO_TAGGED', 'photos', null, { count: photoIds.length, tags, category });
}

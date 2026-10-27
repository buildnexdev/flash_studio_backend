// Developer by: Buildnexdev.in
// Devevloper : Nandhakumar@gmail.com
// Last Edited : 06-10-2026
import { config } from '../../config/env.js';
import { execute, query, queryOne } from '../../db/pool.js';
import { hasPermission, type AuthUser } from '../../middleware/auth.js';
import { qrDataUrl } from '../../lib/qr.js';
import { storage } from '../../lib/storage.js';
import { decrypt, encrypt, randomToken, sha256, uuid } from '../../utils/crypto.js';
import { badRequest, conflict, forbidden, notFound, unauthorized } from '../../utils/errors.js';
import { likeTerm, offsetOf, paged } from '../../utils/pagination.js';
import { audit, type AuditContext } from '../audit/audit.service.js';
import { signGallerySession, type GallerySession, GALLERY_SESSION_HOURS } from './gallery-session.js';

export interface GalleryRow {
    id: number;
    event_id: number;
    title: string;
    description: string | null;
    status: 'DRAFT' | 'LIVE' | 'PUBLISHED' | 'ARCHIVED';
    watermark_enabled: number;
    allow_download: number;
    auto_publish: number;
    photo_price: number | null;
    expires_at: Date | null;
    customer_id: number;
    event_title: string;
    event_status: string;
    event_date: string;
    event_venue?: string | null;
    cover_key?: string | null;
    cover_photo_id?: number | null;
}

export async function loadGallery(id: number): Promise<GalleryRow> {
    const g = await queryOne<GalleryRow>(
        `SELECT g.*, e.customer_id, e.title AS event_title, e.status AS event_status, e.event_date, e.venue AS event_venue, e.cover_key
           FROM tblGallery g JOIN tblEvent e ON e.id = g.event_id AND e.deleted_at IS NULL
          WHERE g.id = ? AND g.deleted_at IS NULL`,
        [id],
    );
    if (!g) throw notFound('Gallery');
    return g;
}

export const galleryUrl = (rawToken: string) => `${config.FRONTEND_URL}/g/${rawToken}`;

/* ---------------- Admin ---------------- */

export async function listGalleries(q: { page: number; pageSize: number; search?: string; status?: string }) {
    const where = ['g.deleted_at IS NULL', 'e.deleted_at IS NULL'];
    const params: unknown[] = [];
    if (q.search) {
        where.push('(g.title LIKE ? OR e.title LIKE ? OR e.event_code LIKE ? OR c.name LIKE ?)');
        const t = likeTerm(q.search);
        params.push(t, t, t, t);
    }
    if (q.status) { where.push('g.status = ?'); params.push(q.status); }
    const w = where.join(' AND ');
    const base = 'FROM tblGallery g JOIN tblEvent e ON e.id = g.event_id JOIN tblCustomer c ON c.id = e.customer_id';
    const total = (await queryOne<{ n: number }>(`SELECT COUNT(*) AS n ${base} WHERE ${w}`, params))?.n ?? 0;
    const items = await query(
        `SELECT g.id, g.title, g.status, g.watermark_enabled, g.allow_download, g.expires_at, g.created_at,
                e.id AS event_id, e.event_code, e.title AS event_title, e.event_date, e.status AS event_status, c.name AS customer_name,
                (SELECT COUNT(*) FROM tblPhoto p WHERE p.gallery_id = g.id AND p.deleted_at IS NULL) AS photo_count,
                (SELECT COUNT(*) FROM tblPhoto p WHERE p.gallery_id = g.id AND p.deleted_at IS NULL AND p.is_published = 1) AS published_count,
                (SELECT COUNT(*) FROM tblGalleryToken t WHERE t.gallery_id = g.id AND t.revoked_at IS NULL AND (t.expires_at IS NULL OR t.expires_at > UTC_TIMESTAMP())) AS active_qr,
                (SELECT COUNT(*) FROM tblGalleryAccessLog l WHERE l.gallery_id = g.id AND l.result = 'GRANTED') AS opens
           ${base} WHERE ${w} ORDER BY g.id DESC LIMIT ? OFFSET ?`,
        [...params, q.pageSize, offsetOf(q)],
    );
    return paged(items, total, q);
}

export async function listQrCodes(q: { page: number; pageSize: number; search?: string; state?: string }) {
    const where = ['g.deleted_at IS NULL', 'e.deleted_at IS NULL'];
    const params: unknown[] = [];
    if (q.search) {
        where.push('(t.label LIKE ? OR g.title LIKE ? OR e.title LIKE ? OR e.event_code LIKE ? OR c.name LIKE ? OR t.token_hint LIKE ?)');
        const term = likeTerm(q.search);
        params.push(term, term, term, term, term, term);
    }
    if (q.state === 'REVOKED') where.push('t.revoked_at IS NOT NULL');
    else if (q.state === 'EXPIRED') where.push('t.revoked_at IS NULL AND t.expires_at IS NOT NULL AND t.expires_at <= UTC_TIMESTAMP()');
    else if (q.state === 'EXHAUSTED') where.push('t.revoked_at IS NULL AND (t.expires_at IS NULL OR t.expires_at > UTC_TIMESTAMP()) AND t.max_uses IS NOT NULL AND t.use_count >= t.max_uses');
    else if (q.state === 'ACTIVE') where.push('t.revoked_at IS NULL AND (t.expires_at IS NULL OR t.expires_at > UTC_TIMESTAMP()) AND (t.max_uses IS NULL OR t.use_count < t.max_uses)');
    const w = where.join(' AND ');
    const base = 'FROM tblGalleryToken t JOIN tblGallery g ON g.id = t.gallery_id JOIN tblEvent e ON e.id = g.event_id JOIN tblCustomer c ON c.id = e.customer_id';
    const total = (await queryOne<{ n: number }>(`SELECT COUNT(*) AS n ${base} WHERE ${w}`, params))?.n ?? 0;
    const rows = await query<{
        id: number;
        gallery_id: number;
        scope: string;
        album_id: number | null;
        photo_id: number | null;
        label: string | null;
        token_hint: string;
        expires_at: Date | string | null;
        revoked_at: Date | string | null;
        max_uses: number | null;
        use_count: number;
        last_used_at: Date | string | null;
        created_at: Date | string;
        gallery_title: string;
        event_code: string;
        event_title: string;
        customer_name: string;
    }>(
        `SELECT t.id, t.gallery_id, t.scope, t.album_id, t.photo_id, t.label, t.token_hint, t.expires_at, t.revoked_at, t.max_uses, t.use_count, t.last_used_at, t.created_at,
                g.title AS gallery_title, e.event_code, e.title AS event_title, c.name AS customer_name
           ${base} WHERE ${w} ORDER BY t.id DESC LIMIT ? OFFSET ?`,
        [...params, q.pageSize, offsetOf(q)],
    );
    const now = new Date();
    const items = rows.map((t) => {
        const state = t.revoked_at ? 'REVOKED' : t.expires_at && new Date(t.expires_at) < now ? 'EXPIRED' : t.max_uses && Number(t.use_count) >= Number(t.max_uses) ? 'EXHAUSTED' : 'ACTIVE';
        return { ...t, state };
    });
    return paged(items, total, q);
}

export async function getGalleryAdmin(id: number) {
    const g = await loadGallery(id);
    const [albums, tokens, stats, recentAccess] = await Promise.all([
        query('SELECT a.*, (SELECT COUNT(*) FROM tblPhoto p WHERE p.album_id = a.id AND p.deleted_at IS NULL) AS photo_count FROM tblAlbum a WHERE a.gallery_id = ? AND a.deleted_at IS NULL ORDER BY a.sort_order, a.id', [id]),
        listTokens(id),
        queryOne(
            `SELECT COUNT(*) AS total, SUM(is_published = 1 AND is_rejected = 0) AS published, SUM(status IN ('UPLOADED','PROCESSING')) AS processing,
                    SUM(is_rejected = 1) AS rejected FROM tblPhoto WHERE gallery_id = ? AND deleted_at IS NULL`,
            [id],
        ),
        query(
            `SELECT l.id, l.result, l.ip, l.user_agent, l.created_at, u.name AS user_name, t.label AS token_label, t.scope
               FROM tblGalleryAccessLog l LEFT JOIN tblUser u ON u.id = l.user_id LEFT JOIN tblGalleryToken t ON t.id = l.token_id
              WHERE l.gallery_id = ? ORDER BY l.id DESC LIMIT 50`,
            [id],
        ),
    ]);
    return { ...g, albums, tokens, stats, recentAccess };
}

export interface GalleryUpdate {
    title: string;
    description?: string | null;
    status: GalleryRow['status'];
    watermarkEnabled: boolean;
    allowDownload: boolean;
    autoPublish: boolean;
    photoPrice?: number | null;
    expiresAt?: string | null;
}

export async function updateGallery(id: number, input: GalleryUpdate, ctx: AuditContext) {
    const before = await loadGallery(id);
    await execute(
        'UPDATE tblGallery SET title = ?, description = ?, status = ?, watermark_enabled = ?, allow_download = ?, auto_publish = ?, photo_price = ?, expires_at = ? WHERE id = ?',
        [input.title, input.description ?? null, input.status, input.watermarkEnabled ? 1 : 0, input.allowDownload ? 1 : 0, input.autoPublish ? 1 : 0, input.photoPrice ?? null, input.expiresAt ?? null, id],
    );
    await audit(ctx, 'GALLERY_UPDATED', 'galleries', id, { status: input.status, watermark: input.watermarkEnabled });
    return { gallery: await getGalleryAdmin(id), watermarkChanged: !!before.watermark_enabled !== input.watermarkEnabled };
}

export async function createGallery(eventId: number, title: string, ctx: AuditContext) {
    const e = await queryOne('SELECT id FROM tblEvent WHERE id = ? AND deleted_at IS NULL', [eventId]);
    if (!e) throw notFound('Event');
    const id = (await execute('INSERT INTO tblGallery (event_id, title, created_by) VALUES (?, ?, ?)', [eventId, title, ctx.userId])).insertId;
    await audit(ctx, 'GALLERY_CREATED', 'galleries', id, { eventId });
    return getGalleryAdmin(id);
}

export async function saveAlbum(galleryId: number, albumId: number | null, input: { name: string; description?: string | null; sortOrder: number }, ctx: AuditContext) {
    await loadGallery(galleryId);
    if (albumId) {
        const res = await execute('UPDATE tblAlbum SET name = ?, description = ?, sort_order = ? WHERE id = ? AND gallery_id = ? AND deleted_at IS NULL', [input.name, input.description ?? null, input.sortOrder, albumId, galleryId]);
        if (!res.affectedRows) throw notFound('Album');
    } else {
        albumId = (await execute('INSERT INTO tblAlbum (gallery_id, name, description, sort_order) VALUES (?, ?, ?, ?)', [galleryId, input.name, input.description ?? null, input.sortOrder])).insertId;
    }
    await audit(ctx, 'ALBUM_SAVED', 'galleries', galleryId, { albumId, name: input.name });
    return queryOne('SELECT * FROM tblAlbum WHERE id = ?', [albumId]);
}

export async function deleteAlbum(galleryId: number, albumId: number, ctx: AuditContext) {
    await execute('UPDATE tblPhoto SET album_id = NULL WHERE album_id = ?', [albumId]);
    await execute('UPDATE tblAlbum SET deleted_at = UTC_TIMESTAMP() WHERE id = ? AND gallery_id = ?', [albumId, galleryId]);
    await execute('UPDATE tblGalleryToken SET revoked_at = UTC_TIMESTAMP() WHERE album_id = ? AND revoked_at IS NULL', [albumId]);
    await audit(ctx, 'ALBUM_DELETED', 'galleries', galleryId, { albumId });
}

/* ---------------- QR tokens ---------------- */

export interface TokenInput {
    scope: 'EVENT' | 'ALBUM' | 'PHOTO';
    albumId?: number | null;
    photoId?: number | null;
    label?: string | null;
    expiresAt?: string | null;
    maxUses?: number | null;
}

async function listTokens(galleryId: number) {
    const rows = await query(
        `SELECT t.id, t.scope, t.album_id, a.name AS album_name, t.photo_id, t.label, t.token_hint, t.token_encrypted, t.expires_at, t.revoked_at, t.max_uses, t.use_count, t.last_used_at, t.created_at
           FROM tblGalleryToken t LEFT JOIN tblAlbum a ON a.id = t.album_id WHERE t.gallery_id = ? ORDER BY t.id DESC`,
        [galleryId],
    );
    const now = new Date();
    return rows.map(({ token_encrypted, ...t }) => {
        const state = t.revoked_at ? 'REVOKED' : t.expires_at && new Date(t.expires_at) < now ? 'EXPIRED' : t.max_uses && t.use_count >= t.max_uses ? 'EXHAUSTED' : 'ACTIVE';
        return { ...t, state, url: state === 'ACTIVE' ? galleryUrl(decrypt(token_encrypted)) : null };
    });
}

/** Issue the guest QR when an event goes live, if one is not already active. */
export async function ensureEventQr(eventId: number, ctx: AuditContext) {
    const g = await queryOne<{ id: number }>('SELECT id FROM tblGallery WHERE event_id = ? AND deleted_at IS NULL ORDER BY id LIMIT 1', [eventId]);
    if (!g) return null;
    const existing = await queryOne(
        `SELECT id FROM tblGalleryToken
          WHERE gallery_id = ? AND scope = 'EVENT' AND revoked_at IS NULL
            AND (expires_at IS NULL OR expires_at > UTC_TIMESTAMP())
            AND (max_uses IS NULL OR use_count < max_uses)
          LIMIT 1`,
        [g.id],
    );
    if (existing) return existing;
    return generateQr(g.id, { scope: 'EVENT', label: 'Live event' }, ctx);
}

export async function generateQr(galleryId: number, input: TokenInput, ctx: AuditContext) {
    const g = await loadGallery(galleryId);
    if (input.scope === 'ALBUM') {
        if (!input.albumId) throw badRequest('Choose an album for an album QR.', [{ field: 'albumId', message: 'Required' }]);
        const a = await queryOne('SELECT id FROM tblAlbum WHERE id = ? AND gallery_id = ? AND deleted_at IS NULL', [input.albumId, galleryId]);
        if (!a) throw badRequest('Album not found in this gallery.');
    }
    if (input.scope === 'PHOTO') {
        if (!input.photoId) throw badRequest('Choose a photo for a photo QR.', [{ field: 'photoId', message: 'Required' }]);
        const p = await queryOne('SELECT id FROM tblPhoto WHERE id = ? AND gallery_id = ? AND deleted_at IS NULL', [input.photoId, galleryId]);
        if (!p) throw badRequest('Photo not found in this gallery.');
    }
    const expiresAt = input.expiresAt ?? (g.expires_at ? new Date(g.expires_at).toISOString().slice(0, 19).replace('T', ' ') : null);
    if (expiresAt && new Date(`${expiresAt.replace(' ', 'T')}Z`) < new Date()) throw badRequest('Expiry must be in the future.', [{ field: 'expiresAt', message: 'In the past' }]);

    const raw = randomToken(24);
    const res = await execute(
        `INSERT INTO tblGalleryToken (gallery_id, scope, album_id, photo_id, label, token_hash, token_encrypted, token_hint, expires_at, max_uses, created_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [galleryId, input.scope, input.scope === 'ALBUM' ? input.albumId : null, input.scope === 'PHOTO' ? input.photoId : null, input.label ?? null, sha256(raw), encrypt(raw), raw.slice(0, 6), expiresAt, input.maxUses ?? null, ctx.userId],
    );
    await audit(ctx, 'QR_GENERATED', 'galleries', galleryId, { tokenId: res.insertId, scope: input.scope, expiresAt });
    const url = galleryUrl(raw);
    return { id: res.insertId, url, qr: await qrDataUrl(url), expiresAt, scope: input.scope };
}

export async function tokenQr(galleryId: number, tokenId: number) {
    const t = await queryOne<{ token_encrypted: string; revoked_at: Date | null; expires_at: Date | null }>('SELECT token_encrypted, revoked_at, expires_at FROM tblGalleryToken WHERE id = ? AND gallery_id = ?', [tokenId, galleryId]);
    if (!t) throw notFound('QR code');
    if (t.revoked_at) throw conflict('This QR code has been revoked.');
    const url = galleryUrl(decrypt(t.token_encrypted));
    return { url, qr: await qrDataUrl(url, 768) };
}

export async function revokeQr(galleryId: number, tokenId: number | 'all', ctx: AuditContext) {
    const res =
        tokenId === 'all'
            ? await execute('UPDATE tblGalleryToken SET revoked_at = UTC_TIMESTAMP(), revoked_by = ? WHERE gallery_id = ? AND revoked_at IS NULL', [ctx.userId, galleryId])
            : await execute('UPDATE tblGalleryToken SET revoked_at = UTC_TIMESTAMP(), revoked_by = ? WHERE id = ? AND gallery_id = ? AND revoked_at IS NULL', [ctx.userId, tokenId, galleryId]);
    await audit(ctx, 'QR_REVOKED', 'galleries', galleryId, { tokenId, count: res.affectedRows });
    return res.affectedRows;
}

export async function regenerateQr(galleryId: number, tokenId: number, ctx: AuditContext) {
    const t = await queryOne<{ scope: TokenInput['scope']; album_id: number | null; photo_id: number | null; label: string | null; expires_at: Date | null; max_uses: number | null }>(
        'SELECT scope, album_id, photo_id, label, expires_at, max_uses FROM tblGalleryToken WHERE id = ? AND gallery_id = ?',
        [tokenId, galleryId],
    );
    if (!t) throw notFound('QR code');
    await revokeQr(galleryId, tokenId, ctx);
    const keepExpiry = t.expires_at && new Date(t.expires_at) > new Date() ? new Date(t.expires_at).toISOString().slice(0, 19).replace('T', ' ') : null;
    return generateQr(galleryId, { scope: t.scope, albumId: t.album_id, photoId: t.photo_id, label: t.label, expiresAt: keepExpiry, maxUses: t.max_uses }, ctx);
}

/* ---------------- Public access ---------------- */

async function logAccess(galleryId: number, tokenId: number | null, userId: number | null, result: string, ip: string, ua: string) {
    await execute('INSERT INTO tblGalleryAccessLog (gallery_id, token_id, user_id, result, ip, user_agent) VALUES (?, ?, ?, ?, ?, ?)', [galleryId, tokenId, userId, result, ip, ua]);
}

/** Exchange a QR token for a short-lived gallery session. */
export async function accessWithToken(rawToken: string, user: AuthUser | undefined, ip: string, ua: string) {
    const t = await queryOne<{ id: number; gallery_id: number; scope: GallerySession['scope']; album_id: number | null; photo_id: number | null; expires_at: Date | null; revoked_at: Date | null; max_uses: number | null; use_count: number }>(
        'SELECT id, gallery_id, scope, album_id, photo_id, expires_at, revoked_at, max_uses, use_count FROM tblGalleryToken WHERE token_hash = ?',
        [sha256(rawToken)],
    );
    if (!t) throw unauthorized('This QR code is not valid.');
    const userId = user?.id ?? null;
    if (t.revoked_at) {
        await logAccess(t.gallery_id, t.id, userId, 'REVOKED', ip, ua);
        throw unauthorized('This QR code has been revoked by the studio. Please ask for a new one.');
    }
    if (t.expires_at && new Date(t.expires_at) < new Date()) {
        await logAccess(t.gallery_id, t.id, userId, 'EXPIRED', ip, ua);
        throw unauthorized('This QR code has expired. Please contact the studio.');
    }
    if (t.max_uses && t.use_count >= t.max_uses) {
        await logAccess(t.gallery_id, t.id, userId, 'LIMIT', ip, ua);
        throw unauthorized('This QR code has reached its scan limit.');
    }
    const g = await loadGallery(t.gallery_id);
    if (g.status === 'ARCHIVED') {
        await logAccess(t.gallery_id, t.id, userId, 'INVALID', ip, ua);
        throw forbidden('This gallery has been archived.');
    }
    await execute('UPDATE tblGalleryToken SET use_count = use_count + 1, last_used_at = UTC_TIMESTAMP() WHERE id = ?', [t.id]);
    await logAccess(t.gallery_id, t.id, userId, 'GRANTED', ip, ua);
    const session: GallerySession = { galleryId: t.gallery_id, tokenId: t.id, scope: t.scope, albumId: t.album_id, photoId: t.photo_id, sessionId: uuid() };
    const photo = await queryOne<{ thumb_key: string | null; preview_key: string | null }>(
        `SELECT thumb_key, preview_key FROM tblPhoto
          WHERE gallery_id = ? AND deleted_at IS NULL AND is_rejected = 0 AND is_published = 1
            AND (thumb_key IS NOT NULL OR preview_key IS NOT NULL)
          ORDER BY (id = ?) DESC, id LIMIT 1`,
        [t.gallery_id, g.cover_photo_id ?? 0],
    );
    const coverKey = g.cover_key || photo?.preview_key || photo?.thumb_key || null;
    const coverUrl = coverKey ? await storage.signedUrl(coverKey) : null;
    return {
        session: signGallerySession(session),
        expiresInHours: GALLERY_SESSION_HOURS,
        galleryId: t.gallery_id,
        scope: t.scope,
        title: g.title,
        coverUrl,
    };
}

export interface GalleryAccess {
    gallery: GalleryRow;
    scope: GallerySession['scope'];
    albumId: number | null;
    photoId: number | null;
    isOwner: boolean;
    isStaff: boolean;
    sessionId: string | null;
}

/** Decide whether the requester may view a gallery: valid QR session, owning customer, or gallery staff. */
export async function resolveAccess(galleryId: number, user: AuthUser | undefined, session: GallerySession | undefined): Promise<GalleryAccess> {
    const gallery = await loadGallery(galleryId);
    const isStaff = hasPermission(user, 'galleries.manage', 'photos.manage');
    const isOwner = !!user?.customerId && user.customerId === gallery.customer_id;
    if (isStaff || isOwner) return { gallery, scope: 'EVENT', albumId: null, photoId: null, isOwner, isStaff, sessionId: session?.sessionId ?? null };
    if (session && session.galleryId === galleryId) {
        const t = await queryOne<{ revoked_at: Date | null; expires_at: Date | null }>('SELECT revoked_at, expires_at FROM tblGalleryToken WHERE id = ?', [session.tokenId]);
        if (!t || t.revoked_at || (t.expires_at && new Date(t.expires_at) < new Date())) throw unauthorized('Access to this gallery has been withdrawn. Please scan a new QR code.');
        if (gallery.status === 'ARCHIVED') throw forbidden('This gallery has been archived.');
        return { gallery, scope: session.scope, albumId: session.albumId, photoId: session.photoId, isOwner: false, isStaff: false, sessionId: session.sessionId };
    }
    throw unauthorized('Scan the QR code to open this gallery.');
}

export function scopeFilter(a: GalleryAccess): { sql: string; params: unknown[] } {
    if (a.scope === 'ALBUM') return { sql: ' AND p.album_id = ?', params: [a.albumId] };
    if (a.scope === 'PHOTO') return { sql: ' AND p.id = ?', params: [a.photoId] };
    return { sql: '', params: [] };
}

/** Galleries a signed-in customer can open from the portal. */
export async function customerGalleries(customerId: number) {
    const rows = await query(
        `SELECT g.id, g.title, g.status, g.expires_at, e.id AS event_id, e.title AS event_title, e.event_date, e.status AS event_status,
                (SELECT COUNT(*) FROM tblPhoto p WHERE p.gallery_id = g.id AND p.is_published = 1 AND p.is_rejected = 0 AND p.deleted_at IS NULL) AS photo_count,
                (SELECT p.thumb_key FROM tblPhoto p WHERE p.gallery_id = g.id AND p.is_published = 1 AND p.is_rejected = 0 AND p.deleted_at IS NULL AND p.thumb_key IS NOT NULL ORDER BY (p.id = g.cover_photo_id) DESC, p.id LIMIT 1) AS cover_key
           FROM tblGallery g JOIN tblEvent e ON e.id = g.event_id AND e.deleted_at IS NULL
          WHERE e.customer_id = ? AND g.deleted_at IS NULL AND g.status <> 'DRAFT' ORDER BY e.event_date DESC`,
        [customerId],
    );
    return Promise.all(rows.map(async ({ cover_key, ...r }) => ({ ...r, cover_url: cover_key ? await storage.signedUrl(cover_key) : null })));
}

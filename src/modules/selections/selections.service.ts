import { execute, query, queryOne } from '../../db/pool.js';
import { storage } from '../../lib/storage.js';
import { hasPermission, type AuthUser } from '../../middleware/auth.js';
import { badRequest, conflict, forbidden, notFound } from '../../utils/errors.js';
import { audit, type AuditContext } from '../audit/audit.service.js';
import { assertEventAccess } from '../events/events.service.js';
import type { GalleryAccess } from '../galleries/galleries.service.js';
import { scopeFilter } from '../galleries/galleries.service.js';
import { notifyCustomer, notifyStaff } from '../notifications/notifications.service.js';

async function visiblePhoto(access: GalleryAccess, photoId: number) {
    const scope = scopeFilter(access);
    const p = await queryOne<{ id: number; event_id: number }>(
        `SELECT p.id, p.event_id FROM tblPhoto p WHERE p.id = ? AND p.gallery_id = ? AND p.deleted_at IS NULL AND p.is_rejected = 0 ${access.isStaff ? '' : 'AND p.is_published = 1'}${scope.sql}`,
        [photoId, access.gallery.id, ...scope.params],
    );
    if (!p) throw notFound('Photo');
    return p;
}

export async function toggleFavourite(access: GalleryAccess, user: AuthUser, photoId: number, on: boolean) {
    await visiblePhoto(access, photoId);
    if (on) await execute('INSERT IGNORE INTO tblPhotoFavourite (photo_id, user_id) VALUES (?, ?)', [photoId, user.id]);
    else await execute('DELETE FROM tblPhotoFavourite WHERE photo_id = ? AND user_id = ?', [photoId, user.id]);
    return { photoId, favourite: on };
}

async function submission(eventId: number, customerId: number) {
    return queryOne<{ id: number; status: string; photo_count: number; note: string | null; submitted_at: Date | null; confirmed_at: Date | null }>(
        'SELECT id, status, photo_count, note, submitted_at, confirmed_at FROM tblSelectionSubmission WHERE event_id = ? AND customer_id = ?',
        [eventId, customerId],
    );
}

/** Album selection belongs to the event's customer and is locked once submitted. */
async function assertCanSelect(access: GalleryAccess, user: AuthUser) {
    if (!user.customerId || !access.isOwner) throw forbidden('Only the event owner can select photos for the album.');
    const s = await submission(access.gallery.event_id, user.customerId);
    if (s && (s.status === 'SUBMITTED' || s.status === 'CONFIRMED')) throw conflict('Your selection has been submitted. Ask the studio to reopen it to make changes.');
}

export async function toggleSelection(access: GalleryAccess, user: AuthUser, photoId: number, on: boolean) {
    await assertCanSelect(access, user);
    const p = await visiblePhoto(access, photoId);
    if (on) await execute('INSERT IGNORE INTO tblPhotoSelection (event_id, photo_id, customer_id) VALUES (?, ?, ?)', [p.event_id, photoId, user.customerId]);
    else await execute('DELETE FROM tblPhotoSelection WHERE photo_id = ? AND customer_id = ?', [photoId, user.customerId]);
    const count = await queryOne<{ n: number }>('SELECT COUNT(*) AS n FROM tblPhotoSelection WHERE event_id = ? AND customer_id = ?', [p.event_id, user.customerId]);
    return { photoId, selected: on, count: count?.n ?? 0 };
}

export async function addComment(access: GalleryAccess, user: AuthUser, photoId: number, body: string, ctx: AuditContext) {
    await visiblePhoto(access, photoId);
    const isStaff = hasPermission(user, 'galleries.manage', 'photos.manage', 'photos.edit');
    if (!isStaff && !access.isOwner && !user.customerId) throw forbidden();
    const res = await execute('INSERT INTO tblPhotoComment (photo_id, user_id, body, is_staff) VALUES (?, ?, ?, ?)', [photoId, user.id, body, isStaff ? 1 : 0]);
    await audit(ctx, 'PHOTO_COMMENT', 'photos', photoId);
    return queryOne('SELECT c.id, c.body, c.is_staff, c.created_at, u.name AS user_name, 1 AS mine FROM tblPhotoComment c JOIN tblUser u ON u.id = c.user_id WHERE c.id = ?', [res.insertId]);
}

export async function deleteComment(user: AuthUser, commentId: number) {
    const c = await queryOne<{ user_id: number }>('SELECT user_id FROM tblPhotoComment WHERE id = ? AND deleted_at IS NULL', [commentId]);
    if (!c) throw notFound('Comment');
    if (c.user_id !== user.id && !hasPermission(user, 'galleries.manage')) throw forbidden();
    await execute('UPDATE tblPhotoComment SET deleted_at = UTC_TIMESTAMP() WHERE id = ?', [commentId]);
}

export async function mySelectionState(access: GalleryAccess, user: AuthUser | undefined) {
    if (!user?.customerId || !access.isOwner) return { canSelect: false, count: 0, status: null };
    const s = await submission(access.gallery.event_id, user.customerId);
    const count = await queryOne<{ n: number }>('SELECT COUNT(*) AS n FROM tblPhotoSelection WHERE event_id = ? AND customer_id = ?', [access.gallery.event_id, user.customerId]);
    return { canSelect: !s || s.status === 'OPEN' || s.status === 'REOPENED', count: count?.n ?? 0, status: s?.status ?? 'OPEN', note: s?.note ?? null, submittedAt: s?.submitted_at ?? null };
}

export async function submitSelection(eventId: number, user: AuthUser, note: string | null, ctx: AuditContext) {
    if (!user.customerId) throw forbidden();
    const e = await queryOne<{ customer_id: number; title: string }>('SELECT customer_id, title FROM tblEvent WHERE id = ? AND deleted_at IS NULL', [eventId]);
    if (!e || e.customer_id !== user.customerId) throw notFound('Event');
    const count = (await queryOne<{ n: number }>('SELECT COUNT(*) AS n FROM tblPhotoSelection WHERE event_id = ? AND customer_id = ?', [eventId, user.customerId]))?.n ?? 0;
    if (!count) throw badRequest('Select at least one photo before submitting.');
    const s = await submission(eventId, user.customerId);
    if (s && (s.status === 'SUBMITTED' || s.status === 'CONFIRMED')) throw conflict('Your selection has already been submitted.');
    await execute(
        `INSERT INTO tblSelectionSubmission (event_id, customer_id, status, photo_count, note, submitted_at) VALUES (?, ?, 'SUBMITTED', ?, ?, UTC_TIMESTAMP())
         ON DUPLICATE KEY UPDATE status = 'SUBMITTED', photo_count = VALUES(photo_count), note = VALUES(note), submitted_at = UTC_TIMESTAMP()`,
        [eventId, user.customerId, count, note],
    );
    await audit(ctx, 'SELECTION_SUBMITTED', 'selections', eventId, { count });
    await notifyStaff(['galleries.manage'], { type: 'SELECTION_SUBMITTED', title: 'Photo selection submitted', body: `${user.name} selected ${count} photo(s) for ${e.title}.`, link: `/admin/events/${eventId}?tab=selection` });
    return { status: 'SUBMITTED', count };
}

/** Staff view of an event's selection (customer selections, favourites and comments). */
export async function eventSelection(eventId: number, actor: AuthUser) {
    await assertEventAccess(actor, eventId, 'view');
    const isStaff = hasPermission(actor, 'galleries.manage', 'photos.manage', 'photos.edit', 'events.view');
    const customerFilter = isStaff ? '' : 'AND s.customer_id = ?';
    const params = isStaff ? [eventId] : [eventId, actor.customerId];
    const submissions = await query(
        `SELECT ss.*, c.name AS customer_name FROM tblSelectionSubmission ss JOIN tblCustomer c ON c.id = ss.customer_id WHERE ss.event_id = ? ${isStaff ? '' : 'AND ss.customer_id = ?'}`,
        params,
    );
    const rows = await query(
        `SELECT p.id, p.file_name, p.status, p.thumb_key, p.editor_id, s.customer_id, s.created_at AS selected_at,
                (SELECT COUNT(*) FROM tblPhotoComment pc WHERE pc.photo_id = p.id AND pc.deleted_at IS NULL) AS comments
           FROM tblPhotoSelection s JOIN tblPhoto p ON p.id = s.photo_id AND p.deleted_at IS NULL
          WHERE s.event_id = ? ${customerFilter} ORDER BY p.id`,
        params,
    );
    const photos = await Promise.all(rows.map(async ({ thumb_key, ...r }) => ({ ...r, thumb_url: thumb_key ? await storage.signedUrl(thumb_key) : null })));
    const comments = isStaff
        ? await query(
              `SELECT c.id, c.photo_id, c.body, c.is_staff, c.created_at, u.name AS user_name FROM tblPhotoComment c JOIN tblUser u ON u.id = c.user_id JOIN tblPhoto p ON p.id = c.photo_id
                WHERE p.event_id = ? AND c.deleted_at IS NULL ORDER BY c.id DESC LIMIT 300`,
              [eventId],
          )
        : [];
    return { submissions, photos, comments };
}

/** Studio confirms the selection: selected photos move to SELECTED, ready for the editing queue. */
export async function confirmSelection(eventId: number, customerId: number, ctx: AuditContext) {
    const s = await submission(eventId, customerId);
    if (!s || s.status !== 'SUBMITTED') throw conflict('There is no submitted selection to confirm.');
    await execute("UPDATE tblSelectionSubmission SET status = 'CONFIRMED', confirmed_at = UTC_TIMESTAMP(), confirmed_by = ? WHERE id = ?", [ctx.userId, s.id]);
    const res = await execute(
        "UPDATE tblPhoto p JOIN tblPhotoSelection s ON s.photo_id = p.id AND s.customer_id = ? SET p.status = 'SELECTED' WHERE p.event_id = ? AND p.status IN ('PREVIEW','UPLOADED','PROCESSING')",
        [customerId, eventId],
    );
    await audit(ctx, 'SELECTION_CONFIRMED', 'selections', eventId, { customerId, photos: res.affectedRows });
    await notifyCustomer(customerId, { type: 'SELECTION_CONFIRMED', title: 'Selection confirmed', body: `The studio confirmed your ${s.photo_count} selected photo(s). Editing will begin shortly.`, link: '/customer/galleries' });
    return { status: 'CONFIRMED', photos: res.affectedRows };
}

export async function reopenSelection(eventId: number, customerId: number, ctx: AuditContext) {
    const s = await submission(eventId, customerId);
    if (!s || s.status === 'OPEN' || s.status === 'REOPENED') throw conflict('The selection is already open.');
    await execute("UPDATE tblSelectionSubmission SET status = 'REOPENED' WHERE id = ?", [s.id]);
    await audit(ctx, 'SELECTION_REOPENED', 'selections', eventId, { customerId });
    await notifyCustomer(customerId, { type: 'GENERAL', title: 'Selection reopened', body: 'The studio reopened your photo selection so you can make changes.', link: '/customer/galleries' });
    return { status: 'REOPENED' };
}

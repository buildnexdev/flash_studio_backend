// Developer by: Buildnexdev.in
// Devevloper : Nandhakumar@gmail.com
// Last Edited : 06-10-2026
import type { PoolConnection } from 'mysql2/promise';
import { execute, query, queryOne, withTransaction, type Db } from '../../db/pool.js';
import { emitTo, rooms } from '../../lib/realtime.js';
import { hasPermission, type AuthUser } from '../../middleware/auth.js';
import { badRequest, conflict, forbidden, notFound } from '../../utils/errors.js';
import { nextNumber } from '../../utils/numbering.js';
import { likeTerm, offsetOf, orderBy, paged } from '../../utils/pagination.js';
import { toSqlDateTime } from '../../utils/dates.js';
import { audit, type AuditContext } from '../audit/audit.service.js';
import { notifyCustomer, notifyUser } from '../notifications/notifications.service.js';
import { signedUrlOrNull, storage } from '../../lib/storage.js';
import { ensureEventQr, galleryUrl } from '../galleries/galleries.service.js';
import { decrypt } from '../../utils/crypto.js';
import { qrDataUrl } from '../../lib/qr.js';
import { getSetting } from '../settings/settings.service.js';
import { assertSlotFree, findSlotClashes, type SlotInput } from './availability.js';

export const EVENT_STATUSES = ['UPCOMING', 'LIVE', 'UPLOADING', 'PROCESSING', 'COMPLETED', 'CANCELLED'] as const;
export type EventStatus = (typeof EVENT_STATUSES)[number];

export interface EventInput {
    customerId: number;
    bookingId?: number | null;
    title: string;
    eventType: string;
    eventDate: string;
    startTime?: string | null;
    endTime?: string | null;
    venue?: string | null;
    notes?: string | null;
    force?: boolean;
}

/** Staff with events.view/manage see everything; photographers/editors only events they are assigned to; customers only their own. */
export async function assertEventAccess(actor: AuthUser, eventId: number, mode: 'view' | 'work' = 'view'): Promise<void> {
    if (hasPermission(actor, 'events.manage')) return;
    if (mode === 'view' && hasPermission(actor, 'events.view')) return;
    if (hasPermission(actor, 'events.assigned', 'photos.upload', 'photos.edit')) {
        const assigned = await queryOne('SELECT 1 FROM tblEventStaff WHERE event_id = ? AND user_id = ?', [eventId, actor.id]);
        if (assigned) return;
    }
    if (mode === 'view' && actor.customerId) {
        const own = await queryOne('SELECT 1 FROM tblEvent WHERE id = ? AND customer_id = ? AND deleted_at IS NULL', [eventId, actor.customerId]);
        if (own) return;
    }
    throw forbidden('You are not assigned to this event.');
}

async function createGallery(conn: Db, eventId: number, title: string, userId: number | null) {
    const days = (await getSetting('gallery')).defaultExpiryDays;
    const expires = toSqlDateTime(new Date(Date.now() + days * 86_400_000));
    // DRAFT until Go live; auto_publish so guest QR shows photos as soon as previews are ready.
    const res = await execute(
        "INSERT INTO tblGallery (event_id, title, status, auto_publish, expires_at, created_by) VALUES (?, ?, 'DRAFT', 1, ?, ?)",
        [eventId, title, expires, userId],
        conn,
    );
    return res.insertId;
}

export async function createEvent(input: EventInput, ctx: AuditContext, conn?: PoolConnection) {
    const run = async (db: PoolConnection) => {
        const customer = await queryOne('SELECT id FROM tblCustomer WHERE id = ? AND deleted_at IS NULL', [input.customerId], db);
        if (!customer) throw badRequest('Customer not found.', [{ field: 'customerId', message: 'Not found' }]);
        if (!input.force) {
            await assertSlotFree({ eventDate: input.eventDate, startTime: input.startTime, endTime: input.endTime, excludeBookingId: input.bookingId ?? null }, db);
        }
        const code = await nextNumber('event', db);
        const res = await execute(
            `INSERT INTO tblEvent (event_code, booking_id, customer_id, title, event_type, event_date, start_time, end_time, venue, notes, created_by)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [code, input.bookingId ?? null, input.customerId, input.title, input.eventType, input.eventDate, input.startTime ?? null, input.endTime ?? null, input.venue ?? null, input.notes ?? null, ctx.userId],
            db,
        );
        await createGallery(db, res.insertId, input.title, ctx.userId);
        return res.insertId;
    };
    const id = conn ? await run(conn) : await withTransaction(run);
    try {
        await ensureEventQr(id, ctx);
    } catch (err) {
        console.error('Failed to generate initial event QR/link:', err);
    }
    await audit(ctx, 'EVENT_CREATED', 'events', id, { title: input.title, bookingId: input.bookingId ?? null });
    return id;
}

/** Called when a booking is confirmed: create its event exactly once. */
export async function ensureEventForBooking(bookingId: number, ctx: AuditContext, conn: PoolConnection): Promise<number> {
    const existing = await queryOne<{ id: number }>('SELECT id FROM tblEvent WHERE booking_id = ? AND deleted_at IS NULL', [bookingId], conn);
    if (existing) return existing.id;
    const b = await queryOne<{ customer_id: number; event_type: string; event_date: string; start_time: string | null; end_time: string | null; venue: string | null; customer_name: string }>(
        'SELECT b.customer_id, b.event_type, b.event_date, b.start_time, b.end_time, b.venue, c.name AS customer_name FROM tblBooking b JOIN tblCustomer c ON c.id = b.customer_id WHERE b.id = ?',
        [bookingId],
        conn,
    );
    if (!b) throw notFound('Booking');
    return createEvent(
        { customerId: b.customer_id, bookingId, title: `${b.customer_name} - ${b.event_type}`, eventType: b.event_type, eventDate: b.event_date, startTime: b.start_time, endTime: b.end_time, venue: b.venue },
        ctx,
        conn,
    );
}

export interface EventFilter {
    page: number;
    pageSize: number;
    search?: string;
    status?: EventStatus;
    from?: string;
    to?: string;
    customerId?: number;
    assignedTo?: number;
    sort?: string;
    order: 'asc' | 'desc';
}

export async function listEvents(f: EventFilter) {
    const where = ['e.deleted_at IS NULL'];
    const params: unknown[] = [];
    if (f.search) {
        where.push('(e.title LIKE ? OR e.event_code LIKE ? OR e.venue LIKE ? OR c.name LIKE ?)');
        const t = likeTerm(f.search);
        params.push(t, t, t, t);
    }
    if (f.status) { where.push('e.status = ?'); params.push(f.status); }
    if (f.from) { where.push('e.event_date >= ?'); params.push(f.from); }
    if (f.to) { where.push('e.event_date <= ?'); params.push(f.to); }
    if (f.customerId) { where.push('e.customer_id = ?'); params.push(f.customerId); }
    if (f.assignedTo) { where.push('EXISTS (SELECT 1 FROM tblEventStaff es WHERE es.event_id = e.id AND es.user_id = ?)'); params.push(f.assignedTo); }
    const w = where.join(' AND ');
    const total = (await queryOne<{ n: number }>(`SELECT COUNT(*) AS n FROM tblEvent e JOIN tblCustomer c ON c.id = e.customer_id WHERE ${w}`, params))?.n ?? 0;
    const items = await query(
        `SELECT e.id, e.event_code, e.title, e.event_type, e.event_date, e.start_time, e.end_time, e.venue, e.status, e.booking_id, e.cover_key,
                c.id AS customer_id, c.name AS customer_name, c.phone AS customer_phone,
                g.id AS gallery_id, g.status AS gallery_status,
                (SELECT gt.token_encrypted FROM tblGalleryToken gt WHERE gt.gallery_id = g.id AND gt.scope = 'EVENT' AND gt.revoked_at IS NULL AND (gt.expires_at IS NULL OR gt.expires_at > UTC_TIMESTAMP()) ORDER BY gt.id DESC LIMIT 1) AS token_encrypted,
                b.status AS booking_status, b.total_amount, b.paid_amount,
                (SELECT COUNT(*) FROM tblPhoto p WHERE p.event_id = e.id AND p.deleted_at IS NULL) AS photo_count,
                (SELECT GROUP_CONCAT(u.name ORDER BY u.name SEPARATOR ', ') FROM tblEventStaff es JOIN tblUser u ON u.id = es.user_id WHERE es.event_id = e.id AND es.role = 'PHOTOGRAPHER') AS photographers
           FROM tblEvent e
           JOIN tblCustomer c ON c.id = e.customer_id
           LEFT JOIN tblGallery g ON g.id = (SELECT MIN(g2.id) FROM tblGallery g2 WHERE g2.event_id = e.id AND g2.deleted_at IS NULL)
           LEFT JOIN tblBooking b ON b.id = e.booking_id
          WHERE ${w}
          ORDER BY ${orderBy(f.sort, { date: 'e.event_date', created: 'e.created_at', title: 'e.title', status: 'e.status' }, 'e.event_date', f.order)}
          LIMIT ? OFFSET ?`,
        [...params, f.pageSize, offsetOf(f)],
    );
    const mapped = await Promise.all(
        (items as any[]).map(async (row) => {
            let qr_token: string | null = null;
            let public_url: string | null = null;
            if (row.token_encrypted) {
                try {
                    qr_token = decrypt(row.token_encrypted);
                    public_url = galleryUrl(qr_token);
                } catch {
                    // fallback
                }
            }
            return {
                ...withPaymentStatus(row),
                cover_url: await signedUrlOrNull(row.cover_key),
                qr_token,
                public_url,
            };
        }),
    );
    return paged(mapped, total, f);
}

function withPaymentStatus<T extends Record<string, any>>(e: T): T & { payment_status: string } {
    const total = Number(e.total_amount ?? 0);
    const paid = Number(e.paid_amount ?? 0);
    const payment_status = !e.booking_id ? 'N/A' : total > 0 && paid >= total ? 'PAID' : paid > 0 ? 'PARTIAL' : 'UNPAID';
    return { ...e, payment_status };
}

export async function getEvent(id: number) {
    const e = await queryOne(
        `SELECT e.*, c.name AS customer_name, c.email AS customer_email, c.phone AS customer_phone, c.user_id AS customer_user_id,
                b.booking_no, b.status AS booking_status, b.total_amount, b.paid_amount, b.package_id, pk.name AS package_name, pk.includes_digital
           FROM tblEvent e JOIN tblCustomer c ON c.id = e.customer_id
           LEFT JOIN tblBooking b ON b.id = e.booking_id LEFT JOIN tblPackage pk ON pk.id = b.package_id
          WHERE e.id = ? AND e.deleted_at IS NULL`,
        [id],
    );
    if (!e) throw notFound('Event');
    const [staff, gallery, photoStats, revenue, access, eventAssets] = await Promise.all([
        query(
            `SELECT es.id, es.user_id, u.name, u.email, u.phone, es.role, es.camera_label, es.task_status, es.created_at,
                    es.pay_basis, es.share_pct, es.commission_pct, es.day_rate_override, es.flat_amount, es.payout_status
               FROM tblEventStaff es JOIN tblUser u ON u.id = es.user_id WHERE es.event_id = ? ORDER BY es.role, u.name`,
            [id],
        ),
        queryOne('SELECT id, title, status, watermark_enabled, allow_download, auto_publish, photo_price, expires_at, cover_photo_id FROM tblGallery WHERE event_id = ? AND deleted_at IS NULL ORDER BY id LIMIT 1', [id]),
        query('SELECT status, COUNT(*) AS n FROM tblPhoto WHERE event_id = ? AND deleted_at IS NULL GROUP BY status', [id]),
        queryOne<{ booking_revenue: number; order_revenue: number }>(
            `SELECT
                COALESCE((SELECT SUM(p.amount - p.refunded_amount) FROM tblPayment p JOIN tblEvent ev ON ev.booking_id = p.booking_id WHERE ev.id = ? AND p.status IN ('SUCCESS','REFUNDED')), 0) AS booking_revenue,
                COALESCE((SELECT SUM(p.amount - p.refunded_amount) FROM tblPayment p JOIN tblOrder o ON o.id = p.order_id WHERE o.event_id = ? AND p.status IN ('SUCCESS','REFUNDED')), 0) AS order_revenue`,
            [id, id],
        ),
        queryOne(
            `SELECT
                (SELECT COUNT(*) FROM tblGalleryAccessLog l JOIN tblGallery g ON g.id = l.gallery_id WHERE g.event_id = ? AND l.result = 'GRANTED') AS gallery_opens,
                (SELECT COUNT(*) FROM tblPhotoView v WHERE v.event_id = ?) AS photo_views,
                (SELECT COUNT(*) FROM tblDownload d WHERE d.event_id = ?) AS downloads`,
            [id, id, id],
        ),
        query(
            `SELECT aa.id AS assignment_id, a.id, a.asset_code, a.name, a.category, a.status, a.asset_condition,
                    aa.assigned_at, aa.notes, u.name AS staff_name
               FROM tblAssetAssignment aa
               JOIN tblAsset a ON a.id = aa.asset_id
               LEFT JOIN tblStaff s ON s.id = aa.staff_id
               LEFT JOIN tblUser u ON u.id = s.user_id
              WHERE aa.event_id = ? AND aa.returned_at IS NULL
              ORDER BY aa.id DESC`,
            [id],
        ),
    ]);
    const row = e as { cover_key?: string | null };
    let publicUrl: string | null = null;
    let qrToken: string | null = null;
    let qrData: string | null = null;
    if (gallery) {
        const galId = (gallery as { id: number }).id;
        const tokenRow = await queryOne<{ id: number; token_encrypted: string }>(
            `SELECT id, token_encrypted FROM tblGalleryToken
              WHERE gallery_id = ? AND scope = 'EVENT' AND revoked_at IS NULL
                AND (expires_at IS NULL OR expires_at > UTC_TIMESTAMP())
                AND (max_uses IS NULL OR use_count < max_uses)
              ORDER BY id DESC LIMIT 1`,
            [galId],
        );
        if (tokenRow) {
            qrToken = decrypt(tokenRow.token_encrypted);
            publicUrl = galleryUrl(qrToken);
            qrData = await qrDataUrl(publicUrl, 512);
        } else {
            const gen = await ensureEventQr(id, { userId: null, ip: '127.0.0.1', userAgent: 'system' });
            if (gen && 'url' in gen) {
                publicUrl = gen.url;
                qrData = gen.qr;
            }
        }
    }
    return {
        ...withPaymentStatus(e),
        cover_url: await signedUrlOrNull(row.cover_key),
        public_url: publicUrl,
        qr_token: qrToken,
        qr_data_url: qrData,
        staff,
        assets: eventAssets,
        gallery,
        photos: Object.fromEntries(photoStats.map((r) => [r.status, r.n])),
        photo_total: photoStats.reduce((s, r) => s + Number(r.n), 0),
        revenue: { booking: Number(revenue?.booking_revenue ?? 0), orders: Number(revenue?.order_revenue ?? 0), total: Number(revenue?.booking_revenue ?? 0) + Number(revenue?.order_revenue ?? 0) },
        access,
    };
}

export async function updateEvent(id: number, input: EventInput, ctx: AuditContext) {
    const current = await queryOne<{ status: EventStatus }>('SELECT status FROM tblEvent WHERE id = ? AND deleted_at IS NULL', [id]);
    if (!current) throw notFound('Event');
    if (current.status === 'CANCELLED') throw conflict('A cancelled event cannot be edited.');
    if (!input.force) {
        await assertSlotFree({ eventDate: input.eventDate, startTime: input.startTime, endTime: input.endTime, excludeEventId: id, excludeBookingId: input.bookingId ?? null });
    }
    await execute('UPDATE tblEvent SET customer_id = ?, title = ?, event_type = ?, event_date = ?, start_time = ?, end_time = ?, venue = ?, notes = ? WHERE id = ?', [
        input.customerId,
        input.title,
        input.eventType,
        input.eventDate,
        input.startTime ?? null,
        input.endTime ?? null,
        input.venue ?? null,
        input.notes ?? null,
        id,
    ]);
    await audit(ctx, 'EVENT_UPDATED', 'events', id);
    return getEvent(id);
}

export async function checkAvailability(input: SlotInput) {
    const conflicts = await findSlotClashes(input);
    return { available: conflicts.length === 0, conflicts };
}

export async function saveCover(id: number, image: Buffer, ctx: AuditContext) {
    const event = await queryOne('SELECT id FROM tblEvent WHERE id = ? AND deleted_at IS NULL', [id]);
    if (!event) throw notFound('Event');
    const key = `events/${id}/cover.jpg`;
    await storage.put(key, image, 'image/jpeg');
    await execute('UPDATE tblEvent SET cover_key = ? WHERE id = ?', [key, id]);
    await audit(ctx, 'EVENT_COVER_UPDATED', 'events', id);
    return getEvent(id);
}

export async function deleteEvent(id: number, ctx: AuditContext) {
    const e = await queryOne<{ status: EventStatus }>('SELECT status FROM tblEvent WHERE id = ? AND deleted_at IS NULL', [id]);
    if (!e) throw notFound('Event');
    if (e.status === 'LIVE') throw conflict('Stop the event before deleting it.');
    await execute('UPDATE tblEvent SET deleted_at = UTC_TIMESTAMP() WHERE id = ?', [id]);
    await execute('UPDATE tblGallery SET deleted_at = UTC_TIMESTAMP() WHERE event_id = ?', [id]);
    await execute('UPDATE tblGalleryToken t JOIN tblGallery g ON g.id = t.gallery_id SET t.revoked_at = UTC_TIMESTAMP() WHERE g.event_id = ? AND t.revoked_at IS NULL', [id]);
    await audit(ctx, 'EVENT_DELETED', 'events', id);
}

const TRANSITIONS: Record<string, { from: EventStatus[]; to: EventStatus }> = {
    start: { from: ['UPCOMING', 'UPLOADING'], to: 'LIVE' },
    stop: { from: ['LIVE'], to: 'UPLOADING' },
    process: { from: ['LIVE', 'UPLOADING'], to: 'PROCESSING' },
    complete: { from: ['LIVE', 'UPLOADING', 'PROCESSING'], to: 'COMPLETED' },
    cancel: { from: ['UPCOMING', 'LIVE', 'UPLOADING', 'PROCESSING'], to: 'CANCELLED' },
    reopen: { from: ['COMPLETED'], to: 'PROCESSING' },
};

export type EventAction = keyof typeof TRANSITIONS;

export async function transitionEvent(id: number, action: EventAction, actor: AuthUser, ctx: AuditContext) {
    const t = TRANSITIONS[action];
    if (!t) throw badRequest('Unknown action');
    const e = await queryOne<{ status: EventStatus; customer_id: number; booking_id: number | null; title: string }>('SELECT status, customer_id, booking_id, title FROM tblEvent WHERE id = ? AND deleted_at IS NULL', [id]);
    if (!e) throw notFound('Event');
    // Photographers can start / stop their assigned events; everything else needs events.manage
    if (!hasPermission(actor, 'events.manage')) {
        if (!['start', 'stop'].includes(action)) throw forbidden();
        await assertEventAccess(actor, id, 'work');
    }
    if (!t.from.includes(e.status)) throw conflict(`Cannot ${action} an event that is ${e.status}.`);

    await withTransaction(async (conn) => {
        const stamp = action === 'start' ? ', started_at = COALESCE(started_at, UTC_TIMESTAMP())' : action === 'stop' ? ', stopped_at = UTC_TIMESTAMP()' : action === 'complete' ? ', completed_at = UTC_TIMESTAMP()' : '';
        await execute(`UPDATE tblEvent SET status = ?${stamp} WHERE id = ?`, [t.to, id], conn);
        if (action === 'start') {
            // Galleries used to be created as PUBLISHED, so "DRAFT only" never flipped them to LIVE.
            await execute(
                "UPDATE tblGallery SET status = 'LIVE', auto_publish = 1 WHERE event_id = ? AND deleted_at IS NULL AND status IN ('DRAFT','PUBLISHED','LIVE')",
                [id],
                conn,
            );
            // Any preview already processed must appear on the guest QR immediately.
            await execute(
                `UPDATE tblPhoto p
                    JOIN tblGallery g ON g.id = p.gallery_id
                    SET p.is_published = 1
                  WHERE g.event_id = ? AND g.deleted_at IS NULL
                    AND p.deleted_at IS NULL AND p.is_rejected = 0 AND p.preview_key IS NOT NULL`,
                [id],
                conn,
            );
            if (e.booking_id) await execute("UPDATE tblBooking SET status = 'IN_PROGRESS' WHERE id = ? AND status = 'CONFIRMED'", [e.booking_id], conn);
            await execute("UPDATE tblEventStaff SET task_status = 'IN_PROGRESS' WHERE event_id = ? AND task_status IN ('ASSIGNED','ACCEPTED')", [id], conn);
        }
        if (action === 'complete') {
            await execute("UPDATE tblGallery SET status = 'PUBLISHED' WHERE event_id = ? AND status IN ('DRAFT','LIVE')", [id], conn);
            await execute("UPDATE tblEventStaff SET task_status = 'DONE' WHERE event_id = ? AND role IN ('PHOTOGRAPHER','ASSISTANT','VIDEOGRAPHER')", [id], conn);
        }
        if (action === 'cancel') {
            await execute('UPDATE tblGalleryToken t JOIN tblGallery g ON g.id = t.gallery_id SET t.revoked_at = UTC_TIMESTAMP() WHERE g.event_id = ? AND t.revoked_at IS NULL', [id], conn);
        }
    });

    if (action === 'start') await ensureEventQr(id, ctx);
    await audit(ctx, `EVENT_${action.toUpperCase()}`, 'events', id, { from: e.status, to: t.to });
    emitTo(rooms.event(id), 'event:status', { eventId: id, status: t.to });
    if (action === 'start') {
        await notifyCustomer(e.customer_id, { type: 'EVENT_STARTED', title: 'Your event is live', body: `${e.title} has started. Photos will appear in your gallery as they are uploaded.`, link: '/customer/galleries' });
    }
    if (action === 'complete') {
        await notifyCustomer(e.customer_id, { type: 'GALLERY_READY', title: 'Your gallery is ready', body: `All photos from ${e.title} are now available in your gallery.`, link: '/customer/galleries' });
    }
    return getEvent(id);
}

export async function assignStaff(
    eventId: number,
    input: {
        userId: number;
        role: string;
        cameraLabel?: string | null;
        payBasis?: 'DAY_RATE' | 'SHARE' | 'COMMISSION' | 'FLAT' | 'NONE';
        sharePct?: number | null;
        commissionPct?: number | null;
        dayRateOverride?: number | null;
        flatAmount?: number | null;
    },
    ctx: AuditContext,
) {
    const e = await queryOne<{ title: string; event_date: string; status: EventStatus }>('SELECT title, event_date, status FROM tblEvent WHERE id = ? AND deleted_at IS NULL', [eventId]);
    if (!e) throw notFound('Event');
    if (e.status === 'CANCELLED') throw conflict('Cannot assign staff to a cancelled event.');
    const user = await queryOne(
        "SELECT u.id FROM tblUser u WHERE u.id = ? AND u.status = 'ACTIVE' AND u.deleted_at IS NULL AND EXISTS (SELECT 1 FROM tblUserRole ur JOIN tblRole r ON r.id = ur.role_id WHERE ur.user_id = u.id AND r.code <> 'CUSTOMER')",
        [input.userId],
    );
    if (!user) throw badRequest('Choose an active staff member.', [{ field: 'userId', message: 'Not a staff member' }]);
    const payBasis = input.payBasis ?? 'DAY_RATE';
    await execute(
        `INSERT INTO tblEventStaff (event_id, user_id, role, camera_label, pay_basis, share_pct, commission_pct, day_rate_override, flat_amount, assigned_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE camera_label = VALUES(camera_label), pay_basis = VALUES(pay_basis), share_pct = VALUES(share_pct),
           commission_pct = VALUES(commission_pct), day_rate_override = VALUES(day_rate_override), flat_amount = VALUES(flat_amount)`,
        [
            eventId,
            input.userId,
            input.role,
            input.cameraLabel ?? null,
            payBasis,
            input.sharePct ?? null,
            input.commissionPct ?? null,
            input.dayRateOverride ?? null,
            input.flatAmount ?? null,
            ctx.userId,
        ],
    );
    await audit(ctx, 'STAFF_ASSIGNED', 'events', eventId, { userId: input.userId, role: input.role });
    await notifyUser(input.userId, {
        type: 'EVENT_ASSIGNED',
        title: 'New event assignment',
        body: `You are assigned as ${input.role.toLowerCase()} for ${e.title} on ${e.event_date}.`,
        link: input.role === 'EDITOR' ? '/editor/tasks' : `/photographer/event/${eventId}`,
        external: true,
    });
    return getEvent(eventId);
}

export async function removeStaff(eventId: number, assignmentId: number, ctx: AuditContext) {
    const res = await execute('DELETE FROM tblEventStaff WHERE id = ? AND event_id = ?', [assignmentId, eventId]);
    if (!res.affectedRows) throw notFound('Assignment');
    await audit(ctx, 'STAFF_UNASSIGNED', 'events', eventId, { assignmentId });
    return getEvent(eventId);
}

export async function updateMyTask(eventId: number, userId: number, status: 'ACCEPTED' | 'IN_PROGRESS' | 'DONE', ctx: AuditContext) {
    const res = await execute('UPDATE tblEventStaff SET task_status = ? WHERE event_id = ? AND user_id = ?', [status, eventId, userId]);
    if (!res.affectedRows) throw forbidden('You are not assigned to this event.');
    await audit(ctx, 'TASK_STATUS', 'events', eventId, { status });
}

/** Assignments for the signed-in staff member (photographer / editor task lists). */
export async function myAssignments(userId: number, scope: 'upcoming' | 'all' = 'all') {
    return query(
        `SELECT es.id AS assignment_id, es.role, es.camera_label, es.task_status,
                e.id, e.event_code, e.title, e.event_type, e.event_date, e.start_time, e.end_time, e.venue, e.status,
                c.name AS customer_name, c.phone AS customer_phone, g.id AS gallery_id,
                (SELECT COUNT(*) FROM tblPhoto p WHERE p.event_id = e.id AND p.uploaded_by = ? AND p.deleted_at IS NULL) AS my_uploads,
                (SELECT COUNT(*) FROM tblPhoto p WHERE p.event_id = e.id AND p.deleted_at IS NULL) AS photo_count
           FROM tblEventStaff es JOIN tblEvent e ON e.id = es.event_id AND e.deleted_at IS NULL
           JOIN tblCustomer c ON c.id = e.customer_id
           LEFT JOIN tblGallery g ON g.event_id = e.id AND g.deleted_at IS NULL
          WHERE es.user_id = ? ${scope === 'upcoming' ? "AND e.status NOT IN ('COMPLETED','CANCELLED')" : ''}
          ORDER BY FIELD(e.status, 'LIVE','UPLOADING','UPCOMING','PROCESSING','COMPLETED','CANCELLED'), e.event_date`,
        [userId, userId],
    );
}

export async function customerEvents(customerId: number) {
    return query(
        `SELECT e.id, e.event_code, e.title, e.event_type, e.event_date, e.start_time, e.venue, e.status,
                g.id AS gallery_id, g.status AS gallery_status, g.expires_at,
                (SELECT COUNT(*) FROM tblPhoto p WHERE p.event_id = e.id AND p.is_published = 1 AND p.is_rejected = 0 AND p.deleted_at IS NULL) AS photo_count
           FROM tblEvent e LEFT JOIN tblGallery g ON g.event_id = e.id AND g.deleted_at IS NULL
          WHERE e.customer_id = ? AND e.deleted_at IS NULL ORDER BY e.event_date DESC`,
        [customerId],
    );
}

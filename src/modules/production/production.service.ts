// Developer by: Buildnexdev.in
// Devevloper : Nandhakumar@gmail.com
// Last Edited : 06-10-2026
import { execute, json, query, queryOne, withTransaction } from '../../db/pool.js';
import { inspectImage, normalizeJpeg } from '../../lib/images.js';
import { storage } from '../../lib/storage.js';
import { hasPermission, type AuthUser } from '../../middleware/auth.js';
import { uuid } from '../../utils/crypto.js';
import { badRequest, conflict, forbidden, notFound } from '../../utils/errors.js';
import { nextNumber } from '../../utils/numbering.js';
import { likeTerm, offsetOf, paged } from '../../utils/pagination.js';
import { audit, type AuditContext } from '../audit/audit.service.js';
import { assertEventAccess } from '../events/events.service.js';
import { notifyCustomer, notifyStaff } from '../notifications/notifications.service.js';

/* ================= Album proofs ================= */

interface ProofPage {
    key: string;
    name: string;
    width: number;
    height: number;
}

interface ProofRow {
    id: number;
    event_id: number;
    order_id: number | null;
    version: number;
    title: string;
    pages: ProofPage[] | string;
    status: 'DRAFT' | 'SENT' | 'APPROVED' | 'REVISION_REQUESTED';
    customer_note: string | null;
    customer_id: number;
    event_title: string;
}

const parsePages = (p: ProofRow['pages']): ProofPage[] => (typeof p === 'string' ? (JSON.parse(p) as ProofPage[]) : p ?? []);

async function loadProof(id: number) {
    const p = await queryOne<ProofRow>(
        'SELECT ap.*, e.customer_id, e.title AS event_title FROM tblAlbumProof ap JOIN tblEvent e ON e.id = ap.event_id WHERE ap.id = ?',
        [id],
    );
    if (!p) throw notFound('Album proof');
    return p;
}

export async function uploadProof(eventId: number, title: string, files: Express.Multer.File[], actor: AuthUser, ctx: AuditContext) {
    if (!files.length) throw badRequest('Add the album pages (spreads) to upload.', [{ field: 'files', message: 'Required' }]);
    await assertEventAccess(actor, eventId, 'work');
    const pages: ProofPage[] = [];
    for (const f of files) {
        const info = await inspectImage(f.buffer).catch((err: Error) => {
            throw badRequest(`${f.originalname}: ${err.message}`);
        });
        const key = `events/${eventId}/proofs/${uuid()}.jpg`;
        await storage.put(key, await normalizeJpeg(f.buffer, 2400, 85), 'image/jpeg');
        pages.push({ key, name: f.originalname.slice(0, 120), width: info.width, height: info.height });
    }
    const version = ((await queryOne<{ v: number | null }>('SELECT MAX(version) AS v FROM tblAlbumProof WHERE event_id = ?', [eventId]))?.v ?? 0) + 1;
    const res = await execute('INSERT INTO tblAlbumProof (event_id, version, title, pages, uploaded_by) VALUES (?, ?, ?, ?, ?)', [eventId, version, title, json(pages), actor.id]);
    await audit(ctx, 'ALBUM_PROOF_UPLOADED', 'proofs', res.insertId, { eventId, version, pages: pages.length });
    return getProof(res.insertId, actor);
}

export async function listProofs(q: { page: number; pageSize: number; eventId?: number; status?: string; search?: string; customerId?: number }) {
    const where = ['1=1'];
    const params: unknown[] = [];
    if (q.eventId) { where.push('ap.event_id = ?'); params.push(q.eventId); }
    if (q.status) { where.push('ap.status = ?'); params.push(q.status); }
    if (q.customerId) { where.push("e.customer_id = ? AND ap.status <> 'DRAFT'"); params.push(q.customerId); }
    if (q.search) { where.push('(e.title LIKE ? OR c.name LIKE ? OR ap.title LIKE ?)'); const t = likeTerm(q.search); params.push(t, t, t); }
    const w = where.join(' AND ');
    const from = 'FROM tblAlbumProof ap JOIN tblEvent e ON e.id = ap.event_id JOIN tblCustomer c ON c.id = e.customer_id';
    const total = (await queryOne<{ n: number }>(`SELECT COUNT(*) AS n ${from} WHERE ${w}`, params))?.n ?? 0;
    const rows = await query(
        `SELECT ap.id, ap.event_id, ap.version, ap.title, ap.status, ap.sent_at, ap.approved_at, ap.created_at, JSON_LENGTH(ap.pages) AS page_count, ap.pages,
                e.title AS event_title, c.name AS customer_name,
                (SELECT COUNT(*) FROM tblAlbumRevision r WHERE r.proof_id = ap.id AND r.status = 'OPEN') AS open_revisions
           ${from} WHERE ${w} ORDER BY ap.id DESC LIMIT ? OFFSET ?`,
        [...params, q.pageSize, offsetOf(q)],
    );
    const items = await Promise.all(
        rows.map(async ({ pages, ...r }) => {
            const first = parsePages(pages)[0];
            return { ...r, cover_url: first ? await storage.signedUrl(first.key) : null };
        }),
    );
    return paged(items, total, q);
}

export async function getProof(id: number, actor: AuthUser) {
    const p = await loadProof(id);
    const isStaff = hasPermission(actor, 'proofs.manage', 'galleries.manage', 'events.view');
    if (!isStaff) {
        if (actor.customerId !== p.customer_id || p.status === 'DRAFT') throw notFound('Album proof');
    }
    const revisions = await query(
        'SELECT r.id, r.notes, r.page_refs, r.status, r.created_at, r.resolved_at, u.name AS requested_by_name FROM tblAlbumRevision r JOIN tblUser u ON u.id = r.requested_by WHERE r.proof_id = ? ORDER BY r.id DESC',
        [id],
    );
    const pages = await Promise.all(parsePages(p.pages).map(async (pg, i) => ({ index: i + 1, name: pg.name, width: pg.width, height: pg.height, url: await storage.signedUrl(pg.key) })));
    const { pages: _raw, ...rest } = p;
    return { ...rest, pages, revisions, can_respond: !isStaff && p.status === 'SENT' };
}

export async function sendProof(id: number, ctx: AuditContext) {
    const p = await loadProof(id);
    if (p.status === 'APPROVED') throw conflict('This proof is already approved.');
    await execute("UPDATE tblAlbumProof SET status = 'SENT', sent_at = UTC_TIMESTAMP() WHERE id = ?", [id]);
    await execute("UPDATE tblAlbumRevision SET status = 'RESOLVED', resolved_by = ?, resolved_at = UTC_TIMESTAMP() WHERE proof_id IN (SELECT id FROM (SELECT id FROM tblAlbumProof WHERE event_id = ? AND id < ?) x) AND status = 'OPEN'", [ctx.userId, p.event_id, id]);
    await audit(ctx, 'ALBUM_PROOF_SENT', 'proofs', id, { version: p.version });
    await notifyCustomer(p.customer_id, { type: 'ALBUM_PROOF_READY', title: 'Your album design is ready', body: `Version ${p.version} of the album for ${p.event_title} is ready for your review.`, link: `/customer/events?proof=${id}` });
}

/** Approving creates the print job (against a paid album order, or the album included in the booking package). */
export async function respondProof(id: number, user: AuthUser, decision: 'APPROVE' | 'REVISION', notes: string | null, pageRefs: string | null, ctx: AuditContext) {
    const p = await loadProof(id);
    if (user.customerId !== p.customer_id) throw notFound('Album proof');
    if (p.status !== 'SENT') throw conflict('This proof is not awaiting your review.');
    if (decision === 'REVISION') {
        if (!notes) throw badRequest('Describe the changes you would like.', [{ field: 'notes', message: 'Required' }]);
        await execute("UPDATE tblAlbumProof SET status = 'REVISION_REQUESTED', customer_note = ? WHERE id = ?", [notes, id]);
        await execute('INSERT INTO tblAlbumRevision (proof_id, requested_by, notes, page_refs) VALUES (?, ?, ?, ?)', [id, user.id, notes, pageRefs]);
        await audit(ctx, 'ALBUM_REVISION_REQUESTED', 'proofs', id, { pageRefs });
        await notifyStaff(['proofs.manage'], { type: 'ALBUM_REVISION', title: 'Album changes requested', body: `${user.name} requested changes to "${p.title}" v${p.version}.`, link: `/editor/proofs?open=${id}` });
        return { status: 'REVISION_REQUESTED' };
    }
    const orderId = await withTransaction(async (conn) => {
        await execute("UPDATE tblAlbumProof SET status = 'APPROVED', approved_at = UTC_TIMESTAMP(), customer_note = ? WHERE id = ?", [notes, id], conn);
        let order = await queryOne<{ id: number }>(
            "SELECT id FROM tblOrder WHERE event_id = ? AND customer_id = ? AND type = 'ALBUM' AND status IN ('PAID','PROCESSING') AND deleted_at IS NULL ORDER BY id LIMIT 1",
            [p.event_id, p.customer_id],
            conn,
        );
        if (!order) {
            const included = await queryOne<{ booking_id: number }>(
                "SELECT e.booking_id FROM tblEvent e JOIN tblBooking b ON b.id = e.booking_id JOIN tblPackage pk ON pk.id = b.package_id WHERE e.id = ? AND pk.includes_album = 1 AND b.status IN ('CONFIRMED','IN_PROGRESS','DELIVERED','COMPLETED')",
                [p.event_id],
                conn,
            );
            if (!included) return null;
            const orderNo = await nextNumber('order', conn);
            const res = await execute(
                "INSERT INTO tblOrder (order_no, customer_id, event_id, booking_id, type, status, delivery_method, notes, paid_at) VALUES (?, ?, ?, ?, 'ALBUM', 'PROCESSING', 'PICKUP', 'Album included in booking package', UTC_TIMESTAMP())",
                [orderNo, p.customer_id, p.event_id, included.booking_id],
                conn,
            );
            await execute("INSERT INTO tblOrderItem (order_id, item_type, description, quantity, unit_price, total) VALUES (?, 'ALBUM', ?, 1, 0, 0)", [res.insertId, `Album - ${p.event_title} (package)`], conn);
            await execute("INSERT IGNORE INTO tblDeliveryOrder (order_id, method) VALUES (?, 'PICKUP')", [res.insertId], conn);
            order = { id: res.insertId };
        }
        await execute("UPDATE tblOrder SET status = 'PROCESSING' WHERE id = ? AND status = 'PAID'", [order.id], conn);
        await execute('UPDATE tblAlbumProof SET order_id = ? WHERE id = ?', [order.id, id], conn);
        const existing = await queryOne("SELECT id FROM tblPrintOrder WHERE order_id = ? AND kind = 'ALBUM' AND status <> 'CANCELLED'", [order.id], conn);
        if (!existing) await execute("INSERT INTO tblPrintOrder (order_id, proof_id, kind, quantity, notes) VALUES (?, ?, 'ALBUM', 1, ?)", [order.id, id, `${p.title} v${p.version}`], conn);
        return order.id;
    });
    await audit(ctx, 'ALBUM_APPROVED', 'proofs', id, { orderId });
    await notifyStaff(['proofs.manage', 'printing.manage'], {
        type: 'ALBUM_APPROVED',
        title: 'Album approved',
        body: orderId ? `"${p.title}" v${p.version} was approved and sent to printing.` : `"${p.title}" v${p.version} was approved. No album order exists yet; ask the customer to order the printed album.`,
        link: orderId ? `/delivery/printing` : `/admin/events/${p.event_id}`,
    });
    return { status: 'APPROVED', orderId };
}

export async function resolveRevision(revisionId: number, ctx: AuditContext) {
    const res = await execute("UPDATE tblAlbumRevision SET status = 'RESOLVED', resolved_by = ?, resolved_at = UTC_TIMESTAMP() WHERE id = ? AND status = 'OPEN'", [ctx.userId, revisionId]);
    if (!res.affectedRows) throw notFound('Open revision');
    await audit(ctx, 'ALBUM_REVISION_RESOLVED', 'proofs', revisionId);
}

export async function deleteProof(id: number, ctx: AuditContext) {
    const p = await loadProof(id);
    if (p.status === 'APPROVED') throw conflict('Approved proofs are kept for printing records.');
    for (const pg of parsePages(p.pages)) await storage.delete(pg.key).catch(() => undefined);
    await execute('DELETE FROM tblAlbumProof WHERE id = ?', [id]);
    await audit(ctx, 'ALBUM_PROOF_DELETED', 'proofs', id, { version: p.version });
}

/* ================= Printing ================= */

export const PRINT_STATUSES = ['QUEUED', 'PRINTING', 'PRINTED', 'READY', 'CANCELLED'] as const;
export type PrintStatus = (typeof PRINT_STATUSES)[number];
const PRINT_FLOW: Record<PrintStatus, PrintStatus[]> = {
    QUEUED: ['PRINTING', 'CANCELLED'],
    PRINTING: ['PRINTED', 'QUEUED', 'CANCELLED'],
    PRINTED: ['READY', 'PRINTING'],
    READY: [],
    CANCELLED: ['QUEUED'],
};

export async function listPrintJobs(q: { page: number; pageSize: number; status?: PrintStatus; kind?: string; search?: string; mine?: number }) {
    const where = ["o.status NOT IN ('CREATED','CANCELLED')"];
    const params: unknown[] = [];
    if (q.status) { where.push('po.status = ?'); params.push(q.status); }
    else where.push("po.status IN ('QUEUED','PRINTING','PRINTED')");
    if (q.kind) { where.push('po.kind = ?'); params.push(q.kind); }
    if (q.mine) { where.push('po.assigned_to = ?'); params.push(q.mine); }
    if (q.search) { where.push('(o.order_no LIKE ? OR c.name LIKE ?)'); params.push(likeTerm(q.search), likeTerm(q.search)); }
    const w = where.join(' AND ');
    const from = 'FROM tblPrintOrder po JOIN tblOrder o ON o.id = po.order_id JOIN tblCustomer c ON c.id = o.customer_id LEFT JOIN tblPhoto p ON p.id = po.photo_id LEFT JOIN tblUser u ON u.id = po.assigned_to';
    const total = (await queryOne<{ n: number }>(`SELECT COUNT(*) AS n ${from} WHERE ${w}`, params))?.n ?? 0;
    const rows = await query(
        `SELECT po.id, po.order_id, po.kind, po.size, po.quantity, po.status, po.notes, po.proof_id, po.started_at, po.completed_at, po.created_at,
                o.order_no, o.delivery_method, c.name AS customer_name, c.phone AS customer_phone, p.file_name, p.thumb_key, u.name AS assigned_name, po.assigned_to
           ${from} WHERE ${w} ORDER BY FIELD(po.status, 'PRINTING', 'QUEUED', 'PRINTED', 'READY', 'CANCELLED'), po.id LIMIT ? OFFSET ?`,
        [...params, q.pageSize, offsetOf(q)],
    );
    const items = await Promise.all(rows.map(async ({ thumb_key, ...r }) => ({ ...r, thumb_url: thumb_key ? await storage.signedUrl(thumb_key) : null })));
    const counts = await query("SELECT po.status, COUNT(*) AS n FROM tblPrintOrder po JOIN tblOrder o ON o.id = po.order_id WHERE o.status NOT IN ('CREATED','CANCELLED') GROUP BY po.status");
    return { ...paged(items, total, q), counts: Object.fromEntries(counts.map((c) => [c.status, c.n])) };
}

/** Print-ready file for the operator: edited version when available, otherwise the original; album jobs get every page. */
export async function printFiles(id: number) {
    const job = await queryOne<{ id: number; photo_id: number | null; proof_id: number | null; size: string | null }>('SELECT id, photo_id, proof_id, size FROM tblPrintOrder WHERE id = ?', [id]);
    if (!job) throw notFound('Print job');
    if (job.photo_id) {
        const p = await queryOne<{ file_name: string; original_key: string; edited_key: string | null }>('SELECT file_name, original_key, edited_key FROM tblPhoto WHERE id = ?', [job.photo_id]);
        if (!p) throw notFound('Photo');
        const key = p.edited_key ?? p.original_key;
        return [{ name: `${job.size ?? ''}_${p.file_name}`.replace(/^_/, ''), url: await storage.signedUrl(key, { downloadName: `print_${job.id}_${p.file_name}`, ttlSeconds: 600 }) }];
    }
    if (job.proof_id) {
        const proof = await loadProof(job.proof_id);
        return Promise.all(parsePages(proof.pages).map(async (pg, i) => ({ name: `page_${String(i + 1).padStart(2, '0')}.jpg`, url: await storage.signedUrl(pg.key, { downloadName: `album_${job.id}_page_${i + 1}.jpg`, ttlSeconds: 600 }) })));
    }
    return [];
}

export async function updatePrintJob(id: number, input: { status?: PrintStatus; assignedTo?: number | null; notes?: string | null }, actor: AuthUser, ctx: AuditContext) {
    const job = await queryOne<{ id: number; order_id: number; status: PrintStatus; assigned_to: number | null; notes: string | null }>('SELECT id, order_id, status, assigned_to, notes FROM tblPrintOrder WHERE id = ?', [id]);
    if (!job) throw notFound('Print job');
    if (input.status && input.status !== job.status) {
        if (!PRINT_FLOW[job.status].includes(input.status)) throw conflict(`Cannot move a print job from ${job.status} to ${input.status}.`);
        if (input.status === 'CANCELLED' && !hasPermission(actor, 'orders.manage')) throw forbidden('Only managers can cancel print jobs.');
    }
    const status = input.status ?? job.status;
    await execute(
        `UPDATE tblPrintOrder SET status = ?, assigned_to = ?, notes = ?,
                started_at = IF(? = 'PRINTING' AND started_at IS NULL, UTC_TIMESTAMP(), started_at),
                completed_at = IF(? = 'READY', UTC_TIMESTAMP(), completed_at)
          WHERE id = ?`,
        [status, input.assignedTo === undefined ? job.assigned_to : input.assignedTo, input.notes === undefined ? job.notes : input.notes, status, status, id],
    );
    if (input.status && input.status !== job.status) await audit(ctx, 'PRINT_STATUS_CHANGED', 'printing', id, { from: job.status, to: input.status });

    const remaining = await queryOne<{ n: number; total: number }>("SELECT SUM(status NOT IN ('READY','CANCELLED')) AS n, SUM(status = 'READY') AS total FROM tblPrintOrder WHERE order_id = ?", [job.order_id]);
    if (status === 'READY' && Number(remaining?.n ?? 0) === 0 && Number(remaining?.total ?? 0) > 0) {
        const o = await queryOne<{ status: string; customer_id: number; order_no: string; delivery_method: string }>('SELECT status, customer_id, order_no, delivery_method FROM tblOrder WHERE id = ?', [job.order_id]);
        if (o && o.status === 'PROCESSING') {
            await execute("UPDATE tblOrder SET status = 'READY' WHERE id = ?", [job.order_id]);
            await execute("UPDATE tblDeliveryOrder SET status = 'READY' WHERE order_id = ? AND status = 'PENDING'", [job.order_id]);
            await audit(ctx, 'ORDER_STATUS_CHANGED', 'orders', job.order_id, { from: 'PROCESSING', to: 'READY', auto: true });
            await notifyCustomer(o.customer_id, {
                type: 'ORDER_READY',
                title: 'Your order is ready',
                body: o.delivery_method === 'COURIER' ? `Order ${o.order_no} is printed and will be dispatched soon.` : `Order ${o.order_no} is ready for pickup at the studio.`,
                link: `/customer/orders?open=${job.order_id}`,
            });
            await notifyStaff(['delivery.manage'], { type: 'DELIVERY_UPDATE', title: 'Order ready for delivery', body: `Order ${o.order_no} is ready (${o.delivery_method.toLowerCase()}).`, link: '/delivery/dispatch' });
        }
    }
    return queryOne('SELECT * FROM tblPrintOrder WHERE id = ?', [id]);
}

/* ================= Delivery ================= */

export const DELIVERY_STATUSES = ['PENDING', 'READY', 'DISPATCHED', 'IN_TRANSIT', 'DELIVERED', 'FAILED'] as const;
export type DeliveryStatus = (typeof DELIVERY_STATUSES)[number];
const DELIVERY_FLOW: Record<DeliveryStatus, DeliveryStatus[]> = {
    PENDING: ['READY'],
    READY: ['DISPATCHED', 'DELIVERED', 'FAILED'],
    DISPATCHED: ['IN_TRANSIT', 'DELIVERED', 'FAILED'],
    IN_TRANSIT: ['DELIVERED', 'FAILED'],
    DELIVERED: [],
    FAILED: ['READY', 'DISPATCHED'],
};

export async function listDeliveries(q: { page: number; pageSize: number; status?: DeliveryStatus; method?: string; search?: string; mine?: number }) {
    const where = ["o.status NOT IN ('CREATED','CANCELLED')"];
    const params: unknown[] = [];
    if (q.status) { where.push('d.status = ?'); params.push(q.status); }
    if (q.method) { where.push('d.method = ?'); params.push(q.method); }
    if (q.mine) { where.push('d.assigned_to = ?'); params.push(q.mine); }
    if (q.search) { where.push('(o.order_no LIKE ? OR c.name LIKE ? OR c.phone LIKE ? OR d.tracking_no LIKE ?)'); const t = likeTerm(q.search); params.push(t, t, t, t); }
    const w = where.join(' AND ');
    const from = 'FROM tblDeliveryOrder d JOIN tblOrder o ON o.id = d.order_id JOIN tblCustomer c ON c.id = o.customer_id LEFT JOIN tblUser u ON u.id = d.assigned_to';
    const total = (await queryOne<{ n: number }>(`SELECT COUNT(*) AS n ${from} WHERE ${w}`, params))?.n ?? 0;
    const items = await query(
        `SELECT d.*, o.order_no, o.type AS order_type, o.status AS order_status, o.total, c.name AS customer_name, c.phone AS customer_phone, u.name AS assigned_name,
                (SELECT COUNT(*) FROM tblOrderItem oi WHERE oi.order_id = o.id) AS item_count
           ${from} WHERE ${w} ORDER BY FIELD(d.status, 'READY', 'FAILED', 'DISPATCHED', 'IN_TRANSIT', 'PENDING', 'DELIVERED'), d.id DESC LIMIT ? OFFSET ?`,
        [...params, q.pageSize, offsetOf(q)],
    );
    const counts = await query("SELECT d.status, COUNT(*) AS n FROM tblDeliveryOrder d JOIN tblOrder o ON o.id = d.order_id WHERE o.status NOT IN ('CREATED','CANCELLED') GROUP BY d.status");
    return { ...paged(items, total, q), counts: Object.fromEntries(counts.map((c) => [c.status, c.n])) };
}

export async function updateDelivery(
    id: number,
    input: { status?: DeliveryStatus; courier?: string | null; trackingNo?: string | null; assignedTo?: number | null; notes?: string | null; method?: 'PICKUP' | 'COURIER' | 'HAND_DELIVERY' },
    ctx: AuditContext,
) {
    const d = await queryOne<{ id: number; order_id: number; status: DeliveryStatus; method: string; courier: string | null; tracking_no: string | null; assigned_to: number | null; notes: string | null }>(
        'SELECT * FROM tblDeliveryOrder WHERE id = ?',
        [id],
    );
    if (!d) throw notFound('Delivery');
    const o = await queryOne<{ status: string; customer_id: number; order_no: string }>('SELECT status, customer_id, order_no FROM tblOrder WHERE id = ?', [d.order_id]);
    if (!o) throw notFound('Order');
    const next = input.status ?? d.status;
    if (input.status && input.status !== d.status) {
        if (!DELIVERY_FLOW[d.status].includes(input.status)) throw conflict(`Cannot move a delivery from ${d.status} to ${input.status}.`);
        if (input.status !== 'FAILED' && !['READY', 'DELIVERED'].includes(o.status)) throw conflict('The order must be ready (all printing finished) before it can be dispatched or handed over.');
        const method = input.method ?? d.method;
        if (input.status === 'DISPATCHED' && method === 'COURIER' && !(input.trackingNo ?? d.tracking_no)) throw badRequest('Enter the courier tracking number before dispatching.', [{ field: 'trackingNo', message: 'Required' }]);
    }
    await execute(
        `UPDATE tblDeliveryOrder SET status = ?, method = ?, courier = ?, tracking_no = ?, assigned_to = ?, notes = ?,
                dispatched_at = IF(? IN ('DISPATCHED','IN_TRANSIT') AND dispatched_at IS NULL, UTC_TIMESTAMP(), dispatched_at),
                delivered_at = IF(? = 'DELIVERED', UTC_TIMESTAMP(), delivered_at)
          WHERE id = ?`,
        [
            next,
            input.method ?? d.method,
            input.courier === undefined ? d.courier : input.courier,
            input.trackingNo === undefined ? d.tracking_no : input.trackingNo,
            input.assignedTo === undefined ? d.assigned_to : input.assignedTo,
            input.notes === undefined ? d.notes : input.notes,
            next,
            next,
            id,
        ],
    );
    if (input.status && input.status !== d.status) {
        await audit(ctx, 'DELIVERY_STATUS_CHANGED', 'delivery', id, { from: d.status, to: input.status, orderId: d.order_id });
        if (input.status === 'DELIVERED') await execute("UPDATE tblOrder SET status = 'DELIVERED' WHERE id = ? AND status = 'READY'", [d.order_id]);
        const messages: Partial<Record<DeliveryStatus, string>> = {
            DISPATCHED: `Order ${o.order_no} has been dispatched${input.trackingNo ?? d.tracking_no ? ` (tracking: ${input.trackingNo ?? d.tracking_no})` : ''}.`,
            IN_TRANSIT: `Order ${o.order_no} is on the way.`,
            DELIVERED: `Order ${o.order_no} has been delivered. Thank you!`,
            FAILED: `We could not deliver order ${o.order_no}. Our team will contact you.`,
        };
        const body = messages[input.status];
        if (body) await notifyCustomer(o.customer_id, { type: 'DELIVERY_UPDATE', title: 'Delivery update', body, link: `/customer/orders?open=${d.order_id}` });
    }
    return queryOne('SELECT * FROM tblDeliveryOrder WHERE id = ?', [id]);
}

export async function productionDashboard(userId: number) {
    const [print, delivery, mine, readyOrders] = await Promise.all([
        query("SELECT po.status, po.kind, COUNT(*) AS n FROM tblPrintOrder po JOIN tblOrder o ON o.id = po.order_id WHERE o.status NOT IN ('CREATED','CANCELLED') GROUP BY po.status, po.kind"),
        query("SELECT d.status, d.method, COUNT(*) AS n FROM tblDeliveryOrder d JOIN tblOrder o ON o.id = d.order_id WHERE o.status NOT IN ('CREATED','CANCELLED') GROUP BY d.status, d.method"),
        queryOne<{ prints: number; deliveries: number }>(
            "SELECT (SELECT COUNT(*) FROM tblPrintOrder WHERE assigned_to = ? AND status IN ('QUEUED','PRINTING','PRINTED')) AS prints, (SELECT COUNT(*) FROM tblDeliveryOrder WHERE assigned_to = ? AND status IN ('READY','DISPATCHED','IN_TRANSIT')) AS deliveries",
            [userId, userId],
        ),
        query(
            `SELECT o.id, o.order_no, o.type, o.delivery_method, o.updated_at, c.name AS customer_name, c.phone AS customer_phone, d.id AS delivery_id, d.status AS delivery_status
               FROM tblOrder o JOIN tblCustomer c ON c.id = o.customer_id LEFT JOIN tblDeliveryOrder d ON d.order_id = o.id
              WHERE o.status = 'READY' ORDER BY o.updated_at LIMIT 20`,
        ),
    ]);
    return { print, delivery, mine, readyOrders };
}

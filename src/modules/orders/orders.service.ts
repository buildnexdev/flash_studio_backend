import type { PoolConnection } from 'mysql2/promise';
import { execute, json, query, queryOne, withTransaction } from '../../db/pool.js';
import { storage } from '../../lib/storage.js';
import { hasPermission, type AuthUser } from '../../middleware/auth.js';
import { badRequest, conflict, forbidden, notFound } from '../../utils/errors.js';
import { nextNumber } from '../../utils/numbering.js';
import { likeTerm, offsetOf, orderBy, paged } from '../../utils/pagination.js';
import { audit, type AuditContext } from '../audit/audit.service.js';
import { evaluateCoupon, getPackage } from '../catalog/catalog.service.js';
import type { GalleryAccess } from '../galleries/galleries.service.js';
import { scopeFilter } from '../galleries/galleries.service.js';
import { notifyCustomer, notifyStaff } from '../notifications/notifications.service.js';
import { getSetting } from '../settings/settings.service.js';
import { entitledPhotoIds, isEntitled } from './entitlements.js';

export const ORDER_TYPES = ['PHOTO_DOWNLOAD', 'ALBUM', 'PRINT', 'FRAME', 'CANVAS', 'PACKAGE'] as const;
export type OrderType = (typeof ORDER_TYPES)[number];
export const ORDER_STATUSES = ['CREATED', 'PAID', 'PROCESSING', 'READY', 'DELIVERED', 'COMPLETED', 'CANCELLED'] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

export interface Address {
    name: string;
    phone: string;
    line1: string;
    line2?: string | null;
    city: string;
    state: string;
    pincode: string;
}

export interface OrderInput {
    type: OrderType;
    galleryId?: number;
    eventId?: number;
    packageId?: number;
    photoIds?: number[];
    items?: { photoId: number; size: string; quantity: number }[];
    deliveryMethod?: 'DIGITAL' | 'PICKUP' | 'COURIER';
    shippingAddress?: Address | null;
    couponCode?: string | null;
    notes?: string | null;
}

interface Line {
    itemType: OrderType;
    photoId: number | null;
    packageId: number | null;
    description: string;
    size: string | null;
    quantity: number;
    unitPrice: number;
}

/** Tax is included in studio prices; this extracts the GST portion for invoices. */
export const inclusiveTax = (total: number, percent: number) => Math.round((total * percent) / (100 + percent));

async function visiblePhotos(access: GalleryAccess, photoIds: number[]) {
    const scope = scopeFilter(access);
    const rows = await query<{ id: number; file_name: string; price: number | null; event_id: number }>(
        `SELECT p.id, p.file_name, p.price, p.event_id FROM tblPhoto p
          WHERE p.id IN (?) AND p.gallery_id = ? AND p.deleted_at IS NULL AND p.is_rejected = 0 AND p.is_published = 1${scope.sql}`,
        [photoIds, access.gallery.id, ...scope.params],
    );
    if (rows.length !== new Set(photoIds).size) throw badRequest('Some photos are not available in this gallery.');
    return rows;
}

/** Build priced order lines entirely on the server. Client-supplied prices are never used. */
export async function priceOrder(input: OrderInput, customerId: number, access: GalleryAccess | null): Promise<{ lines: Line[]; eventId: number | null; fee: number }> {
    const pricing = await getSetting('pricing');
    const lines: Line[] = [];
    let eventId: number | null = null;
    let fee = 0;

    if (input.type === 'PHOTO_DOWNLOAD') {
        if (!access || !input.photoIds?.length) throw badRequest('Choose photos to purchase.');
        const photos = await visiblePhotos(access, input.photoIds);
        const owned = await entitledPhotoIds(customerId, photos.map((p) => p.id));
        const toBuy = photos.filter((p) => !owned.has(p.id));
        if (!toBuy.length) throw conflict('You already own the HD version of these photos.');
        const price = access.gallery.photo_price ?? pricing.photoDownload;
        for (const p of toBuy) lines.push({ itemType: 'PHOTO_DOWNLOAD', photoId: p.id, packageId: null, description: `HD download - ${p.file_name}`, size: null, quantity: 1, unitPrice: p.price ?? price });
        eventId = access.gallery.event_id;
    } else if (input.type === 'PRINT' || input.type === 'FRAME' || input.type === 'CANVAS') {
        if (!access || !input.items?.length) throw badRequest('Add at least one photo to print.');
        const table = input.type === 'PRINT' ? pricing.prints : input.type === 'FRAME' ? pricing.frames : pricing.canvas;
        const photos = await visiblePhotos(access, input.items.map((i) => i.photoId));
        const names = new Map(photos.map((p) => [p.id, p.file_name]));
        for (const item of input.items) {
            const unit = table[item.size];
            if (unit === undefined) throw badRequest(`Size ${item.size} is not available for ${input.type.toLowerCase()}s.`, [{ field: 'size', message: 'Unavailable' }]);
            lines.push({ itemType: input.type, photoId: item.photoId, packageId: null, description: `${input.type[0]}${input.type.slice(1).toLowerCase()} ${item.size} - ${names.get(item.photoId)}`, size: item.size, quantity: item.quantity, unitPrice: unit });
        }
        eventId = access.gallery.event_id;
    } else if (input.type === 'ALBUM') {
        if (!input.eventId) throw badRequest('Choose the event for the album.');
        const e = await queryOne<{ id: number; customer_id: number; title: string }>('SELECT id, customer_id, title FROM tblEvent WHERE id = ? AND deleted_at IS NULL', [input.eventId]);
        if (!e || e.customer_id !== customerId) throw notFound('Event');
        lines.push({ itemType: 'ALBUM', photoId: null, packageId: null, description: `Printed album - ${e.title}`, size: null, quantity: 1, unitPrice: pricing.album });
        eventId = e.id;
    } else if (input.type === 'PACKAGE') {
        if (!input.packageId) throw badRequest('Choose a package.');
        const pkg = await getPackage(input.packageId);
        if (!pkg || !pkg.is_active) throw badRequest('This package is not available.');
        if (input.eventId) {
            const e = await queryOne<{ customer_id: number }>('SELECT customer_id FROM tblEvent WHERE id = ? AND deleted_at IS NULL', [input.eventId]);
            if (!e || e.customer_id !== customerId) throw notFound('Event');
            eventId = input.eventId;
        }
        lines.push({ itemType: 'PACKAGE', photoId: null, packageId: pkg.id, description: `Package - ${pkg.name}`, size: null, quantity: 1, unitPrice: Number(pkg.price) });
    }

    const physical = ['PRINT', 'FRAME', 'CANVAS', 'ALBUM'].includes(input.type);
    if (physical && input.deliveryMethod === 'COURIER') {
        if (!input.shippingAddress) throw badRequest('Enter a delivery address for courier delivery.', [{ field: 'shippingAddress', message: 'Required' }]);
        fee = pricing.courierFee;
    }
    return { lines, eventId, fee };
}

export async function createOrder(input: OrderInput, user: AuthUser, access: GalleryAccess | null, ctx: AuditContext) {
    if (!user.customerId) throw forbidden('Sign in with a customer account to place an order.');
    const { lines, eventId, fee } = await priceOrder(input, user.customerId, access);
    const subtotal = lines.reduce((s, l) => s + l.unitPrice * l.quantity, 0);
    const physical = ['PRINT', 'FRAME', 'CANVAS', 'ALBUM'].includes(input.type);
    const deliveryMethod = physical ? (input.deliveryMethod === 'COURIER' ? 'COURIER' : 'PICKUP') : 'DIGITAL';
    const taxPercent = (await getSetting('pricing')).taxPercent;

    const orderId = await withTransaction(async (conn) => {
        let discount = 0;
        let couponId: number | null = null;
        if (input.couponCode) {
            const c = await evaluateCoupon(input.couponCode, subtotal, 'ORDER', conn);
            discount = c.discount;
            couponId = c.couponId;
        }
        const total = subtotal - discount + fee;
        const orderNo = await nextNumber('order', conn);
        const res = await execute(
            `INSERT INTO tblOrder (order_no, customer_id, event_id, type, subtotal, discount, tax, total, coupon_id, delivery_method, shipping_address, notes)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [orderNo, user.customerId, eventId, input.type, subtotal + fee, discount, inclusiveTax(total, taxPercent), total, couponId, deliveryMethod, json(deliveryMethod === 'COURIER' ? input.shippingAddress : null), input.notes ?? null],
            conn,
        );
        for (const l of lines) {
            await execute(
                'INSERT INTO tblOrderItem (order_id, item_type, photo_id, package_id, description, size, quantity, unit_price, total) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
                [res.insertId, l.itemType, l.photoId, l.packageId, l.description.slice(0, 255), l.size, l.quantity, l.unitPrice, l.unitPrice * l.quantity],
                conn,
            );
        }
        if (fee) await execute("INSERT INTO tblOrderItem (order_id, item_type, description, quantity, unit_price, total) VALUES (?, ?, 'Courier delivery', 1, ?, ?)", [res.insertId, input.type, fee, fee], conn);
        return res.insertId;
    });
    await audit(ctx, 'ORDER_CREATED', 'orders', orderId, { type: input.type, items: lines.length });
    return getOrder(orderId, user);
}

export interface OrderFilter {
    page: number;
    pageSize: number;
    search?: string;
    status?: OrderStatus;
    type?: OrderType;
    customerId?: number;
    sort?: string;
    order: 'asc' | 'desc';
}

export async function listOrders(f: OrderFilter) {
    const where = ['o.deleted_at IS NULL'];
    const params: unknown[] = [];
    if (f.search) {
        where.push('(o.order_no LIKE ? OR c.name LIKE ? OR c.phone LIKE ?)');
        const t = likeTerm(f.search);
        params.push(t, t, t);
    }
    if (f.status) { where.push('o.status = ?'); params.push(f.status); }
    if (f.type) { where.push('o.type = ?'); params.push(f.type); }
    if (f.customerId) { where.push('o.customer_id = ?'); params.push(f.customerId); }
    const w = where.join(' AND ');
    const total = (await queryOne<{ n: number }>(`SELECT COUNT(*) AS n FROM tblOrder o JOIN tblCustomer c ON c.id = o.customer_id WHERE ${w}`, params))?.n ?? 0;
    const items = await query(
        `SELECT o.id, o.order_no, o.type, o.status, o.total, o.delivery_method, o.paid_at, o.created_at, o.event_id,
                c.id AS customer_id, c.name AS customer_name, c.phone AS customer_phone, e.title AS event_title,
                (SELECT COUNT(*) FROM tblOrderItem oi WHERE oi.order_id = o.id) AS item_count,
                d.status AS delivery_status
           FROM tblOrder o JOIN tblCustomer c ON c.id = o.customer_id LEFT JOIN tblEvent e ON e.id = o.event_id LEFT JOIN tblDeliveryOrder d ON d.order_id = o.id
          WHERE ${w} ORDER BY ${orderBy(f.sort, { created: 'o.created_at', total: 'o.total', status: 'o.status' }, 'o.created_at', f.order)} LIMIT ? OFFSET ?`,
        [...params, f.pageSize, offsetOf(f)],
    );
    return paged(items, total, f);
}

export async function getOrder(id: number, actor?: AuthUser) {
    const o = await queryOne(
        `SELECT o.*, c.name AS customer_name, c.email AS customer_email, c.phone AS customer_phone, e.title AS event_title, cp.code AS coupon_code
           FROM tblOrder o JOIN tblCustomer c ON c.id = o.customer_id LEFT JOIN tblEvent e ON e.id = o.event_id LEFT JOIN tblCoupon cp ON cp.id = o.coupon_id
          WHERE o.id = ? AND o.deleted_at IS NULL`,
        [id],
    );
    if (!o) throw notFound('Order');
    if (actor && !hasPermission(actor, 'orders.view', 'orders.manage') && actor.customerId !== o.customer_id) throw notFound('Order');
    const [items, payments, prints, delivery, invoice] = await Promise.all([
        query('SELECT oi.*, p.thumb_key FROM tblOrderItem oi LEFT JOIN tblPhoto p ON p.id = oi.photo_id WHERE oi.order_id = ? ORDER BY oi.id', [id]),
        query('SELECT id, payment_no, amount, status, method, provider, paid_at, created_at FROM tblPayment WHERE order_id = ? ORDER BY id DESC', [id]),
        query('SELECT po.*, u.name AS assigned_name FROM tblPrintOrder po LEFT JOIN tblUser u ON u.id = po.assigned_to WHERE po.order_id = ? ORDER BY po.id', [id]),
        queryOne('SELECT * FROM tblDeliveryOrder WHERE order_id = ?', [id]),
        queryOne('SELECT id, invoice_no FROM tblInvoice WHERE order_id = ? ORDER BY id DESC LIMIT 1', [id]),
    ]);
    return {
        ...o,
        items: await Promise.all(items.map(async ({ thumb_key, ...i }) => ({ ...i, thumb_url: thumb_key ? await storage.signedUrl(thumb_key) : null }))),
        payments,
        prints,
        delivery,
        invoice,
        can_pay: o.status === 'CREATED' && Number(o.total) > 0,
    };
}

/** Run inside the payment transaction once a payment for this order succeeds. Idempotent. */
export async function fulfilPaidOrder(orderId: number, conn: PoolConnection): Promise<{ type: OrderType; customerId: number; orderNo: string; photoIds: number[] }> {
    const o = await queryOne<{ id: number; type: OrderType; status: OrderStatus; customer_id: number; order_no: string; delivery_method: string; shipping_address: unknown; coupon_id: number | null }>(
        'SELECT id, type, status, customer_id, order_no, delivery_method, shipping_address, coupon_id FROM tblOrder WHERE id = ? FOR UPDATE',
        [orderId],
        conn,
    );
    if (!o) throw notFound('Order');
    const items = await query<{ id: number; item_type: OrderType; photo_id: number | null; size: string | null; quantity: number }>('SELECT id, item_type, photo_id, size, quantity FROM tblOrderItem WHERE order_id = ?', [orderId], conn);
    const result = { type: o.type, customerId: o.customer_id, orderNo: o.order_no, photoIds: items.map((i) => i.photo_id).filter((x): x is number => !!x) };
    if (o.status !== 'CREATED') return result;

    const digital = o.type === 'PHOTO_DOWNLOAD' || o.type === 'PACKAGE';
    await execute(`UPDATE tblOrder SET status = ?, paid_at = UTC_TIMESTAMP()${digital ? ', completed_at = UTC_TIMESTAMP()' : ''} WHERE id = ?`, [digital ? 'COMPLETED' : 'PROCESSING', orderId], conn);
    if (o.coupon_id) await execute('UPDATE tblCoupon SET used_count = used_count + 1 WHERE id = ?', [o.coupon_id], conn);

    if (['PRINT', 'FRAME', 'CANVAS'].includes(o.type)) {
        for (const i of items.filter((x) => x.photo_id)) {
            await execute('INSERT INTO tblPrintOrder (order_id, order_item_id, kind, photo_id, size, quantity) VALUES (?, ?, ?, ?, ?, ?)', [orderId, i.id, i.item_type, i.photo_id, i.size, i.quantity], conn);
        }
    }
    if (!digital) {
        await execute('INSERT IGNORE INTO tblDeliveryOrder (order_id, method, address) VALUES (?, ?, ?)', [orderId, o.delivery_method === 'COURIER' ? 'COURIER' : 'PICKUP', json(o.shipping_address ?? null)], conn);
    }
    return result;
}

const STATUS_FLOW: Record<OrderStatus, OrderStatus[]> = {
    CREATED: ['CANCELLED'],
    PAID: ['PROCESSING', 'CANCELLED'],
    PROCESSING: ['READY', 'CANCELLED'],
    READY: ['DELIVERED'],
    DELIVERED: ['COMPLETED'],
    COMPLETED: [],
    CANCELLED: [],
};

export async function updateOrderStatus(id: number, status: OrderStatus, note: string | null, actor: AuthUser, ctx: AuditContext) {
    const o = await queryOne<{ status: OrderStatus; customer_id: number; order_no: string; type: OrderType }>('SELECT status, customer_id, order_no, type FROM tblOrder WHERE id = ? AND deleted_at IS NULL', [id]);
    if (!o) throw notFound('Order');
    if (!hasPermission(actor, 'orders.manage') && status === 'CANCELLED') throw forbidden('Only managers can cancel orders.');
    if (!STATUS_FLOW[o.status].includes(status)) throw conflict(`Cannot move an order from ${o.status} to ${status}.`);
    if (status === 'READY') {
        const pending = await queryOne<{ n: number }>("SELECT COUNT(*) AS n FROM tblPrintOrder WHERE order_id = ? AND status NOT IN ('READY','CANCELLED')", [id]);
        if ((pending?.n ?? 0) > 0) throw conflict('Some print jobs for this order are not ready yet.');
    }
    await execute(`UPDATE tblOrder SET status = ?${status === 'COMPLETED' ? ', completed_at = UTC_TIMESTAMP()' : ''}, notes = IF(? IS NULL, notes, CONCAT(COALESCE(notes, ''), '\n', ?)) WHERE id = ?`, [status, note, note, id]);
    if (status === 'READY') await execute("UPDATE tblDeliveryOrder SET status = 'READY' WHERE order_id = ? AND status = 'PENDING'", [id]);
    if (status === 'DELIVERED') await execute("UPDATE tblDeliveryOrder SET status = 'DELIVERED', delivered_at = UTC_TIMESTAMP() WHERE order_id = ? AND status <> 'DELIVERED'", [id]);
    await audit(ctx, 'ORDER_STATUS_CHANGED', 'orders', id, { from: o.status, to: status, note });
    if (status === 'READY') await notifyCustomer(o.customer_id, { type: 'ORDER_READY', title: 'Your order is ready', body: `Order ${o.order_no} is ready${o.type === 'ALBUM' ? '' : ' for pickup or dispatch'}.`, link: `/customer/orders?open=${id}` });
    if (status === 'DELIVERED' || status === 'CANCELLED') await notifyCustomer(o.customer_id, { type: 'DELIVERY_UPDATE', title: `Order ${status.toLowerCase()}`, body: `Order ${o.order_no} has been ${status.toLowerCase()}.`, link: `/customer/orders?open=${id}` });
    return getOrder(id, actor);
}

export async function cancelUnpaidOrder(id: number, user: AuthUser, ctx: AuditContext) {
    const o = await queryOne<{ customer_id: number; status: OrderStatus }>('SELECT customer_id, status FROM tblOrder WHERE id = ? AND deleted_at IS NULL', [id]);
    if (!o || o.customer_id !== user.customerId) throw notFound('Order');
    if (o.status !== 'CREATED') throw conflict('Only unpaid orders can be cancelled. Contact the studio for paid orders.');
    await execute("UPDATE tblOrder SET status = 'CANCELLED' WHERE id = ?", [id]);
    await execute("UPDATE tblPayment SET status = 'FAILED', failure_reason = 'Order cancelled' WHERE order_id = ? AND status IN ('PENDING','PROCESSING')", [id]);
    await audit(ctx, 'ORDER_CANCELLED', 'orders', id);
}

/* ---------------- Downloads ---------------- */

export async function downloadLink(photoId: number, user: AuthUser, ip: string, ua: string, ctx: AuditContext) {
    const p = await queryOne<{ id: number; event_id: number; gallery_id: number; file_name: string; original_key: string; edited_key: string | null; status: string; allow_download: number }>(
        `SELECT p.id, p.event_id, p.gallery_id, p.file_name, p.original_key, p.edited_key, p.status, g.allow_download
           FROM tblPhoto p JOIN tblGallery g ON g.id = p.gallery_id WHERE p.id = ? AND p.deleted_at IS NULL AND p.is_rejected = 0`,
        [photoId],
    );
    if (!p) throw notFound('Photo');
    const isStaff = hasPermission(user, 'galleries.manage', 'photos.manage');
    let orderId: number | null = null;
    if (!isStaff) {
        if (!user.customerId) throw forbidden();
        const ent = await isEntitled(user.customerId, photoId);
        if (!ent.entitled) throw forbidden('Purchase this photo to download the HD version.');
        if (!p.allow_download) throw forbidden('Downloads are currently disabled for this gallery.');
        orderId = ent.orderId;
    }
    const useEdited = !!p.edited_key && ['EDITED', 'APPROVED', 'DELIVERED'].includes(p.status);
    const key = useEdited ? p.edited_key! : p.original_key;
    const name = useEdited ? `${p.file_name.replace(/\.\w+$/, '')}_edited.jpg` : p.file_name;
    await execute('INSERT INTO tblDownload (photo_id, event_id, user_id, customer_id, order_id, variant, ip, user_agent) VALUES (?, ?, ?, ?, ?, ?, ?, ?)', [
        photoId,
        p.event_id,
        user.id,
        user.customerId,
        orderId,
        useEdited ? 'EDITED' : 'ORIGINAL',
        ip,
        ua,
    ]);
    await audit(ctx, 'PHOTO_DOWNLOAD', 'photos', photoId, { variant: useEdited ? 'EDITED' : 'ORIGINAL' });
    return { url: await storage.signedUrl(key, { downloadName: name, ttlSeconds: 120 }), expiresIn: 120, fileName: name };
}

/** All HD photos the customer can download, grouped by event. */
export async function customerDownloads(customerId: number) {
    const rows = await query<{ id: number; event_id: number; event_title: string; file_name: string; thumb_key: string | null; status: string; allow_download: number }>(
        `SELECT p.id, p.event_id, e.title AS event_title, p.file_name, p.thumb_key, p.status, g.allow_download
           FROM tblPhoto p JOIN tblEvent e ON e.id = p.event_id JOIN tblGallery g ON g.id = p.gallery_id
          WHERE p.deleted_at IS NULL AND p.is_rejected = 0 AND (
                p.id IN (SELECT oi.photo_id FROM tblOrderItem oi JOIN tblOrder o ON o.id = oi.order_id WHERE o.customer_id = ? AND o.status IN ('PAID','PROCESSING','READY','DELIVERED','COMPLETED') AND oi.item_type = 'PHOTO_DOWNLOAD')
             OR e.id IN (SELECT ev.id FROM tblEvent ev JOIN tblBooking b ON b.id = ev.booking_id JOIN tblPackage pk ON pk.id = b.package_id
                          WHERE ev.customer_id = ? AND pk.includes_digital = 1 AND b.status IN ('CONFIRMED','IN_PROGRESS','DELIVERED','COMPLETED'))
             OR e.id IN (SELECT o.event_id FROM tblOrder o JOIN tblOrderItem oi ON oi.order_id = o.id JOIN tblPackage pk ON pk.id = oi.package_id
                          WHERE o.customer_id = ? AND o.type = 'PACKAGE' AND pk.includes_digital = 1 AND o.status IN ('PAID','PROCESSING','READY','DELIVERED','COMPLETED')))
          ORDER BY e.event_date DESC, p.id`,
        [customerId, customerId, customerId],
    );
    const counts = await query<{ photo_id: number; n: number }>('SELECT photo_id, COUNT(*) AS n FROM tblDownload WHERE customer_id = ? GROUP BY photo_id', [customerId]);
    const countMap = new Map(counts.map((c) => [c.photo_id, c.n]));
    const items = await Promise.all(rows.map(async ({ thumb_key, ...r }) => ({ ...r, thumb_url: thumb_key ? await storage.signedUrl(thumb_key) : null, downloads: countMap.get(r.id) ?? 0 })));
    const groups = new Map<number, { event_id: number; event_title: string; photos: typeof items }>();
    for (const i of items) {
        if (!groups.has(i.event_id)) groups.set(i.event_id, { event_id: i.event_id, event_title: i.event_title, photos: [] });
        groups.get(i.event_id)!.photos.push(i);
    }
    return [...groups.values()];
}

/* ---------------- Invoices ---------------- */

export async function listInvoices(q: { page: number; pageSize: number; customerId?: number; search?: string }) {
    const where = ['1=1'];
    const params: unknown[] = [];
    if (q.customerId) { where.push('i.customer_id = ?'); params.push(q.customerId); }
    if (q.search) { where.push('(i.invoice_no LIKE ? OR c.name LIKE ?)'); params.push(likeTerm(q.search), likeTerm(q.search)); }
    const w = where.join(' AND ');
    const total = (await queryOne<{ n: number }>(`SELECT COUNT(*) AS n FROM tblInvoice i JOIN tblCustomer c ON c.id = i.customer_id WHERE ${w}`, params))?.n ?? 0;
    const items = await query(
        `SELECT i.id, i.invoice_no, i.description, i.total, i.tax, i.issued_at, c.name AS customer_name, p.payment_no, p.purpose
           FROM tblInvoice i JOIN tblCustomer c ON c.id = i.customer_id JOIN tblPayment p ON p.id = i.payment_id WHERE ${w} ORDER BY i.id DESC LIMIT ? OFFSET ?`,
        [...params, q.pageSize, offsetOf(q)],
    );
    return paged(items, total, q);
}

export async function getInvoice(id: number, actor: AuthUser) {
    const inv = await queryOne(
        `SELECT i.*, c.name AS customer_name, c.email AS customer_email, c.phone AS customer_phone, c.address AS customer_address, c.city AS customer_city,
                p.payment_no, p.purpose, p.method, p.provider, p.provider_payment_id, p.paid_at, o.order_no, b.booking_no
           FROM tblInvoice i JOIN tblCustomer c ON c.id = i.customer_id JOIN tblPayment p ON p.id = i.payment_id
           LEFT JOIN tblOrder o ON o.id = i.order_id LEFT JOIN tblBooking b ON b.id = i.booking_id WHERE i.id = ?`,
        [id],
    );
    if (!inv) throw notFound('Invoice');
    if (!hasPermission(actor, 'payments.view', 'orders.view') && actor.customerId !== inv.customer_id) throw notFound('Invoice');
    return { ...inv, studio: await getSetting('studio'), taxPercent: (await getSetting('pricing')).taxPercent };
}

export async function notifyPrintTeam(orderNo: string, orderId: number) {
    await notifyStaff(['printing.manage'], { type: 'GENERAL', title: 'New paid order', body: `Order ${orderNo} is paid and ready for production.`, link: `/delivery/orders?open=${orderId}` });
}

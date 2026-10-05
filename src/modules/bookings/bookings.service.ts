import type { PoolConnection } from 'mysql2/promise';
import { execute, query, queryOne, withTransaction, type Db, pool } from '../../db/pool.js';
import type { AuthUser } from '../../middleware/auth.js';
import { hasPermission } from '../../middleware/auth.js';
import { badRequest, conflict, forbidden, notFound } from '../../utils/errors.js';
import { nextNumber } from '../../utils/numbering.js';
import { likeTerm, offsetOf, orderBy, paged } from '../../utils/pagination.js';
import { audit, type AuditContext } from '../audit/audit.service.js';
import { evaluateCoupon, getPackage } from '../catalog/catalog.service.js';
import { findOrCreateCustomer } from '../customers/customers.service.js';
import { ensureEventForBooking } from '../events/events.service.js';
import { notifyCustomer, notifyStaff } from '../notifications/notifications.service.js';

export const BOOKING_STATUSES = ['ENQUIRY', 'QUOTED', 'ADVANCE_PENDING', 'CONFIRMED', 'IN_PROGRESS', 'DELIVERED', 'COMPLETED', 'CANCELLED'] as const;
export type BookingStatus = (typeof BOOKING_STATUSES)[number];

export interface BookingDetails {
    serviceId?: number | null;
    packageId?: number | null;
    eventType: string;
    eventDate: string;
    startTime?: string | null;
    endTime?: string | null;
    venue?: string | null;
    guests?: number | null;
    message?: string | null;
}

export interface EnquiryInput extends BookingDetails {
    name: string;
    email: string;
    phone: string;
    city?: string | null;
}

async function packagePricing(packageId: number | null | undefined, db: Db = pool) {
    if (!packageId) return { total: 0, advance: 0 };
    const pkg = await getPackage(packageId, db);
    if (!pkg || !pkg.is_active) throw badRequest('The selected package is not available.', [{ field: 'packageId', message: 'Unavailable' }]);
    return { total: Number(pkg.price), advance: Math.round((Number(pkg.price) * Number(pkg.advance_percent)) / 100) };
}

async function insertBooking(db: PoolConnection, customerId: number, d: BookingDetails, source: 'WEBSITE' | 'ADMIN' | 'CUSTOMER_PORTAL', createdBy: number | null, internalNotes?: string | null) {
    const pricing = await packagePricing(d.packageId, db);
    const bookingNo = await nextNumber('booking', db);
    const res = await execute(
        `INSERT INTO tblBooking (booking_no, customer_id, service_id, package_id, event_type, event_date, start_time, end_time, venue, guests, message, internal_notes,
                               total_amount, advance_amount, source, created_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [bookingNo, customerId, d.serviceId ?? null, d.packageId ?? null, d.eventType, d.eventDate, d.startTime ?? null, d.endTime ?? null, d.venue ?? null, d.guests ?? null, d.message ?? null, internalNotes ?? null, pricing.total, pricing.advance, source, createdBy],
        db,
    );
    return { id: res.insertId, bookingNo };
}

const futureDate = (ymd: string) => {
    const today = new Date().toISOString().slice(0, 10);
    if (ymd < today) throw badRequest('The event date cannot be in the past.', [{ field: 'eventDate', message: 'Choose today or a future date' }]);
};

/** Public website enquiry (no login). */
export async function createEnquiry(input: EnquiryInput, ctx: AuditContext) {
    futureDate(input.eventDate);
    const { id, bookingNo } = await withTransaction(async (conn) => {
        const customerId = await findOrCreateCustomer({ name: input.name, email: input.email, phone: input.phone, city: input.city, source: 'WEBSITE' }, conn);
        return insertBooking(conn, customerId, input, 'WEBSITE', null);
    });
    await audit(ctx, 'BOOKING_CREATED', 'bookings', id, { source: 'WEBSITE', bookingNo });
    await notifyStaff(['bookings.manage'], { type: 'BOOKING_RECEIVED', title: 'New enquiry', body: `${input.name} enquired about a ${input.eventType} on ${input.eventDate}.`, link: `/admin/bookings?open=${id}` });
    return { id, bookingNo };
}

/** Logged-in customer booking from the portal. */
export async function createCustomerBooking(actor: AuthUser, input: BookingDetails, ctx: AuditContext) {
    if (!actor.customerId) throw forbidden('A customer account is required.');
    futureDate(input.eventDate);
    const { id, bookingNo } = await withTransaction((conn) => insertBooking(conn, actor.customerId!, input, 'CUSTOMER_PORTAL', actor.id));
    await audit(ctx, 'BOOKING_CREATED', 'bookings', id, { source: 'CUSTOMER_PORTAL', bookingNo });
    await notifyStaff(['bookings.manage'], { type: 'BOOKING_RECEIVED', title: 'New booking request', body: `${actor.name} requested a ${input.eventType} on ${input.eventDate}.`, link: `/admin/bookings?open=${id}` });
    return getBooking(id, actor);
}

/** Staff-created booking for an existing or new customer. */
export async function createAdminBooking(input: BookingDetails & { customerId: number; internalNotes?: string | null }, actor: AuthUser, ctx: AuditContext) {
    const { id, bookingNo } = await withTransaction(async (conn) => {
        const c = await queryOne('SELECT id FROM tblCustomer WHERE id = ? AND deleted_at IS NULL', [input.customerId], conn);
        if (!c) throw badRequest('Customer not found.', [{ field: 'customerId', message: 'Not found' }]);
        return insertBooking(conn, input.customerId, input, 'ADMIN', actor.id, input.internalNotes);
    });
    await audit(ctx, 'BOOKING_CREATED', 'bookings', id, { source: 'ADMIN', bookingNo });
    return getBooking(id, actor);
}

export interface BookingFilter {
    page: number;
    pageSize: number;
    search?: string;
    status?: BookingStatus;
    from?: string;
    to?: string;
    customerId?: number;
    sort?: string;
    order: 'asc' | 'desc';
}

export async function listBookings(f: BookingFilter) {
    const where = ['b.deleted_at IS NULL'];
    const params: unknown[] = [];
    if (f.search) {
        where.push('(b.booking_no LIKE ? OR c.name LIKE ? OR c.phone LIKE ? OR c.email LIKE ? OR b.venue LIKE ?)');
        const t = likeTerm(f.search);
        params.push(t, t, t, t, t);
    }
    if (f.status) { where.push('b.status = ?'); params.push(f.status); }
    if (f.from) { where.push('b.event_date >= ?'); params.push(f.from); }
    if (f.to) { where.push('b.event_date <= ?'); params.push(f.to); }
    if (f.customerId) { where.push('b.customer_id = ?'); params.push(f.customerId); }
    const w = where.join(' AND ');
    const total = (await queryOne<{ n: number }>(`SELECT COUNT(*) AS n FROM tblBooking b JOIN tblCustomer c ON c.id = b.customer_id WHERE ${w}`, params))?.n ?? 0;
    const items = await query(
        `SELECT b.id, b.booking_no, b.event_type, b.event_date, b.start_time, b.venue, b.status, b.total_amount, b.advance_amount, b.paid_amount, b.source, b.created_at,
                c.id AS customer_id, c.name AS customer_name, c.phone AS customer_phone, c.email AS customer_email,
                pk.name AS package_name, s.name AS service_name,
                (SELECT e.id FROM tblEvent e WHERE e.booking_id = b.id AND e.deleted_at IS NULL LIMIT 1) AS event_id
           FROM tblBooking b JOIN tblCustomer c ON c.id = b.customer_id
           LEFT JOIN tblPackage pk ON pk.id = b.package_id LEFT JOIN tblService s ON s.id = b.service_id
          WHERE ${w}
          ORDER BY ${orderBy(f.sort, { date: 'b.event_date', created: 'b.created_at', status: 'b.status', amount: 'b.total_amount' }, 'b.created_at', f.order)}
          LIMIT ? OFFSET ?`,
        [...params, f.pageSize, offsetOf(f)],
    );
    return paged(items, total, f);
}

export async function getBooking(id: number, actor?: AuthUser) {
    const b = await queryOne(
        `SELECT b.*, c.name AS customer_name, c.email AS customer_email, c.phone AS customer_phone, c.city AS customer_city,
                pk.name AS package_name, pk.includes_digital, pk.includes_album, s.name AS service_name, cp.code AS coupon_code
           FROM tblBooking b JOIN tblCustomer c ON c.id = b.customer_id
           LEFT JOIN tblPackage pk ON pk.id = b.package_id LEFT JOIN tblService s ON s.id = b.service_id LEFT JOIN tblCoupon cp ON cp.id = b.coupon_id
          WHERE b.id = ? AND b.deleted_at IS NULL`,
        [id],
    );
    if (!b) throw notFound('Booking');
    if (actor && !hasPermission(actor, 'bookings.view', 'bookings.manage') && actor.customerId !== b.customer_id) throw notFound('Booking');
    const isStaff = !actor || hasPermission(actor, 'bookings.view', 'bookings.manage');
    const [quotations, payments, event] = await Promise.all([
        query(`SELECT * FROM tblQuotation WHERE booking_id = ? ${isStaff ? '' : "AND status <> 'DRAFT'"} ORDER BY id DESC`, [id]),
        query('SELECT id, payment_no, purpose, amount, status, method, provider, paid_at, created_at FROM tblPayment WHERE booking_id = ? ORDER BY id DESC', [id]),
        queryOne('SELECT id, event_code, title, status FROM tblEvent WHERE booking_id = ? AND deleted_at IS NULL', [id]),
    ]);
    const items = quotations.length ? await query('SELECT * FROM tblQuotationItem WHERE quotation_id IN (?) ORDER BY sort_order, id', [quotations.map((q) => q.id)]) : [];
    const due = Math.max(0, Number(b.total_amount) - Number(b.paid_amount));
    const advanceDue = Math.max(0, Number(b.advance_amount) - Number(b.paid_amount));
    if (!isStaff) delete b.internal_notes;
    return {
        ...b,
        balance_due: due,
        advance_due: advanceDue,
        can_pay_advance: b.status === 'ADVANCE_PENDING' && advanceDue > 0,
        can_pay_balance: ['CONFIRMED', 'IN_PROGRESS', 'DELIVERED'].includes(b.status) && due > 0,
        quotations: quotations.map((q) => ({ ...q, items: items.filter((i) => i.quotation_id === q.id) })),
        payments,
        event,
    };
}

export async function updateBooking(id: number, input: BookingDetails & { internalNotes?: string | null; couponCode?: string | null }, actor: AuthUser, ctx: AuditContext) {
    const b = await queryOne<{ status: BookingStatus; total_amount: number; package_id: number | null }>('SELECT status, total_amount, package_id FROM tblBooking WHERE id = ? AND deleted_at IS NULL', [id]);
    if (!b) throw notFound('Booking');
    if (['COMPLETED', 'CANCELLED'].includes(b.status)) throw conflict(`A ${b.status.toLowerCase()} booking cannot be edited.`);
    await withTransaction(async (conn) => {
        await execute(
            'UPDATE tblBooking SET service_id = ?, package_id = ?, event_type = ?, event_date = ?, start_time = ?, end_time = ?, venue = ?, guests = ?, message = ?, internal_notes = ? WHERE id = ?',
            [input.serviceId ?? null, input.packageId ?? null, input.eventType, input.eventDate, input.startTime ?? null, input.endTime ?? null, input.venue ?? null, input.guests ?? null, input.message ?? null, input.internalNotes ?? null, id],
            conn,
        );
        // Package change before quoting re-prices the booking
        if (['ENQUIRY'].includes(b.status) && (input.packageId ?? null) !== b.package_id) {
            const pricing = await packagePricing(input.packageId, conn);
            await execute('UPDATE tblBooking SET total_amount = ?, advance_amount = ? WHERE id = ?', [pricing.total, pricing.advance, id], conn);
        }
        await execute('UPDATE tblEvent SET event_type = ?, event_date = ?, start_time = ?, end_time = ?, venue = ? WHERE booking_id = ? AND status = ?', [
            input.eventType,
            input.eventDate,
            input.startTime ?? null,
            input.endTime ?? null,
            input.venue ?? null,
            id,
            'UPCOMING',
        ], conn);
    });
    await audit(ctx, 'BOOKING_UPDATED', 'bookings', id);
    return getBooking(id, actor);
}

export async function cancelBooking(id: number, reason: string | null, actor: AuthUser, ctx: AuditContext) {
    const b = await queryOne<{ status: BookingStatus; customer_id: number; booking_no: string }>('SELECT status, customer_id, booking_no FROM tblBooking WHERE id = ? AND deleted_at IS NULL', [id]);
    if (!b) throw notFound('Booking');
    const isStaff = hasPermission(actor, 'bookings.manage');
    if (!isStaff && actor.customerId !== b.customer_id) throw notFound('Booking');
    if (!isStaff && !['ENQUIRY', 'QUOTED', 'ADVANCE_PENDING'].includes(b.status)) throw conflict('Please contact the studio to cancel a confirmed booking.');
    if (['COMPLETED', 'CANCELLED'].includes(b.status)) throw conflict(`Booking is already ${b.status.toLowerCase()}.`);
    await withTransaction(async (conn) => {
        await execute("UPDATE tblBooking SET status = 'CANCELLED', cancelled_at = UTC_TIMESTAMP(), internal_notes = CONCAT(COALESCE(internal_notes, ''), ?) WHERE id = ?", [reason ? `\nCancelled: ${reason}` : '', id], conn);
        await execute("UPDATE tblEvent SET status = 'CANCELLED' WHERE booking_id = ? AND status IN ('UPCOMING')", [id], conn);
        await execute("UPDATE tblQuotation SET status = 'EXPIRED' WHERE booking_id = ? AND status IN ('DRAFT','SENT')", [id], conn);
    });
    await audit(ctx, 'BOOKING_CANCELLED', 'bookings', id, { reason });
    if (isStaff) await notifyCustomer(b.customer_id, { type: 'GENERAL', title: 'Booking cancelled', body: `Booking ${b.booking_no} has been cancelled.${reason ? ` Reason: ${reason}` : ''}`, link: '/customer/bookings' });
    else await notifyStaff(['bookings.manage'], { type: 'GENERAL', title: 'Booking cancelled by customer', body: `${b.booking_no} was cancelled by the customer.`, link: `/admin/bookings?open=${id}` });
    return getBooking(id, actor);
}

/** Final delivery done: booking moves to DELIVERED, or COMPLETED when fully paid. */
export async function markDelivered(id: number, actor: AuthUser, ctx: AuditContext) {
    const b = await queryOne<{ status: BookingStatus; total_amount: number; paid_amount: number; customer_id: number; booking_no: string }>('SELECT status, total_amount, paid_amount, customer_id, booking_no FROM tblBooking WHERE id = ? AND deleted_at IS NULL', [id]);
    if (!b) throw notFound('Booking');
    if (!['CONFIRMED', 'IN_PROGRESS'].includes(b.status)) throw conflict(`Cannot mark a ${b.status.toLowerCase()} booking as delivered.`);
    const next = Number(b.paid_amount) >= Number(b.total_amount) ? 'COMPLETED' : 'DELIVERED';
    await execute('UPDATE tblBooking SET status = ? WHERE id = ?', [next, id]);
    await audit(ctx, 'BOOKING_DELIVERED', 'bookings', id, { status: next });
    const due = Number(b.total_amount) - Number(b.paid_amount);
    await notifyCustomer(b.customer_id, {
        type: 'DELIVERY_UPDATE',
        title: 'Final delivery completed',
        body: next === 'COMPLETED' ? `Booking ${b.booking_no} is complete. Thank you!` : `Booking ${b.booking_no} has been delivered. A balance of ₹${(due / 100).toFixed(2)} is due.`,
        link: `/customer/bookings?open=${id}`,
    });
    return getBooking(id, actor);
}

/* ---------------- Quotations ---------------- */

export interface QuotationInput {
    items: { description: string; quantity: number; unitPrice: number }[];
    discount: number;
    taxPercent: number;
    advanceAmount?: number | null;
    advancePercent?: number | null;
    validUntil?: string | null;
    notes?: string | null;
    terms?: string | null;
    couponCode?: string | null;
}

/** Pure quotation maths (exported for unit tests). */
export function computeQuotation(items: QuotationInput['items'], discount: number, taxPercent: number) {
    const lines = items.map((i) => ({ ...i, total: i.quantity * i.unitPrice }));
    const subtotal = lines.reduce((s, l) => s + l.total, 0);
    const disc = Math.min(discount, subtotal);
    const tax = Math.round(((subtotal - disc) * taxPercent) / 100);
    return { lines, subtotal, discount: disc, tax, total: subtotal - disc + tax };
}

async function writeQuotation(conn: PoolConnection, quotationId: number, bookingId: number, input: QuotationInput) {
    let discount = input.discount;
    let couponId: number | null = null;
    const base = computeQuotation(input.items, 0, 0);
    if (input.couponCode) {
        const c = await evaluateCoupon(input.couponCode, base.subtotal, 'BOOKING', conn);
        discount += c.discount;
        couponId = c.couponId;
    }
    const q = computeQuotation(input.items, discount, input.taxPercent);
    const advance = input.advanceAmount ?? Math.round((q.total * (input.advancePercent ?? 30)) / 100);
    if (advance > q.total) throw badRequest('The advance cannot exceed the quotation total.', [{ field: 'advanceAmount', message: 'Too high' }]);
    await execute(
        'UPDATE tblQuotation SET subtotal = ?, discount = ?, tax_percent = ?, tax = ?, total = ?, advance_amount = ?, valid_until = ?, notes = ?, terms = ? WHERE id = ?',
        [q.subtotal, q.discount, input.taxPercent, q.tax, q.total, advance, input.validUntil ?? null, input.notes ?? null, input.terms ?? null, quotationId],
        conn,
    );
    await execute('DELETE FROM tblQuotationItem WHERE quotation_id = ?', [quotationId], conn);
    let i = 0;
    for (const l of q.lines) await execute('INSERT INTO tblQuotationItem (quotation_id, description, quantity, unit_price, total, sort_order) VALUES (?, ?, ?, ?, ?, ?)', [quotationId, l.description, l.quantity, l.unitPrice, l.total, i++], conn);
    if (couponId) await execute('UPDATE tblBooking SET coupon_id = ? WHERE id = ?', [couponId, bookingId], conn);
}

export async function createQuotation(bookingId: number, input: QuotationInput, actor: AuthUser, ctx: AuditContext) {
    const b = await queryOne<{ status: BookingStatus }>('SELECT status FROM tblBooking WHERE id = ? AND deleted_at IS NULL', [bookingId]);
    if (!b) throw notFound('Booking');
    if (!['ENQUIRY', 'QUOTED', 'ADVANCE_PENDING'].includes(b.status)) throw conflict('Quotations can only be created before the booking is confirmed.');
    const id = await withTransaction(async (conn) => {
        const no = await nextNumber('quotation', conn);
        const res = await execute('INSERT INTO tblQuotation (quotation_no, booking_id, created_by) VALUES (?, ?, ?)', [no, bookingId, actor.id], conn);
        await writeQuotation(conn, res.insertId, bookingId, input);
        return res.insertId;
    });
    await audit(ctx, 'QUOTATION_CREATED', 'bookings', bookingId, { quotationId: id });
    return getBooking(bookingId, actor);
}

async function loadQuotation(id: number, db: Db = pool) {
    const q = await queryOne<{ id: number; booking_id: number; status: string; total: number; advance_amount: number; quotation_no: string; valid_until: string | null }>('SELECT * FROM tblQuotation WHERE id = ?', [id], db);
    if (!q) throw notFound('Quotation');
    return q;
}

export async function updateQuotation(id: number, input: QuotationInput, actor: AuthUser, ctx: AuditContext) {
    const q = await loadQuotation(id);
    if (!['DRAFT', 'SENT'].includes(q.status)) throw conflict(`A ${q.status.toLowerCase()} quotation cannot be edited.`);
    await withTransaction((conn) => writeQuotation(conn, id, q.booking_id, input));
    await audit(ctx, 'QUOTATION_UPDATED', 'bookings', q.booking_id, { quotationId: id });
    return getBooking(q.booking_id, actor);
}

export async function sendQuotation(id: number, actor: AuthUser, ctx: AuditContext) {
    const q = await loadQuotation(id);
    if (!['DRAFT', 'SENT'].includes(q.status)) throw conflict('Only draft quotations can be sent.');
    const b = await queryOne<{ customer_id: number; booking_no: string; status: BookingStatus }>('SELECT customer_id, booking_no, status FROM tblBooking WHERE id = ?', [q.booking_id]);
    await withTransaction(async (conn) => {
        await execute("UPDATE tblQuotation SET status = 'SENT', sent_at = UTC_TIMESTAMP() WHERE id = ?", [id], conn);
        await execute("UPDATE tblBooking SET status = 'QUOTED' WHERE id = ? AND status = 'ENQUIRY'", [q.booking_id], conn);
    });
    await audit(ctx, 'QUOTATION_SENT', 'bookings', q.booking_id, { quotationId: id });
    await notifyCustomer(b!.customer_id, {
        type: 'QUOTATION_SENT',
        title: 'Your quotation is ready',
        body: `Quotation ${q.quotation_no} for booking ${b!.booking_no}: total ₹${(Number(q.total) / 100).toFixed(2)}. Sign in to review and accept it.`,
        link: `/customer/bookings?open=${q.booking_id}`,
    });
    return getBooking(q.booking_id, actor);
}

/**
 * Accept or reject a quotation. Accepting fixes the booking total/advance from the quotation;
 * with no advance due the booking is confirmed right away (and its event created).
 */
export async function respondQuotation(id: number, decision: 'ACCEPT' | 'REJECT', actor: AuthUser, ctx: AuditContext) {
    const q = await loadQuotation(id);
    const b = await queryOne<{ id: number; customer_id: number; status: BookingStatus; paid_amount: number; booking_no: string }>('SELECT id, customer_id, status, paid_amount, booking_no FROM tblBooking WHERE id = ?', [q.booking_id]);
    if (!b) throw notFound('Booking');
    const isStaff = hasPermission(actor, 'bookings.manage');
    if (!isStaff && actor.customerId !== b.customer_id) throw notFound('Quotation');
    if (q.status !== 'SENT') throw conflict('This quotation is not awaiting a response.');
    if (q.valid_until && q.valid_until < new Date().toISOString().slice(0, 10)) {
        await execute("UPDATE tblQuotation SET status = 'EXPIRED' WHERE id = ?", [id]);
        throw conflict('This quotation has expired. Please ask the studio for a new one.');
    }

    let confirmed = false;
    await withTransaction(async (conn) => {
        if (decision === 'REJECT') {
            await execute("UPDATE tblQuotation SET status = 'REJECTED', responded_at = UTC_TIMESTAMP() WHERE id = ?", [id], conn);
            return;
        }
        await execute("UPDATE tblQuotation SET status = 'ACCEPTED', responded_at = UTC_TIMESTAMP() WHERE id = ?", [id], conn);
        await execute("UPDATE tblQuotation SET status = 'EXPIRED' WHERE booking_id = ? AND id <> ? AND status IN ('DRAFT','SENT')", [q.booking_id, id], conn);
        const advanceDue = Math.max(0, Number(q.advance_amount) - Number(b.paid_amount));
        confirmed = advanceDue === 0;
        await execute(`UPDATE tblBooking SET total_amount = ?, advance_amount = ?, status = ?${confirmed ? ', confirmed_at = UTC_TIMESTAMP()' : ''} WHERE id = ?`, [
            q.total,
            q.advance_amount,
            confirmed ? 'CONFIRMED' : 'ADVANCE_PENDING',
            q.booking_id,
        ], conn);
        if (confirmed) await ensureEventForBooking(q.booking_id, ctx, conn);
    });
    await audit(ctx, decision === 'ACCEPT' ? 'QUOTATION_ACCEPTED' : 'QUOTATION_REJECTED', 'bookings', q.booking_id, { quotationId: id });
    if (isStaff) {
        await notifyCustomer(b.customer_id, { type: 'GENERAL', title: `Quotation ${decision === 'ACCEPT' ? 'accepted' : 'declined'}`, body: `Quotation ${q.quotation_no} was ${decision === 'ACCEPT' ? 'accepted' : 'declined'} on your behalf.`, link: `/customer/bookings?open=${b.id}` });
    } else {
        await notifyStaff(['bookings.manage'], { type: 'GENERAL', title: `Quotation ${decision === 'ACCEPT' ? 'accepted' : 'declined'}`, body: `${b.booking_no}: the customer ${decision === 'ACCEPT' ? 'accepted' : 'declined'} quotation ${q.quotation_no}.`, link: `/admin/bookings?open=${b.id}` });
    }
    if (confirmed) await notifyCustomer(b.customer_id, { type: 'BOOKING_CONFIRMED', title: 'Booking confirmed', body: `Booking ${b.booking_no} is confirmed.`, link: `/customer/bookings?open=${b.id}` });
    return getBooking(q.booking_id, actor);
}

export async function deleteQuotation(id: number, actor: AuthUser, ctx: AuditContext) {
    const q = await loadQuotation(id);
    if (q.status !== 'DRAFT') throw conflict('Only draft quotations can be deleted.');
    await execute('DELETE FROM tblQuotation WHERE id = ?', [id]);
    await audit(ctx, 'QUOTATION_DELETED', 'bookings', q.booking_id, { quotationId: id });
    return getBooking(q.booking_id, actor);
}

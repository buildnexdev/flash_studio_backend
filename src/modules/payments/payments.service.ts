import type { PoolConnection } from 'mysql2/promise';
import { config } from '../../config/env.js';
import { execute, json, query, queryOne, withTransaction } from '../../db/pool.js';
import { devPay, paymentProvider } from '../../lib/payments.js';
import { emitTo, rooms } from '../../lib/realtime.js';
import { hasPermission, type AuthUser } from '../../middleware/auth.js';
import { badRequest, conflict, forbidden, notFound } from '../../utils/errors.js';
import { nextNumber } from '../../utils/numbering.js';
import { likeTerm, offsetOf, orderBy, paged } from '../../utils/pagination.js';
import { audit, systemCtx, type AuditContext } from '../audit/audit.service.js';
import { ensureEventForBooking } from '../events/events.service.js';
import { notifyCustomer, notifyStaff } from '../notifications/notifications.service.js';
import { fulfilPaidOrder, inclusiveTax, notifyPrintTeam, type OrderType } from '../orders/orders.service.js';
import { getSetting } from '../settings/settings.service.js';

export const PAYMENT_PURPOSES = ['ADVANCE', 'BALANCE', 'PHOTO_PURCHASE', 'PACKAGE', 'HD_UNLOCK', 'PRINT', 'ALBUM'] as const;
export type PaymentPurpose = (typeof PAYMENT_PURPOSES)[number];
export type PaymentStatus = 'PENDING' | 'PROCESSING' | 'SUCCESS' | 'FAILED' | 'REFUNDED';

const ORDER_PURPOSE: Record<OrderType, PaymentPurpose> = {
    PHOTO_DOWNLOAD: 'HD_UNLOCK',
    PRINT: 'PRINT',
    FRAME: 'PRINT',
    CANVAS: 'PRINT',
    ALBUM: 'ALBUM',
    PACKAGE: 'PACKAGE',
};

interface PaymentRow {
    id: number;
    payment_no: string;
    customer_id: number;
    booking_id: number | null;
    order_id: number | null;
    purpose: PaymentPurpose;
    amount: number;
    currency: string;
    status: PaymentStatus;
    provider: string;
    provider_order_id: string | null;
    provider_payment_id: string | null;
}

/** Work out what is owed. The amount always comes from the database, never from the client. */
async function amountDue(customerId: number, target: { bookingId?: number; orderId?: number; purpose?: 'ADVANCE' | 'BALANCE' }) {
    if (target.orderId) {
        const o = await queryOne<{ id: number; customer_id: number; status: string; total: number; type: OrderType; order_no: string }>('SELECT id, customer_id, status, total, type, order_no FROM tblOrder WHERE id = ? AND deleted_at IS NULL', [target.orderId]);
        if (!o || o.customer_id !== customerId) throw notFound('Order');
        if (o.status !== 'CREATED') throw conflict('This order has already been paid or cancelled.');
        if (Number(o.total) <= 0) throw badRequest('Nothing to pay for this order.');
        return { amount: Number(o.total), purpose: ORDER_PURPOSE[o.type], bookingId: null, orderId: o.id, description: `Order ${o.order_no}` };
    }
    if (target.bookingId) {
        const b = await queryOne<{ id: number; customer_id: number; status: string; total_amount: number; advance_amount: number; paid_amount: number; booking_no: string }>(
            'SELECT id, customer_id, status, total_amount, advance_amount, paid_amount, booking_no FROM tblBooking WHERE id = ? AND deleted_at IS NULL',
            [target.bookingId],
        );
        if (!b || b.customer_id !== customerId) throw notFound('Booking');
        const purpose = target.purpose ?? (b.status === 'ADVANCE_PENDING' ? 'ADVANCE' : 'BALANCE');
        if (purpose === 'ADVANCE') {
            if (b.status !== 'ADVANCE_PENDING') throw conflict('No advance is due for this booking.');
            const due = Number(b.advance_amount) - Number(b.paid_amount);
            if (due <= 0) throw conflict('The advance has already been paid.');
            return { amount: due, purpose, bookingId: b.id, orderId: null, description: `Advance for booking ${b.booking_no}` };
        }
        if (!['CONFIRMED', 'IN_PROGRESS', 'DELIVERED'].includes(b.status)) throw conflict('The balance can be paid once the booking is confirmed.');
        const due = Number(b.total_amount) - Number(b.paid_amount);
        if (due <= 0) throw conflict('This booking is fully paid.');
        return { amount: due, purpose: 'BALANCE' as const, bookingId: b.id, orderId: null, description: `Balance for booking ${b.booking_no}` };
    }
    throw badRequest('Specify a booking or an order to pay for.');
}

export async function createPayment(user: AuthUser, target: { bookingId?: number; orderId?: number; purpose?: 'ADVANCE' | 'BALANCE' }, ctx: AuditContext) {
    if (!user.customerId) throw forbidden('A customer account is required to pay.');
    const due = await amountDue(user.customerId, target);
    const paymentNo = await nextNumber('payment');
    const res = await execute(
        'INSERT INTO tblPayment (payment_no, customer_id, booking_id, order_id, purpose, amount, currency, provider) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        [paymentNo, user.customerId, due.bookingId, due.orderId, due.purpose, due.amount, config.CURRENCY, paymentProvider.name],
    );
    let providerOrderId: string;
    try {
        const po = await paymentProvider.createOrder(due.amount, config.CURRENCY, paymentNo, { payment_no: paymentNo, purpose: due.purpose });
        providerOrderId = po.id;
    } catch (err) {
        await execute("UPDATE tblPayment SET status = 'FAILED', failure_reason = ? WHERE id = ?", [(err as Error).message.slice(0, 250), res.insertId]);
        throw badRequest('Could not start the payment. Please try again in a moment.');
    }
    await execute("UPDATE tblPayment SET provider_order_id = ?, status = 'PROCESSING' WHERE id = ?", [providerOrderId, res.insertId]);
    await audit(ctx, 'PAYMENT_CREATED', 'payments', res.insertId, { purpose: due.purpose, amount: due.amount });
    const studio = await getSetting('studio');
    return {
        paymentId: res.insertId,
        paymentNo,
        provider: paymentProvider.name,
        keyId: paymentProvider.publicKey,
        providerOrderId,
        amount: due.amount,
        currency: config.CURRENCY,
        description: due.description,
        studioName: studio.name,
        prefill: { name: user.name, email: user.email ?? '', contact: user.phone ?? '' },
    };
}

/** Apply a confirmed payment. Runs in one transaction and is safe to call more than once (callback + webhook). */
async function applySuccess(paymentId: number, providerPaymentId: string | null, method: string | null, ctx: AuditContext, recordedBy?: number | null) {
    const outcome = await withTransaction(async (conn) => {
        const p = await queryOne<PaymentRow>('SELECT * FROM tblPayment WHERE id = ? FOR UPDATE', [paymentId], conn);
        if (!p) throw notFound('Payment');
        if (p.status === 'SUCCESS' || p.status === 'REFUNDED') return { already: true, payment: p, effects: null };
        await execute("UPDATE tblPayment SET status = 'SUCCESS', provider_payment_id = COALESCE(?, provider_payment_id), method = COALESCE(?, method), paid_at = UTC_TIMESTAMP(), failure_reason = NULL, recorded_by = ? WHERE id = ?", [
            providerPaymentId,
            method,
            recordedBy ?? null,
            paymentId,
        ], conn);
        const effects = await applyEffects(conn, p, ctx);
        await createInvoice(conn, p, effects.description);
        return { already: false, payment: p, effects };
    });
    if (!outcome.already && outcome.effects) {
        const p = outcome.payment;
        await audit(ctx, 'PAYMENT_SUCCESS', 'payments', p.id, { purpose: p.purpose, amount: p.amount, provider: p.provider });
        const customerUser = await queryOne<{ user_id: number | null }>('SELECT user_id FROM tblCustomer WHERE id = ?', [p.customer_id]);
        if (customerUser?.user_id) emitTo(rooms.user(customerUser.user_id), 'payment:success', { paymentId: p.id, orderId: p.order_id, bookingId: p.booking_id, photoIds: outcome.effects.photoIds });
        await notifyCustomer(p.customer_id, { type: 'PAYMENT_SUCCESS', title: 'Payment received', body: `We received ₹${(p.amount / 100).toFixed(2)} for ${outcome.effects.description}. Thank you!`, link: '/customer/payments' });
        if (outcome.effects.confirmedBooking) await notifyCustomer(p.customer_id, { type: 'BOOKING_CONFIRMED', title: 'Booking confirmed', body: `${outcome.effects.description.replace('Advance for ', '')} is confirmed. We look forward to your event!`, link: '/customer/bookings' });
        if (outcome.effects.hdUnlocked) await notifyCustomer(p.customer_id, { type: 'HD_UNLOCKED', title: 'HD downloads unlocked', body: `${outcome.effects.photoIds.length} photo(s) are ready to download in full resolution.`, link: '/customer/downloads', external: false });
        if (outcome.effects.orderNo && outcome.effects.physical) await notifyPrintTeam(outcome.effects.orderNo, p.order_id!);
        await notifyStaff(['payments.view'], { type: 'PAYMENT_SUCCESS', title: 'Payment received', body: `₹${(p.amount / 100).toFixed(2)} - ${outcome.effects.description}`, link: '/admin/payments' });
    }
    return getPayment(paymentId);
}

async function applyEffects(conn: PoolConnection, p: PaymentRow, ctx: AuditContext) {
    const effects = { description: '', confirmedBooking: false, hdUnlocked: false, photoIds: [] as number[], orderNo: null as string | null, physical: false };
    if (p.booking_id) {
        const b = await queryOne<{ id: number; booking_no: string; status: string; total_amount: number; advance_amount: number; paid_amount: number }>(
            'SELECT id, booking_no, status, total_amount, advance_amount, paid_amount FROM tblBooking WHERE id = ? FOR UPDATE',
            [p.booking_id],
            conn,
        );
        if (b) {
            const paid = Number(b.paid_amount) + Number(p.amount);
            effects.description = `${p.purpose === 'ADVANCE' ? 'Advance for' : 'Balance for'} booking ${b.booking_no}`;
            let status = b.status;
            if (b.status === 'ADVANCE_PENDING' && paid >= Number(b.advance_amount)) {
                status = 'CONFIRMED';
                effects.confirmedBooking = true;
            }
            if (b.status === 'DELIVERED' && paid >= Number(b.total_amount)) status = 'COMPLETED';
            await execute(`UPDATE tblBooking SET paid_amount = ?, status = ?${effects.confirmedBooking ? ', confirmed_at = UTC_TIMESTAMP()' : ''} WHERE id = ?`, [paid, status, b.id], conn);
            if (effects.confirmedBooking) await ensureEventForBooking(b.id, ctx, conn);
        }
    }
    if (p.order_id) {
        const r = await fulfilPaidOrder(p.order_id, conn);
        effects.description = `order ${r.orderNo}`;
        effects.orderNo = r.orderNo;
        effects.hdUnlocked = r.type === 'PHOTO_DOWNLOAD' || r.type === 'PACKAGE';
        effects.physical = ['PRINT', 'FRAME', 'CANVAS', 'ALBUM'].includes(r.type);
        effects.photoIds = r.photoIds;
    }
    return effects;
}

async function createInvoice(conn: PoolConnection, p: PaymentRow, description: string) {
    const exists = await queryOne('SELECT id FROM tblInvoice WHERE payment_id = ?', [p.id], conn);
    if (exists) return;
    const taxPercent = (await getSetting('pricing')).taxPercent;
    const lines = p.order_id
        ? await query('SELECT description, quantity, unit_price, total FROM tblOrderItem WHERE order_id = ?', [p.order_id], conn)
        : [{ description: description.charAt(0).toUpperCase() + description.slice(1), quantity: 1, unit_price: p.amount, total: p.amount }];
    const tax = inclusiveTax(Number(p.amount), taxPercent);
    const invoiceNo = await nextNumber('invoice', conn);
    await execute(
        'INSERT INTO tblInvoice (invoice_no, customer_id, payment_id, booking_id, order_id, description, subtotal, tax, total, line_items) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [invoiceNo, p.customer_id, p.id, p.booking_id, p.order_id, description.slice(0, 255), Number(p.amount) - tax, tax, p.amount, json(lines)],
        conn,
    );
}

async function markFailed(paymentId: number, reason: string, ctx: AuditContext) {
    const res = await execute("UPDATE tblPayment SET status = 'FAILED', failure_reason = ? WHERE id = ? AND status IN ('PENDING','PROCESSING')", [reason.slice(0, 250), paymentId]);
    if (res.affectedRows) {
        await audit(ctx, 'PAYMENT_FAILED', 'payments', paymentId, { reason });
        const p = await queryOne<{ customer_id: number }>('SELECT customer_id FROM tblPayment WHERE id = ?', [paymentId]);
        if (p) await notifyCustomer(p.customer_id, { type: 'PAYMENT_FAILED', title: 'Payment failed', body: 'Your payment did not go through. No money was taken; please try again.', link: '/customer/payments', external: false });
    }
}

/**
 * Verify the checkout callback. Never trust the client: check the HMAC signature AND
 * re-fetch the payment from the gateway to confirm status and amount.
 */
export async function verifyPayment(user: AuthUser, input: { paymentId: number; providerOrderId: string; providerPaymentId: string; signature: string }, ctx: AuditContext) {
    const p = await queryOne<PaymentRow>('SELECT * FROM tblPayment WHERE id = ?', [input.paymentId]);
    if (!p || p.customer_id !== user.customerId) throw notFound('Payment');
    if (p.status === 'SUCCESS') return getPayment(p.id);
    if (p.provider_order_id !== input.providerOrderId) throw badRequest('Payment does not match this order.');
    if (!paymentProvider.verifySignature(input.providerOrderId, input.providerPaymentId, input.signature)) {
        await audit(ctx, 'PAYMENT_SIGNATURE_INVALID', 'payments', p.id);
        await markFailed(p.id, 'Invalid payment signature', ctx);
        throw badRequest('Payment verification failed.');
    }
    const remote = await paymentProvider.fetchPayment(input.providerPaymentId);
    if (remote.orderId !== p.provider_order_id || Number(remote.amount) !== Number(p.amount)) {
        await markFailed(p.id, 'Amount or order mismatch', ctx);
        throw badRequest('Payment amount mismatch.');
    }
    if (remote.status === 'failed') {
        await markFailed(p.id, 'Declined by the payment gateway', ctx);
        throw badRequest('The payment was declined.');
    }
    if (remote.status !== 'captured' && remote.status !== 'authorized') throw conflict('The payment is still being processed. We will update you shortly.');
    return applySuccess(p.id, remote.id, remote.method, ctx);
}

/** Gateway webhook (server to server). The raw body signature is verified before anything is trusted. */
export async function handleWebhook(rawBody: Buffer, signature: string) {
    if (!paymentProvider.verifyWebhook(rawBody, signature)) throw forbidden('Invalid webhook signature');
    const event = JSON.parse(rawBody.toString('utf8')) as { event: string; payload: any };
    const entity = event.payload?.payment?.entity ?? event.payload?.refund?.entity;
    const orderId: string | undefined = event.payload?.payment?.entity?.order_id;
    const ctx = { ...systemCtx, userAgent: 'payment-webhook' };
    if (event.event === 'payment.captured' || event.event === 'order.paid') {
        const oid = orderId ?? event.payload?.order?.entity?.id;
        const p = await queryOne<PaymentRow>('SELECT * FROM tblPayment WHERE provider = ? AND provider_order_id = ?', [paymentProvider.name, oid]);
        if (!p) return { handled: false, reason: 'unknown order' };
        if (Number(entity?.amount ?? event.payload?.order?.entity?.amount_paid) !== Number(p.amount)) return { handled: false, reason: 'amount mismatch' };
        await applySuccess(p.id, entity?.id ?? null, entity?.method ?? null, ctx);
        return { handled: true };
    }
    if (event.event === 'payment.failed' && orderId) {
        const p = await queryOne<PaymentRow>('SELECT id FROM tblPayment WHERE provider = ? AND provider_order_id = ?', [paymentProvider.name, orderId]);
        if (p) await markFailed(p.id, entity?.error_description ?? 'Payment failed', ctx);
        return { handled: !!p };
    }
    if (event.event === 'refund.processed') {
        const paymentId = entity?.payment_id;
        const p = await queryOne<PaymentRow>('SELECT id FROM tblPayment WHERE provider_payment_id = ?', [paymentId]);
        if (p) await execute("UPDATE tblPayment SET status = 'REFUNDED', refunded_amount = LEAST(amount, refunded_amount + ?) WHERE id = ? AND status <> 'REFUNDED'", [Number(entity?.amount ?? 0), p.id]);
        return { handled: !!p };
    }
    return { handled: false, reason: `ignored ${event.event}` };
}

/** Local test gateway: simulate checkout. Only exists when PAYMENT_PROVIDER=devpay (never in production). */
export async function devCheckout(user: AuthUser, paymentId: number, outcome: 'success' | 'failure') {
    if (!devPay) throw notFound('Route');
    const p = await queryOne<PaymentRow>('SELECT * FROM tblPayment WHERE id = ?', [paymentId]);
    if (!p || p.customer_id !== user.customerId || !p.provider_order_id) throw notFound('Payment');
    return devPay.checkout(p.provider_order_id, outcome);
}

/** Staff records a cash / bank transfer / UPI-to-studio payment. Applies the same effects as an online payment. */
export async function recordOfflinePayment(input: { bookingId?: number; orderId?: number; amount: number; method: string; reference?: string | null }, actor: AuthUser, ctx: AuditContext) {
    let customerId: number;
    let purpose: PaymentPurpose;
    if (input.orderId) {
        const o = await queryOne<{ customer_id: number; type: OrderType; status: string; total: number }>('SELECT customer_id, type, status, total FROM tblOrder WHERE id = ?', [input.orderId]);
        if (!o) throw notFound('Order');
        if (o.status !== 'CREATED') throw conflict('This order is already paid or cancelled.');
        if (input.amount !== Number(o.total)) throw badRequest(`Order payments must be for the full amount (₹${(Number(o.total) / 100).toFixed(2)}).`);
        customerId = o.customer_id;
        purpose = ORDER_PURPOSE[o.type];
    } else if (input.bookingId) {
        const b = await queryOne<{ customer_id: number; status: string; total_amount: number; paid_amount: number }>('SELECT customer_id, status, total_amount, paid_amount FROM tblBooking WHERE id = ?', [input.bookingId]);
        if (!b) throw notFound('Booking');
        if (['CANCELLED', 'COMPLETED', 'ENQUIRY', 'QUOTED'].includes(b.status)) throw conflict(`Cannot record a payment for a ${b.status.toLowerCase()} booking.`);
        const due = Number(b.total_amount) - Number(b.paid_amount);
        if (input.amount > due) throw badRequest(`The amount exceeds the balance due (₹${(due / 100).toFixed(2)}).`);
        customerId = b.customer_id;
        purpose = b.status === 'ADVANCE_PENDING' ? 'ADVANCE' : 'BALANCE';
    } else {
        throw badRequest('Specify a booking or an order.');
    }
    const paymentNo = await nextNumber('payment');
    const res = await execute(
        "INSERT INTO tblPayment (payment_no, customer_id, booking_id, order_id, purpose, amount, currency, provider, provider_order_id, method, meta, status) VALUES (?, ?, ?, ?, ?, ?, ?, 'offline', ?, ?, ?, 'PROCESSING')",
        [paymentNo, customerId, input.bookingId ?? null, input.orderId ?? null, purpose, input.amount, config.CURRENCY, `offline_${paymentNo}`, input.method, json({ reference: input.reference ?? null })],
    );
    return applySuccess(res.insertId, input.reference ?? null, input.method, ctx, actor.id);
}

export async function refundPayment(paymentId: number, amount: number | null, reason: string, ctx: AuditContext) {
    const p = await queryOne<PaymentRow & { refunded_amount: number }>('SELECT * FROM tblPayment WHERE id = ?', [paymentId]);
    if (!p) throw notFound('Payment');
    if (p.status !== 'SUCCESS') throw conflict('Only successful payments can be refunded.');
    const refund = amount ?? Number(p.amount) - Number(p.refunded_amount);
    if (refund <= 0 || refund > Number(p.amount) - Number(p.refunded_amount)) throw badRequest('Invalid refund amount.');
    if (p.provider !== 'offline' && p.provider_payment_id) await paymentProvider.refund(p.provider_payment_id, refund);
    const total = Number(p.refunded_amount) + refund;
    await execute('UPDATE tblPayment SET refunded_amount = ?, status = ?, failure_reason = ? WHERE id = ?', [total, total >= Number(p.amount) ? 'REFUNDED' : 'SUCCESS', `Refund: ${reason}`.slice(0, 250), paymentId]);
    if (p.booking_id) await execute('UPDATE tblBooking SET paid_amount = GREATEST(0, paid_amount - ?) WHERE id = ?', [refund, p.booking_id]);
    await audit(ctx, 'PAYMENT_REFUNDED', 'payments', paymentId, { amount: refund, reason });
    await notifyCustomer(p.customer_id, { type: 'GENERAL', title: 'Refund processed', body: `A refund of ₹${(refund / 100).toFixed(2)} for payment ${p.payment_no} has been initiated.`, link: '/customer/payments' });
    return getPayment(paymentId);
}

export async function getPayment(id: number, actor?: AuthUser) {
    const p = await queryOne(
        `SELECT p.*, c.name AS customer_name, c.email AS customer_email, c.phone AS customer_phone, b.booking_no, o.order_no, i.id AS invoice_id, i.invoice_no
           FROM tblPayment p JOIN tblCustomer c ON c.id = p.customer_id LEFT JOIN tblBooking b ON b.id = p.booking_id LEFT JOIN tblOrder o ON o.id = p.order_id
           LEFT JOIN tblInvoice i ON i.payment_id = p.id WHERE p.id = ?`,
        [id],
    );
    if (!p) throw notFound('Payment');
    if (actor && !hasPermission(actor, 'payments.view') && actor.customerId !== p.customer_id) throw notFound('Payment');
    return p;
}

export interface PaymentFilter {
    page: number;
    pageSize: number;
    search?: string;
    status?: PaymentStatus;
    purpose?: PaymentPurpose;
    customerId?: number;
    from?: string;
    to?: string;
    sort?: string;
    order: 'asc' | 'desc';
}

export async function listPayments(f: PaymentFilter) {
    const where = ['1=1'];
    const params: unknown[] = [];
    if (f.search) {
        where.push('(p.payment_no LIKE ? OR p.provider_payment_id LIKE ? OR c.name LIKE ? OR c.phone LIKE ?)');
        const t = likeTerm(f.search);
        params.push(t, t, t, t);
    }
    if (f.status) { where.push('p.status = ?'); params.push(f.status); }
    if (f.purpose) { where.push('p.purpose = ?'); params.push(f.purpose); }
    if (f.customerId) { where.push('p.customer_id = ?'); params.push(f.customerId); }
    if (f.from) { where.push('p.created_at >= ?'); params.push(`${f.from} 00:00:00`); }
    if (f.to) { where.push('p.created_at < DATE_ADD(?, INTERVAL 1 DAY)'); params.push(f.to); }
    const w = where.join(' AND ');
    const total = (await queryOne<{ n: number }>(`SELECT COUNT(*) AS n FROM tblPayment p JOIN tblCustomer c ON c.id = p.customer_id WHERE ${w}`, params))?.n ?? 0;
    const items = await query(
        `SELECT p.id, p.payment_no, p.purpose, p.amount, p.refunded_amount, p.currency, p.status, p.provider, p.provider_payment_id, p.method, p.failure_reason, p.paid_at, p.created_at,
                c.id AS customer_id, c.name AS customer_name, b.booking_no, o.order_no, i.id AS invoice_id, i.invoice_no
           FROM tblPayment p JOIN tblCustomer c ON c.id = p.customer_id LEFT JOIN tblBooking b ON b.id = p.booking_id LEFT JOIN tblOrder o ON o.id = p.order_id LEFT JOIN tblInvoice i ON i.payment_id = p.id
          WHERE ${w} ORDER BY ${orderBy(f.sort, { created: 'p.created_at', amount: 'p.amount', paid: 'p.paid_at' }, 'p.created_at', f.order)} LIMIT ? OFFSET ?`,
        [...params, f.pageSize, offsetOf(f)],
    );
    const summary = await queryOne(
        `SELECT COALESCE(SUM(CASE WHEN p.status IN ('SUCCESS','REFUNDED') THEN p.amount - p.refunded_amount END), 0) AS collected,
                COALESCE(SUM(CASE WHEN p.status IN ('PENDING','PROCESSING') THEN p.amount END), 0) AS pending,
                COALESCE(SUM(p.refunded_amount), 0) AS refunded, SUM(p.status = 'FAILED') AS failed
           FROM tblPayment p JOIN tblCustomer c ON c.id = p.customer_id WHERE ${w}`,
        params,
    );
    return { ...paged(items, total, f), summary };
}

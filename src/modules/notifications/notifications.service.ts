import { execute, json, query, queryOne } from '../../db/pool.js';
import { sendEmail, sendSms, sendWhatsApp, type ChannelResult } from '../../lib/channels.js';
import { emitTo, rooms } from '../../lib/realtime.js';
import type { Permission } from '../../config/rbac.js';
import { getSetting } from '../settings/settings.service.js';
import { offsetOf, paged } from '../../utils/pagination.js';

export const NOTIFICATION_TYPES = [
    'BOOKING_RECEIVED',
    'QUOTATION_SENT',
    'BOOKING_CONFIRMED',
    'PAYMENT_SUCCESS',
    'PAYMENT_FAILED',
    'EVENT_STARTED',
    'EVENT_ASSIGNED',
    'GALLERY_READY',
    'NEW_PHOTOS',
    'SELECTION_SUBMITTED',
    'SELECTION_CONFIRMED',
    'EDIT_ASSIGNED',
    'ALBUM_PROOF_READY',
    'ALBUM_APPROVED',
    'ALBUM_REVISION',
    'ORDER_READY',
    'DELIVERY_UPDATE',
    'HD_UNLOCKED',
    'GENERAL',
] as const;

export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

export interface NotifyInput {
    type: NotificationType;
    title: string;
    body: string;
    link?: string;
    data?: Record<string, unknown>;
    /** Also deliver over external channels (email / WhatsApp / SMS) when enabled in settings. */
    external?: boolean;
}

interface Recipient {
    userId: number | null;
    email: string | null;
    phone: string | null;
}

async function deliverExternal(r: Recipient, input: NotifyInput): Promise<Record<string, ChannelResult>> {
    const prefs = await getSetting('notifications');
    const studio = await getSetting('studio');
    const results: Record<string, ChannelResult> = {};
    const text = `${input.title}\n${input.body}`;
    if (prefs.email && r.email) results.email = await sendEmail(r.email, `${input.title} - ${studio.name}`, input.body, input.link);
    if (prefs.whatsapp && r.phone) results.whatsapp = await sendWhatsApp(r.phone, `${studio.name}: ${text}`);
    if (prefs.sms && r.phone) results.sms = await sendSms(r.phone, `${studio.name}: ${input.title}. ${input.body}`.slice(0, 300));
    return results;
}

async function store(userId: number, input: NotifyInput, channels: Record<string, ChannelResult>) {
    const res = await execute(
        'INSERT INTO tblNotification (user_id, type, title, body, link, data, channels) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [userId, input.type, input.title.slice(0, 160), input.body.slice(0, 500), input.link ?? null, json(input.data), json({ inApp: { sent: true }, ...channels })],
    );
    const payload = { id: res.insertId, type: input.type, title: input.title, body: input.body, link: input.link ?? null, data: input.data ?? null, read_at: null, created_at: new Date().toISOString() };
    emitTo(rooms.user(userId), 'notification', payload);
}

/** Notify a platform user (in-app + optional external channels). Never throws. */
export async function notifyUser(userId: number, input: NotifyInput): Promise<void> {
    try {
        const u = await queryOne<{ email: string | null; phone: string | null }>('SELECT email, phone FROM tblUser WHERE id = ? AND deleted_at IS NULL', [userId]);
        if (!u) return;
        const channels = input.external ? await deliverExternal({ userId, ...u }, input) : {};
        await store(userId, input, channels);
    } catch (err) {
        console.error('[notify] user', userId, err);
    }
}

/** Notify a customer; customers without a login still receive external messages. */
export async function notifyCustomer(customerId: number, input: NotifyInput): Promise<void> {
    try {
        const c = await queryOne<{ user_id: number | null; email: string | null; phone: string | null }>('SELECT user_id, email, phone FROM tblCustomer WHERE id = ?', [customerId]);
        if (!c) return;
        const channels = input.external !== false ? await deliverExternal({ userId: c.user_id, email: c.email, phone: c.phone }, input) : {};
        if (c.user_id) await store(c.user_id, input, channels);
    } catch (err) {
        console.error('[notify] customer', customerId, err);
    }
}

/** Notify every active staff member holding one of the permissions (in-app only). */
export async function notifyStaff(permissions: Permission[], input: NotifyInput, exceptUserId?: number): Promise<void> {
    try {
        const users = await query<{ id: number }>(
            `SELECT DISTINCT u.id FROM tblUser u
               JOIN tblUserRole ur ON ur.user_id = u.id
               JOIN tblRolePermission rp ON rp.role_id = ur.role_id
               JOIN tblPermission p ON p.id = rp.permission_id
              WHERE p.code IN (?) AND u.status = 'ACTIVE' AND u.deleted_at IS NULL`,
            [permissions],
        );
        for (const u of users) if (u.id !== exceptUserId) await store(u.id, input, {});
    } catch (err) {
        console.error('[notify] staff', err);
    }
}

export async function listNotifications(userId: number, q: { page: number; pageSize: number; unread?: boolean }) {
    const where = q.unread ? 'user_id = ? AND read_at IS NULL' : 'user_id = ?';
    const total = (await queryOne<{ n: number }>(`SELECT COUNT(*) AS n FROM tblNotification WHERE ${where}`, [userId]))?.n ?? 0;
    const unread = (await queryOne<{ n: number }>('SELECT COUNT(*) AS n FROM tblNotification WHERE user_id = ? AND read_at IS NULL', [userId]))?.n ?? 0;
    const items = await query(
        `SELECT id, type, title, body, link, data, channels, read_at, created_at FROM tblNotification WHERE ${where} ORDER BY id DESC LIMIT ? OFFSET ?`,
        [userId, q.pageSize, offsetOf(q)],
    );
    return { ...paged(items, total, q), unread };
}

export async function markRead(userId: number, ids: number[] | 'all'): Promise<number> {
    const res =
        ids === 'all'
            ? await execute('UPDATE tblNotification SET read_at = UTC_TIMESTAMP() WHERE user_id = ? AND read_at IS NULL', [userId])
            : await execute('UPDATE tblNotification SET read_at = UTC_TIMESTAMP() WHERE user_id = ? AND id IN (?) AND read_at IS NULL', [userId, ids]);
    return res.affectedRows;
}

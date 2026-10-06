// Developer by: Buildnexdev.in
// Devevloper : Nandhakumar@gmail.com
// Last Edited : 06-10-2026
import { query, queryOne } from '../../db/pool.js';

const PAID_ORDER = "('PAID','PROCESSING','READY','DELIVERED','COMPLETED')";
const DIGITAL_BOOKING = "('CONFIRMED','IN_PROGRESS','DELIVERED','COMPLETED')";

/**
 * A customer may download the HD original of a photo when:
 *  1. they paid for it (PHOTO_DOWNLOAD order item in a paid order), or
 *  2. they own the event and its booking package includes all digital files and the booking is confirmed, or
 *  3. they paid for a digital package order attached to the event.
 */
export async function entitledPhotoIds(customerId: number, photoIds: number[]): Promise<Set<number>> {
    if (!photoIds.length) return new Set();
    const rows = await query<{ photo_id: number }>(
        `SELECT oi.photo_id FROM tblOrderItem oi JOIN tblOrder o ON o.id = oi.order_id
          WHERE o.customer_id = ? AND o.status IN ${PAID_ORDER} AND oi.item_type = 'PHOTO_DOWNLOAD' AND oi.photo_id IN (?)
         UNION
         SELECT p.id AS photo_id FROM tblPhoto p
           JOIN tblEvent e ON e.id = p.event_id AND e.customer_id = ?
           JOIN tblBooking b ON b.id = e.booking_id AND b.status IN ${DIGITAL_BOOKING}
           JOIN tblPackage pk ON pk.id = b.package_id AND pk.includes_digital = 1
          WHERE p.id IN (?)
         UNION
         SELECT p.id AS photo_id FROM tblPhoto p
           JOIN tblOrder o ON o.event_id = p.event_id AND o.customer_id = ? AND o.type = 'PACKAGE' AND o.status IN ${PAID_ORDER}
           JOIN tblOrderItem oi ON oi.order_id = o.id
           JOIN tblPackage pk ON pk.id = oi.package_id AND pk.includes_digital = 1
          WHERE p.id IN (?)`,
        [customerId, photoIds, customerId, photoIds, customerId, photoIds],
    );
    return new Set(rows.map((r) => r.photo_id));
}

export async function isEntitled(customerId: number, photoId: number): Promise<{ entitled: boolean; orderId: number | null }> {
    const paid = await queryOne<{ order_id: number }>(
        `SELECT o.id AS order_id FROM tblOrderItem oi JOIN tblOrder o ON o.id = oi.order_id
          WHERE o.customer_id = ? AND o.status IN ${PAID_ORDER} AND oi.item_type = 'PHOTO_DOWNLOAD' AND oi.photo_id = ? ORDER BY o.id LIMIT 1`,
        [customerId, photoId],
    );
    if (paid) return { entitled: true, orderId: paid.order_id };
    const ids = await entitledPhotoIds(customerId, [photoId]);
    return { entitled: ids.has(photoId), orderId: null };
}

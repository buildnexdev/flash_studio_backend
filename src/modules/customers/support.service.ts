// Developer by: Buildnexdev.in
// Devevloper : Nandhakumar@gmail.com
// Last Edited : 06-10-2026
// AUTHOR : NANDHAKUMAR
// DEVELOPER BY: buildnexdev.in
// Last Edit : 06-10-2026
import { execute, query, queryOne } from '../../db/pool.js';
import { notFound, badRequest } from '../../utils/errors.js';
import { audit, type AuditContext } from '../audit/audit.service.js';

export interface SupportTicketInput {
    customerId: number;
    category: 'GENERAL' | 'ORDER' | 'PHOTO_REQUEST' | 'EVENT' | 'PAYMENT' | 'OTHER';
    subject: string;
    priority?: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
    photoId?: number | null;
    eventId?: number | null;
    message: string;
}

export async function createSupportTicket(input: SupportTicketInput, ctx: AuditContext) {
    const ticketNo = 'TKT-' + Math.random().toString(36).substring(2, 8).toUpperCase();
    
    // Check if photo request already exists
    if (input.category === 'PHOTO_REQUEST' && input.photoId) {
        const existing = await queryOne(
            `SELECT id FROM tblSupportTicket WHERE customer_id = ? AND photo_id = ? AND category = 'PHOTO_REQUEST' AND status != 'CLOSED'`,
            [input.customerId, input.photoId]
        );
        if (existing) throw badRequest('A photo request is already pending for this image.');
    }

    const ticketId = (
        await execute(
            `INSERT INTO tblSupportTicket (ticket_no, customer_id, category, subject, priority, photo_id, event_id) VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [ticketNo, input.customerId, input.category, input.subject, input.priority ?? 'MEDIUM', input.photoId ?? null, input.eventId ?? null]
        )
    ).insertId;

    await execute(
        `INSERT INTO tblSupportMessage (ticket_id, user_id, message, is_staff) VALUES (?, ?, ?, ?)`,
        [ticketId, ctx.userId, input.message, 0]
    );

    await audit(ctx, 'SUPPORT_TICKET_CREATED', 'customer', ticketId, { ticketNo, subject: input.subject });
    return getTicket(ticketId);
}

export async function listTickets(options: { customerId?: number; status?: string } = {}) {
    const conditions: string[] = [];
    const params: unknown[] = [];

    if (options.customerId) {
        conditions.push('t.customer_id = ?');
        params.push(options.customerId);
    }
    if (options.status) {
        conditions.push('t.status = ?');
        params.push(options.status);
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    return query(
        `SELECT t.*, c.name AS customer_name, c.email AS customer_email 
         FROM tblSupportTicket t 
         LEFT JOIN tblCustomer c ON c.id = t.customer_id 
         ${where} ORDER BY t.id DESC`,
        params
    );
}

export async function getTicket(id: number) {
    const ticket = await queryOne(
        `SELECT t.*, c.name AS customer_name, c.email AS customer_email 
         FROM tblSupportTicket t 
         LEFT JOIN tblCustomer c ON c.id = t.customer_id 
         WHERE t.id = ?`,
        [id]
    );
    if (!ticket) throw notFound('Ticket');

    const messages = await query(
        `SELECT m.*, u.name AS user_name 
         FROM tblSupportMessage m 
         LEFT JOIN tblUser u ON u.id = m.user_id 
         WHERE m.ticket_id = ? ORDER BY m.created_at ASC`,
        [id]
    );
    return { ...ticket, messages };
}

export async function addTicketMessage(ticketId: number, message: string, isStaff: boolean, ctx: AuditContext) {
    const ticket = await queryOne<{ id: number }>('SELECT id FROM tblSupportTicket WHERE id = ?', [ticketId]);
    if (!ticket) throw notFound('Ticket');

    await execute(
        `INSERT INTO tblSupportMessage (ticket_id, user_id, message, is_staff) VALUES (?, ?, ?, ?)`,
        [ticketId, ctx.userId, message, isStaff ? 1 : 0]
    );
    
    // Auto-update status if staff replies
    if (isStaff) {
        await execute(`UPDATE tblSupportTicket SET status = 'IN_PROGRESS' WHERE id = ? AND status = 'OPEN'`, [ticketId]);
    }

    await audit(ctx, 'SUPPORT_MESSAGE_ADDED', 'customer', ticketId);
    return getTicket(ticketId);
}

export async function updateTicketStatus(id: number, status: string, ctx: AuditContext) {
    await execute('UPDATE tblSupportTicket SET status = ? WHERE id = ?', [status, id]);
    await audit(ctx, 'SUPPORT_TICKET_STATUS_UPDATED', 'customer', id, { status });
}

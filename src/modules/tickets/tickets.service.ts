import { execute, query, queryOne, withTransaction } from '../../db/pool.js';
import { randomToken } from '../../utils/crypto.js';
import { notFound } from '../../utils/errors.js';
import { likeTerm, offsetOf, paged } from '../../utils/pagination.js';

export type TicketStatus = 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED';
export type TicketCategory = 'GENERAL' | 'ORDER' | 'PHOTO_REQUEST' | 'EVENT' | 'PAYMENT' | 'OTHER';
export type TicketPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';

export interface TicketFilter {
    page: number;
    pageSize: number;
    search?: string;
    status?: TicketStatus;
}

export interface TicketInput {
    subject: string;
    category: TicketCategory;
    priority: TicketPriority;
    message: string;
    status?: TicketStatus;
}

export interface TicketActor {
    id: number;
    customerId: number | null;
    isSuperAdmin: boolean;
    isStaff: boolean;
}

interface TicketRecord {
    id: number;
    ticket_no: string;
    user_id: number | null;
    customer_id: number | null;
    user_name: string | null;
    user_email: string | null;
    category: TicketCategory;
    subject: string;
    status: TicketStatus;
    priority: TicketPriority;
    created_at: string;
    updated_at: string;
}

function accessCondition(actor: TicketActor) {
    return actor.isSuperAdmin
        ? { sql: '1 = 1', params: [] as unknown[] }
        : { sql: '(t.user_id = ? OR (t.user_id IS NULL AND c.user_id = ?))', params: [actor.id, actor.id] };
}

function writeCondition(actor: TicketActor) {
    return actor.isSuperAdmin
        ? { sql: '1 = 1', params: [] as unknown[] }
        : { sql: '(t.user_id = ? OR (t.user_id IS NULL AND t.customer_id IN (SELECT c.id FROM tblCustomer c WHERE c.user_id = ?)))', params: [actor.id, actor.id] };
}

export async function listTickets(actor: TicketActor, filter: TicketFilter) {
    const access = accessCondition(actor);
    const where = [`${access.sql}`, 't.deleted_at IS NULL'];
    const params: unknown[] = [...access.params];
    if (filter.status) {
        where.push('t.status = ?');
        params.push(filter.status);
    }
    if (filter.search) {
        where.push('(t.ticket_no LIKE ? OR t.subject LIKE ? OR t.category LIKE ? OR EXISTS (SELECT 1 FROM tblSupportMessage sm WHERE sm.ticket_id = t.id AND sm.message LIKE ?) OR u.name LIKE ? OR u.email LIKE ?)');
        const term = likeTerm(filter.search);
        params.push(term, term, term, term, term, term);
    }
    const clause = where.join(' AND ');
    const total = (await queryOne<{ total: number }>(
        `SELECT COUNT(*) AS total FROM tblSupportTicket t
           LEFT JOIN tblCustomer c ON c.id = t.customer_id
           LEFT JOIN tblUser u ON u.id = COALESCE(t.user_id, c.user_id)
          WHERE ${clause}`,
        params,
    ))?.total ?? 0;
    const items = await query(
        `SELECT t.id, t.ticket_no, t.user_id, t.customer_id, u.name AS user_name, u.email AS user_email,
                t.category, t.subject, t.status, t.priority, t.created_at, t.updated_at,
                (SELECT sm.message FROM tblSupportMessage sm WHERE sm.ticket_id = t.id ORDER BY sm.id ASC LIMIT 1) AS message
           FROM tblSupportTicket t
           LEFT JOIN tblCustomer c ON c.id = t.customer_id
           LEFT JOIN tblUser u ON u.id = COALESCE(t.user_id, c.user_id)
          WHERE ${clause}
          ORDER BY t.created_at DESC, t.id DESC
          LIMIT ? OFFSET ?`,
        [...params, filter.pageSize, offsetOf(filter)],
    );
    return paged(items, total, filter);
}

export async function getTicket(id: number, actor: TicketActor) {
    const access = accessCondition(actor);
    const ticket = await queryOne<TicketRecord>(
        `SELECT t.id, t.ticket_no, t.user_id, t.customer_id, u.name AS user_name, u.email AS user_email,
                t.category, t.subject, t.status, t.priority, t.created_at, t.updated_at
           FROM tblSupportTicket t
           LEFT JOIN tblCustomer c ON c.id = t.customer_id
           LEFT JOIN tblUser u ON u.id = COALESCE(t.user_id, c.user_id)
          WHERE t.id = ? AND t.deleted_at IS NULL AND ${access.sql}`,
        [id, ...access.params],
    );
    if (!ticket) throw notFound('Ticket');
    const messages = await query(
        `SELECT m.id, m.user_id, u.name AS user_name, m.message, m.is_staff, m.created_at
           FROM tblSupportMessage m
           LEFT JOIN tblUser u ON u.id = m.user_id
          WHERE m.ticket_id = ?
          ORDER BY m.created_at ASC, m.id ASC`,
        [id],
    );
    return { ...ticket, messages };
}

export async function createTicket(input: TicketInput, actor: TicketActor) {
    const ticketNo = `TKT-${randomToken(6).replace(/[-_]/g, '').slice(0, 8).toUpperCase()}`;
    const id = await withTransaction(async (conn) => {
        const result = await execute(
            `INSERT INTO tblSupportTicket (ticket_no, user_id, customer_id, category, subject, priority, status)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [ticketNo, actor.id, actor.customerId, input.category, input.subject, input.priority, input.status ?? 'OPEN'],
            conn,
        );
        await execute(
            'INSERT INTO tblSupportMessage (ticket_id, user_id, message, is_staff) VALUES (?, ?, ?, ?)',
            [result.insertId, actor.id, input.message, actor.isStaff ? 1 : 0],
            conn,
        );
        return result.insertId;
    });
    return getTicket(id, actor);
}

export async function updateTicket(id: number, input: TicketInput, actor: TicketActor) {
    const access = writeCondition(actor);
    await withTransaction(async (conn) => {
        const ticket = await queryOne<{ id: number }>(
            `SELECT t.id FROM tblSupportTicket t
              WHERE t.id = ? AND t.deleted_at IS NULL AND ${access.sql}`,
            [id, ...access.params],
            conn,
        );
        if (!ticket) throw notFound('Ticket');
        await execute(
            `UPDATE tblSupportTicket t
                SET subject = ?, category = ?, priority = ?, status = COALESCE(?, status)
              WHERE t.id = ? AND t.deleted_at IS NULL AND ${access.sql}`,
            [input.subject, input.category, input.priority, input.status ?? null, id, ...access.params],
            conn,
        );
        const firstMessage = await queryOne<{ id: number }>(
            'SELECT id FROM tblSupportMessage WHERE ticket_id = ? ORDER BY created_at ASC, id ASC LIMIT 1',
            [id],
            conn,
        );
        if (firstMessage) {
            await execute('UPDATE tblSupportMessage SET message = ? WHERE id = ?', [input.message, firstMessage.id], conn);
        } else {
            await execute(
                'INSERT INTO tblSupportMessage (ticket_id, user_id, message, is_staff) VALUES (?, ?, ?, ?)',
                [id, actor.id, input.message, actor.isStaff ? 1 : 0],
                conn,
            );
        }
    });
    return getTicket(id, actor);
}

export async function deleteTicket(id: number, actor: TicketActor): Promise<void> {
    await getTicket(id, actor);
    const access = writeCondition(actor);
    const result = await execute(
        `UPDATE tblSupportTicket t SET deleted_at = CURRENT_TIMESTAMP
          WHERE t.id = ? AND t.deleted_at IS NULL AND ${access.sql}`,
        [id, ...access.params],
    );
    if (!result.affectedRows) throw notFound('Ticket');
}

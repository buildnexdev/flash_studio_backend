// Developer by: Buildnexdev.in
// Devevloper : Nandhakumar@gmail.com
// Last Edited : 06-10-2026 
import { randomUUID } from 'node:crypto';
import { execute, primaryCompanyId, query, queryOne, type Db, type Row, pool, withTransaction } from '../../db/pool.js';
import { storage } from '../../lib/storage.js';
import { conflict, notFound } from '../../utils/errors.js';
import { likeTerm, offsetOf, orderBy, paged, type PageQuery } from '../../utils/pagination.js';
import { audit, type AuditContext } from '../audit/audit.service.js';
import { hashPassword } from '../auth/auth.service.js';

export interface CustomerInput {
    name: string;
    email?: string | null;
    phone?: string | null;
    password?: string;
    address?: string | null;
    city?: string | null;
    state?: string | null;
    pincode?: string | null;
    notes?: string | null;
}

export async function listCustomers(q: PageQuery) {
    const where = ['c.deleted_at IS NULL'];
    const params: unknown[] = [];
    if (q.search) {
        where.push('(c.name LIKE ? OR c.email LIKE ? OR c.phone LIKE ? OR c.city LIKE ?)');
        const t = likeTerm(q.search);
        params.push(t, t, t, t);
    }
    const w = where.join(' AND ');
    const total = (await queryOne<{ n: number }>(`SELECT COUNT(*) AS n FROM tblCustomer c WHERE ${w}`, params))?.n ?? 0;
    const items = await query(
        `SELECT c.id, c.name, c.email, c.phone, c.city, c.source, c.user_id, c.created_at,
                (SELECT COUNT(*) FROM tblBooking b WHERE b.customer_id = c.id AND b.deleted_at IS NULL) AS bookings,
                (SELECT COUNT(*) FROM tblEvent e WHERE e.customer_id = c.id AND e.deleted_at IS NULL) AS events,
                (SELECT COALESCE(SUM(p.amount - p.refunded_amount), 0) FROM tblPayment p WHERE p.customer_id = c.id AND p.status IN ('SUCCESS','REFUNDED')) AS lifetime_value
           FROM tblCustomer c WHERE ${w}
          ORDER BY ${orderBy(q.sort, { name: 'c.name', created: 'c.created_at', city: 'c.city' }, 'c.created_at', q.order)}
          LIMIT ? OFFSET ?`,
        [...params, q.pageSize, offsetOf(q)],
    );
    return paged(items, total, q);
}

export async function getCustomer(id: number): Promise<Row & { bookings: Row[]; events: Row[]; orders: Row[]; payments: Row[]; photo_url: string | null }> {
    const c = await queryOne('SELECT * FROM tblCustomer WHERE id = ? AND deleted_at IS NULL', [id]);
    if (!c) throw notFound('Customer');
    const [bookings, events, orders, payments] = await Promise.all([
        query('SELECT id, booking_no, event_type, event_date, status, total_amount, paid_amount, created_at FROM tblBooking WHERE customer_id = ? AND deleted_at IS NULL ORDER BY id DESC LIMIT 50', [id]),
        query('SELECT id, event_code, title, event_type, event_date, status FROM tblEvent WHERE customer_id = ? AND deleted_at IS NULL ORDER BY event_date DESC LIMIT 50', [id]),
        query('SELECT id, order_no, type, status, total, created_at FROM tblOrder WHERE customer_id = ? AND deleted_at IS NULL ORDER BY id DESC LIMIT 50', [id]),
        query('SELECT id, payment_no, purpose, amount, status, method, paid_at, created_at FROM tblPayment WHERE customer_id = ? ORDER BY id DESC LIMIT 50', [id]),
    ]);
    const photoKey = c.photo_key ? String(c.photo_key) : null;
    const photo_url = photoKey ? await storage.signedUrl(photoKey) : null;
    const { photo_key: _pk, ...rest } = c;
    void _pk;
    return { ...rest, photo_url, bookings, events, orders, payments } as Row & {
        bookings: Row[];
        events: Row[];
        orders: Row[];
        payments: Row[];
        photo_url: string | null;
    };
}

export async function setCustomerPhoto(id: number, file: { buffer: Buffer; originalname: string; mimetype: string; size: number }, ctx: AuditContext) {
    const c = await queryOne<{ id: number; photo_key: string | null }>('SELECT id, photo_key FROM tblCustomer WHERE id = ? AND deleted_at IS NULL', [id]);
    if (!c) throw notFound('Customer');
    const ext = (/\.(jpe?g|png|webp)$/i.exec(file.originalname)?.[1] ?? 'jpg').toLowerCase();
    const key = `customers/${id}/${randomUUID()}.${ext}`;
    await storage.put(key, file.buffer, file.mimetype);
    if (c.photo_key) await storage.delete(String(c.photo_key)).catch(() => undefined);
    await execute('UPDATE tblCustomer SET photo_key = ? WHERE id = ?', [key, id]);
    await audit(ctx, 'CUSTOMER_UPDATED', 'customers', id, { photo: true });
    return getCustomer(id);
}

export async function removeCustomerPhoto(id: number, ctx: AuditContext) {
    const c = await queryOne<{ photo_key: string | null }>('SELECT photo_key FROM tblCustomer WHERE id = ? AND deleted_at IS NULL', [id]);
    if (!c) throw notFound('Customer');
    if (c.photo_key) {
        await storage.delete(String(c.photo_key)).catch(() => undefined);
        await execute('UPDATE tblCustomer SET photo_key = NULL WHERE id = ?', [id]);
        await audit(ctx, 'CUSTOMER_UPDATED', 'customers', id, { photoRemoved: true });
    }
    return getCustomer(id);
}

/** Find a customer by email/phone or create one (used by public enquiries and admin bookings). */
export async function findOrCreateCustomer(input: CustomerInput & { source?: string }, db: Db = pool): Promise<number> {
    const email = input.email?.toLowerCase() ?? null;
    const existing = await queryOne<{ id: number }>(
        'SELECT id FROM tblCustomer WHERE deleted_at IS NULL AND ((? IS NOT NULL AND email = ?) OR (? IS NOT NULL AND phone = ?)) ORDER BY user_id IS NULL, id LIMIT 1',
        [email, email, input.phone ?? null, input.phone ?? null],
        db,
    );
    if (existing) return existing.id;
    const res = await execute(
        'INSERT INTO tblCustomer (name, email, phone, address, city, state, pincode, notes, source) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [input.name, email, input.phone ?? null, input.address ?? null, input.city ?? null, input.state ?? null, input.pincode ?? null, input.notes ?? null, input.source ?? 'ADMIN'],
        db,
    );
    return res.insertId;
}

export async function createCustomer(input: CustomerInput, ctx: AuditContext) {
    if (input.email || input.phone) {
        const dup = await queryOne('SELECT id FROM tblCustomer WHERE deleted_at IS NULL AND ((? IS NOT NULL AND email = ?) OR (? IS NOT NULL AND phone = ?))', [input.email ?? null, input.email ?? null, input.phone ?? null, input.phone ?? null]);
        if (dup) throw conflict('A customer with this email or phone already exists.');
    }
    
    let userId: number | null = null;
    if (input.password && input.email) {
        const dupUser = await queryOne('SELECT id FROM tblUser WHERE email = ?', [input.email]);
        if (dupUser) throw conflict('A user with this email already exists.');
        const hash = await hashPassword(input.password);
        
        const roleRes = await queryOne<{ id: number }>('SELECT id FROM tblRole WHERE code = ?', ['CUSTOMER']);
        if (!roleRes) throw conflict('The customer role is not available.');
        const res = await execute(
            'INSERT INTO tblUser (company_id, role_id, name, email, phone, password_hash, status, email_verified_at) VALUES (?, ?, ?, ?, ?, ?, ?, UTC_TIMESTAMP())',
            [await primaryCompanyId(), roleRes.id, input.name, input.email, input.phone ?? null, hash, 'ACTIVE'],
        );
        userId = res.insertId;
        await execute('INSERT INTO tblUserRole (user_id, role_id) VALUES (?, ?)', [userId, roleRes.id]);
    }
    
    const email = input.email?.toLowerCase() ?? null;
    const res = await execute(
        'INSERT INTO tblCustomer (name, email, phone, address, city, state, pincode, notes, source, user_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [input.name, email, input.phone ?? null, input.address ?? null, input.city ?? null, input.state ?? null, input.pincode ?? null, input.notes ?? null, 'ADMIN', userId]
    );
    const id = res.insertId;
    
    await audit(ctx, 'CUSTOMER_CREATED', 'customers', id, { name: input.name });
    return getCustomer(id);
}

export async function updateCustomer(id: number, input: CustomerInput, ctx: AuditContext) {
    const current = await getCustomer(id);
    const dup = await queryOne('SELECT id FROM tblCustomer WHERE deleted_at IS NULL AND id <> ? AND ((? IS NOT NULL AND email = ?) OR (? IS NOT NULL AND phone = ?))', [id, input.email ?? null, input.email ?? null, input.phone ?? null, input.phone ?? null]);
    if (dup) throw conflict('Another customer already uses this email or phone.');
    
    let userId = current.user_id;
    if (input.password && input.email) {
        const hash = await hashPassword(input.password);
        if (userId) {
            await execute('UPDATE tblUser SET password_hash = ?, token_version = token_version + 1 WHERE id = ?', [hash, userId]);
        } else {
            const dupUser = await queryOne('SELECT id FROM tblUser WHERE email = ?', [input.email]);
            if (dupUser) throw conflict('A user with this email already exists.');
            const roleRes = await queryOne<{ id: number }>('SELECT id FROM tblRole WHERE code = ?', ['CUSTOMER']);
            if (!roleRes) throw conflict('The customer role is not available.');
            const res = await execute(
                'INSERT INTO tblUser (company_id, role_id, name, email, phone, password_hash, status, email_verified_at) VALUES (?, ?, ?, ?, ?, ?, ?, UTC_TIMESTAMP())',
                [await primaryCompanyId(), roleRes.id, input.name, input.email, input.phone ?? null, hash, 'ACTIVE'],
            );
            userId = res.insertId;
            await execute('INSERT INTO tblUserRole (user_id, role_id) VALUES (?, ?)', [userId, roleRes.id]);
        }
    }
    
    if (userId) {
        await execute('UPDATE tblUser SET name = ?, email = ?, phone = ? WHERE id = ?', [input.name, input.email, input.phone ?? null, userId]);
    }
    
    await execute('UPDATE tblCustomer SET name = ?, email = ?, phone = ?, address = ?, city = ?, state = ?, pincode = ?, notes = ?, user_id = ? WHERE id = ?', [
        input.name,
        input.email?.toLowerCase() ?? null,
        input.phone ?? null,
        input.address ?? null,
        input.city ?? null,
        input.state ?? null,
        input.pincode ?? null,
        input.notes ?? null,
        userId,
        id,
    ]);
    await audit(ctx, 'CUSTOMER_UPDATED', 'customers', id);
    return getCustomer(id);
}

export async function deleteCustomer(id: number, ctx: AuditContext) {
    const active = await queryOne<{ n: number }>("SELECT COUNT(*) AS n FROM tblBooking WHERE customer_id = ? AND deleted_at IS NULL AND status NOT IN ('COMPLETED','CANCELLED')", [id]);
    if ((active?.n ?? 0) > 0) throw conflict('This customer has open bookings. Complete or cancel them first.');
    await execute('UPDATE tblCustomer SET deleted_at = UTC_TIMESTAMP() WHERE id = ?', [id]);
    await audit(ctx, 'CUSTOMER_DELETED', 'customers', id);
}

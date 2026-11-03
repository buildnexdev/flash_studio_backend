// Developer by: Buildnexdev.in
// Last Edited : 29-10-2026
import { execute, query, queryOne } from '../../db/pool.js';
import { notFound } from '../../utils/errors.js';

export interface ShopOrderCustomer {
    name: string;
    mobile: string;
    email: string;
    address: string;
    city: string;
    state: string;
    pincode: string;
    instructions?: string;
}

export interface ShopOrderItem {
    id: string;
    productId: string;
    productName: string;
    image: string;
    variant: string;
    size: string;
    quantity: number;
    basePrice: number;
    customizationPrice: number;
    photo?: string;
    preview?: string;
    adjustment?: any;
    placement?: any;
    text?: string;
    lineTotal: number;
}

export interface CreateShopOrderInput {
    id?: string;
    customer: ShopOrderCustomer;
    items: ShopOrderItem[];
    subtotal: number;
    customization: number;
    delivery: number;
    discount?: number;
    total: number;
    payment: string;
    paymentStatus?: 'Pending' | 'Paid';
    status?: string;
}

export interface UpdateShopOrderInput {
    status?: string;
    paymentStatus?: 'Pending' | 'Paid';
    trackingNumber?: string | null;
    courierPartner?: string | null;
}

export async function ensureShopOrderTable(): Promise<void> {
    await execute(`
        CREATE TABLE IF NOT EXISTS tblShopOrder (
            id VARCHAR(50) NOT NULL PRIMARY KEY,
            customer_name VARCHAR(120) NOT NULL,
            customer_phone VARCHAR(30) NOT NULL,
            customer_email VARCHAR(120) NOT NULL,
            customer_address TEXT NOT NULL,
            customer_city VARCHAR(80) NOT NULL,
            customer_state VARCHAR(80) NOT NULL,
            customer_pincode VARCHAR(20) NOT NULL,
            instructions TEXT NULL,
            items LONGTEXT NOT NULL,
            subtotal DECIMAL(12, 2) NOT NULL DEFAULT 0,
            customization DECIMAL(12, 2) NOT NULL DEFAULT 0,
            delivery DECIMAL(12, 2) NOT NULL DEFAULT 0,
            discount DECIMAL(12, 2) NOT NULL DEFAULT 0,
            total DECIMAL(12, 2) NOT NULL DEFAULT 0,
            payment_method VARCHAR(50) NOT NULL DEFAULT 'UPI / online payment',
            payment_status VARCHAR(30) NOT NULL DEFAULT 'Pending',
            payment_transaction_id VARCHAR(100) NULL,
            status VARCHAR(50) NOT NULL DEFAULT 'New Order',
            tracking_number VARCHAR(100) NULL,
            courier_partner VARCHAR(100) NULL,
            created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            company_id INT UNSIGNED DEFAULT NULL,
            KEY idx_shoporder_company (company_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `).catch(() => undefined);
}

function parseOrderRow(row: any) {
    let items: ShopOrderItem[] = [];
    try {
        items = typeof row.items === 'string' ? JSON.parse(row.items) : row.items ?? [];
    } catch {
        items = [];
    }
    return {
        id: row.id,
        createdAt: row.created_at ? new Date(row.created_at).toISOString() : new Date().toISOString(),
        customer: {
            name: row.customer_name,
            mobile: row.customer_phone,
            email: row.customer_email,
            address: row.customer_address,
            city: row.customer_city,
            state: row.customer_state,
            pincode: row.customer_pincode,
            instructions: row.instructions || '',
        },
        items,
        subtotal: Number(row.subtotal),
        customization: Number(row.customization),
        delivery: Number(row.delivery),
        discount: Number(row.discount),
        total: Number(row.total),
        payment: row.payment_method,
        paymentStatus: (row.payment_status || 'Pending') as 'Pending' | 'Paid',
        status: row.status || 'New Order',
        trackingNumber: row.tracking_number || null,
        courierPartner: row.courier_partner || null,
    };
}

export async function createShopOrder(input: CreateShopOrderInput, companyId?: number | null) {
    await ensureShopOrderTable();
    const id = input.id?.trim() || `FL-${Date.now().toString().slice(-7)}`;
    const itemsJson = JSON.stringify(input.items);
    const targetCompanyId = companyId ?? 1;

    await execute(
        `INSERT INTO tblShopOrder 
          (company_id, id, customer_name, customer_phone, customer_email, customer_address, customer_city, customer_state, customer_pincode, instructions, items, subtotal, customization, delivery, discount, total, payment_method, payment_status, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE 
            customer_name = VALUES(customer_name),
            customer_phone = VALUES(customer_phone),
            customer_email = VALUES(customer_email),
            customer_address = VALUES(customer_address),
            items = VALUES(items),
            total = VALUES(total),
            payment_status = VALUES(payment_status),
            status = VALUES(status)`,
        [
            targetCompanyId,
            id,
            input.customer.name.trim(),
            input.customer.mobile.trim(),
            input.customer.email.trim(),
            input.customer.address.trim(),
            input.customer.city.trim(),
            input.customer.state.trim(),
            input.customer.pincode.trim(),
            input.customer.instructions?.trim() || null,
            itemsJson,
            input.subtotal,
            input.customization,
            input.delivery,
            input.discount ?? 0,
            input.total,
            input.payment || 'UPI / online payment',
            input.paymentStatus || 'Pending',
            input.status || 'New Order',
        ],
    );

    const created = await queryOne('SELECT * FROM tblShopOrder WHERE id = ?', [id]);
    return parseOrderRow(created);
}

export async function listShopOrders(search?: string, status?: string, companyId?: number | null) {
    await ensureShopOrderTable();
    const where: string[] = [];
    const params: unknown[] = [];

    if (companyId) {
        where.push('company_id = ?');
        params.push(companyId);
    }
    if (search?.trim()) {
        const term = `%${search.trim().toLowerCase()}%`;
        where.push('(LOWER(id) LIKE ? OR LOWER(customer_name) LIKE ? OR LOWER(customer_phone) LIKE ? OR LOWER(customer_email) LIKE ?)');
        params.push(term, term, term, term);
    }
    if (status && status !== 'All') {
        where.push('status = ?');
        params.push(status);
    }

    const whereClause = where.length > 0 ? `WHERE ${where.join(' AND ')}` : '';
    const rows = await query(`SELECT * FROM tblShopOrder ${whereClause} ORDER BY created_at DESC`, params);
    return rows.map(parseOrderRow);
}

export async function getShopOrder(id: string, companyId?: number | null) {
    await ensureShopOrderTable();
    const where = ['id = ?'];
    const params: unknown[] = [id];
    if (companyId) {
        where.push('company_id = ?');
        params.push(companyId);
    }
    const row = await queryOne(`SELECT * FROM tblShopOrder WHERE ${where.join(' AND ')}`, params);
    if (!row) throw notFound('Order');
    return parseOrderRow(row);
}

export async function updateShopOrder(id: string, input: UpdateShopOrderInput, companyId?: number | null) {
    await ensureShopOrderTable();
    const where = ['id = ?'];
    const params: unknown[] = [id];
    if (companyId) {
        where.push('company_id = ?');
        params.push(companyId);
    }
    const existing = await queryOne(`SELECT id FROM tblShopOrder WHERE ${where.join(' AND ')}`, params);
    if (!existing) throw notFound('Order');

    const sets: string[] = [];
    const updateParams: unknown[] = [];

    if (input.status) {
        sets.push('status = ?');
        updateParams.push(input.status);
    }
    if (input.paymentStatus) {
        sets.push('payment_status = ?');
        updateParams.push(input.paymentStatus);
    }
    if (input.trackingNumber !== undefined) {
        sets.push('tracking_number = ?');
        updateParams.push(input.trackingNumber);
    }
    if (input.courierPartner !== undefined) {
        sets.push('courier_partner = ?');
        updateParams.push(input.courierPartner);
    }

    if (sets.length > 0) {
        updateParams.push(id);
        await execute(`UPDATE tblShopOrder SET ${sets.join(', ')} WHERE id = ?`, updateParams);
    }

    const updated = await queryOne('SELECT * FROM tblShopOrder WHERE id = ?', [id]);
    return parseOrderRow(updated);
}

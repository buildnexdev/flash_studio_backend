// Developer by: Buildnexdev.in
// Devevloper : Nandhakumar@gmail.com
// Last Edited : 06-10-2026
import { randomInt } from 'node:crypto';
import { queryOne, type Db, pool } from '../db/pool.js';

const PREFIX = {
    booking: 'BK',
    quotation: 'QT',
    event: 'EV',
    order: 'OR',
    payment: 'PY',
    invoice: 'INV',
    asset: 'AST',
    payroll: 'PR',
} as const;

const TABLES: Record<keyof typeof PREFIX, [string, string]> = {
    booking: ['tblBooking', 'booking_no'],
    quotation: ['tblQuotation', 'quotation_no'],
    event: ['tblEvent', 'event_code'],
    order: ['tblOrder', 'order_no'],
    payment: ['tblPayment', 'payment_no'],
    invoice: ['tblInvoice', 'invoice_no'],
    asset: ['tblAsset', 'asset_code'],
    payroll: ['tblPayrollEntry', 'payroll_no'],
};

/**
 * Human friendly document numbers, e.g. BK-2610-48213.
 * Invoices are sequential per financial month (INV-202610-0001) because GST invoices must not skip.
 */
export async function nextNumber(kind: keyof typeof PREFIX, db: Db = pool): Promise<string> {
    const now = new Date();
    const yymm = `${String(now.getUTCFullYear()).slice(2)}${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
    const [table, column] = TABLES[kind];
    if (kind === 'invoice') {
        const prefix = `INV-20${yymm}-`;
        const row = await queryOne<{ last: string | null }>(
            `SELECT MAX(${column}) AS last FROM ${table} WHERE ${column} LIKE ? FOR UPDATE`,
            [`${prefix}%`],
            db,
        );
        const seq = row?.last ? Number(row.last.slice(prefix.length)) + 1 : 1;
        return `${prefix}${String(seq).padStart(4, '0')}`;
    }
    for (let attempt = 0; attempt < 8; attempt++) {
        const candidate = `${PREFIX[kind]}-${yymm}-${String(randomInt(10000, 99999))}`;
        const exists = await queryOne(`SELECT 1 FROM ${table} WHERE ${column} = ?`, [candidate], db);
        if (!exists) return candidate;
    }
    return `${PREFIX[kind]}-${yymm}-${Date.now().toString(36).toUpperCase()}`;
}

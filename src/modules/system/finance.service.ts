// Developer by: Buildnexdev.in
// Devevloper : Nandhakumar@gmail.com
// Last Edited : 13-11-2026
import { execute, query, queryOne } from '../../db/pool.js';
import { notFound } from '../../utils/errors.js';
import { audit, type AuditContext } from '../audit/audit.service.js';

export interface FinanceTransactionInput {
    type: 'INCOME' | 'EXPENSE';
    category: string;
    amount: number; // in paise
    paymentMethod?: string | null;
    referenceNo?: string | null;
    orderId?: number | null;
    eventId?: number | null;
    staffId?: number | null;
    assetId?: number | null;
    description: string;
    transactionDate: string;
}

export interface FinanceListOptions {
    startDate?: string;
    endDate?: string;
    type?: string;
    category?: string;
    paymentMethod?: string;
    search?: string;
}

export const DEFAULT_FINANCE_CATEGORIES = {
    EXPENSE: [
        { name: 'Frames & Raw Materials', icon: 'Frame' },
        { name: 'Photo Albums & Printing Lab', icon: 'Printer' },
        { name: 'Studio Rent & Maintenance', icon: 'Building' },
        { name: 'Electricity & Utility Bills', icon: 'Zap' },
        { name: 'Camera & Lighting Equipment', icon: 'Camera' },
        { name: 'Freelancer & Crew Payout', icon: 'Users' },
        { name: 'Staff Salary & Advances', icon: 'Briefcase' },
        { name: 'Food, Tea & Refreshments', icon: 'Coffee' },
        { name: 'Travel, Fuel & Transport', icon: 'Car' },
        { name: 'Marketing, Ads & Social Media', icon: 'Megaphone' },
        { name: 'Packaging & Courier Charges', icon: 'Truck' },
        { name: 'Software & Cloud Subscriptions', icon: 'Globe' },
        { name: 'Miscellaneous Expenses', icon: 'Receipt' },
    ],
    INCOME: [
        { name: 'Event Booking Advance', icon: 'CalendarCheck' },
        { name: 'Event Final Balance', icon: 'CheckCircle' },
        { name: 'Photo Frames & Art Store', icon: 'Frame' },
        { name: 'Flush Mount Albums', icon: 'BookOpen' },
        { name: 'Prints & Passport Photos', icon: 'Image' },
        { name: 'Studio Portrait Sessions', icon: 'Camera' },
        { name: 'Commercial & Brand Shoots', icon: 'Briefcase' },
        { name: 'Other Income', icon: 'Banknote' },
    ],
};

export async function listFinanceTransactions(options: FinanceListOptions = {}) {
    const conditions: string[] = [];
    const params: unknown[] = [];

    if (options.type && (options.type === 'INCOME' || options.type === 'EXPENSE')) {
        conditions.push('type = ?');
        params.push(options.type);
    }
    if (options.category && options.category !== 'All') {
        conditions.push('category = ?');
        params.push(options.category);
    }
    if (options.paymentMethod && options.paymentMethod !== 'All') {
        conditions.push('payment_method = ?');
        params.push(options.paymentMethod);
    }
    if (options.startDate) {
        conditions.push('transaction_date >= ?');
        params.push(options.startDate);
    }
    if (options.endDate) {
        conditions.push('transaction_date <= ?');
        params.push(options.endDate);
    }
    if (options.search && options.search.trim()) {
        const s = `%${options.search.trim()}%`;
        conditions.push('(description LIKE ? OR reference_no LIKE ? OR transaction_no LIKE ? OR category LIKE ?)');
        params.push(s, s, s, s);
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    return query(`SELECT * FROM tblFinanceTransaction ${where} ORDER BY transaction_date DESC, id DESC`, params);
}

export async function saveFinanceTransaction(id: number | null, input: FinanceTransactionInput, ctx: AuditContext) {
    const txnNo = 'TXN-' + Math.floor(100000 + Math.random() * 900000);
    const values = [
        input.type,
        input.category,
        input.amount,
        input.paymentMethod ?? 'CASH',
        input.referenceNo ?? null,
        input.orderId ?? null,
        input.eventId ?? null,
        input.staffId ?? null,
        input.assetId ?? null,
        input.description,
        input.transactionDate,
        ctx.userId,
    ];

    if (id) {
        await execute(
            `UPDATE tblFinanceTransaction SET type = ?, category = ?, amount = ?, payment_method = ?, reference_no = ?, order_id = ?, event_id = ?, staff_id = ?, asset_id = ?, description = ?, transaction_date = ? WHERE id = ?`,
            [...values.slice(0, 11), id]
        );
    } else {
        id = (
            await execute(
                `INSERT INTO tblFinanceTransaction (transaction_no, type, category, amount, payment_method, reference_no, order_id, event_id, staff_id, asset_id, description, transaction_date, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [txnNo, ...values]
            )
        ).insertId;
    }

    await audit(ctx, 'FINANCE_TRANSACTION_SAVED', 'system', id, { type: input.type, amount: input.amount, category: input.category });
    return queryOne('SELECT * FROM tblFinanceTransaction WHERE id = ?', [id]);
}

export async function deleteFinanceTransaction(id: number, ctx: AuditContext) {
    const existing = await queryOne('SELECT * FROM tblFinanceTransaction WHERE id = ?', [id]);
    if (!existing) throw notFound('Transaction not found');
    await execute('DELETE FROM tblFinanceTransaction WHERE id = ?', [id]);
    await audit(ctx, 'FINANCE_TRANSACTION_DELETED', 'system', id, { id });
    return { success: true };
}

export async function getFinanceSummary(startDate?: string, endDate?: string) {
    const conditions: string[] = [];
    const params: unknown[] = [];

    if (startDate) {
        conditions.push('transaction_date >= ?');
        params.push(startDate);
    }
    if (endDate) {
        conditions.push('transaction_date <= ?');
        params.push(endDate);
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const incomeRow = await queryOne<{ total: number }>(
        `SELECT COALESCE(SUM(amount), 0) AS total FROM tblFinanceTransaction ${where ? where + " AND type = 'INCOME'" : "WHERE type = 'INCOME'"}`,
        params
    );

    const expenseRow = await queryOne<{ total: number }>(
        `SELECT COALESCE(SUM(amount), 0) AS total FROM tblFinanceTransaction ${where ? where + " AND type = 'EXPENSE'" : "WHERE type = 'EXPENSE'"}`,
        params
    );

    const totalIncome = incomeRow?.total ?? 0;
    const totalExpense = expenseRow?.total ?? 0;
    const netAmount = totalIncome - totalExpense;

    // Today's summary
    const today = new Date().toISOString().slice(0, 10);
    const todayIncomeRow = await queryOne<{ total: number }>(
        `SELECT COALESCE(SUM(amount), 0) AS total FROM tblFinanceTransaction WHERE transaction_date = ? AND type = 'INCOME'`,
        [today]
    );
    const todayExpenseRow = await queryOne<{ total: number }>(
        `SELECT COALESCE(SUM(amount), 0) AS total FROM tblFinanceTransaction WHERE transaction_date = ? AND type = 'EXPENSE'`,
        [today]
    );
    const todayIncome = todayIncomeRow?.total ?? 0;
    const todayExpense = todayExpenseRow?.total ?? 0;
    const todayNet = todayIncome - todayExpense;

    // Category breakdown
    const categoryBreakdown = await query<{ category: string; type: string; total: number; count: number }>(
        `SELECT category, type, COUNT(*) as count, SUM(amount) AS total FROM tblFinanceTransaction ${where} GROUP BY category, type ORDER BY total DESC`,
        params
    );

    // Payment method breakdown
    const paymentMethodBreakdown = await query<{ payment_method: string; type: string; total: number; count: number }>(
        `SELECT COALESCE(payment_method, 'CASH') as payment_method, type, COUNT(*) as count, SUM(amount) AS total FROM tblFinanceTransaction ${where} GROUP BY payment_method, type ORDER BY total DESC`,
        params
    );

    return {
        totalIncome,
        totalExpense,
        netAmount,
        todayIncome,
        todayExpense,
        todayNet,
        categoryBreakdown,
        paymentMethodBreakdown,
    };
}

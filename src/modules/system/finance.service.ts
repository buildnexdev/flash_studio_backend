// Developer by: Buildnexdev.in
// Devevloper : Nandhakumar@gmail.com
// Last Edited : 06-10-2026
import { execute, query, queryOne } from '../../db/pool.js';
import { notFound } from '../../utils/errors.js';
import { audit, type AuditContext } from '../audit/audit.service.js';

export interface FinanceTransactionInput {
    type: 'INCOME' | 'EXPENSE';
    category: string;
    amount: number;
    paymentMethod?: string | null;
    referenceNo?: string | null;
    orderId?: number | null;
    eventId?: number | null;
    staffId?: number | null;
    assetId?: number | null;
    description: string;
    transactionDate: string;
}

export async function listFinanceTransactions(options: { startDate?: string; endDate?: string; type?: string; category?: string } = {}) {
    const conditions: string[] = [];
    const params: unknown[] = [];

    if (options.type) {
        conditions.push('type = ?');
        params.push(options.type);
    }
    if (options.category) {
        conditions.push('category = ?');
        params.push(options.category);
    }
    if (options.startDate) {
        conditions.push('transaction_date >= ?');
        params.push(options.startDate);
    }
    if (options.endDate) {
        conditions.push('transaction_date <= ?');
        params.push(options.endDate);
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

    await audit(ctx, 'FINANCE_TRANSACTION_SAVED', 'system', id, { type: input.type, amount: input.amount });
    return queryOne('SELECT * FROM tblFinanceTransaction WHERE id = ?', [id]);
}

export async function deleteFinanceTransaction(id: number, ctx: AuditContext) {
    await execute('DELETE FROM tblFinanceTransaction WHERE id = ?', [id]);
    await audit(ctx, 'FINANCE_TRANSACTION_DELETED', 'system', id);
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

    const orderIncomeRow = await queryOne<{ total: number }>(
        `SELECT COALESCE(SUM(total), 0) AS total FROM tblOrder WHERE status IN ('PAID', 'DELIVERED', 'COMPLETED')`
    );

    const totalIncome = (incomeRow?.total ?? 0) + (orderIncomeRow?.total ?? 0);
    const totalExpense = expenseRow?.total ?? 0;
    const netAmount = totalIncome - totalExpense;

    const categoryBreakdown = await query(
        `SELECT category, type, SUM(amount) AS total FROM tblFinanceTransaction ${where} GROUP BY category, type`,
        params
    );

    return {
        totalIncome,
        totalExpense,
        netAmount,
        categoryBreakdown,
    };
}

// Developer by: Buildnexdev.in
// Devevloper : Nandhakumar@gmail.com
// Last Edited : 27-10-2026
import { execute, query, queryOne } from '../../db/pool.js';
import { badRequest, conflict, notFound } from '../../utils/errors.js';
import { audit, type AuditContext } from '../audit/audit.service.js';

function assertDate(d: string) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) throw badRequest('Use date as YYYY-MM-DD');
}
function assertMonth(m: string) {
    if (!/^\d{4}-\d{2}$/.test(m)) throw badRequest('Use period as YYYY-MM');
}

async function paymentTotalsForDay(closeDate: string, companyId?: number | null) {
    const where = ["status IN ('SUCCESS','REFUNDED')", "DATE(COALESCE(paid_at, created_at)) = ?"];
    const params: unknown[] = [closeDate];
    if (companyId) {
        where.push('company_id = ?');
        params.push(companyId);
    }
    const sqlWhere = `WHERE ${where.join(' AND ')}`;
    const row = await queryOne<{
        cash: number;
        upi: number;
        card: number;
        bank: number;
        other: number;
        refunds: number;
        payment_count: number;
    }>(
        `SELECT
            COALESCE(SUM(CASE WHEN LOWER(COALESCE(method,'')) IN ('cash') THEN amount - refunded_amount ELSE 0 END), 0) AS cash,
            COALESCE(SUM(CASE WHEN LOWER(COALESCE(method,'')) IN ('upi') THEN amount - refunded_amount ELSE 0 END), 0) AS upi,
            COALESCE(SUM(CASE WHEN LOWER(COALESCE(method,'')) IN ('card','card (pos)') THEN amount - refunded_amount ELSE 0 END), 0) AS card,
            COALESCE(SUM(CASE WHEN LOWER(COALESCE(method,'')) IN ('bank_transfer','bank transfer','neft','rtgs') THEN amount - refunded_amount ELSE 0 END), 0) AS bank,
            COALESCE(SUM(CASE WHEN LOWER(COALESCE(method,'')) NOT IN ('cash','upi','card','card (pos)','bank_transfer','bank transfer','neft','rtgs') OR method IS NULL THEN amount - refunded_amount ELSE 0 END), 0) AS other,
            COALESCE(SUM(refunded_amount), 0) AS refunds,
            COUNT(*) AS payment_count
           FROM tblPayment
          ${sqlWhere}`,
        params,
    );
    const payments = await query(
        `SELECT id, payment_no, purpose, amount, refunded_amount, method, provider, status, paid_at, customer_id
           FROM tblPayment
          ${sqlWhere}
          ORDER BY COALESCE(paid_at, created_at)`,
        params,
    );
    return { totals: row ?? { cash: 0, upi: 0, card: 0, bank: 0, other: 0, refunds: 0, payment_count: 0 }, payments };
}

export async function previewEndOfDay(closeDate: string, companyId?: number | null) {
    assertDate(closeDate);
    const { totals, payments } = await paymentTotalsForDay(closeDate, companyId);
    const existing = await queryOne(
        `SELECT * FROM tblCashClosingDay WHERE close_date = ? ${companyId ? 'AND company_id = ?' : ''}`,
        companyId ? [closeDate, companyId] : [closeDate],
    );
    const eventWhere = ['e.deleted_at IS NULL', 'e.event_date = ?'];
    const eventParams: unknown[] = [closeDate];
    if (companyId) {
        eventWhere.push('e.company_id = ?');
        eventParams.push(companyId);
    }
    const events = await query(
        `SELECT e.id, e.event_code, e.title, e.status, e.event_date,
                COUNT(es.id) AS team_size,
                COALESCE(b.total_amount, 0) AS booking_total,
                COALESCE(b.paid_amount, 0) AS booking_paid
           FROM tblEvent e
           LEFT JOIN tblBooking b ON b.id = e.booking_id
           LEFT JOIN tblEventStaff es ON es.event_id = e.id
          WHERE ${eventWhere.join(' AND ')}
          GROUP BY e.id
          ORDER BY e.id`,
        eventParams,
    );
    return {
        closeDate,
        system: {
            cash: Number(totals.cash),
            upi: Number(totals.upi),
            card: Number(totals.card),
            bank: Number(totals.bank),
            other: Number(totals.other),
            refunds: Number(totals.refunds),
            paymentCount: Number(totals.payment_count),
            netCollected: Number(totals.cash) + Number(totals.upi) + Number(totals.card) + Number(totals.bank) + Number(totals.other),
        },
        payments,
        events,
        closing: existing,
    };
}

export async function submitEndOfDay(
    input: { closeDate: string; openingFloat: number; countedCash: number; notes?: string | null },
    ctx: AuditContext,
) {
    assertDate(input.closeDate);
    const companyId = ctx.companyId ?? 1;
    const prev = await queryOne<{ id: number; status: string }>(
        'SELECT id, status FROM tblCashClosingDay WHERE close_date = ? AND company_id = ?',
        [input.closeDate, companyId],
    );
    if (prev && (prev.status === 'LOCKED' || prev.status === 'APPROVED')) throw conflict('This day is already closed.');

    const { totals } = await paymentTotalsForDay(input.closeDate, companyId);
    const systemCash = Number(totals.cash);
    const variance = input.countedCash - (input.openingFloat + systemCash);
    const values = [
        companyId,
        input.closeDate,
        input.openingFloat,
        systemCash,
        Number(totals.upi),
        Number(totals.card),
        Number(totals.bank),
        Number(totals.other),
        Number(totals.refunds),
        input.countedCash,
        variance,
        Number(totals.payment_count),
        'SUBMITTED',
        input.notes ?? null,
        ctx.userId,
    ];

    if (prev) {
        await execute(
            `UPDATE tblCashClosingDay SET opening_float=?, system_cash=?, system_upi=?, system_card=?, system_bank=?, system_other=?, system_refunds=?,
             counted_cash=?, variance=?, payment_count=?, status=?, notes=?, closed_by=?, closed_at=UTC_TIMESTAMP() WHERE id=? AND company_id=?`,
            [...values.slice(2), prev.id, companyId],
        );
        await audit(ctx, 'EOD_UPDATED', 'finance', prev.id, { closeDate: input.closeDate, variance });
        return queryOne('SELECT * FROM tblCashClosingDay WHERE id = ?', [prev.id]);
    }

    const id = (
        await execute(
            `INSERT INTO tblCashClosingDay
             (company_id, close_date, opening_float, system_cash, system_upi, system_card, system_bank, system_other, system_refunds,
              counted_cash, variance, payment_count, status, notes, closed_by, closed_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, UTC_TIMESTAMP())`,
            values,
        )
    ).insertId;
    await audit(ctx, 'EOD_SUBMITTED', 'finance', id, { closeDate: input.closeDate, variance });
    return queryOne('SELECT * FROM tblCashClosingDay WHERE id = ?', [id]);
}

export async function listEndOfDay(limit = 31, companyId?: number | null) {
    if (companyId) {
        return query('SELECT * FROM tblCashClosingDay WHERE company_id = ? ORDER BY close_date DESC LIMIT ?', [companyId, limit]);
    }
    return query('SELECT * FROM tblCashClosingDay ORDER BY close_date DESC LIMIT ?', [limit]);
}

export async function previewEndOfMonth(periodMonth: string, companyId?: number | null) {
    assertMonth(periodMonth);
    const from = `${periodMonth}-01`;
    const toRow = await queryOne<{ last: string }>(`SELECT LAST_DAY(?) AS last`, [from]);
    const to = toRow?.last ?? `${periodMonth}-28`;

    const payWhere = ["status IN ('SUCCESS','REFUNDED')", 'DATE(COALESCE(paid_at, created_at)) BETWEEN ? AND ?'];
    const payParams: unknown[] = [from, to];
    if (companyId) {
        payWhere.push('company_id = ?');
        payParams.push(companyId);
    }
    const pay = await queryOne<{ revenue: number; refunds: number; cash: number; non_cash: number }>(
        `SELECT
            COALESCE(SUM(amount - refunded_amount), 0) AS revenue,
            COALESCE(SUM(refunded_amount), 0) AS refunds,
            COALESCE(SUM(CASE WHEN LOWER(COALESCE(method,'')) = 'cash' THEN amount - refunded_amount ELSE 0 END), 0) AS cash,
            COALESCE(SUM(CASE WHEN LOWER(COALESCE(method,'')) <> 'cash' OR method IS NULL THEN amount - refunded_amount ELSE 0 END), 0) AS non_cash
           FROM tblPayment
          WHERE ${payWhere.join(' AND ')}`,
        payParams,
    );
    const dueWhere = ["deleted_at IS NULL AND status NOT IN ('CANCELLED','COMPLETED')"];
    const dueParams: unknown[] = [];
    if (companyId) {
        dueWhere.push('company_id = ?');
        dueParams.push(companyId);
    }
    const due = await queryOne<{ due: number }>(
        `SELECT COALESCE(SUM(GREATEST(total_amount - paid_amount, 0)), 0) AS due
           FROM tblBooking WHERE ${dueWhere.join(' AND ')}`,
        dueParams,
    );
    const payrollWhere = ['period_month = ?'];
    const payrollParams: unknown[] = [periodMonth];
    if (companyId) {
        payrollWhere.push('company_id = ?');
        payrollParams.push(companyId);
    }
    const payroll = await queryOne<{ draft: number; paid: number }>(
        `SELECT
            COALESCE(SUM(CASE WHEN status='DRAFT' THEN amount ELSE 0 END), 0) AS draft,
            COALESCE(SUM(CASE WHEN status='PAID' THEN amount ELSE 0 END), 0) AS paid
           FROM tblPayrollEntry WHERE ${payrollWhere.join(' AND ')}`,
        payrollParams,
    );
    const commissionWhere = ["period_month = ? AND type IN ('COMMISSION','SHARE')"];
    const commissionParams: unknown[] = [periodMonth];
    if (companyId) {
        commissionWhere.push('company_id = ?');
        commissionParams.push(companyId);
    }
    const commission = await queryOne<{ total: number }>(
        `SELECT COALESCE(SUM(amount), 0) AS total FROM tblStaffEarning
          WHERE ${commissionWhere.join(' AND ')}`,
        commissionParams,
    );
    const daysClosedWhere = ["close_date BETWEEN ? AND ? AND status IN ('SUBMITTED','APPROVED','LOCKED')"];
    const daysClosedParams: unknown[] = [from, to];
    if (companyId) {
        daysClosedWhere.push('company_id = ?');
        daysClosedParams.push(companyId);
    }
    const daysClosed = await queryOne<{ n: number }>(
        `SELECT COUNT(*) AS n FROM tblCashClosingDay WHERE ${daysClosedWhere.join(' AND ')}`,
        daysClosedParams,
    );
    const memberWhere = ["e.deleted_at IS NULL", "DATE_FORMAT(e.event_date, '%Y-%m') = ?"];
    const memberParams: unknown[] = [periodMonth];
    if (companyId) {
        memberWhere.push('e.company_id = ?');
        memberParams.push(companyId);
    }
    const memberShares = await query(
        `SELECT es.id, es.role, es.pay_basis, es.share_pct, es.commission_pct, es.flat_amount, es.day_rate_override, es.payout_status,
                u.id AS staff_user_id, u.name AS staff_name,
                e.id AS event_id, e.event_code, e.title AS event_title, e.event_date,
                COALESCE(b.total_amount, 0) AS booking_total, COALESCE(b.paid_amount, 0) AS booking_paid
           FROM tblEventStaff es
           JOIN tblEvent e ON e.id = es.event_id
           JOIN tblUser u ON u.id = es.user_id
           LEFT JOIN tblBooking b ON b.id = e.booking_id
          WHERE ${memberWhere.join(' AND ')}
          ORDER BY e.event_date, u.name`,
        memberParams,
    );
    const earningsWhere = ['se.period_month = ?'];
    const earningsParams: unknown[] = [periodMonth];
    if (companyId) {
        earningsWhere.push('se.company_id = ?');
        earningsParams.push(companyId);
    }
    const earnings = await query(
        `SELECT se.*, u.name AS staff_name, e.title AS event_title, e.event_code
           FROM tblStaffEarning se
           JOIN tblUser u ON u.id = se.staff_user_id
           LEFT JOIN tblEvent e ON e.id = se.event_id
          WHERE ${earningsWhere.join(' AND ')}
          ORDER BY se.earning_date DESC, se.id DESC`,
        earningsParams,
    );
    const existing = await queryOne(
        `SELECT * FROM tblCashClosingMonth WHERE period_month = ? ${companyId ? 'AND company_id = ?' : ''}`,
        companyId ? [periodMonth, companyId] : [periodMonth],
    );
    const revenue = Number(pay?.revenue ?? 0);
    const refunds = Number(pay?.refunds ?? 0);
    const payrollPaid = Number(payroll?.paid ?? 0);
    const commissionTotal = Number(commission?.total ?? 0);
    return {
        periodMonth,
        from,
        to,
        summary: {
            revenueTotal: revenue,
            refundsTotal: refunds,
            cashTotal: Number(pay?.cash ?? 0),
            nonCashTotal: Number(pay?.non_cash ?? 0),
            bookingsDue: Number(due?.due ?? 0),
            payrollDraft: Number(payroll?.draft ?? 0),
            payrollPaid,
            commissionTotal,
            daysClosed: Number(daysClosed?.n ?? 0),
            net: revenue - refunds - payrollPaid,
        },
        memberShares,
        earnings,
        closing: existing,
    };
}

export async function submitEndOfMonth(input: { periodMonth: string; notes?: string | null }, ctx: AuditContext) {
    const companyId = ctx.companyId ?? 1;
    const preview = await previewEndOfMonth(input.periodMonth, companyId);
    const prev = await queryOne<{ id: number; status: string }>(
        'SELECT id, status FROM tblCashClosingMonth WHERE period_month = ? AND company_id = ?',
        [input.periodMonth, companyId],
    );
    if (prev && (prev.status === 'LOCKED' || prev.status === 'APPROVED')) throw conflict('This month is already closed.');

    const s = preview.summary;
    const values = [
        companyId,
        input.periodMonth,
        s.revenueTotal,
        s.refundsTotal,
        s.cashTotal,
        s.nonCashTotal,
        s.bookingsDue,
        s.payrollDraft,
        s.payrollPaid,
        s.commissionTotal,
        s.net,
        s.daysClosed,
        'SUBMITTED',
        input.notes ?? null,
        ctx.userId,
    ];

    if (prev) {
        await execute(
            `UPDATE tblCashClosingMonth SET revenue_total=?, refunds_total=?, cash_total=?, non_cash_total=?, bookings_due=?,
             payroll_draft=?, payroll_paid=?, commission_total=?, net=?, days_closed=?, status=?, notes=?, closed_by=?, closed_at=UTC_TIMESTAMP()
             WHERE id=? AND company_id=?`,
            [...values.slice(2), prev.id, companyId],
        );
        await audit(ctx, 'EOM_UPDATED', 'finance', prev.id, { periodMonth: input.periodMonth });
        return queryOne('SELECT * FROM tblCashClosingMonth WHERE id = ?', [prev.id]);
    }

    const id = (
        await execute(
            `INSERT INTO tblCashClosingMonth
             (company_id, period_month, revenue_total, refunds_total, cash_total, non_cash_total, bookings_due,
              payroll_draft, payroll_paid, commission_total, net, days_closed, status, notes, closed_by, closed_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, UTC_TIMESTAMP())`,
            values,
        )
    ).insertId;
    await audit(ctx, 'EOM_SUBMITTED', 'finance', id, { periodMonth: input.periodMonth });
    return queryOne('SELECT * FROM tblCashClosingMonth WHERE id = ?', [id]);
}

export async function listEndOfMonth(limit = 24, companyId?: number | null) {
    if (companyId) {
        return query('SELECT * FROM tblCashClosingMonth WHERE company_id = ? ORDER BY period_month DESC LIMIT ?', [companyId, limit]);
    }
    return query('SELECT * FROM tblCashClosingMonth ORDER BY period_month DESC LIMIT ?', [limit]);
}

export async function getClosing(id: number, companyId?: number | null) {
    const where = ['id = ?'];
    const params: unknown[] = [id];
    if (companyId) {
        where.push('company_id = ?');
        params.push(companyId);
    }
    const row = await queryOne(`SELECT * FROM tblCashClosingDay WHERE ${where.join(' AND ')}`, params);
    if (!row) throw notFound('Closing');
    return row;
}

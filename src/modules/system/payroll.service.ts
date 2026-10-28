// Developer by: Buildnexdev.in
// Devevloper : Nandhakumar@gmail.com
// Last Edited : 27-10-2026
import { execute, query, queryOne } from '../../db/pool.js';
import { badRequest, conflict, notFound } from '../../utils/errors.js';
import { nextNumber } from '../../utils/numbering.js';
import { audit, type AuditContext } from '../audit/audit.service.js';

export interface PayrollInput {
    staffUserId: number;
    periodMonth: string;
    amount: number;
    payType?: 'SALARY' | 'DAY_RATE' | 'COMMISSION' | 'SHARE' | 'MIXED' | 'MANUAL';
    commissionPct?: number | null;
    notes?: string | null;
}

function assertMonth(m: string) {
    if (!/^\d{4}-\d{2}$/.test(m)) throw badRequest('Use period as YYYY-MM');
}

export async function listStaffForPayroll() {
    return query(
        `SELECT u.id, u.name, u.email, u.phone, u.status,
                (SELECT GROUP_CONCAT(r.code ORDER BY r.id) FROM tblUserRole ur JOIN tblRole r ON r.id = ur.role_id WHERE ur.user_id = u.id) AS role,
                s.designation, s.department,
                COALESCE(s.monthly_salary, 0) AS monthly_salary,
                COALESCE(s.default_commission_pct, 0) AS default_commission_pct,
                COALESCE(s.default_event_share_pct, 0) AS default_event_share_pct,
                COALESCE(p.day_rate, 0) AS day_rate
           FROM tblUser u
           LEFT JOIN tblStaff s ON s.user_id = u.id
           LEFT JOIN tblPhotographer p ON p.user_id = u.id
          WHERE u.deleted_at IS NULL
            AND u.status = 'ACTIVE'
            AND EXISTS (
                SELECT 1 FROM tblUserRole ur JOIN tblRole r ON r.id = ur.role_id
                 WHERE ur.user_id = u.id AND r.code <> 'CUSTOMER'
            )
          ORDER BY u.name`,
    );
}

export async function listPayroll(options: { periodMonth?: string; status?: string } = {}) {
    const where: string[] = [];
    const params: unknown[] = [];
    if (options.periodMonth) {
        assertMonth(options.periodMonth);
        where.push('pe.period_month = ?');
        params.push(options.periodMonth);
    }
    if (options.status) {
        where.push('pe.status = ?');
        params.push(options.status);
    }
    const sqlWhere = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const rows = await query(
        `SELECT pe.*, u.name AS staff_name, u.email AS staff_email,
                (SELECT GROUP_CONCAT(r.code ORDER BY r.id) FROM tblUserRole ur JOIN tblRole r ON r.id = ur.role_id WHERE ur.user_id = u.id) AS staff_role,
                s.designation, s.department
           FROM tblPayrollEntry pe
           JOIN tblUser u ON u.id = pe.staff_user_id
           LEFT JOIN tblStaff s ON s.user_id = u.id
           ${sqlWhere}
          ORDER BY pe.period_month DESC, pe.id DESC`,
        params,
    );
    const summary = await queryOne<{ draft: number; paid: number; total_paid: number }>(
        `SELECT
            COALESCE(SUM(CASE WHEN status = 'DRAFT' THEN amount ELSE 0 END), 0) AS draft,
            COALESCE(SUM(CASE WHEN status = 'PAID' THEN amount ELSE 0 END), 0) AS paid,
            COALESCE(SUM(CASE WHEN status = 'PAID' THEN amount ELSE 0 END), 0) AS total_paid
           FROM tblPayrollEntry
           ${options.periodMonth ? 'WHERE period_month = ?' : ''}`,
        options.periodMonth ? [options.periodMonth] : [],
    );
    return { items: rows, summary: { draft: Number(summary?.draft ?? 0), paid: Number(summary?.paid ?? 0), totalPaid: Number(summary?.total_paid ?? 0) } };
}

export async function createPayroll(input: PayrollInput, ctx: AuditContext) {
    assertMonth(input.periodMonth);
    if (input.amount <= 0) throw badRequest('Amount must be greater than zero');
    const staff = await queryOne('SELECT id FROM tblUser WHERE id = ? AND deleted_at IS NULL', [input.staffUserId]);
    if (!staff) throw notFound('Staff');
    const open = await queryOne(
        "SELECT id FROM tblPayrollEntry WHERE staff_user_id = ? AND period_month = ? AND status <> 'CANCELLED'",
        [input.staffUserId, input.periodMonth],
    );
    if (open) throw conflict('A payroll entry already exists for this staff member in that month.');

    const payrollNo = await nextNumber('payroll');
    const id = (
        await execute(
            `INSERT INTO tblPayrollEntry (payroll_no, staff_user_id, period_month, amount, pay_type, commission_pct, status, notes, created_by)
             VALUES (?, ?, ?, ?, ?, ?, 'DRAFT', ?, ?)`,
            [
                payrollNo,
                input.staffUserId,
                input.periodMonth,
                input.amount,
                input.payType ?? 'MANUAL',
                input.commissionPct ?? null,
                input.notes ?? null,
                ctx.userId,
            ],
        )
    ).insertId;
    await audit(ctx, 'PAYROLL_CREATED', 'finance', id, { payrollNo, periodMonth: input.periodMonth });
    return getPayroll(id);
}

export async function getPayroll(id: number) {
    const row = await queryOne(
        `SELECT pe.*, u.name AS staff_name, u.email AS staff_email,
                (SELECT GROUP_CONCAT(r.code ORDER BY r.id) FROM tblUserRole ur JOIN tblRole r ON r.id = ur.role_id WHERE ur.user_id = u.id) AS staff_role,
                s.designation, s.department
           FROM tblPayrollEntry pe
           JOIN tblUser u ON u.id = pe.staff_user_id
           LEFT JOIN tblStaff s ON s.user_id = u.id
          WHERE pe.id = ?`,
        [id],
    );
    if (!row) throw notFound('Payroll entry');
    return row;
}

export async function markPayrollPaid(id: number, ctx: AuditContext) {
    const row = await queryOne<{ id: number; status: string }>('SELECT id, status FROM tblPayrollEntry WHERE id = ?', [id]);
    if (!row) throw notFound('Payroll entry');
    if (row.status === 'PAID') throw conflict('Already marked as paid.');
    if (row.status === 'CANCELLED') throw badRequest('Cancelled payroll cannot be paid.');
    await execute("UPDATE tblPayrollEntry SET status = 'PAID', paid_at = UTC_TIMESTAMP() WHERE id = ?", [id]);
    await audit(ctx, 'PAYROLL_PAID', 'finance', id);
    return getPayroll(id);
}

export async function cancelPayroll(id: number, ctx: AuditContext) {
    const row = await queryOne<{ id: number; status: string }>('SELECT id, status FROM tblPayrollEntry WHERE id = ?', [id]);
    if (!row) throw notFound('Payroll entry');
    if (row.status === 'PAID') throw badRequest('Paid payroll cannot be cancelled. Create an adjustment instead.');
    await execute("UPDATE tblPayrollEntry SET status = 'CANCELLED' WHERE id = ?", [id]);
    await audit(ctx, 'PAYROLL_CANCELLED', 'finance', id);
    return getPayroll(id);
}

export async function listEventShares(periodMonth?: string, eventId?: number) {
    const where: string[] = ['e.deleted_at IS NULL'];
    const params: unknown[] = [];
    if (periodMonth) {
        assertMonth(periodMonth);
        where.push(`DATE_FORMAT(e.event_date, '%Y-%m') = ?`);
        params.push(periodMonth);
    }
    if (eventId) {
        where.push('e.id = ?');
        params.push(eventId);
    }
    return query(
        `SELECT es.id, es.event_id, es.user_id AS staff_user_id, es.role, es.pay_basis, es.share_pct, es.commission_pct,
                es.day_rate_override, es.flat_amount, es.payout_status, es.camera_label, es.task_status,
                u.name AS staff_name,
                e.event_code, e.title AS event_title, e.event_date, e.status AS event_status,
                COALESCE(b.total_amount, 0) AS booking_total,
                COALESCE(b.paid_amount, 0) AS booking_paid,
                COALESCE(p.day_rate, 0) AS staff_day_rate,
                COALESCE(s.default_commission_pct, 0) AS default_commission_pct,
                COALESCE(s.default_event_share_pct, 0) AS default_event_share_pct,
                CASE
                  WHEN es.pay_basis = 'FLAT' THEN COALESCE(es.flat_amount, 0)
                  WHEN es.pay_basis = 'DAY_RATE' THEN COALESCE(es.day_rate_override, p.day_rate, 0)
                  WHEN es.pay_basis = 'SHARE' THEN ROUND(COALESCE(b.paid_amount, 0) * COALESCE(es.share_pct, s.default_event_share_pct, 0) / 100)
                  WHEN es.pay_basis = 'COMMISSION' THEN ROUND(COALESCE(b.paid_amount, 0) * COALESCE(es.commission_pct, s.default_commission_pct, 0) / 100)
                  ELSE 0
                END AS estimated_pay
           FROM tblEventStaff es
           JOIN tblEvent e ON e.id = es.event_id
           JOIN tblUser u ON u.id = es.user_id
           LEFT JOIN tblBooking b ON b.id = e.booking_id
           LEFT JOIN tblPhotographer p ON p.user_id = u.id
           LEFT JOIN tblStaff s ON s.user_id = u.id
          WHERE ${where.join(' AND ')}
          ORDER BY e.event_date DESC, u.name`,
        params,
    );
}

export async function listEarnings(periodMonth: string) {
    assertMonth(periodMonth);
    return query(
        `SELECT se.*, u.name AS staff_name, e.title AS event_title, e.event_code
           FROM tblStaffEarning se
           JOIN tblUser u ON u.id = se.staff_user_id
           LEFT JOIN tblEvent e ON e.id = se.event_id
          WHERE se.period_month = ?
          ORDER BY se.earning_date DESC, se.id DESC`,
        [periodMonth],
    );
}

/** Build earnings from event team shares for a month, then create draft payroll per staff. */
export async function generateFromEvents(periodMonth: string, ctx: AuditContext) {
    assertMonth(periodMonth);
    const shares = (await listEventShares(periodMonth)) as {
        id: number;
        event_id: number;
        staff_user_id: number;
        pay_basis: string;
        share_pct: number | null;
        commission_pct: number | null;
        day_rate_override: number | null;
        flat_amount: number | null;
        staff_day_rate: number;
        booking_paid: number;
        estimated_pay: number;
        event_date: string;
        event_title: string;
        payout_status: string;
    }[];

    let createdEarnings = 0;
    let createdPayroll = 0;
    const byStaff = new Map<number, { amount: number; types: Set<string> }>();

    for (const s of shares) {
        if (s.pay_basis === 'NONE' || s.payout_status === 'WAIVED' || s.payout_status === 'PAID') continue;
        const amount = Number(s.estimated_pay || 0);
        if (amount <= 0) continue;

        const exists = await queryOne(
            'SELECT id FROM tblStaffEarning WHERE event_staff_id = ? AND type = ? AND period_month = ?',
            [s.id, s.pay_basis === 'FLAT' ? 'DAY_RATE' : s.pay_basis, periodMonth],
        );
        if (exists) continue;

        const type = s.pay_basis === 'FLAT' ? 'DAY_RATE' : s.pay_basis === 'NONE' ? 'ADJUSTMENT' : (s.pay_basis as 'DAY_RATE' | 'SHARE' | 'COMMISSION');
        const ratePct = s.pay_basis === 'SHARE' ? s.share_pct : s.pay_basis === 'COMMISSION' ? s.commission_pct : null;
        await execute(
            `INSERT INTO tblStaffEarning
             (staff_user_id, event_id, event_staff_id, earning_date, period_month, type, base_amount, rate_pct, amount, notes, created_by)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                s.staff_user_id,
                s.event_id,
                s.id,
                s.event_date,
                periodMonth,
                type,
                Number(s.booking_paid || 0),
                ratePct,
                amount,
                `${type} for ${s.event_title}`,
                ctx.userId,
            ],
        );
        await execute("UPDATE tblEventStaff SET payout_status = 'INCLUDED' WHERE id = ?", [s.id]);
        createdEarnings += 1;
        const cur = byStaff.get(s.staff_user_id) ?? { amount: 0, types: new Set<string>() };
        cur.amount += amount;
        cur.types.add(type);
        byStaff.set(s.staff_user_id, cur);
    }

    for (const [staffUserId, agg] of byStaff) {
        const open = await queryOne(
            "SELECT id, amount FROM tblPayrollEntry WHERE staff_user_id = ? AND period_month = ? AND status = 'DRAFT'",
            [staffUserId, periodMonth],
        );
        const payType = agg.types.size > 1 ? 'MIXED' : ([...agg.types][0] as PayrollInput['payType']) ?? 'MIXED';
        if (open) {
            await execute('UPDATE tblPayrollEntry SET amount = amount + ?, pay_type = ? WHERE id = ?', [agg.amount, payType, open.id]);
            await execute('UPDATE tblStaffEarning SET payroll_entry_id = ? WHERE staff_user_id = ? AND period_month = ? AND payroll_entry_id IS NULL', [
                open.id,
                staffUserId,
                periodMonth,
            ]);
        } else {
            const cancelled = await queryOne(
                "SELECT id FROM tblPayrollEntry WHERE staff_user_id = ? AND period_month = ? AND status = 'PAID'",
                [staffUserId, periodMonth],
            );
            if (cancelled) continue;
            const entry = await createPayroll(
                { staffUserId, periodMonth, amount: agg.amount, payType: payType === 'SALARY' ? 'MIXED' : payType, notes: `Auto from event commissions · ${periodMonth}` },
                ctx,
            );
            await execute('UPDATE tblStaffEarning SET payroll_entry_id = ? WHERE staff_user_id = ? AND period_month = ? AND payroll_entry_id IS NULL', [
                (entry as { id: number }).id,
                staffUserId,
                periodMonth,
            ]);
            createdPayroll += 1;
        }
    }

    await audit(ctx, 'PAYROLL_GENERATED', 'finance', null, { periodMonth, createdEarnings, createdPayroll });
    return { createdEarnings, createdPayroll, payroll: await listPayroll({ periodMonth }), earnings: await listEarnings(periodMonth) };
}

export async function updateEventShare(
    assignmentId: number,
    input: {
        payBasis: 'DAY_RATE' | 'SHARE' | 'COMMISSION' | 'FLAT' | 'NONE';
        sharePct?: number | null;
        commissionPct?: number | null;
        dayRateOverride?: number | null;
        flatAmount?: number | null;
    },
    ctx: AuditContext,
) {
    const row = await queryOne<{ id: number; event_id: number }>('SELECT id, event_id FROM tblEventStaff WHERE id = ?', [assignmentId]);
    if (!row) throw notFound('Assignment');
    if (input.payBasis === 'SHARE' && (input.sharePct == null || input.sharePct < 0 || input.sharePct > 100)) {
        throw badRequest('Share % must be between 0 and 100');
    }
    if (input.payBasis === 'COMMISSION' && (input.commissionPct == null || input.commissionPct < 0 || input.commissionPct > 100)) {
        throw badRequest('Commission % must be between 0 and 100');
    }
    await execute(
        `UPDATE tblEventStaff SET pay_basis = ?, share_pct = ?, commission_pct = ?, day_rate_override = ?, flat_amount = ? WHERE id = ?`,
        [
            input.payBasis,
            input.sharePct ?? null,
            input.commissionPct ?? null,
            input.dayRateOverride ?? null,
            input.flatAmount ?? null,
            assignmentId,
        ],
    );
    await audit(ctx, 'EVENT_SHARE_UPDATED', 'events', row.event_id, { assignmentId, ...input });
    return listEventShares(undefined, row.event_id);
}

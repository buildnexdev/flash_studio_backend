// Developer by: Buildnexdev.in
// Devevloper : Nandhakumar@gmail.com
// Last Edited : 06-10-2026
import type { Request } from 'express';
import { execute, json, query, queryOne } from '../../db/pool.js';
import { clientIp, userAgent } from '../../utils/http.js';
import { likeTerm, offsetOf, paged } from '../../utils/pagination.js';

export interface AuditContext {
    userId: number | null;
    companyId?: number | null;
    ip?: string | null;
    userAgent?: string | null;
}

export const auditCtx = (req: Request, userId?: number | null): AuditContext => ({
    userId: userId ?? req.user?.id ?? null,
    companyId: req.user?.companyId ?? null,
    ip: clientIp(req),
    userAgent: userAgent(req),
});

export const systemCtx: AuditContext = { userId: null, companyId: null, ip: null, userAgent: 'system' };

const SENSITIVE = /pass(word)?|secret|token|signature|otp|code_hash/i;

function scrub(meta: Record<string, unknown> | undefined): Record<string, unknown> | undefined {
    if (!meta) return undefined;
    return Object.fromEntries(Object.entries(meta).map(([k, v]) => [k, SENSITIVE.test(k) ? '[redacted]' : v]));
}

/** Write an audit entry. Failures are logged but never break the business action. */
export async function audit(ctx: AuditContext, action: string, module: string, recordId?: string | number | null, metadata?: Record<string, unknown>): Promise<void> {
    try {
        await execute(
            'INSERT INTO tblAuditLog (user_id, company_id, action, module, record_id, ip, user_agent, metadata) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
            [ctx.userId, ctx.companyId ?? null, action, module, recordId == null ? null : String(recordId), ctx.ip ?? null, ctx.userAgent ?? null, json(scrub(metadata))],
        );
    } catch (err) {
        console.error('[audit] failed to write entry', action, err);
    }
}

export interface AuditFilter {
    page: number;
    pageSize: number;
    search?: string;
    module?: string;
    action?: string;
    userId?: number;
    companyId?: number;
    from?: string;
    to?: string;
}

export async function listAudit(f: AuditFilter) {
    const where: string[] = ['1=1'];
    const params: unknown[] = [];
    if (f.module) { where.push('a.module = ?'); params.push(f.module); }
    if (f.action) { where.push('a.action = ?'); params.push(f.action); }
    if (f.userId) { where.push('a.user_id = ?'); params.push(f.userId); }
    if (f.companyId) { where.push('a.company_id = ?'); params.push(f.companyId); }
    if (f.from) { where.push('a.created_at >= ?'); params.push(`${f.from} 00:00:00`); }
    if (f.to) { where.push('a.created_at < DATE_ADD(?, INTERVAL 1 DAY)'); params.push(f.to); }
    if (f.search) {
        where.push('(a.action LIKE ? OR a.module LIKE ? OR a.record_id LIKE ? OR u.name LIKE ? OR u.email LIKE ?)');
        const t = likeTerm(f.search);
        params.push(t, t, t, t, t);
    }
    const sqlWhere = where.join(' AND ');
    const total = (await queryOne<{ n: number }>(`SELECT COUNT(*) AS n FROM tblAuditLog a LEFT JOIN tblUser u ON u.id = a.user_id WHERE ${sqlWhere}`, params))?.n ?? 0;
    const items = await query(
        `SELECT a.id, a.user_id, a.company_id, u.name AS user_name, u.email AS user_email, a.action, a.module, a.record_id, a.ip, a.user_agent, a.metadata, a.created_at
           FROM tblAuditLog a LEFT JOIN tblUser u ON u.id = a.user_id
          WHERE ${sqlWhere} ORDER BY a.id DESC LIMIT ? OFFSET ?`,
        [...params, f.pageSize, offsetOf(f)],
    );
    const modules = await query<{ module: string }>('SELECT DISTINCT module FROM tblAuditLog ORDER BY module');
    return { ...paged(items, total, f), modules: modules.map((m) => m.module) };
}

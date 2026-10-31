// Developer by: Buildnexdev.in
// Devevloper : Nandhakumar@gmail.com
// Last Edited : 06-10-2026
import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config/env.js';
import { applyPageRules, matchPageRequest, type PageRule } from '../config/pages.js';
import { ROLE_LEVEL, primaryRole, type Permission, type RoleCode } from '../config/rbac.js';
import { currentDatabaseKey, currentStudioSlug, query, queryOne, runInTenant } from '../db/pool.js';
import { resolveTenant } from '../modules/companies/companies.service.js';
import { forbidden, unauthorized } from '../utils/errors.js';

export interface AuthUser {
    id: number;
    name: string;
    email: string | null;
    phone: string | null;
    companyId: number | null;
    roles: RoleCode[];
    /** tblUser.is_admin = 1 (or Super Admin): may manage other users' page access. */
    isAdmin: boolean;
    permissions: Set<Permission>;
    /** Per-user page overrides; empty when the role decides everything. */
    pageRules: Map<string, PageRule>;
    customerId: number | null;
    tokenVersion: number;
}

export async function loadPageRules(userId: number): Promise<Map<string, PageRule>> {
    const rows = await query<{ page_key: string; can_view: number; can_add: number; can_edit: number; can_delete: number }>(
        'SELECT page_key, can_view, can_add, can_edit, can_delete FROM tblUserPageAccess WHERE user_id = ?',
        [userId],
    ).catch(() => []);
    return new Map(rows.map((r) => [r.page_key, { view: !!r.can_view, add: !!r.can_add, edit: !!r.can_edit, delete: !!r.can_delete }]));
}

interface AccessPayload {
    sub: string;
    tv: number;
    typ: 'access';
    sid?: string;
}

const CACHE_TTL_MS = 30_000;
const cache = new Map<string, { user: AuthUser; expires: number }>();
const userCacheKey = (userId: number) => `${currentDatabaseKey()}:${userId}`;

export function invalidateUserCache(userId?: number): void {
    if (userId === undefined) cache.clear();
    else cache.delete(userCacheKey(userId));
}

export async function loadAuthUser(userId: number): Promise<AuthUser | null> {
    const key = userCacheKey(userId);
    const hit = cache.get(key);
    if (hit && hit.expires > Date.now()) return hit.user;

    const row = await queryOne<{ id: number; company_id: number | null; name: string; email: string | null; phone: string | null; status: string; token_version: number; is_admin: number; customer_id: number | null }>(
        `SELECT u.id, u.company_id, u.name, u.email, u.phone, u.status, u.token_version, u.is_admin, c.id AS customer_id
           FROM tblUser u LEFT JOIN tblCustomer c ON c.user_id = u.id AND c.deleted_at IS NULL
          WHERE u.id = ? AND u.deleted_at IS NULL`,
        [userId],
    );
    if (!row || row.status !== 'ACTIVE') return null;

    const perms = await query<{ role: RoleCode; permission: Permission | null }>(
        `SELECT r.code AS role, p.code AS permission
           FROM tblUserRole ur
           JOIN tblRole r ON r.id = ur.role_id
           LEFT JOIN tblRolePermission rp ON rp.role_id = r.id
           LEFT JOIN tblPermission p ON p.id = rp.permission_id
          WHERE ur.user_id = ?`,
        [userId],
    );
    const roles = [...new Set(perms.map((p) => p.role))];
    const rolePerms = new Set(perms.map((p) => p.permission).filter((p): p is Permission => !!p));
    const pageRules = roles.includes('SUPER_ADMIN') ? new Map<string, PageRule>() : await loadPageRules(userId);
    const user: AuthUser = {
        id: row.id,
        companyId: row.company_id,
        name: row.name,
        email: row.email,
        phone: row.phone,
        roles,
        isAdmin: !!row.is_admin || roles.includes('SUPER_ADMIN'),
        permissions: pageRules.size ? applyPageRules(rolePerms, pageRules) : rolePerms,
        pageRules,
        customerId: row.customer_id,
        tokenVersion: row.token_version,
    };
    cache.set(key, { user, expires: Date.now() + CACHE_TTL_MS });
    return user;
}

export function signAccessToken(userId: number, tokenVersion: number, studioSlug?: string | null): string {
    const payload: AccessPayload = { sub: String(userId), tv: tokenVersion, typ: 'access', ...(studioSlug ? { sid: studioSlug } : {}) };
    return jwt.sign(payload, config.JWT_SECRET, { expiresIn: config.ACCESS_TOKEN_TTL as jwt.SignOptions['expiresIn'], issuer: 'photolab' });
}

export async function userFromAccessToken(token: string): Promise<AuthUser | null> {
    try {
        const payload = jwt.verify(token, config.JWT_SECRET, { issuer: 'photolab' }) as AccessPayload;
        if (payload.typ !== 'access') return null;
        if (payload.sid && !currentStudioSlug()) {
            const scope = await resolveTenant(payload.sid).catch(() => null);
            if (scope) {
                return runInTenant(scope, async () => {
                    const user = await loadAuthUser(Number(payload.sub));
                    if (!user || user.tokenVersion !== payload.tv) return null;
                    return user;
                });
            }
        }
        const user = await loadAuthUser(Number(payload.sub));
        if (!user || user.tokenVersion !== payload.tv) return null;
        return user;
    } catch {
        return null;
    }
}

function bearer(req: Request): string | null {
    const header = req.headers.authorization;
    if (header?.startsWith('Bearer ')) return header.slice(7).trim();
    return null;
}

export async function authenticate(req: Request, _res: Response, next: NextFunction): Promise<void> {
    const token = bearer(req);
    if (!token) return next(unauthorized());
    const payload = jwt.decode(token) as AccessPayload | null;
    if (payload?.sid && !currentStudioSlug()) {
        const scope = await resolveTenant(payload.sid).catch(() => null);
        if (scope) {
            return runInTenant(scope, () => authenticate(req, _res, next));
        }
    }
    const user = await userFromAccessToken(token).catch(() => null);
    if (!user) return next(unauthorized('Your session has expired. Please sign in again.'));
    req.user = user;
    if (user.pageRules.size) {
        const hit = matchPageRequest(req.method, (req.originalUrl ?? req.url).split('?')[0]);
        const rule = hit && user.pageRules.get(hit.page.key);
        if (hit && rule && !rule[hit.action]) return next(forbidden(`You do not have permission to ${hit.action} on ${hit.page.label}.`));
    }
    next();
}

export async function optionalAuth(req: Request, _res: Response, next: NextFunction): Promise<void> {
    const token = bearer(req);
    if (token) {
        const payload = jwt.decode(token) as AccessPayload | null;
        if (payload?.sid && !currentStudioSlug()) {
            const scope = await resolveTenant(payload.sid).catch(() => null);
            if (scope) {
                return runInTenant(scope, () => optionalAuth(req, _res, next));
            }
        }
        const user = await userFromAccessToken(token).catch(() => null);
        if (user) req.user = user;
    }
    next();
}

export const hasPermission = (user: AuthUser | undefined, ...perms: Permission[]): boolean =>
    !!user && perms.some((p) => user.permissions.has(p));

export const hasRole = (user: AuthUser | undefined, ...roles: RoleCode[]): boolean => !!user && roles.some((r) => user.roles.includes(r));

/** Allow the request when the user has ANY of the listed permissions. */
export function requirePermission(...perms: Permission[]) {
    return (req: Request, _res: Response, next: NextFunction) => {
        if (!req.user) return next(unauthorized());
        if (!hasPermission(req.user, ...perms)) return next(forbidden());
        next();
    };
}

export function requireAdmin(req: Request, _res: Response, next: NextFunction) {
    if (!req.user) return next(unauthorized());
    if (!req.user.isAdmin) return next(forbidden('Only admin users can manage page access.'));
    next();
}

export function requireCustomer(req: Request, _res: Response, next: NextFunction) {
    if (!req.user) return next(unauthorized());
    if (!req.user.customerId || !req.user.permissions.has('customer.portal')) return next(forbidden('A customer account is required.'));
    next();
}

export function serializeUser(user: AuthUser) {
    return {
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        companyId: user.companyId,
        roles: user.roles,
        isAdmin: user.isAdmin,
        roleLevel: primaryRole(user.roles) ? ROLE_LEVEL[primaryRole(user.roles)!] : null,
        permissions: [...user.permissions],
        pageAccess: Object.fromEntries(user.pageRules),
        customerId: user.customerId,
    };
}

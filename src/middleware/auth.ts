// Developer by: Buildnexdev.in
// Devevloper : Nandhakumar@gmail.com
// Last Edited : 06-10-2026
import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config/env.js';
import type { Permission, RoleCode } from '../config/rbac.js';
import { query, queryOne } from '../db/pool.js';
import { forbidden, unauthorized } from '../utils/errors.js';

export interface AuthUser {
    id: number;
    name: string;
    email: string | null;
    phone: string | null;
    roles: RoleCode[];
    permissions: Set<Permission>;
    customerId: number | null;
    tokenVersion: number;
}

interface AccessPayload {
    sub: string;
    tv: number;
    typ: 'access';
}

const CACHE_TTL_MS = 30_000;
const cache = new Map<number, { user: AuthUser; expires: number }>();

export function invalidateUserCache(userId?: number): void {
    if (userId === undefined) cache.clear();
    else cache.delete(userId);
}

export async function loadAuthUser(userId: number): Promise<AuthUser | null> {
    const hit = cache.get(userId);
    if (hit && hit.expires > Date.now()) return hit.user;

    const row = await queryOne<{ id: number; name: string; email: string | null; phone: string | null; status: string; token_version: number; customer_id: number | null }>(
        `SELECT u.id, u.name, u.email, u.phone, u.status, u.token_version, c.id AS customer_id
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
    const user: AuthUser = {
        id: row.id,
        name: row.name,
        email: row.email,
        phone: row.phone,
        roles: [...new Set(perms.map((p) => p.role))],
        permissions: new Set(perms.map((p) => p.permission).filter((p): p is Permission => !!p)),
        customerId: row.customer_id,
        tokenVersion: row.token_version,
    };
    cache.set(userId, { user, expires: Date.now() + CACHE_TTL_MS });
    return user;
}

export function signAccessToken(userId: number, tokenVersion: number): string {
    const payload: AccessPayload = { sub: String(userId), tv: tokenVersion, typ: 'access' };
    return jwt.sign(payload, config.JWT_SECRET, { expiresIn: config.ACCESS_TOKEN_TTL as jwt.SignOptions['expiresIn'], issuer: 'photolab' });
}

export async function userFromAccessToken(token: string): Promise<AuthUser | null> {
    try {
        const payload = jwt.verify(token, config.JWT_SECRET, { issuer: 'photolab' }) as AccessPayload;
        if (payload.typ !== 'access') return null;
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
    const user = await userFromAccessToken(token).catch(() => null);
    if (!user) return next(unauthorized('Your session has expired. Please sign in again.'));
    req.user = user;
    next();
}

export async function optionalAuth(req: Request, _res: Response, next: NextFunction): Promise<void> {
    const token = bearer(req);
    if (token) {
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
        roles: user.roles,
        permissions: [...user.permissions],
        customerId: user.customerId,
    };
}

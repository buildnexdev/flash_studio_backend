// Developer by: Buildnexdev.in
// Last Edited : 14-10-2026
import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config/env.js';
import { runInTenant } from '../db/pool.js';
import { resolveTenant } from '../modules/companies/companies.service.js';
import { AppError } from '../utils/errors.js';

export const STUDIO_COOKIE = 'pl_studio';

function bearer(req: Request): string | null {
    const header = req.headers.authorization;
    if (header?.startsWith('Bearer ')) return header.slice(7).trim();
    return null;
}

function slugFromRequest(req: Request): string | null {
    const token = bearer(req);
    if (token) {
        try {
            const payload = jwt.verify(token, config.JWT_SECRET, { issuer: 'photolab' }) as { typ?: string; sid?: string };
            if (payload.typ === 'access') return payload.sid?.trim().toLowerCase() || null;
        } catch {
            // An expired access token still lets the refresh cookie select the studio.
        }
    }
    const header = req.headers['x-studio-slug'];
    if (typeof header === 'string' && header.trim()) return header.trim().toLowerCase();
    const cookie = req.cookies?.[STUDIO_COOKIE];
    if (typeof cookie === 'string' && cookie.trim()) return cookie.trim().toLowerCase();
    return null;
}

/** Point this request at the studio database named by the access token, header, or cookie. */
export function bindTenant(req: Request, _res: Response, next: NextFunction): void {
    const slug = slugFromRequest(req);
    if (!slug) return next();
    resolveTenant(slug)
        .then((scope) => {
            runInTenant(scope, () => next());
        })
        .catch((err: unknown) => {
            const errno = (err as { errno?: number }).errno;
            if (errno === 1146) return next();
            next(err instanceof AppError ? err : err);
        });
}

// Developer by: Buildnexdev.in
// Devevloper : Nandhakumar@gmail.com
// Last Edited : 06-10-2026
// AUTHOR: NANDHAKUMAR
// EDITED DATE: 2026-10-01
import { Router, type CookieOptions, type Request, type Response } from 'express';
import { z } from 'zod';
import { config } from '../../config/env.js';
import { platformDatabaseName, pool, runInTenant } from '../../db/pool.js';
import { authenticate, serializeUser } from '../../middleware/auth.js';
import { STUDIO_COOKIE } from '../../middleware/tenant.js';
import { authLimiter, otpLimiter } from '../../middleware/rate-limit.js';
import { validate } from '../../middleware/validate.js';
import { asyncHandler, clientIp, ok, userAgent } from '../../utils/http.js';
import { email, optionalText, password, phone } from '../../utils/schemas.js';
import { auditCtx } from '../audit/audit.service.js';
import { resolveTenant } from '../companies/companies.service.js';
import * as auth from './auth.service.js';

export const REFRESH_COOKIE = 'pl_rt';

const cookieOptions = (expires?: Date): CookieOptions => ({
    httpOnly: true,
    secure: config.isProd,
    sameSite: config.isProd ? 'none' : 'lax',
    path: '/api/auth',
    ...(expires ? { expires } : {}),
});

const meta = (req: Request) => ({ ip: clientIp(req), userAgent: userAgent(req) });

/** Browsers get the refresh token only as an httpOnly cookie; native apps (X-Client: mobile) receive it in the body. */
function sendSession(req: Request, res: Response, session: Awaited<ReturnType<typeof auth.sessionPayload>>, status = 200) {
    const expires = new Date(session.refreshExpiresAt);
    res.cookie(REFRESH_COOKIE, session.refreshToken, cookieOptions(expires));
    if (session.studioSlug) {
        res.cookie(STUDIO_COOKIE, session.studioSlug, { httpOnly: true, secure: config.isProd, sameSite: config.isProd ? 'none' : 'lax', path: '/api', expires });
    } else {
        res.clearCookie(STUDIO_COOKIE, { path: '/api' });
    }
    const isMobile = req.headers['x-client'] === 'mobile';
    const { refreshToken, ...rest } = session;
    return res.status(status).json({ success: true, message: 'Signed in', data: isMobile ? session : rest });
}

const readRefresh = (req: Request): string | undefined => req.cookies?.[REFRESH_COOKIE] || (typeof req.body?.refreshToken === 'string' ? req.body.refreshToken : undefined);

/** CSRF defence for cookie-authenticated endpoints: require a custom header a cross-site form cannot set. */
function requireXhr(req: Request, res: Response, next: () => void) {
    if (req.headers['x-requested-with'] !== 'XMLHttpRequest' && req.headers['x-client'] !== 'mobile') {
        return res.status(403).json({ success: false, message: 'Missing X-Requested-With header.', errors: [] });
    }
    next();
}

const router = Router();

router.post(
    '/register',
    authLimiter,
    validate(z.object({ name: z.string().trim().min(2).max(120), email, phone: phone.optional(), password })),
    asyncHandler(async (req, res) => {
        const session = await auth.register(req.body, meta(req), auditCtx(req));
        sendSession(req, res, session, 201);
    }),
);

router.post(
    '/login',
    authLimiter,
    validate(z.object({ identifier: z.string().trim().min(3).max(190), password: z.string().min(1).max(200), studio: z.string().trim().max(80).optional() })),
    asyncHandler(async (req, res) => {
        const slug = (req.body.studio as string | undefined)?.trim().toLowerCase() ?? '';
        const signIn = async () => {
            const session = await auth.login(req.body.identifier, req.body.password, meta(req), auditCtx(req));
            sendSession(req, res, session);
        };
        if (!slug) {
            await runInTenant({ pool, database: platformDatabaseName(), slug: null }, signIn);
            return;
        }
        await runInTenant(await resolveTenant(slug), signIn);
    }),
);

router.post(
    '/refresh',
    requireXhr,
    asyncHandler(async (req, res) => {
        try {
            const session = await auth.refresh(readRefresh(req) ?? '', meta(req));
            sendSession(req, res, session);
        } catch (err) {
            res.clearCookie(REFRESH_COOKIE, cookieOptions());
            throw err;
        }
    }),
);

router.post(
    '/logout',
    requireXhr,
    asyncHandler(async (req, res) => {
        await auth.logout(readRefresh(req), auditCtx(req));
        res.clearCookie(REFRESH_COOKIE, cookieOptions());
        res.clearCookie(STUDIO_COOKIE, { path: '/api' });
        ok(res, null, 'Signed out');
    }),
);

router.post(
    '/logout-all',
    authenticate,
    asyncHandler(async (req, res) => {
        await auth.logoutAll(req.user!.id, auditCtx(req));
        res.clearCookie(REFRESH_COOKIE, cookieOptions());
        ok(res, null, 'Signed out from all devices');
    }),
);

router.get(
    '/me',
    authenticate,
    asyncHandler(async (req, res) => {
        ok(res, { user: serializeUser(req.user!), profile: await auth.getProfile(req.user!.id) });
    }),
);

router.put(
    '/profile',
    authenticate,
    validate(
        z.object({
            name: z.string().trim().min(2).max(120),
            phone: phone.optional().nullable(),
            address: optionalText(255),
            city: optionalText(80),
            state: optionalText(80),
            pincode: optionalText(12),
        }),
    ),
    asyncHandler(async (req, res) => {
        await auth.updateProfile(req.user!.id, req.body, auditCtx(req));
        ok(res, await auth.getProfile(req.user!.id), 'Profile updated');
    }),
);

router.post(
    '/change-password',
    authenticate,
    validate(z.object({ currentPassword: z.string().min(1), newPassword: password })),
    asyncHandler(async (req, res) => {
        await auth.changePassword(req.user!.id, req.body.currentPassword, req.body.newPassword, auditCtx(req));
        ok(res, null, 'Password changed');
    }),
);

router.post(
    '/forgot-password',
    otpLimiter,
    validate(z.object({ email })),
    asyncHandler(async (req, res) => {
        ok(res, await auth.forgotPassword(req.body.email), 'If the email is registered, a reset link has been sent.');
    }),
);

router.post(
    '/reset-password',
    authLimiter,
    validate(z.object({ email, token: z.string().min(10).max(200), password })),
    asyncHandler(async (req, res) => {
        ok(res, await auth.resetPassword(req.body.email, req.body.token, req.body.password, auditCtx(req)), 'Password updated. Please sign in.');
    }),
);

const destination = z.string().trim().min(5).max(190);

router.post(
    '/otp/request',
    otpLimiter,
    validate(z.object({ destination, purpose: z.enum(['LOGIN', 'VERIFY']).default('LOGIN') })),
    asyncHandler(async (req, res) => {
        ok(res, await auth.requestOtp(req.body.destination, req.body.purpose), 'If the account exists, a code has been sent.');
    }),
);

router.post(
    '/otp/verify',
    authLimiter,
    validate(z.object({ destination, purpose: z.enum(['LOGIN', 'VERIFY']).default('LOGIN'), code: z.string().regex(/^\d{6}$/, 'Enter the 6 digit code') })),
    asyncHandler(async (req, res) => {
        const result = await auth.verifyOtp(req.body.destination, req.body.purpose, req.body.code, meta(req), auditCtx(req));
        if ('accessToken' in result) return sendSession(req, res, result);
        ok(res, result, 'Verified');
    }),
);

router.get(
    '/sessions',
    authenticate,
    asyncHandler(async (req, res) => {
        ok(res, await auth.listSessions(req.user!.id));
    }),
);

router.delete(
    '/sessions/:id',
    authenticate,
    validate(z.object({ id: z.string().uuid() }), 'params'),
    asyncHandler(async (req, res) => {
        await auth.revokeSession(req.user!.id, String(req.params.id), auditCtx(req));
        ok(res, null, 'Session revoked');
    }),
);

export default router;

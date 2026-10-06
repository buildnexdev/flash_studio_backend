// Developer by: Buildnexdev.in
// Devevloper : Nandhakumar@gmail.com
// Last Edited : 06-10-2026
import rateLimit, { type Options } from 'express-rate-limit';
import { config } from '../config/env.js';

const make = (opts: Partial<Options>) =>
    rateLimit({
        standardHeaders: 'draft-7',
        legacyHeaders: false,
        skip: () => config.isTest,
        handler: (_req, res, _next, options) =>
            res.status(options.statusCode).json({ success: false, message: 'Too many requests, please try again later.', errors: [] }),
        ...opts,
    });

export const apiLimiter = make({ windowMs: 60_000, limit: 600 });
export const authLimiter = make({ windowMs: 15 * 60_000, limit: 30 });
export const otpLimiter = make({ windowMs: 15 * 60_000, limit: 6 });
export const galleryAccessLimiter = make({ windowMs: 15 * 60_000, limit: 60 });
export const publicFormLimiter = make({ windowMs: 60 * 60_000, limit: 20 });

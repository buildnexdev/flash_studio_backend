// Developer by: Buildnexdev.in
// Devevloper : Nandhakumar@gmail.com
// Last Edited : 06-10-2026
import type { NextFunction, Request, Response } from 'express';
import multer from 'multer';
import { ZodError } from 'zod';
import { config } from '../config/env.js';
import { AppError } from '../utils/errors.js';

export function notFoundHandler(req: Request, res: Response) {
    res.status(404).json({ success: false, message: `Route ${req.method} ${req.path} not found`, errors: [] });
}

export function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction) {
    if (err instanceof ZodError) {
        return res.status(422).json({
            success: false,
            message: 'Please correct the highlighted fields.',
            errors: err.issues.map((i) => ({ field: i.path.join('.') || 'value', message: i.message })),
        });
    }
    if (err instanceof AppError) {
        return res.status(err.status).json({ success: false, message: err.message, errors: err.errors, code: err.code });
    }
    if (err instanceof multer.MulterError) {
        const message = err.code === 'LIMIT_FILE_SIZE' ? `File is too large (max ${config.MAX_UPLOAD_MB} MB).` : err.message;
        return res.status(400).json({ success: false, message, errors: [{ field: err.field || 'file', message }] });
    }
    const e = err as { type?: string; status?: number; code?: string; message?: string };
    if (e?.type === 'entity.parse.failed') {
        return res.status(400).json({ success: false, message: 'Malformed JSON body.', errors: [] });
    }
    if (e?.type === 'entity.too.large') {
        return res.status(413).json({ success: false, message: 'Request body is too large.', errors: [] });
    }
    if (e?.code === 'ER_DUP_ENTRY') {
        return res.status(409).json({ success: false, message: 'A record with the same unique value already exists.', errors: [] });
    }

    // Unknown error: log server-side, never leak internals (SQL, secrets, stack) to the client
    console.error(`[error] ${req.method} ${req.originalUrl}`, err);
    return res.status(500).json({ success: false, message: 'Something went wrong. Please try again.', errors: [] });
}

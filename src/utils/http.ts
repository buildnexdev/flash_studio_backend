// Developer by: Buildnexdev.in
// Devevloper : Nandhakumar@gmail.com
// Last Edited : 06-10-2026
import type { NextFunction, Request, RequestHandler, Response } from 'express';

export interface Paged<T> {
    items: T[];
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
}

export function ok<T>(res: Response, data: T, message = 'Success', status = 200): Response {
    return res.status(status).json({ success: true, message, data });
}

export function created<T>(res: Response, data: T, message = 'Created'): Response {
    return ok(res, data, message, 201);
}

/** Wrap an async route handler so rejected promises reach the error middleware. */
export function asyncHandler<Req extends Request = Request>(
    fn: (req: Req, res: Response, next: NextFunction) => Promise<unknown>,
): RequestHandler {
    return (req, res, next) => {
        fn(req as Req, res, next).catch(next);
    };
}

export function clientIp(req: Request): string {
    return (req.ip || req.socket.remoteAddress || '').slice(0, 64);
}

export function userAgent(req: Request): string {
    return String(req.headers['user-agent'] || '').slice(0, 255);
}

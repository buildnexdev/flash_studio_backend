// Developer by: Buildnexdev.in
// Devevloper : Nandhakumar@gmail.com
// Last Edited : 06-10-2026
import type { NextFunction, Request, Response } from 'express';
import type { ZodType } from 'zod';

type Part = 'body' | 'query' | 'params';

/** Parse and replace req[part] with the validated, typed value. Errors go to the error handler (422). */
export function validate(schema: ZodType, part: Part = 'body') {
    return (req: Request, _res: Response, next: NextFunction) => {
        const result = schema.safeParse(req[part] ?? {});
        if (!result.success) return next(result.error);
        if (part === 'query') {
            Object.defineProperty(req, 'query', { value: result.data, writable: true, configurable: true });
        } else {
            (req as unknown as Record<Part, unknown>)[part] = result.data;
        }
        next();
    };
}

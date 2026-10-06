// Developer by: Buildnexdev.in
// Devevloper : Nandhakumar@gmail.com
// Last Edited : 06-10-2026
export interface FieldError {
    field: string;
    message: string;
}

export class AppError extends Error {
    constructor(
        public readonly status: number,
        message: string,
        public readonly errors: FieldError[] = [],
        public readonly code?: string,
    ) {
        super(message);
        this.name = 'AppError';
    }
}

export const badRequest = (message: string, errors: FieldError[] = []) => new AppError(400, message, errors, 'BAD_REQUEST');
export const unauthorized = (message = 'Authentication required') => new AppError(401, message, [], 'UNAUTHORIZED');
export const forbidden = (message = 'You do not have permission to perform this action') => new AppError(403, message, [], 'FORBIDDEN');
export const notFound = (what = 'Resource') => new AppError(404, `${what} not found`, [], 'NOT_FOUND');
export const conflict = (message: string) => new AppError(409, message, [], 'CONFLICT');
export const unprocessable = (message: string, errors: FieldError[] = []) => new AppError(422, message, errors, 'UNPROCESSABLE');
export const tooMany = (message = 'Too many requests, please try again later') => new AppError(429, message, [], 'RATE_LIMITED');

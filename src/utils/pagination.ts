// Developer by: Buildnexdev.in
// Devevloper : Nandhakumar@gmail.com
// Last Edited : 06-10-2026
import { z } from 'zod';
import type { Paged } from './http.js';

export const pageQuery = z.object({
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(20),
    search: z.string().trim().max(100).optional(),
    sort: z.string().trim().max(40).optional(),
    order: z.enum(['asc', 'desc']).default('desc'),
});

export type PageQuery = z.infer<typeof pageQuery>;

export const offsetOf = (q: { page: number; pageSize: number }) => (q.page - 1) * q.pageSize;

export function paged<T>(items: T[], total: number, q: { page: number; pageSize: number }): Paged<T> {
    return { items, total, page: q.page, pageSize: q.pageSize, totalPages: Math.max(1, Math.ceil(total / q.pageSize)) };
}

/** Pick a whitelisted ORDER BY column; never interpolate user input directly. */
export function orderBy(sort: string | undefined, allowed: Record<string, string>, fallback: string, order: 'asc' | 'desc' = 'desc'): string {
    const column = (sort && allowed[sort]) || fallback;
    return `${column} ${order === 'asc' ? 'ASC' : 'DESC'}`;
}

export const likeTerm = (term: string) => `%${term.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;

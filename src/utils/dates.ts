// Developer by: Buildnexdev.in
// Devevloper : Nandhakumar@gmail.com
// Last Edited : 06-10-2026
import { z } from 'zod';
import { badRequest } from './errors.js';

/** Studio-local timezone used for "today", "this week" etc. */
export const STUDIO_TZ_OFFSET_MINUTES = 330; // Asia/Kolkata (UTC+05:30)

export const rangeQuery = z.object({
    range: z.enum(['today', 'yesterday', 'this_week', 'this_month', 'last_30_days', 'custom']).default('last_30_days'),
    from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

export type RangeQuery = z.infer<typeof rangeQuery>;

export interface ResolvedRange {
    from: string; // YYYY-MM-DD (studio local)
    to: string;
    /** UTC datetime bounds for DATETIME columns: [start, end) */
    startUtc: string;
    endUtc: string;
    label: string;
}

const fmt = (d: Date) => d.toISOString().slice(0, 10);

function studioToday(now = new Date()): Date {
    const local = new Date(now.getTime() + STUDIO_TZ_OFFSET_MINUTES * 60_000);
    return new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate()));
}

const addDays = (d: Date, n: number) => new Date(d.getTime() + n * 86_400_000);

/** Convert a studio-local date (YYYY-MM-DD) at 00:00 to a UTC 'YYYY-MM-DD HH:MM:SS' string. */
export function localDateStartUtc(ymd: string): string {
    const d = new Date(`${ymd}T00:00:00Z`);
    return new Date(d.getTime() - STUDIO_TZ_OFFSET_MINUTES * 60_000).toISOString().slice(0, 19).replace('T', ' ');
}

export function resolveRange(q: RangeQuery, now = new Date()): ResolvedRange {
    const today = studioToday(now);
    let from: Date;
    let to: Date;
    let label: string;
    switch (q.range) {
        case 'today':
            from = to = today;
            label = 'Today';
            break;
        case 'yesterday':
            from = to = addDays(today, -1);
            label = 'Yesterday';
            break;
        case 'this_week': {
            const dow = (today.getUTCDay() + 6) % 7; // Monday = 0
            from = addDays(today, -dow);
            to = today;
            label = 'This week';
            break;
        }
        case 'this_month':
            from = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1));
            to = today;
            label = 'This month';
            break;
        case 'custom': {
            if (!q.from || !q.to) throw badRequest('Choose both a From and a To date for a custom range.');
            from = new Date(`${q.from}T00:00:00Z`);
            to = new Date(`${q.to}T00:00:00Z`);
            if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) throw badRequest('Invalid date.');
            if (from > to) throw badRequest('The From date must be on or before the To date.');
            if ((to.getTime() - from.getTime()) / 86_400_000 > 366) throw badRequest('Choose a range of one year or less.');
            label = `${q.from} to ${q.to}`;
            break;
        }
        default:
            from = addDays(today, -29);
            to = today;
            label = 'Last 30 days';
    }
    const fromYmd = fmt(from);
    const toYmd = fmt(to);
    return { from: fromYmd, to: toYmd, startUtc: localDateStartUtc(fromYmd), endUtc: localDateStartUtc(fmt(addDays(to, 1))), label };
}

/** List every studio-local date in the range (inclusive), for zero-filling chart series. */
export function eachDay(from: string, to: string): string[] {
    const days: string[] = [];
    for (let d = new Date(`${from}T00:00:00Z`); fmt(d) <= to; d = addDays(d, 1)) days.push(fmt(d));
    return days;
}

/** SQL expression converting a UTC DATETIME column to the studio-local date. */
export const localDateSql = (column: string) => `DATE(DATE_ADD(${column}, INTERVAL ${STUDIO_TZ_OFFSET_MINUTES} MINUTE))`;

export const nowUtc = () => new Date().toISOString().slice(0, 19).replace('T', ' ');

export const toSqlDateTime = (d: Date) => d.toISOString().slice(0, 19).replace('T', ' ');

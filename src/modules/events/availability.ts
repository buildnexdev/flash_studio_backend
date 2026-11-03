import type { Db } from '../../db/pool.js';
import { query } from '../../db/pool.js';
import { AppError } from '../../utils/errors.js';

export interface SlotInput {
    eventDate: string;
    startTime?: string | null;
    endTime?: string | null;
    excludeEventId?: number | null;
    excludeBookingId?: number | null;
    companyId?: number | null;
}

const clock = (value: string) => (value.length === 5 ? `${value}:00` : value);

/** True when two same-day ranges share any minute. */
export function rangesOverlap(startA: string, endA: string, startB: string, endB: string): boolean {
    return clock(startA) < clock(endB) && clock(endA) > clock(startB);
}

interface Clash {
    kind: 'event' | 'booking';
    label: string;
    start_time: string;
    end_time: string;
}

export async function findSlotClashes(input: SlotInput, db?: Db): Promise<Clash[]> {
    if (!input.startTime || !input.endTime) return [];
    const start = clock(input.startTime);
    const end = clock(input.endTime);
    const events = await query<{ event_code: string; title: string; start_time: string; end_time: string }>(
        `SELECT e.event_code, e.title, e.start_time, e.end_time
           FROM tblEvent e
          WHERE e.deleted_at IS NULL AND e.status <> 'CANCELLED' AND e.event_date = ?
            AND (? IS NULL OR e.company_id = ?)
            AND e.start_time IS NOT NULL AND e.end_time IS NOT NULL
            AND e.start_time < ? AND e.end_time > ?
            AND (? IS NULL OR e.id <> ?)`,
        [input.eventDate, input.companyId ?? null, input.companyId ?? null, end, start, input.excludeEventId ?? null, input.excludeEventId ?? null],
        db,
    );
    const bookings = await query<{ booking_no: string; start_time: string; end_time: string }>(
        `SELECT b.booking_no, b.start_time, b.end_time
           FROM tblBooking b
          WHERE b.deleted_at IS NULL AND b.status IN ('ADVANCE_PENDING','CONFIRMED','IN_PROGRESS')
            AND (? IS NULL OR b.company_id = ?)
            AND b.event_date = ? AND b.start_time IS NOT NULL AND b.end_time IS NOT NULL
            AND b.start_time < ? AND b.end_time > ?
            AND (? IS NULL OR b.id <> ?)
            AND NOT EXISTS (SELECT 1 FROM tblEvent ev WHERE ev.booking_id = b.id AND ev.deleted_at IS NULL)`,
        [input.companyId ?? null, input.companyId ?? null, input.eventDate, end, start, input.excludeBookingId ?? null, input.excludeBookingId ?? null],
        db,
    );
    return [
        ...events.map((row) => ({ kind: 'event' as const, label: `${row.event_code} ${row.title}`, start_time: String(row.start_time), end_time: String(row.end_time) })),
        ...bookings.map((row) => ({ kind: 'booking' as const, label: row.booking_no, start_time: String(row.start_time), end_time: String(row.end_time) })),
    ];
}

function formatTime12(t: string): string {
    const parts = String(t).slice(0, 5).split(':');
    const h = parseInt(parts[0], 10);
    const m = parts[1] || '00';
    if (isNaN(h)) return t;
    const period = h >= 12 ? 'PM' : 'AM';
    const hour12 = h % 12 === 0 ? 12 : h % 12;
    return `${hour12}:${m} ${period}`;
}

export async function assertSlotFree(input: SlotInput, db?: Db): Promise<void> {
    const clashes = await findSlotClashes(input, db);
    if (!clashes.length) return;
    const first = clashes[0];
    throw new AppError(409, `That time overlaps ${first.label} (${formatTime12(first.start_time)} – ${formatTime12(first.end_time)}). Choose another slot.`, [
        { field: 'eventDate', message: 'This date and time is already booked' },
    ], 'CONFLICT');
}


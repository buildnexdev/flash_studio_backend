// Developer by: Buildnexdev.in
// Devevloper : Nandhakumar@gmail.com
// Last Edited : 06-10-2026
import { z } from 'zod';

export const idParam = z.object({ id: z.coerce.number().int().positive() });

export const password = z
    .string()
    .min(8, 'Use at least 8 characters')
    .max(72, 'Use at most 72 characters')
    .regex(/[A-Za-z]/, 'Include at least one letter')
    .regex(/\d/, 'Include at least one number');

export const email = z.string().trim().toLowerCase().email('Enter a valid email').max(190);
export const phone = z
    .string()
    .trim()
    .regex(/^\+?[0-9\s-]{8,16}$/, 'Enter a valid phone number')
    .transform((v) => v.replace(/[\s-]/g, ''));

export const optionalText = (max: number) =>
    z
        .string()
        .trim()
        .max(max)
        .optional()
        .nullable()
        .transform((v) => (v ? v : null));

export const ymd = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD');
export const hhmm = z
    .string()
    .regex(/^\d{2}:\d{2}(:\d{2})?$/, 'Use HH:MM')
    .optional()
    .nullable()
    .transform((v) => (v ? v : null));

/** Money in paise. */
export const money = z.coerce.number().int('Amount must be in paise (whole number)').min(0).max(10_000_000_000);

export const boolish = z
    .union([z.boolean(), z.literal('true'), z.literal('false'), z.literal('1'), z.literal('0')])
    .transform((v) => v === true || v === 'true' || v === '1');

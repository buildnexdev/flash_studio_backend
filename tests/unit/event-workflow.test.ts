import { describe, expect, it } from 'vitest';
import { rangesOverlap } from '../../src/modules/events/availability.js';
import { simplePdf } from '../../src/lib/simple-pdf.js';
import { assertFaceSearchAllowed } from '../../src/modules/galleries/event-access.js';

describe('event workflow helpers', () => {
    it('detects overlapping times and ignores ranges that only touch', () => {
        expect(rangesOverlap('09:00', '12:00', '11:00', '13:00')).toBe(true);
        expect(rangesOverlap('09:00:00', '12:00:00', '12:00', '15:00')).toBe(false);
        expect(rangesOverlap('14:00', '16:00', '09:00', '13:00')).toBe(false);
    });

    it('builds a PDF document', () => {
        const pdf = simplePdf(['Nammaqr quotation', 'Total Rs 1000.00']);
        expect(pdf.subarray(0, 5).toString()).toBe('%PDF-');
        expect(pdf.includes(Buffer.from('Nammaqr quotation'))).toBe(true);
    });

    it('requires consent before face search, even for the event owner', async () => {
        await expect(assertFaceSearchAllowed(1, undefined, false, true)).rejects.toMatchObject({ status: 403 });
        await expect(assertFaceSearchAllowed(1, undefined, true, true)).resolves.toBeUndefined();
    });
});

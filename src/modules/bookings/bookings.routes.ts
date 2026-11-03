// Developer by: Buildnexdev.in
// Devevloper : Nandhakumar@gmail.com
// Last Edited : 06-10-2026
import { Router } from 'express';
import { z } from 'zod';
import { authenticate, hasPermission, requirePermission } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import { asyncHandler, created, ok } from '../../utils/http.js';
import { forbidden } from '../../utils/errors.js';
import { pageQuery } from '../../utils/pagination.js';
import { hhmm, idParam, money, optionalText, ymd } from '../../utils/schemas.js';
import { auditCtx } from '../audit/audit.service.js';
import * as bookings from './bookings.service.js';

export const bookingDetails = z
    .object({
        serviceId: z.coerce.number().int().positive().optional().nullable(),
        packageId: z.coerce.number().int().positive().optional().nullable(),
        /** Custom quotation total in paise when no package is selected. */
        quotedAmount: money.optional().nullable(),
        eventType: z.string().trim().min(2).max(60),
        eventDate: ymd,
        startTime: hhmm,
        endTime: hhmm,
        venue: optionalText(255),
        guests: z.coerce.number().int().min(0).max(100000).optional().nullable(),
        message: optionalText(3000),
    })
    .superRefine((v, ctx) => {
        if (!v.packageId && v.quotedAmount != null && v.quotedAmount < 0) {
            ctx.addIssue({ code: 'custom', path: ['quotedAmount'], message: 'Enter a valid amount' });
        }
    });

const adminBooking = bookingDetails.extend({ customerId: z.coerce.number().int().positive(), internalNotes: optionalText(3000) });

const quotationBody = z.object({
    items: z.array(z.object({ description: z.string().trim().min(2).max(255), quantity: z.coerce.number().int().min(1).max(1000), unitPrice: money })).min(1, 'Add at least one line'),
    discount: money.default(0),
    taxPercent: z.coerce.number().min(0).max(40).default(18),
    advanceAmount: money.optional().nullable(),
    advancePercent: z.coerce.number().min(0).max(100).optional().nullable(),
    validUntil: ymd.optional().nullable(),
    notes: optionalText(3000),
    terms: optionalText(5000),
    couponCode: optionalText(40),
});

const qParam = z.object({ qid: z.coerce.number().int().positive() });

const router = Router();
router.use(authenticate);

router.get(
    '/',
    validate(pageQuery.extend({ status: z.enum(bookings.BOOKING_STATUSES).optional(), from: ymd.optional(), to: ymd.optional(), customerId: z.coerce.number().int().optional() }), 'query'),
    asyncHandler(async (req, res) => {
        const q = req.query as unknown as bookings.BookingFilter;
        if (req.user?.companyId) q.companyId = req.user.companyId;
        if (!hasPermission(req.user, 'bookings.view', 'bookings.manage')) {
            if (!req.user!.customerId) throw forbidden();
            q.customerId = req.user!.customerId;
        }
        ok(res, await bookings.listBookings(q));
    }),
);

router.post(
    '/',
    asyncHandler(async (req, res) => {
        if (hasPermission(req.user, 'bookings.manage') && req.body?.customerId) {
            const body = adminBooking.parse(req.body);
            return created(res, await bookings.createAdminBooking(body, req.user!, auditCtx(req)), 'Booking created');
        }
        if (!req.user!.customerId) throw forbidden('A customer account is required.');
        const body = bookingDetails.parse(req.body);
        created(res, await bookings.createCustomerBooking(req.user!, body, auditCtx(req)), 'Booking request sent');
    }),
);

router.get(
    '/:id',
    validate(idParam, 'params'),
    asyncHandler(async (req, res) => {
        ok(res, await bookings.getBooking(Number(req.params.id), req.user));
    }),
);

router.put(
    '/:id',
    requirePermission('bookings.manage'),
    validate(idParam, 'params'),
    validate(bookingDetails.extend({ internalNotes: optionalText(3000) })),
    asyncHandler(async (req, res) => {
        ok(res, await bookings.updateBooking(Number(req.params.id), req.body, req.user!, auditCtx(req)), 'Booking updated');
    }),
);

router.post(
    '/:id/cancel',
    validate(idParam, 'params'),
    validate(z.object({ reason: optionalText(500) })),
    asyncHandler(async (req, res) => {
        ok(res, await bookings.cancelBooking(Number(req.params.id), req.body.reason, req.user!, auditCtx(req)), 'Booking cancelled');
    }),
);

router.post(
    '/:id/deliver',
    requirePermission('bookings.manage'),
    validate(idParam, 'params'),
    asyncHandler(async (req, res) => {
        ok(res, await bookings.markDelivered(Number(req.params.id), req.user!, auditCtx(req)), 'Marked as delivered');
    }),
);

router.get(
    '/quotations/:qid/pdf',
    validate(qParam, 'params'),
    asyncHandler(async (req, res) => {
        const pdf = await bookings.quotationPdf(Number(req.params.qid), req.user!);
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="${pdf.filename}"`);
        res.send(pdf.bytes);
    }),
);

router.post(
    '/quotations/:qid/revise',
    requirePermission('bookings.manage'),
    validate(qParam, 'params'),
    validate(z.object({ note: optionalText(500) })),
    asyncHandler(async (req, res) => {
        ok(res, await bookings.reviseQuotation(Number(req.params.qid), req.body.note ?? null, req.user!, auditCtx(req)), 'Revision saved as a new draft');
    }),
);

router.post(
    '/:id/quotations',
    requirePermission('bookings.manage'),
    validate(idParam, 'params'),
    validate(quotationBody),
    asyncHandler(async (req, res) => {
        created(res, await bookings.createQuotation(Number(req.params.id), req.body, req.user!, auditCtx(req)), 'Quotation created');
    }),
);

router.put(
    '/quotations/:qid',
    requirePermission('bookings.manage'),
    validate(qParam, 'params'),
    validate(quotationBody),
    asyncHandler(async (req, res) => {
        ok(res, await bookings.updateQuotation(Number(req.params.qid), req.body, req.user!, auditCtx(req)), 'Quotation updated');
    }),
);

router.post(
    '/quotations/:qid/send',
    requirePermission('bookings.manage'),
    validate(qParam, 'params'),
    asyncHandler(async (req, res) => {
        ok(res, await bookings.sendQuotation(Number(req.params.qid), req.user!, auditCtx(req)), 'Quotation sent to customer');
    }),
);

router.post(
    '/quotations/:qid/respond',
    validate(qParam, 'params'),
    validate(z.object({ decision: z.enum(['ACCEPT', 'REJECT']) })),
    asyncHandler(async (req, res) => {
        ok(res, await bookings.respondQuotation(Number(req.params.qid), req.body.decision, req.user!, auditCtx(req)), req.body.decision === 'ACCEPT' ? 'Quotation accepted' : 'Quotation declined');
    }),
);

router.delete(
    '/quotations/:qid',
    requirePermission('bookings.manage'),
    validate(qParam, 'params'),
    asyncHandler(async (req, res) => {
        ok(res, await bookings.deleteQuotation(Number(req.params.qid), req.user!, auditCtx(req)), 'Quotation deleted');
    }),
);

export default router;

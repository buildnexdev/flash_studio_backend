// Developer by: Buildnexdev.in
// Devevloper : Nandhakumar@gmail.com
// Last Edited : 06-10-2026
import { Router } from 'express';
import { z } from 'zod';
import { devPay } from '../../lib/payments.js';
import { authenticate, requireCustomer, requirePermission } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import { badRequest, forbidden } from '../../utils/errors.js';
import { asyncHandler, created, ok } from '../../utils/http.js';
import { pageQuery } from '../../utils/pagination.js';
import { idParam, money, optionalText, ymd } from '../../utils/schemas.js';
import { auditCtx } from '../audit/audit.service.js';
import * as payments from './payments.service.js';

const router = Router();

/** Gateway → server webhook. Authenticated by the HMAC signature over the raw body, not by a user token. */
router.post(
    '/webhook',
    asyncHandler(async (req, res) => {
        if (!req.rawBody) throw badRequest('Missing body');
        const signature = String(req.headers['x-razorpay-signature'] ?? req.headers['x-devpay-signature'] ?? '');
        const result = await payments.handleWebhook(req.rawBody, signature);
        ok(res, result, 'Webhook processed');
    }),
);

router.use(authenticate);

router.get(
    '/',
    validate(
        pageQuery.extend({
            status: z.enum(['PENDING', 'PROCESSING', 'SUCCESS', 'FAILED', 'REFUNDED']).optional(),
            purpose: z.enum(payments.PAYMENT_PURPOSES).optional(),
            customerId: z.coerce.number().int().positive().optional(),
            from: ymd.optional(),
            to: ymd.optional(),
        }),
        'query',
    ),
    asyncHandler(async (req, res) => {
        const q = req.query as unknown as payments.PaymentFilter;
        if (!req.user!.permissions.has('payments.view')) {
            if (!req.user!.customerId) throw forbidden();
            q.customerId = req.user!.customerId;
        }
        ok(res, await payments.listPayments(q));
    }),
);

router.post(
    '/create',
    requireCustomer,
    validate(
        z
            .object({
                bookingId: z.coerce.number().int().positive().optional(),
                orderId: z.coerce.number().int().positive().optional(),
                purpose: z.enum(['ADVANCE', 'BALANCE']).optional(),
            })
            .refine((v) => !!v.bookingId !== !!v.orderId, { message: 'Provide either a booking or an order' }),
    ),
    asyncHandler(async (req, res) => {
        created(res, await payments.createPayment(req.user!, req.body, auditCtx(req)), 'Payment initiated');
    }),
);

router.post(
    '/verify',
    requireCustomer,
    validate(
        z.object({
            paymentId: z.coerce.number().int().positive(),
            providerOrderId: z.string().trim().min(5).max(80),
            providerPaymentId: z.string().trim().min(5).max(80),
            signature: z.string().trim().min(16).max(256),
        }),
    ),
    asyncHandler(async (req, res) => {
        ok(res, await payments.verifyPayment(req.user!, req.body, auditCtx(req)), 'Payment successful');
    }),
);

if (devPay) {
    /** Test checkout for local development and automated tests (PAYMENT_PROVIDER=devpay; refused in production). */
    router.post(
        '/devpay/checkout',
        requireCustomer,
        validate(z.object({ paymentId: z.coerce.number().int().positive(), outcome: z.enum(['success', 'failure']).default('success') })),
        asyncHandler(async (req, res) => {
            ok(res, await payments.devCheckout(req.user!, req.body.paymentId, req.body.outcome), 'Test checkout completed');
        }),
    );
}

router.post(
    '/offline',
    requirePermission('payments.manage'),
    validate(
        z
            .object({
                bookingId: z.coerce.number().int().positive().optional(),
                orderId: z.coerce.number().int().positive().optional(),
                amount: money.refine((v) => v > 0, 'Amount must be greater than zero'),
                method: z.enum(['cash', 'upi', 'bank_transfer', 'card', 'cheque']),
                reference: optionalText(80),
            })
            .refine((v) => !!v.bookingId !== !!v.orderId, { message: 'Provide either a booking or an order' }),
    ),
    asyncHandler(async (req, res) => {
        created(res, await payments.recordOfflinePayment(req.body, req.user!, auditCtx(req)), 'Payment recorded');
    }),
);

router.get(
    '/:id',
    validate(idParam, 'params'),
    asyncHandler(async (req, res) => {
        ok(res, await payments.getPayment(Number(req.params.id), req.user!));
    }),
);

router.post(
    '/:id/refund',
    requirePermission('payments.manage'),
    validate(idParam, 'params'),
    validate(z.object({ amount: money.nullable().optional(), reason: z.string().trim().min(3).max(200) })),
    asyncHandler(async (req, res) => {
        ok(res, await payments.refundPayment(Number(req.params.id), req.body.amount ?? null, req.body.reason, auditCtx(req)), 'Refund processed');
    }),
);

export default router;

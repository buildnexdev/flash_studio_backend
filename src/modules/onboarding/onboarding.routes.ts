// Developer by: Buildnexdev.in
import { Router } from 'express';
import { z } from 'zod';
import { devPay } from '../../lib/payments.js';
import { validate } from '../../middleware/validate.js';
import { notFound } from '../../utils/errors.js';
import { asyncHandler, created, ok } from '../../utils/http.js';
import { email, password, phone } from '../../utils/schemas.js';
import { ONBOARDING_MODULES } from './onboarding.catalog.js';
import * as onboarding from './onboarding.service.js';

const moduleKeys = Object.keys(ONBOARDING_MODULES) as [string, ...string[]];
const moduleIds = z.array(z.enum(moduleKeys)).min(1);

const payloadSchema = z.object({
    phone,
    email,
    password,
    companyEmail: email,
    companyName: z.string().trim().min(2).max(120),
    ownerName: z.string().trim().min(2).max(120),
    about: z.string().trim().max(2000).default(''),
    modules: moduleIds,
    logoBase64: z.string().max(500_000).optional().nullable(),
});

const router = Router();

router.get(
    '/modules',
    asyncHandler(async (_req, res) => {
        ok(res, onboarding.listModuleCatalog());
    }),
);

router.post(
    '/quote',
    validate(z.object({ modules: moduleIds })),
    asyncHandler(async (req, res) => {
        ok(res, await onboarding.quote(req.body.modules));
    }),
);

router.post(
    '/check-phone',
    validate(z.object({ phone })),
    asyncHandler(async (req, res) => {
        ok(res, await onboarding.checkPhoneAvailable(req.body.phone), 'Phone number is available');
    }),
);

router.post(
    '/start',
    validate(payloadSchema),
    asyncHandler(async (req, res) => {
        created(res, await onboarding.startOnboarding(req.body), 'Checkout ready');
    }),
);

router.post(
    '/complete',
    validate(
        z.object({
            token: z.string().min(16).max(32),
            providerOrderId: z.string().min(3).max(64),
            providerPaymentId: z.string().min(3).max(64),
            signature: z.string().min(8).max(256),
        }),
    ),
    asyncHandler(async (req, res) => {
        ok(
            res,
            await onboarding.completeOnboarding(req.body.token, req.body.providerOrderId, req.body.providerPaymentId, req.body.signature),
            'Company created',
        );
    }),
);

router.post(
    '/devpay-complete',
    validate(
        z.object({
            token: z.string().min(16).max(32),
            providerOrderId: z.string().min(3).max(64),
            outcome: z.enum(['success', 'failure']),
        }),
    ),
    asyncHandler(async (req, res) => {
        if (!devPay) throw notFound('Route');
        if (req.body.outcome === 'failure') {
            ok(res, { status: 'failed' }, 'Payment failed');
            return;
        }
        const paid = devPay.checkout(req.body.providerOrderId, 'success');
        ok(
            res,
            await onboarding.completeOnboardingDevPay(req.body.token, paid.razorpay_order_id, paid.razorpay_payment_id, paid.razorpay_signature),
            'Company created',
        );
    }),
);

export default router;

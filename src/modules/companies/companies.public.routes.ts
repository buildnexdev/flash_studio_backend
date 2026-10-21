// Developer by: Buildnexdev.in
// Last Edited : 21-10-2026
import { Router } from 'express';
import { z } from 'zod';
import { publicFormLimiter } from '../../middleware/rate-limit.js';
import { validate } from '../../middleware/validate.js';
import { asyncHandler, ok } from '../../utils/http.js';
import { email, password, phone } from '../../utils/schemas.js';
import { COMPANY_MODULES, completeCompanySignup, devpayCompanyCheckout, findCompanyDuplicates, startCompanyCheckout } from './companies.service.js';

const router = Router();
const moduleCode = z.enum(['asset', 'staff', 'event', 'report', 'ecommerce']);

const signupBody = z.object({
    name: z.string().trim().min(2).max(120),
    phone,
    address: z.string().trim().min(5).max(300),
    logo: z.string().trim().min(20).max(1_800_000),
    ownerName: z.string().trim().min(2).max(120),
    ownerEmail: email,
    password,
    gstNumber: z.string().trim().toUpperCase().regex(/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/, 'Enter a valid GST number'),
    aboutUs: z.string().trim().min(10).max(2000),
    aadhaarNumber: z.string().trim().regex(/^\d{12}$/, 'Aadhaar number must be 12 digits'),
    panNumber: z.string().trim().toUpperCase().regex(/^[A-Z]{5}[0-9]{4}[A-Z]$/, 'Enter a valid PAN number'),
    modules: z.array(moduleCode).min(1),
});

router.get(
    '/modules',
    asyncHandler(async (_req, res) => {
        ok(res, COMPANY_MODULES);
    }),
);

router.post(
    '/check',
    publicFormLimiter,
    validate(
        z.object({
            name: z.string().trim().min(2).max(120).optional(),
            phone: phone.optional(),
            ownerEmail: email.optional(),
            gstNumber: z.string().trim().max(20).optional(),
            aadhaarNumber: z.string().trim().max(12).optional(),
            panNumber: z.string().trim().max(10).optional(),
        }),
    ),
    asyncHandler(async (req, res) => {
        ok(res, await findCompanyDuplicates(req.body));
    }),
);

router.post(
    '/checkout',
    publicFormLimiter,
    validate(signupBody),
    asyncHandler(async (req, res) => {
        ok(res, await startCompanyCheckout(req.body), 'Registration is ready for payment.');
    }),
);

router.post(
    '/devpay',
    publicFormLimiter,
    validate(z.object({ signupId: z.number().int().positive(), outcome: z.enum(['success', 'failure']) })),
    asyncHandler(async (req, res) => {
        ok(res, await devpayCompanyCheckout(req.body.signupId, req.body.outcome));
    }),
);

router.post(
    '/complete',
    publicFormLimiter,
    validate(
        z.object({
            signupId: z.number().int().positive(),
            providerOrderId: z.string().min(3).max(80).optional(),
            providerPaymentId: z.string().min(3).max(80).optional(),
            signature: z.string().min(8).max(256).optional(),
        }),
    ),
    asyncHandler(async (req, res) => {
        ok(res, await completeCompanySignup(req.body), 'Your company is registered.');
    }),
);

export default router;

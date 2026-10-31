// Developer by: Buildnexdev.in
// Devevloper : Nandhakumar@gmail.com
// Last Edited : 27-10-2026
import { Router } from 'express';
import { z } from 'zod';
import { authenticate, requirePermission } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import { asyncHandler, ok } from '../../utils/http.js';
import { optionalText, ymd } from '../../utils/schemas.js';
import { auditCtx } from '../audit/audit.service.js';
import * as closing from './closing.service.js';

const router = Router();
router.use(authenticate, requirePermission('payments.view', 'reports.view'));

router.get(
    '/day',
    validate(z.object({ date: ymd.optional() }), 'query'),
    asyncHandler(async (req, res) => {
        const date = (req.query.date as string) || new Date().toISOString().slice(0, 10);
        ok(res, await closing.previewEndOfDay(date, req.user?.companyId));
    }),
);

router.get(
    '/day/history',
    asyncHandler(async (req, res) => {
        ok(res, await closing.listEndOfDay(31, req.user?.companyId));
    }),
);

router.post(
    '/day',
    requirePermission('payments.manage'),
    validate(
        z.object({
            closeDate: ymd,
            openingFloat: z.coerce.number().int().min(0).default(0),
            countedCash: z.coerce.number().int().min(0),
            notes: optionalText(2000),
        }),
    ),
    asyncHandler(async (req, res) => {
        ok(res, await closing.submitEndOfDay(req.body, auditCtx(req)), 'End of day submitted');
    }),
);

router.get(
    '/month',
    validate(z.object({ periodMonth: z.string().regex(/^\d{4}-\d{2}$/).optional() }), 'query'),
    asyncHandler(async (req, res) => {
        const now = new Date();
        const periodMonth = (req.query.periodMonth as string) || `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
        ok(res, await closing.previewEndOfMonth(periodMonth, req.user?.companyId));
    }),
);

router.get(
    '/month/history',
    asyncHandler(async (req, res) => {
        ok(res, await closing.listEndOfMonth(24, req.user?.companyId));
    }),
);

router.post(
    '/month',
    requirePermission('payments.manage'),
    validate(z.object({ periodMonth: z.string().regex(/^\d{4}-\d{2}$/), notes: optionalText(2000) })),
    asyncHandler(async (req, res) => {
        ok(res, await closing.submitEndOfMonth(req.body, auditCtx(req)), 'End of month submitted');
    }),
);

export default router;

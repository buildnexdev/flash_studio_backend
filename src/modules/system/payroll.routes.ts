// Developer by: Buildnexdev.in
// Devevloper : Nandhakumar@gmail.com
// Last Edited : 27-10-2026
import { Router } from 'express';
import { z } from 'zod';
import { authenticate, requirePermission } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import { asyncHandler, created, ok } from '../../utils/http.js';
import { idParam, optionalText } from '../../utils/schemas.js';
import { auditCtx } from '../audit/audit.service.js';
import * as payroll from './payroll.service.js';

const router = Router();
router.use(authenticate, requirePermission('payments.view', 'staff.manage'));

router.get(
    '/staff',
    asyncHandler(async (_req, res) => {
        ok(res, await payroll.listStaffForPayroll());
    }),
);

router.get(
    '/shares',
    validate(
        z.object({
            periodMonth: z.string().regex(/^\d{4}-\d{2}$/).optional(),
            eventId: z.coerce.number().int().positive().optional(),
        }),
        'query',
    ),
    asyncHandler(async (req, res) => {
        ok(res, await payroll.listEventShares(req.query.periodMonth as string | undefined, req.query.eventId ? Number(req.query.eventId) : undefined));
    }),
);

router.get(
    '/earnings',
    validate(z.object({ periodMonth: z.string().regex(/^\d{4}-\d{2}$/) }), 'query'),
    asyncHandler(async (req, res) => {
        ok(res, await payroll.listEarnings(req.query.periodMonth as string));
    }),
);

router.get(
    '/',
    validate(
        z.object({
            periodMonth: z.string().regex(/^\d{4}-\d{2}$/).optional(),
            status: z.enum(['DRAFT', 'PAID', 'CANCELLED']).optional(),
        }),
        'query',
    ),
    asyncHandler(async (req, res) => {
        ok(res, await payroll.listPayroll(req.query as { periodMonth?: string; status?: string }));
    }),
);

router.post(
    '/generate',
    requirePermission('payments.manage', 'staff.manage'),
    validate(z.object({ periodMonth: z.string().regex(/^\d{4}-\d{2}$/) })),
    asyncHandler(async (req, res) => {
        ok(res, await payroll.generateFromEvents(req.body.periodMonth, auditCtx(req)), 'Payroll generated from event shares');
    }),
);

router.put(
    '/shares/:id',
    requirePermission('payments.manage', 'staff.manage', 'staff.assign'),
    validate(idParam, 'params'),
    validate(
        z.object({
            payBasis: z.enum(['DAY_RATE', 'SHARE', 'COMMISSION', 'FLAT', 'NONE']),
            sharePct: z.coerce.number().min(0).max(100).nullable().optional(),
            commissionPct: z.coerce.number().min(0).max(100).nullable().optional(),
            dayRateOverride: z.coerce.number().int().min(0).nullable().optional(),
            flatAmount: z.coerce.number().int().min(0).nullable().optional(),
        }),
    ),
    asyncHandler(async (req, res) => {
        ok(res, await payroll.updateEventShare(Number(req.params.id), req.body, auditCtx(req)), 'Event share updated');
    }),
);

router.post(
    '/',
    requirePermission('payments.manage', 'staff.manage'),
    validate(
        z.object({
            staffUserId: z.coerce.number().int().positive(),
            periodMonth: z.string().regex(/^\d{4}-\d{2}$/),
            amount: z.coerce.number().int().min(1),
            payType: z.enum(['SALARY', 'DAY_RATE', 'COMMISSION', 'SHARE', 'MIXED', 'MANUAL']).optional(),
            commissionPct: z.coerce.number().min(0).max(100).nullable().optional(),
            notes: optionalText(2000),
        }),
    ),
    asyncHandler(async (req, res) => {
        created(res, await payroll.createPayroll(req.body, auditCtx(req)), 'Payroll entry created');
    }),
);

router.post(
    '/:id/pay',
    requirePermission('payments.manage', 'staff.manage'),
    validate(idParam, 'params'),
    asyncHandler(async (req, res) => {
        ok(res, await payroll.markPayrollPaid(Number(req.params.id), auditCtx(req)), 'Marked as paid');
    }),
);

router.post(
    '/:id/cancel',
    requirePermission('payments.manage', 'staff.manage'),
    validate(idParam, 'params'),
    asyncHandler(async (req, res) => {
        ok(res, await payroll.cancelPayroll(Number(req.params.id), auditCtx(req)), 'Payroll cancelled');
    }),
);

export default router;

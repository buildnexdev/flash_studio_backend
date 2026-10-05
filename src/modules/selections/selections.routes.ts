import { Router } from 'express';
import { z } from 'zod';
import { authenticate, requirePermission } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import { asyncHandler, ok } from '../../utils/http.js';
import { idParam } from '../../utils/schemas.js';
import { auditCtx } from '../audit/audit.service.js';
import * as selections from './selections.service.js';

const router = Router();
router.use(authenticate);

router.get(
    '/event/:id',
    validate(idParam, 'params'),
    asyncHandler(async (req, res) => {
        ok(res, await selections.eventSelection(Number(req.params.id), req.user!));
    }),
);

const customerBody = z.object({ customerId: z.coerce.number().int().positive() });

router.post(
    '/event/:id/confirm',
    requirePermission('galleries.manage', 'photos.manage'),
    validate(idParam, 'params'),
    validate(customerBody),
    asyncHandler(async (req, res) => {
        ok(res, await selections.confirmSelection(Number(req.params.id), req.body.customerId, auditCtx(req)), 'Selection confirmed');
    }),
);

router.post(
    '/event/:id/reopen',
    requirePermission('galleries.manage', 'photos.manage'),
    validate(idParam, 'params'),
    validate(customerBody),
    asyncHandler(async (req, res) => {
        ok(res, await selections.reopenSelection(Number(req.params.id), req.body.customerId, auditCtx(req)), 'Selection reopened for the customer');
    }),
);

export default router;

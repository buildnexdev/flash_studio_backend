import { Router } from 'express';
import { z } from 'zod';
import { authenticate, requirePermission } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import { asyncHandler, created, ok } from '../../utils/http.js';
import { idParam, optionalText, ymd } from '../../utils/schemas.js';
import { auditCtx } from '../audit/audit.service.js';
import * as assets from './asset.service.js';

const categories = ['CAMERA', 'LENS', 'FLASH', 'TRIPOD', 'LIGHTS', 'MEMORY_CARD', 'LAPTOP', 'PRINTER', 'STUDIO_EQUIPMENT', 'OTHER'] as const;
const conditions = ['EXCELLENT', 'GOOD', 'FAIR', 'POOR', 'DAMAGED'] as const;
const statuses = ['AVAILABLE', 'ASSIGNED', 'IN_USE', 'MAINTENANCE', 'DAMAGED', 'LOST', 'RETIRED'] as const;

const assetBody = z.object({
    assetCode: z.string().trim().min(2).max(40).optional().nullable(),
    name: z.string().trim().min(2).max(140),
    category: z.enum(categories),
    purchaseDate: ymd.optional().nullable(),
    purchasePrice: z.coerce.number().int().min(0),
    currentValue: z.coerce.number().int().min(0),
    assetCondition: z.enum(conditions),
    location: optionalText(120),
    status: z.enum(statuses),
    maintenanceDate: ymd.optional().nullable(),
    notes: optionalText(2000),
});

const router = Router();
router.use(authenticate, requirePermission('events.view', 'events.manage'));

router.get(
    '/',
    validate(z.object({ category: z.enum(categories).optional(), status: z.enum(statuses).optional() }), 'query'),
    asyncHandler(async (req, res) => {
        ok(res, await assets.listAssets({ ...(req.query as { category?: string; status?: string }), companyId: req.user?.companyId ?? undefined }));
    }),
);

router.get(
    '/by-event/:eventId',
    validate(z.object({ eventId: z.coerce.number().int().positive() }), 'params'),
    asyncHandler(async (req, res) => {
        ok(res, await assets.listEventAssets(Number(req.params.eventId)));
    }),
);

router.post(
    '/:id/assign',
    requirePermission('events.manage'),
    validate(idParam, 'params'),
    validate(
        z.object({
            eventId: z.coerce.number().int().positive().nullable().optional(),
            staffId: z.coerce.number().int().positive().nullable().optional(),
            notes: optionalText(500),
        }),
    ),
    asyncHandler(async (req, res) => {
        ok(res, await assets.assignAsset(Number(req.params.id), req.body.staffId ?? null, req.body.eventId ?? null, req.body.notes ?? null, auditCtx(req)), 'Asset allocated');
    }),
);

router.post(
    '/:id/return',
    requirePermission('events.manage'),
    validate(idParam, 'params'),
    validate(z.object({ condition: z.enum(conditions), notes: optionalText(500) })),
    asyncHandler(async (req, res) => {
        ok(res, await assets.returnAsset(Number(req.params.id), req.body.condition, req.body.notes ?? null, auditCtx(req)), 'Asset returned');
    }),
);

router.get(
    '/:id',
    validate(idParam, 'params'),
    asyncHandler(async (req, res) => {
        ok(res, await assets.getAsset(Number(req.params.id), req.user?.companyId));
    }),
);

router.post(
    '/',
    requirePermission('events.manage'),
    validate(assetBody),
    asyncHandler(async (req, res) => {
        created(res, await assets.saveAsset(null, req.body, auditCtx(req)));
    }),
);

router.put(
    '/:id',
    requirePermission('events.manage'),
    validate(idParam, 'params'),
    validate(assetBody),
    asyncHandler(async (req, res) => {
        ok(res, await assets.saveAsset(Number(req.params.id), req.body, auditCtx(req)));
    }),
);

export default router;

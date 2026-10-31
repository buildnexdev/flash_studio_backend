// Developer by: Buildnexdev.in
// Devevloper : Nandhakumar@gmail.com
// Last Edited : 06-10-2026
import { Router } from 'express';
import { z } from 'zod';
import { proofUpload } from '../../lib/upload.js';
import { authenticate, hasPermission, requireCustomer, requirePermission } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import { forbidden } from '../../utils/errors.js';
import { asyncHandler, created, ok } from '../../utils/http.js';
import { pageQuery } from '../../utils/pagination.js';
import { boolish, idParam, optionalText } from '../../utils/schemas.js';
import { auditCtx } from '../audit/audit.service.js';
import * as production from './production.service.js';

/** Partial-update text field: absent stays undefined (unchanged), empty string clears it. */
const patchText = (max: number) =>
    z
        .string()
        .trim()
        .max(max)
        .nullable()
        .optional()
        .transform((v) => (v === undefined ? undefined : v || null));

/* ---------------- Album proofs: /api/proofs ---------------- */

export const proofsRouter = Router();
proofsRouter.use(authenticate);

proofsRouter.get(
    '/',
    validate(pageQuery.extend({ eventId: z.coerce.number().int().positive().optional(), status: z.enum(['DRAFT', 'SENT', 'APPROVED', 'REVISION_REQUESTED']).optional() }), 'query'),
    asyncHandler(async (req, res) => {
        const q = req.query as unknown as Parameters<typeof production.listProofs>[0];
        if (!hasPermission(req.user, 'proofs.manage', 'galleries.manage', 'events.view')) {
            if (!req.user!.customerId) throw forbidden();
            q.customerId = req.user!.customerId;
        } else if (req.user?.companyId && !req.user.roles.includes('SUPER_ADMIN')) {
            q.companyId = req.user.companyId;
        }
        ok(res, await production.listProofs(q));
    }),
);

proofsRouter.post(
    '/',
    requirePermission('proofs.manage'),
    proofUpload.array('files', 80),
    validate(z.object({ eventId: z.coerce.number().int().positive(), title: z.string().trim().min(2).max(160) })),
    asyncHandler(async (req, res) => {
        const files = (req.files as Express.Multer.File[] | undefined) ?? [];
        created(res, await production.uploadProof(req.body.eventId, req.body.title, files, req.user!, auditCtx(req)), 'Album proof uploaded');
    }),
);

proofsRouter.get(
    '/:id',
    validate(idParam, 'params'),
    asyncHandler(async (req, res) => {
        ok(res, await production.getProof(Number(req.params.id), req.user!));
    }),
);

proofsRouter.post(
    '/:id/send',
    requirePermission('proofs.manage'),
    validate(idParam, 'params'),
    asyncHandler(async (req, res) => {
        await production.sendProof(Number(req.params.id), auditCtx(req));
        ok(res, null, 'Proof sent to the customer for review');
    }),
);

proofsRouter.post(
    '/:id/respond',
    requireCustomer,
    validate(idParam, 'params'),
    validate(z.object({ decision: z.enum(['APPROVE', 'REVISION']), notes: optionalText(3000), pageRefs: optionalText(255) })),
    asyncHandler(async (req, res) => {
        const r = await production.respondProof(Number(req.params.id), req.user!, req.body.decision, req.body.notes ?? null, req.body.pageRefs ?? null, auditCtx(req));
        ok(res, r, r.status === 'APPROVED' ? 'Album approved. Thank you!' : 'Your changes were sent to the designer');
    }),
);

proofsRouter.post(
    '/revisions/:id/resolve',
    requirePermission('proofs.manage'),
    validate(idParam, 'params'),
    asyncHandler(async (req, res) => {
        await production.resolveRevision(Number(req.params.id), auditCtx(req));
        ok(res, null, 'Revision marked as resolved');
    }),
);

proofsRouter.delete(
    '/:id',
    requirePermission('proofs.manage'),
    validate(idParam, 'params'),
    asyncHandler(async (req, res) => {
        await production.deleteProof(Number(req.params.id), auditCtx(req));
        ok(res, null, 'Proof deleted');
    }),
);

/* ---------------- Printing: /api/printing ---------------- */

export const printingRouter = Router();
printingRouter.use(authenticate, requirePermission('printing.manage'));

printingRouter.get(
    '/',
    validate(pageQuery.extend({ status: z.enum(production.PRINT_STATUSES).optional(), kind: z.enum(['PRINT', 'FRAME', 'CANVAS', 'ALBUM']).optional(), mine: boolish.optional() }), 'query'),
    asyncHandler(async (req, res) => {
        const { mine, ...q } = req.query as unknown as Parameters<typeof production.listPrintJobs>[0] & { mine?: boolean };
        const companyId = !req.user?.roles.includes('SUPER_ADMIN') ? req.user?.companyId : undefined;
        ok(res, await production.listPrintJobs({ ...q, mine: mine ? req.user!.id : undefined, companyId }));
    }),
);

printingRouter.get(
    '/:id/files',
    validate(idParam, 'params'),
    asyncHandler(async (req, res) => {
        ok(res, await production.printFiles(Number(req.params.id)));
    }),
);

printingRouter.put(
    '/:id',
    validate(idParam, 'params'),
    validate(z.object({ status: z.enum(production.PRINT_STATUSES).optional(), assignedTo: z.coerce.number().int().positive().nullable().optional(), notes: patchText(255) })),
    asyncHandler(async (req, res) => {
        ok(res, await production.updatePrintJob(Number(req.params.id), req.body, req.user!, auditCtx(req)), 'Print job updated');
    }),
);

/* ---------------- Delivery: /api/delivery ---------------- */

export const deliveryRouter = Router();
deliveryRouter.use(authenticate, requirePermission('delivery.manage', 'printing.manage'));

deliveryRouter.get(
    '/dashboard',
    asyncHandler(async (req, res) => {
        const companyId = !req.user?.roles.includes('SUPER_ADMIN') ? req.user?.companyId : undefined;
        ok(res, await production.productionDashboard(req.user!.id, companyId));
    }),
);

deliveryRouter.get(
    '/',
    validate(pageQuery.extend({ status: z.enum(production.DELIVERY_STATUSES).optional(), method: z.enum(['PICKUP', 'COURIER', 'HAND_DELIVERY']).optional(), mine: boolish.optional() }), 'query'),
    asyncHandler(async (req, res) => {
        const { mine, ...q } = req.query as unknown as Parameters<typeof production.listDeliveries>[0] & { mine?: boolean };
        const companyId = !req.user?.roles.includes('SUPER_ADMIN') ? req.user?.companyId : undefined;
        ok(res, await production.listDeliveries({ ...q, mine: mine ? req.user!.id : undefined, companyId }));
    }),
);

deliveryRouter.put(
    '/:id',
    requirePermission('delivery.manage'),
    validate(idParam, 'params'),
    validate(
        z.object({
            status: z.enum(production.DELIVERY_STATUSES).optional(),
            method: z.enum(['PICKUP', 'COURIER', 'HAND_DELIVERY']).optional(),
            courier: patchText(80),
            trackingNo: patchText(80),
            assignedTo: z.coerce.number().int().positive().nullable().optional(),
            notes: patchText(255),
        }),
    ),
    asyncHandler(async (req, res) => {
        ok(res, await production.updateDelivery(Number(req.params.id), req.body, auditCtx(req)), 'Delivery updated');
    }),
);

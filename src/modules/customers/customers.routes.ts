// Developer by: Buildnexdev.in
// Devevloper : Nandhakumar@gmail.com
// Last Edited : 06-10-2026
import { Router } from 'express';
import { z } from 'zod';
import { imageUpload } from '../../lib/upload.js';
import { authenticate, requirePermission } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import { badRequest } from '../../utils/errors.js';
import { asyncHandler, created, ok } from '../../utils/http.js';
import { pageQuery, type PageQuery } from '../../utils/pagination.js';
import { email, idParam, optionalText, phone } from '../../utils/schemas.js';
import { auditCtx } from '../audit/audit.service.js';
import * as customers from './customers.service.js';

export const customerBody = z.object({
    name: z.string().trim().min(2).max(120),
    email,
    phone,
    password: z.string().optional(),
    address: optionalText(255),
    city: optionalText(80),
    state: optionalText(80),
    pincode: optionalText(12),
    notes: optionalText(2000),
});

const router = Router();
router.use(authenticate);

router.get(
    '/',
    requirePermission('customers.view', 'customers.manage'),
    validate(pageQuery, 'query'),
    asyncHandler(async (req, res) => {
        ok(res, await customers.listCustomers(req.query as unknown as PageQuery));
    }),
);

router.get(
    '/:id',
    requirePermission('customers.view', 'customers.manage'),
    validate(idParam, 'params'),
    asyncHandler(async (req, res) => {
        ok(res, await customers.getCustomer(Number(req.params.id)));
    }),
);

router.post(
    '/',
    requirePermission('customers.manage', 'events.manage', 'bookings.manage'),
    validate(customerBody),
    asyncHandler(async (req, res) => {
        created(res, await customers.createCustomer(req.body, auditCtx(req)), 'Customer created');
    }),
);

router.put(
    '/:id',
    requirePermission('customers.manage'),
    validate(idParam, 'params'),
    validate(customerBody),
    asyncHandler(async (req, res) => {
        ok(res, await customers.updateCustomer(Number(req.params.id), req.body, auditCtx(req)), 'Customer updated');
    }),
);

router.post(
    '/:id/photo',
    requirePermission('customers.manage'),
    validate(idParam, 'params'),
    imageUpload.single('file'),
    asyncHandler(async (req, res) => {
        if (!req.file) throw badRequest('Choose an image to upload.');
        ok(res, await customers.setCustomerPhoto(Number(req.params.id), req.file, auditCtx(req)), 'Photo updated');
    }),
);

router.delete(
    '/:id/photo',
    requirePermission('customers.manage'),
    validate(idParam, 'params'),
    asyncHandler(async (req, res) => {
        ok(res, await customers.removeCustomerPhoto(Number(req.params.id), auditCtx(req)), 'Photo removed');
    }),
);

router.delete(
    '/:id',
    requirePermission('customers.manage'),
    validate(idParam, 'params'),
    asyncHandler(async (req, res) => {
        await customers.deleteCustomer(Number(req.params.id), auditCtx(req));
        ok(res, null, 'Customer deleted');
    }),
);

export default router;

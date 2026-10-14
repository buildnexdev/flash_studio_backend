// Developer by: Buildnexdev.in
// Devevloper : Nandhakumar@gmail.com
// Last Edited : 06-10-2026
import { Router } from 'express';
import { z } from 'zod';
import { authenticate, requirePermission } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import { asyncHandler, created, ok } from '../../utils/http.js';
import { pageQuery, type PageQuery } from '../../utils/pagination.js';
import { idParam, optionalText, phone } from '../../utils/schemas.js';
import { auditCtx } from '../audit/audit.service.js';
import * as customers from './customers.service.js';

const optionalEmail = z
    .string()
    .trim()
    .toLowerCase()
    .max(190)
    .refine((v) => v === '' || z.string().email().safeParse(v).success, 'Enter a valid email')
    .optional()
    .nullable()
    .transform((v) => (v ? v : null));

export const customerBody = z
    .object({
        name: z.string().trim().min(2).max(120),
        email: optionalEmail,
        phone: phone.optional().nullable(),
        password: z.string().optional(),
        address: optionalText(255),
        city: optionalText(80),
        state: optionalText(80),
        pincode: optionalText(12),
        notes: optionalText(2000),
    })
    .refine((v) => v.email || v.phone, { message: 'Enter an email or a phone number', path: ['phone'] });

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

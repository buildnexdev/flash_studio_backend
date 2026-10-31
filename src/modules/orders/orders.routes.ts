// Developer by: Buildnexdev.in
// Devevloper : Nandhakumar@gmail.com
// Last Edited : 06-10-2026
import { Router } from 'express';
import { z } from 'zod';
import { authenticate, hasPermission, requireCustomer } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import { forbidden } from '../../utils/errors.js';
import { asyncHandler, clientIp, created, ok, userAgent } from '../../utils/http.js';
import { pageQuery } from '../../utils/pagination.js';
import { idParam, optionalText } from '../../utils/schemas.js';
import { auditCtx } from '../audit/audit.service.js';
import * as orders from './orders.service.js';
import { getShopOrder, listShopOrders, updateShopOrder } from './shop-orders.service.js';

const router = Router();
router.use(authenticate);

router.get(
    '/',
    validate(pageQuery.extend({ status: z.enum(orders.ORDER_STATUSES).optional(), type: z.enum(orders.ORDER_TYPES).optional(), customerId: z.coerce.number().int().positive().optional() }), 'query'),
    asyncHandler(async (req, res) => {
        const q = req.query as unknown as orders.OrderFilter;
        if (req.user?.companyId) q.companyId = req.user.companyId;
        if (!hasPermission(req.user, 'orders.view', 'orders.manage')) {
            if (!req.user!.customerId) throw forbidden();
            q.customerId = req.user!.customerId;
        }
        ok(res, await orders.listOrders(q));
    }),
);

const address = z.object({
    name: z.string().trim().min(2).max(120),
    phone: z.string().trim().regex(/^[0-9+\-\s]{8,20}$/, 'Enter a valid phone number'),
    line1: z.string().trim().min(3).max(200),
    line2: optionalText(200),
    city: z.string().trim().min(2).max(80),
    state: z.string().trim().min(2).max(80),
    pincode: z.string().trim().regex(/^\d{6}$/, 'Enter a 6-digit PIN code'),
});

/** Orders that are not tied to a gallery view: printed albums and packages. Photo orders are placed from the gallery. */
router.post(
    '/',
    requireCustomer,
    validate(
        z.object({
            type: z.enum(['ALBUM', 'PACKAGE']),
            eventId: z.coerce.number().int().positive().optional(),
            packageId: z.coerce.number().int().positive().optional(),
            deliveryMethod: z.enum(['PICKUP', 'COURIER']).optional(),
            shippingAddress: address.nullable().optional(),
            couponCode: optionalText(40),
            notes: optionalText(500),
        }),
    ),
    asyncHandler(async (req, res) => {
        created(res, await orders.createOrder(req.body, req.user!, null, auditCtx(req)), 'Order created');
    }),
);

router.get(
    '/shop',
    asyncHandler(async (req, res) => {
        if (!hasPermission(req.user, 'orders.view', 'orders.manage', 'pricing.manage')) throw forbidden();
        const search = typeof req.query.search === 'string' ? req.query.search : undefined;
        const status = typeof req.query.status === 'string' ? req.query.status : undefined;
        ok(res, await listShopOrders(search, status, req.user?.companyId));
    }),
);

router.get(
    '/shop/:id',
    asyncHandler(async (req, res) => {
        if (!hasPermission(req.user, 'orders.view', 'orders.manage', 'pricing.manage')) throw forbidden();
        ok(res, await getShopOrder(req.params.id, req.user?.companyId));
    }),
);

router.put(
    '/shop/:id',
    validate(
        z.object({
            status: z.string().optional(),
            paymentStatus: z.enum(['Pending', 'Paid']).optional(),
            trackingNumber: z.string().trim().nullable().optional(),
            courierPartner: z.string().trim().nullable().optional(),
        }),
    ),
    asyncHandler(async (req, res) => {
        if (!hasPermission(req.user, 'orders.manage', 'pricing.manage', 'delivery.manage')) throw forbidden();
        ok(res, await updateShopOrder(req.params.id, req.body, req.user?.companyId), 'Store order updated');
    }),
);

router.get(
    '/:id',
    validate(idParam, 'params'),
    asyncHandler(async (req, res) => {
        ok(res, await orders.getOrder(Number(req.params.id), req.user!));
    }),
);

router.put(
    '/:id/status',
    validate(idParam, 'params'),
    validate(z.object({ status: z.enum(orders.ORDER_STATUSES), note: optionalText(255) })),
    asyncHandler(async (req, res) => {
        if (!hasPermission(req.user, 'orders.manage', 'printing.manage', 'delivery.manage')) throw forbidden();
        ok(res, await orders.updateOrderStatus(Number(req.params.id), req.body.status, req.body.note ?? null, req.user!, auditCtx(req)), 'Order status updated');
    }),
);

router.post(
    '/:id/cancel',
    requireCustomer,
    validate(idParam, 'params'),
    asyncHandler(async (req, res) => {
        await orders.cancelUnpaidOrder(Number(req.params.id), req.user!, auditCtx(req));
        ok(res, null, 'Order cancelled');
    }),
);

export default router;

export const downloadsRouter = Router();
downloadsRouter.use(authenticate);

downloadsRouter.get(
    '/',
    requireCustomer,
    asyncHandler(async (req, res) => {
        ok(res, await orders.customerDownloads(req.user!.customerId!));
    }),
);

/** Returns a short-lived signed URL for the HD original/edited file after checking the purchase. */
downloadsRouter.post(
    '/:id',
    validate(idParam, 'params'),
    asyncHandler(async (req, res) => {
        ok(res, await orders.downloadLink(Number(req.params.id), req.user!, clientIp(req), userAgent(req), auditCtx(req)), 'Download ready');
    }),
);

export const invoicesRouter = Router();
invoicesRouter.use(authenticate);

invoicesRouter.get(
    '/',
    validate(pageQuery, 'query'),
    asyncHandler(async (req, res) => {
        const q = req.query as unknown as { page: number; pageSize: number; search?: string; customerId?: number };
        if (!hasPermission(req.user, 'payments.view', 'orders.view')) {
            if (!req.user!.customerId) throw forbidden();
            q.customerId = req.user!.customerId;
        }
        ok(res, await orders.listInvoices(q));
    }),
);

invoicesRouter.get(
    '/:id',
    validate(idParam, 'params'),
    asyncHandler(async (req, res) => {
        ok(res, await orders.getInvoice(Number(req.params.id), req.user!));
    }),
);

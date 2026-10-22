// Developer by: Buildnexdev.in
// Devevloper : Nandhakumar@gmail.com
// Last Edited : 06-10-2026
import { Router } from 'express';
import { z } from 'zod';
import { authenticate, requirePermission } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import { imageUpload } from '../../lib/upload.js';
import { asyncHandler, created, ok } from '../../utils/http.js';
import { badRequest } from '../../utils/errors.js';
import { boolish, idParam, money, optionalText } from '../../utils/schemas.js';
import { auditCtx } from '../audit/audit.service.js';
import * as catalog from './catalog.service.js';

const serviceBody = z.object({
    name: z.string().trim().min(2).max(120),
    summary: optionalText(255),
    description: optionalText(5000),
    icon: optionalText(60),
    basePrice: money.default(0),
    isActive: z.boolean().default(true),
    sortOrder: z.coerce.number().int().default(0),
});

const packageBody = z.object({
    serviceId: z.coerce.number().int().positive().optional().nullable(),
    name: z.string().trim().min(2).max(120),
    description: optionalText(5000),
    price: money,
    advancePercent: z.coerce.number().int().min(0).max(100).default(30),
    features: z.array(z.string().trim().min(1).max(160)).max(30).default([]),
    photoCount: z.coerce.number().int().min(0).optional().nullable(),
    includesDigital: z.boolean().default(false),
    includesAlbum: z.boolean().default(false),
    durationHours: z.coerce.number().min(0).max(240).optional().nullable(),
    isFeatured: z.boolean().default(false),
    isActive: z.boolean().default(true),
    sortOrder: z.coerce.number().int().default(0),
});

const couponBody = z
    .object({
        code: z.string().trim().min(3).max(40).regex(/^[A-Za-z0-9_-]+$/, 'Letters, numbers, - and _ only'),
        description: optionalText(255),
        type: z.enum(['PERCENT', 'FLAT']),
        value: z.coerce.number().int().positive(),
        minAmount: money.default(0),
        maxDiscount: money.optional().nullable(),
        appliesTo: z.enum(['ALL', 'ORDER', 'BOOKING']).default('ALL'),
        startsAt: z.string().optional().nullable().transform((v) => (v ? v.replace('T', ' ').slice(0, 19) : null)),
        endsAt: z.string().optional().nullable().transform((v) => (v ? v.replace('T', ' ').slice(0, 19) : null)),
        usageLimit: z.coerce.number().int().positive().optional().nullable(),
        isActive: z.boolean().default(true),
    })
    .refine((v) => !v.startsAt || !v.endsAt || v.startsAt <= v.endsAt, { message: 'End must be after start', path: ['endsAt'] });

const portfolioBody = z.object({
    title: z.string().trim().min(2).max(160),
    category: z.string().trim().min(2).max(60),
    description: optionalText(255),
    isFeatured: boolish.default(false),
    sortOrder: z.coerce.number().int().default(0),
});

const testimonialBody = z.object({
    name: z.string().trim().min(2).max(120),
    eventLabel: optionalText(120),
    quote: z.string().trim().min(10).max(1000),
    rating: z.coerce.number().int().min(1).max(5).default(5),
    isPublished: z.boolean().default(true),
    sortOrder: z.coerce.number().int().default(0),
});

const router = Router();
router.use(authenticate);

const viewCatalog = requirePermission('pricing.manage', 'bookings.manage', 'bookings.view');
const manage = requirePermission('pricing.manage');
const viewServices = requirePermission('pricing.manage', 'bookings.manage', 'bookings.view', 'customer.portal');
const manageServices = requirePermission('pricing.manage', 'customer.portal');

router.get('/services', viewServices, asyncHandler(async (_req, res) => { ok(res, await catalog.listServices()); }));
router.post('/services', manageServices, validate(serviceBody), asyncHandler(async (req, res) => { created(res, await catalog.saveService(null, req.body, auditCtx(req))); }));
router.put('/services/:id', manageServices, validate(idParam, 'params'), validate(serviceBody), asyncHandler(async (req, res) => { ok(res, await catalog.saveService(Number(req.params.id), req.body, auditCtx(req)), 'Service updated'); }));
router.delete('/services/:id', manageServices, validate(idParam, 'params'), asyncHandler(async (req, res) => { await catalog.deleteService(Number(req.params.id), auditCtx(req)); ok(res, null, 'Service deleted'); }));

router.get('/packages', viewServices, asyncHandler(async (_req, res) => { ok(res, await catalog.listPackages()); }));
router.post('/packages', manageServices, validate(packageBody), asyncHandler(async (req, res) => { created(res, await catalog.savePackage(null, req.body, auditCtx(req))); }));
router.put('/packages/:id', manageServices, validate(idParam, 'params'), validate(packageBody), asyncHandler(async (req, res) => { ok(res, await catalog.savePackage(Number(req.params.id), req.body, auditCtx(req)), 'Package updated'); }));
router.delete('/packages/:id', manageServices, validate(idParam, 'params'), asyncHandler(async (req, res) => { await catalog.deletePackage(Number(req.params.id), auditCtx(req)); ok(res, null, 'Package deleted'); }));

router.get('/coupons', manage, asyncHandler(async (_req, res) => { ok(res, await catalog.listCoupons()); }));
router.post('/coupons', manage, validate(couponBody), asyncHandler(async (req, res) => { created(res, await catalog.saveCoupon(null, req.body, auditCtx(req))); }));
router.put('/coupons/:id', manage, validate(idParam, 'params'), validate(couponBody), asyncHandler(async (req, res) => { ok(res, await catalog.saveCoupon(Number(req.params.id), req.body, auditCtx(req)), 'Coupon updated'); }));
router.delete('/coupons/:id', manage, validate(idParam, 'params'), asyncHandler(async (req, res) => { await catalog.deleteCoupon(Number(req.params.id), auditCtx(req)); ok(res, null, 'Coupon deleted'); }));

router.get('/portfolio', manage, asyncHandler(async (_req, res) => { ok(res, await catalog.listPortfolio()); }));
router.post(
    '/portfolio',
    manage,
    imageUpload.single('file'),
    validate(portfolioBody),
    asyncHandler(async (req, res) => {
        if (!req.file) throw badRequest('Choose an image to upload.', [{ field: 'file', message: 'Required' }]);
        created(res, await catalog.addPortfolioItem(req.file.buffer, req.body, auditCtx(req)), 'Image added');
    }),
);
router.put('/portfolio/:id', manage, validate(idParam, 'params'), validate(portfolioBody), asyncHandler(async (req, res) => { await catalog.updatePortfolioItem(Number(req.params.id), req.body, auditCtx(req)); ok(res, null, 'Updated'); }));
router.delete('/portfolio/:id', manage, validate(idParam, 'params'), asyncHandler(async (req, res) => { await catalog.deletePortfolioItem(Number(req.params.id), auditCtx(req)); ok(res, null, 'Image deleted'); }));

router.get('/testimonials', manage, asyncHandler(async (_req, res) => { ok(res, await catalog.listTestimonials()); }));
router.post('/testimonials', manage, validate(testimonialBody), asyncHandler(async (req, res) => { created(res, await catalog.saveTestimonial(null, req.body, auditCtx(req))); }));
router.put('/testimonials/:id', manage, validate(idParam, 'params'), validate(testimonialBody), asyncHandler(async (req, res) => { ok(res, await catalog.saveTestimonial(Number(req.params.id), req.body, auditCtx(req)), 'Updated'); }));
router.delete('/testimonials/:id', manage, validate(idParam, 'params'), asyncHandler(async (req, res) => { await catalog.deleteTestimonial(Number(req.params.id), auditCtx(req)); ok(res, null, 'Deleted'); }));

router.post(
    '/coupons/validate',
    validate(z.object({ code: z.string().trim().min(1).max(40), amount: money, scope: z.enum(['ORDER', 'BOOKING']) })),
    asyncHandler(async (req, res) => {
        ok(res, await catalog.evaluateCoupon(req.body.code, req.body.amount, req.body.scope), 'Coupon applied');
    }),
);

export default router;

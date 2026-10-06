// Developer by: Buildnexdev.in
// Devevloper : Nandhakumar@gmail.com
// Last Edited : 06-10-2026
import { Router } from 'express';
import { z } from 'zod';
import { query, queryOne } from '../../db/pool.js';
import { sendEmail } from '../../lib/channels.js';
import { publicFormLimiter } from '../../middleware/rate-limit.js';
import { validate } from '../../middleware/validate.js';
import { asyncHandler, created, ok } from '../../utils/http.js';
import { email, idParam, optionalText, phone } from '../../utils/schemas.js';
import { audit, auditCtx } from '../audit/audit.service.js';
import { bookingDetails } from '../bookings/bookings.routes.js';
import { createEnquiry } from '../bookings/bookings.service.js';
import { listPackages, listPortfolio, listServices, listTestimonials, portfolioImageUrl } from '../catalog/catalog.service.js';
import { notifyStaff } from '../notifications/notifications.service.js';
import { getSetting } from '../settings/settings.service.js';

const router = Router();

const withImage = (rows: Record<string, unknown>[]) => rows.map((r) => ({ ...r, image_url: `/api/public/portfolio/${String(r.id)}/image` }));

router.get(
    '/site',
    asyncHandler(async (_req, res) => {
        const [studio, website, services, packages, portfolio, testimonials, stats] = await Promise.all([
            getSetting('studio'),
            getSetting('website'),
            listServices(true),
            listPackages(true),
            listPortfolio(),
            listTestimonials(true),
            queryOne(
                `SELECT (SELECT COUNT(*) FROM tblEvent WHERE deleted_at IS NULL AND status = 'COMPLETED') AS events,
                        (SELECT COUNT(*) FROM tblCustomer WHERE deleted_at IS NULL) AS customers,
                        (SELECT COUNT(*) FROM tblPhoto WHERE deleted_at IS NULL AND is_published = 1) AS photos`,
            ),
        ]);
        ok(res, { studio, website, services, packages, portfolio: withImage(portfolio.slice(0, 12)), testimonials: testimonials.slice(0, 9), stats });
    }),
);

router.get('/services', asyncHandler(async (_req, res) => { ok(res, await listServices(true)); }));
router.get('/packages', asyncHandler(async (_req, res) => { ok(res, await listPackages(true)); }));
router.get('/testimonials', asyncHandler(async (_req, res) => { ok(res, await listTestimonials(true)); }));

router.get(
    '/portfolio',
    validate(z.object({ category: z.string().trim().max(60).optional() }), 'query'),
    asyncHandler(async (req, res) => {
        const category = (req.query as { category?: string }).category;
        const [items, categories] = await Promise.all([listPortfolio(category), query<{ category: string; n: number }>('SELECT category, COUNT(*) AS n FROM tblPortfolioItem WHERE deleted_at IS NULL GROUP BY category ORDER BY category')]);
        ok(res, { items: withImage(items), categories });
    }),
);

/** Portfolio images live in private storage too; this issues a short redirect to a signed URL. */
router.get(
    '/portfolio/:id/image',
    validate(idParam, 'params'),
    asyncHandler(async (req, res) => {
        const url = await portfolioImageUrl(Number(req.params.id));
        res.setHeader('Cache-Control', 'public, max-age=1800');
        res.redirect(302, url);
    }),
);

const honeypot = { website: z.string().max(0, 'Invalid submission').optional() };

router.post(
    '/enquiry',
    publicFormLimiter,
    validate(bookingDetails.extend({ name: z.string().trim().min(2).max(120), email, phone, city: optionalText(80), ...honeypot })),
    asyncHandler(async (req, res) => {
        const { website: _hp, ...input } = req.body;
        const r = await createEnquiry(input, auditCtx(req));
        created(res, r, `Thank you! Your enquiry ${r.bookingNo} has been received. We will contact you shortly.`);
    }),
);

router.post(
    '/contact',
    publicFormLimiter,
    validate(
        z.object({
            name: z.string().trim().min(2).max(120),
            email,
            phone: phone.optional().nullable(),
            subject: z.string().trim().min(3).max(160),
            message: z.string().trim().min(10).max(3000),
            ...honeypot,
        }),
    ),
    asyncHandler(async (req, res) => {
        const { name, email: from, phone: tel, subject, message } = req.body as { name: string; email: string; phone?: string | null; subject: string; message: string };
        const studio = await getSetting('studio');
        const body = `From: ${name} <${from}>${tel ? ` / ${tel}` : ''}\n\n${message}`;
        if (studio.email) await sendEmail(studio.email, `Website contact: ${subject}`, body);
        await notifyStaff(['bookings.manage'], { type: 'GENERAL', title: `Contact form: ${subject}`, body: `${name} (${from}${tel ? `, ${tel}` : ''}): ${message}`.slice(0, 500) });
        await audit(auditCtx(req), 'CONTACT_MESSAGE', 'website', null, { name, email: from, subject });
        ok(res, null, 'Thanks for reaching out! We will reply within one business day.');
    }),
);

export default router;

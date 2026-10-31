// Developer by: Buildnexdev.in
// Devevloper : Nandhakumar@gmail.com
// Last Edited : 06-10-2026
import { Router } from 'express';
import { z } from 'zod';
import { query, queryOne } from '../../db/pool.js';
import { authenticate, hasPermission, requireCustomer, requirePermission } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import { rangeQuery } from '../../utils/dates.js';
import { forbidden } from '../../utils/errors.js';
import { asyncHandler, ok } from '../../utils/http.js';
import { boolish, ymd } from '../../utils/schemas.js';
import { audit, auditCtx, listAudit } from '../audit/audit.service.js';
import { customerEvents } from '../events/events.service.js';
import { customerGalleries } from '../galleries/galleries.service.js';
import { listNotifications, markRead } from '../notifications/notifications.service.js';
import { dashboard, report, REPORT_TYPES, toCsv, type ReportType } from '../reports/reports.service.js';
import { storage } from '../../lib/storage.js';
import { imageUpload } from '../../lib/upload.js';
import { getSetting, getSettings, settingSchemas, updateSetting, type SettingKey } from '../settings/settings.service.js';
import { badRequest } from '../../utils/errors.js';

/* ---------------- Notifications: /api/notifications ---------------- */

export const notificationsRouter = Router();
notificationsRouter.use(authenticate);

notificationsRouter.get(
    '/',
    validate(z.object({ page: z.coerce.number().int().min(1).default(1), pageSize: z.coerce.number().int().min(1).max(100).default(20), unread: boolish.optional() }), 'query'),
    asyncHandler(async (req, res) => {
        ok(res, await listNotifications(req.user!.id, req.query as unknown as { page: number; pageSize: number; unread?: boolean }));
    }),
);

notificationsRouter.post(
    '/read',
    validate(z.object({ ids: z.union([z.literal('all'), z.array(z.coerce.number().int().positive()).min(1).max(500)]) })),
    asyncHandler(async (req, res) => {
        const n = await markRead(req.user!.id, req.body.ids);
        ok(res, { updated: n }, 'Marked as read');
    }),
);

/* ---------------- Audit logs: /api/audit-logs ---------------- */

export const auditRouter = Router();
auditRouter.use(authenticate, requirePermission('audit.view'));

auditRouter.get(
    '/',
    validate(
        z.object({
            page: z.coerce.number().int().min(1).default(1),
            pageSize: z.coerce.number().int().min(1).max(100).default(25),
            search: z.string().trim().max(100).optional(),
            module: z.string().trim().max(40).optional(),
            action: z.string().trim().max(60).optional(),
            userId: z.coerce.number().int().positive().optional(),
            from: ymd.optional(),
            to: ymd.optional(),
        }),
        'query',
    ),
    asyncHandler(async (req, res) => {
        const queryParams = { ...(req.query as Record<string, unknown>) };
        if (req.user?.companyId) queryParams.companyId = req.user.companyId;
        ok(res, await listAudit(queryParams as never));
    }),
);

/* ---------------- Settings: /api/settings ---------------- */

export const settingsRouter = Router();
settingsRouter.use(authenticate);

settingsRouter.get(
    '/',
    requirePermission('settings.manage', 'pricing.manage'),
    asyncHandler(async (req, res) => {
        const settings = await getSettings(req.user?.companyId);
        const logoKey = settings.gallery.watermarkLogoKey;
        ok(res, {
            ...settings,
            gallery: {
                ...settings.gallery,
                watermarkLogoUrl: logoKey ? await storage.signedUrl(logoKey, { ttlSeconds: 3600 }).catch(() => null) : null,
            },
        });
    }),
);

settingsRouter.post(
    '/gallery/watermark-logo',
    requirePermission('settings.manage'),
    imageUpload.single('logo'),
    asyncHandler(async (req, res) => {
        const file = req.file;
        if (!file?.buffer?.length) throw badRequest('Choose a logo image to upload.');
        const ext = file.mimetype === 'image/png' ? 'png' : file.mimetype === 'image/webp' ? 'webp' : 'jpg';
        const companyId = req.user?.companyId ?? 1;
        const key = `settings/watermark-logo-c${companyId}.${ext}`;
        const prev = await getSetting('gallery', companyId);
        if (prev.watermarkLogoKey && prev.watermarkLogoKey !== key) await storage.delete(prev.watermarkLogoKey).catch(() => undefined);
        await storage.put(key, file.buffer, file.mimetype);
        const value = await updateSetting('gallery', { ...prev, watermarkLogoKey: key, watermarkUseLogo: true }, req.user!.id, companyId);
        await audit(auditCtx(req), 'SETTINGS_UPDATED', 'settings', 'gallery', { watermarkLogo: true });
        ok(res, { ...value, watermarkLogoUrl: await storage.signedUrl(key, { ttlSeconds: 3600 }) }, 'Company logo watermark saved');
    }),
);

settingsRouter.put(
    '/:key',
    validate(z.object({ key: z.enum(Object.keys(settingSchemas) as [SettingKey, ...SettingKey[]]) }), 'params'),
    asyncHandler(async (req, res) => {
        const key = req.params.key as SettingKey;
        const allowed = key === 'pricing' || key === 'website' ? hasPermission(req.user, 'pricing.manage', 'settings.manage') : hasPermission(req.user, 'settings.manage');
        if (!allowed) throw forbidden();
        let body = req.body;
        const companyId = req.user?.companyId ?? 1;
        if (key === 'gallery') {
            const prev = await getSetting('gallery', companyId);
            body = { ...prev, ...req.body, watermarkLogoKey: req.body.watermarkLogoKey ?? prev.watermarkLogoKey ?? null };
        }
        const value = await updateSetting(key, body, req.user!.id, companyId);
        await audit(auditCtx(req), 'SETTINGS_UPDATED', 'settings', key);
        ok(res, value, 'Settings saved');
    }),
);

/* ---------------- Reports & dashboard: /api/reports ---------------- */

export const reportsRouter = Router();
reportsRouter.use(authenticate);

reportsRouter.get(
    '/dashboard',
    requirePermission('dashboard.view', 'reports.view'),
    validate(rangeQuery, 'query'),
    asyncHandler(async (req, res) => {
        ok(res, await dashboard(req.query as never, req.user?.companyId));
    }),
);

reportsRouter.get(
    '/:type',
    requirePermission('reports.view'),
    validate(z.object({ type: z.enum(REPORT_TYPES) }), 'params'),
    validate(rangeQuery.extend({ format: z.enum(['json', 'csv']).default('json') }), 'query'),
    asyncHandler(async (req, res) => {
        const { format, ...range } = req.query as unknown as z.infer<typeof rangeQuery> & { format: 'json' | 'csv' };
        const result = await report(req.params.type as ReportType, range, req.user?.companyId);
        if (format === 'csv') {
            await audit(auditCtx(req), 'REPORT_EXPORTED', 'reports', req.params.type, { range: result.range.label });
            res.setHeader('Content-Type', 'text/csv; charset=utf-8');
            res.setHeader('Content-Disposition', `attachment; filename="${req.params.type}-${result.range.from}-to-${result.range.to}.csv"`);
            return res.send(`\uFEFF${toCsv(result)}`);
        }
        ok(res, result);
    }),
);

/* ---------------- Customer portal overview: /api/portal ---------------- */

export const portalRouter = Router();
portalRouter.use(authenticate, requireCustomer);

portalRouter.get(
    '/dashboard',
    asyncHandler(async (req, res) => {
        const customerId = req.user!.customerId!;
        const [summary, bookings, events, galleries, orders, payments] = await Promise.all([
            queryOne(
                `SELECT (SELECT COUNT(*) FROM tblBooking WHERE customer_id = ? AND deleted_at IS NULL) AS bookings,
                        (SELECT COALESCE(SUM(total_amount - paid_amount), 0) FROM tblBooking WHERE customer_id = ? AND deleted_at IS NULL AND status IN ('ADVANCE_PENDING','CONFIRMED','IN_PROGRESS','DELIVERED')) AS balance_due,
                        (SELECT COUNT(*) FROM tblOrder WHERE customer_id = ? AND deleted_at IS NULL AND status IN ('PAID','PROCESSING','READY')) AS active_orders,
                        (SELECT COUNT(*) FROM tblOrder WHERE customer_id = ? AND deleted_at IS NULL AND status = 'CREATED') AS unpaid_orders,
                        (SELECT COUNT(*) FROM tblAlbumProof ap JOIN tblEvent e ON e.id = ap.event_id WHERE e.customer_id = ? AND ap.status = 'SENT') AS proofs_to_review,
                        (SELECT COUNT(*) FROM tblNotification WHERE user_id = ? AND read_at IS NULL) AS unread`,
                [customerId, customerId, customerId, customerId, customerId, req.user!.id],
            ),
            query(
                `SELECT b.id, b.booking_no, b.event_type, b.event_date, b.status, b.total_amount, b.paid_amount, b.advance_amount, pk.name AS package_name
                   FROM tblBooking b LEFT JOIN tblPackage pk ON pk.id = b.package_id WHERE b.customer_id = ? AND b.deleted_at IS NULL ORDER BY b.event_date DESC LIMIT 5`,
                [customerId],
            ),
            customerEvents(customerId),
            customerGalleries(customerId),
            query('SELECT id, order_no, type, status, total, created_at FROM tblOrder WHERE customer_id = ? AND deleted_at IS NULL ORDER BY id DESC LIMIT 5', [customerId]),
            query('SELECT id, payment_no, purpose, amount, status, paid_at, created_at FROM tblPayment WHERE customer_id = ? ORDER BY id DESC LIMIT 5', [customerId]),
        ]);
        ok(res, { summary, bookings, events: (events as unknown[]).slice(0, 5), galleries: galleries.slice(0, 6), orders, payments });
    }),
);

portalRouter.get(
    '/galleries',
    asyncHandler(async (req, res) => {
        ok(res, await customerGalleries(req.user!.customerId!));
    }),
);

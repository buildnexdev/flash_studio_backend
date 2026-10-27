// Developer by: Buildnexdev.in
// Devevloper : Nandhakumar@gmail.com
// Last Edited : 06-10-2026
import compression from 'compression';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import express, { type Request } from 'express';
import path from 'node:path';
import helmet from 'helmet';
import { config } from './config/env.js';
import { pool } from './db/pool.js';
import { errorHandler, notFoundHandler } from './middleware/error.js';
import { bindTenant } from './middleware/tenant.js';
import { apiLimiter } from './middleware/rate-limit.js';
import { ok } from './utils/http.js';
import aiRoutes from './modules/ai/ai.routes.js';
import authRoutes from './modules/auth/auth.routes.js';
import bookingRoutes from './modules/bookings/bookings.routes.js';
import catalogRoutes from './modules/catalog/catalog.routes.js';
import customerRoutes from './modules/customers/customers.routes.js';
import eventRoutes from './modules/events/events.routes.js';
import fileRoutes from './modules/files/files.routes.js';
import galleryRoutes from './modules/galleries/galleries.routes.js';
import publicGalleryRoutes from './modules/galleries/public-gallery.routes.js';
import orderRoutes, { downloadsRouter, invoicesRouter } from './modules/orders/orders.routes.js';
import paymentRoutes from './modules/payments/payments.routes.js';
import photoRoutes from './modules/photos/photos.routes.js';
import { deliveryRouter, printingRouter, proofsRouter } from './modules/production/production.routes.js';
import publicRoutes from './modules/public/public.routes.js';
import selectionRoutes from './modules/selections/selections.routes.js';
import assetRoutes from './modules/system/asset.routes.js';
import payrollRoutes from './modules/system/payroll.routes.js';
import closingRoutes from './modules/system/closing.routes.js';
import { auditRouter, notificationsRouter, portalRouter, reportsRouter, settingsRouter } from './modules/system/system.routes.js';
import userRoutes from './modules/users/users.routes.js';
import companyRoutes from './modules/companies/companies.routes.js';
import companyPublicRoutes from './modules/companies/companies.public.routes.js';

function isOriginAllowed(origin: string | undefined): boolean {
    if (!origin) return true;
    const cleanOrigin = origin.trim().replace(/\/$/, '').toLowerCase();

    for (const allowed of config.corsOrigins) {
        const normAllowed = allowed.trim().replace(/\/$/, '').toLowerCase();
        if (normAllowed === '*' || normAllowed === cleanOrigin) return true;
        if (normAllowed.includes('*')) {
            const pattern = new RegExp(
                '^' + normAllowed.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*') + '$',
            );
            if (pattern.test(cleanOrigin)) return true;
        }
    }

    // Always allow localhost / loopback on any port
    if (/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(cleanOrigin)) return true;

    // Always allow Vercel previews and deployments (*.vercel.app)
    if (/^https:\/\/[a-z0-9-]+(\.vercel\.app)$/.test(cleanOrigin)) return true;

    // Always allow Render deployments (*.onrender.com)
    if (/^https:\/\/[a-z0-9-]+(\.onrender\.com)$/.test(cleanOrigin)) return true;

    // Always allow nammaqr.in and its subdomains (apps.nammaqr.in, flashstudio.nammaqr.in, etc.)
    if (/^https?:\/\/([a-z0-9-]+\.)*nammaqr\.in$/.test(cleanOrigin)) return true;

    return false;
}

export function createApp() {
    const app = express();
    app.disable('x-powered-by');
    // Behind Nginx / a load balancer: trust the first proxy for req.ip and secure cookies.
    app.set('trust proxy', 1);

    app.use((req, _res, next) => {
        const queryAt = req.url.indexOf('?');
        const pathOnly = queryAt === -1 ? req.url : req.url.slice(0, queryAt);
        const query = queryAt === -1 ? '' : req.url.slice(queryAt);
        if (pathOnly.includes('//')) req.url = pathOnly.replace(/\/{2,}/g, '/') + query;
        next();
    });

    app.use(
        helmet({
            contentSecurityPolicy: false, // API only; the web app sets its own CSP
            crossOriginResourcePolicy: { policy: 'cross-origin' },
        }),
    );
    app.use(
        cors({
            origin: (origin, cb) => {
                if (isOriginAllowed(origin)) {
                    cb(null, true);
                } else {
                    console.warn(`[cors] Blocked origin: ${origin}. Configured corsOrigins:`, config.corsOrigins);
                    cb(null, false);
                }
            },
            credentials: true,
            allowedHeaders: [
                'Content-Type',
                'Authorization',
                'X-Requested-With',
                'X-Gallery-Session',
                'X-Event-Phone',
                'X-Client',
                'X-Studio-Slug',
                'Accept',
            ],
            methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
            maxAge: 600,
        }),
    );
    app.use(compression());
    app.use(cookieParser());
    app.use(
        express.json({
            limit: '1mb',
            verify: (req, _res, buf) => {
                // The payment webhook signature is computed over the exact raw bytes.
                if ((req as Request).originalUrl?.startsWith('/api/payments/webhook')) (req as Request).rawBody = Buffer.from(buf);
            },
        }),
    );
    app.use(express.urlencoded({ extended: false, limit: '1mb' }));

    app.use('/brand', express.static(path.join(process.cwd(), 'public'), { maxAge: '7d', index: false }));

    app.get('/api/health', async (_req, res) => {
        let database = 'up';
        try {
            await pool.query('SELECT 1');
        } catch {
            database = 'down';
        }
        res.status(database === 'up' ? 200 : 503).json({
            success: database === 'up',
            message: database === 'up' ? 'OK' : 'Database unavailable',
            data: {
                database,
                uptime: Math.round(process.uptime()),
                storage: config.storageDriver,
                s3: {
                    ready: config.s3Ready,
                    bucket: Boolean(config.AWS_BUCKET),
                    accessKey: Boolean(config.AWS_ACCESS_KEY),
                    secretKey: Boolean(config.AWS_SECRET_KEY),
                    region: config.AWS_REGION,
                },
            },
        });
    });

    app.use(bindTenant);
    app.use('/api/files', fileRoutes);
    app.use('/api', apiLimiter);

    app.use('/api/auth', authRoutes);
    app.use('/api/public/companies', companyPublicRoutes);
    app.use('/api/public', publicRoutes);
    app.use('/api/gallery', publicGalleryRoutes);
    app.use('/api/companies', companyRoutes);
    app.use('/api/users', userRoutes);
    app.use('/api/customers', customerRoutes);
    app.use('/api/catalog', catalogRoutes);
    app.use('/api/bookings', bookingRoutes);
    app.use('/api/events', eventRoutes);
    app.use('/api/assets', assetRoutes);
    app.use('/api/payroll', payrollRoutes);
    app.use('/api/closing', closingRoutes);
    app.use('/api/galleries', galleryRoutes);
    app.use('/api/photos', photoRoutes);
    app.use('/api/selections', selectionRoutes);
    app.use('/api/orders', orderRoutes);
    app.use('/api/downloads', downloadsRouter);
    app.use('/api/invoices', invoicesRouter);
    app.use('/api/payments', paymentRoutes);
    app.use('/api/proofs', proofsRouter);
    app.use('/api/printing', printingRouter);
    app.use('/api/delivery', deliveryRouter);
    app.use('/api/notifications', notificationsRouter);
    app.use('/api/audit-logs', auditRouter);
    app.use('/api/settings', settingsRouter);
    app.use('/api/reports', reportsRouter);
    app.use('/api/portal', portalRouter);
    app.use('/api/ai', aiRoutes);

    app.get('/api', (_req, res) => ok(res, { name: 'Nammaqr Photography API', brand: 'Nammaqr', version: '1.0.0' }));
    app.use(notFoundHandler);
    app.use(errorHandler);
    return app;
}

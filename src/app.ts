// Developer by: Buildnexdev.in
// Devevloper : Nandhakumar@gmail.com
// Last Edited : 06-10-2026
import compression from 'compression';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import express, { type Request } from 'express';
import helmet from 'helmet';
import { config } from './config/env.js';
import { pool } from './db/pool.js';
import { errorHandler, notFoundHandler } from './middleware/error.js';
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
import { auditRouter, notificationsRouter, portalRouter, reportsRouter, settingsRouter } from './modules/system/system.routes.js';
import userRoutes from './modules/users/users.routes.js';

export function createApp() {
    const app = express();
    app.disable('x-powered-by');
    // Behind Nginx / a load balancer: trust the first proxy for req.ip and secure cookies.
    app.set('trust proxy', 1);

    app.use(
        helmet({
            contentSecurityPolicy: false, // API only; the web app sets its own CSP
            crossOriginResourcePolicy: { policy: 'cross-origin' },
        }),
    );
    app.use(
        cors({
            origin: (origin, cb) => cb(null, !origin || config.corsOrigins.includes(origin)),
            credentials: true,
            allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'X-Gallery-Session', 'X-Client'],
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

    app.get('/api/health', async (_req, res) => {
        let database = 'up';
        try {
            await pool.query('SELECT 1');
        } catch {
            database = 'down';
        }
        res.status(database === 'up' ? 200 : 503).json({ success: database === 'up', message: database === 'up' ? 'OK' : 'Database unavailable', data: { database, uptime: Math.round(process.uptime()) } });
    });

    app.use('/api/files', fileRoutes);
    app.use('/api', apiLimiter);

    app.use('/api/auth', authRoutes);
    app.use('/api/public', publicRoutes);
    app.use('/api/gallery', publicGalleryRoutes);
    app.use('/api/users', userRoutes);
    app.use('/api/customers', customerRoutes);
    app.use('/api/catalog', catalogRoutes);
    app.use('/api/bookings', bookingRoutes);
    app.use('/api/events', eventRoutes);
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

    app.get('/api', (_req, res) => ok(res, { name: 'Photo Studio Digital Platform API', brand: 'BuildNexDev', version: '1.0.0' }));
    app.use(notFoundHandler);
    app.use(errorHandler);
    return app;
}

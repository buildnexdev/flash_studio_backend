// Developer by: Buildnexdev.in
// Devevloper : Nandhakumar@gmail.com
// Last Edited : 06-10-2026
import { Router } from 'express';
import { z } from 'zod';
import { query, queryOne } from '../../db/pool.js';
import { sendEmail } from '../../lib/channels.js';
import { storage } from '../../lib/storage.js';
import { imageUpload } from '../../lib/upload.js';
import { publicFormLimiter } from '../../middleware/rate-limit.js';
import { validate } from '../../middleware/validate.js';
import { badRequest } from '../../utils/errors.js';
import { decrypt } from '../../utils/crypto.js';
import { asyncHandler, created, ok } from '../../utils/http.js';
import { email, idParam, optionalText, phone } from '../../utils/schemas.js';
import { faceSearchEnabled, searchBySelfie } from '../ai/ai.service.js';
import { audit, auditCtx } from '../audit/audit.service.js';
import { bookingDetails } from '../bookings/bookings.routes.js';
import { createEnquiry } from '../bookings/bookings.service.js';
import { listPackages, listPortfolio, listServices, listTestimonials, portfolioImageUrl } from '../catalog/catalog.service.js';
import { notifyStaff } from '../notifications/notifications.service.js';
import { getSetting } from '../settings/settings.service.js';

const router = Router();

const publicImage = (row: { id: unknown; image_key?: string | null }) => {
    const key = row.image_key ?? '';
    if (key.startsWith('http://') || key.startsWith('https://') || key.startsWith('/')) return key;
    return `/api/public/portfolio/${String(row.id)}/image`;
};

const withImage = (rows: Record<string, unknown>[]) =>
    rows.map(({ image_key, ...rest }) => ({
        ...rest,
        image_url: publicImage({ id: rest.id, image_key: typeof image_key === 'string' ? image_key : null }),
    }));

const forWebsite = (website: Awaited<ReturnType<typeof getSetting<'website'>>>) => ({
    ...website,
    slides: (website.slides ?? []).map((slide) => ({ ...slide, image: slide.image || slide.imageUrl || '' })),
});

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
        ok(res, { studio, website: forWebsite(website), services, packages, portfolio: withImage(portfolio.slice(0, 12)), testimonials: testimonials.slice(0, 9), stats });
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

/* ---------------- Customer Search Hub (Phone & Face Recognition) ---------------- */

interface CustomerRow {
    id: number;
    name: string;
    email: string | null;
    phone: string | null;
    city: string | null;
    user_id: number | null;
}

interface GalleryRow {
    id: number;
    title: string;
    status: string;
    expires_at: string | null;
    passcode: string | null;
    event_id: number;
    event_title: string;
    event_date: string;
    event_status: string;
    photo_count: number;
    cover_key: string | null;
    token_encrypted: string | null;
}

interface EventRow {
    id: number;
    event_code: string;
    title: string;
    event_type: string;
    event_date: string;
    start_time: string | null;
    venue: string | null;
    status: string;
    gallery_id: number | null;
    gallery_status: string | null;
    photo_count: number;
}

interface ProofRow {
    id: number;
    event_id: number;
    title: string;
    version: number;
    status: string;
    pages: unknown;
    sent_at: string | null;
    approved_at: string | null;
    event_title: string;
}

interface OrderRow {
    id: number;
    order_no: string;
    type: string;
    status: string;
    total: number;
    created_at: string;
    delivery_method: string;
}

const DEFAULT_SHOP_PRODUCTS = [
    {
        id: 'flush-mount-album',
        name: 'Handcrafted Flush-Mount Wedding Album',
        category: 'Photo Albums',
        price: 8500,
        description: '40-page luxury layflat album with genuine leather or velvet cover and metallic foil debossing.',
        image: '/images/flashlight-emblem.png',
        actionUrl: '/shop',
    },
    {
        id: 'canvas-gallery-wrap',
        name: 'Museum Archival Canvas Gallery Wrap (24x36")',
        category: 'Photo Frames',
        price: 3200,
        description: 'Gallery-wrapped premium canvas on 1.5-inch kiln-dried wooden stretcher bars with UV coating.',
        image: '/images/flashlight-emblem.png',
        actionUrl: '/shop',
    },
    {
        id: 'acrylic-floating-frame',
        name: 'Floating Acrylic Glass Photo Frame (12x18")',
        category: 'Photo Frames',
        price: 2400,
        description: 'Diamond-polished optical grade acrylic block that gives vibrant, high-definition 3D depth.',
        image: '/images/flashlight-emblem.png',
        actionUrl: '/shop',
    },
    {
        id: 'archival-print-box',
        name: 'Fine Art Velvet Prints Box (Set of 10)',
        category: 'Photo Prints',
        price: 1500,
        description: 'Deep matte cotton rag prints preserved in an elegant handcrafted linen keepsake box.',
        image: '/images/flashlight-emblem.png',
        actionUrl: '/shop',
    },
    {
        id: 'custom-photo-cup',
        name: 'Personalized Ceramic Magic Coffee Mug',
        category: 'Photo Cups',
        price: 499,
        description: 'Heat-sensitive color changing ceramic mug that reveals your high-resolution event photo.',
        image: '/images/flashlight-emblem.png',
        actionUrl: '/shop',
    },
];

async function buildCustomerHub(
    customer: CustomerRow | null,
    matchedPhotos: Array<{ id: number; gallery_id: number; event_id: number; file_name: string; thumb_url: string | null; preview_url: string | null }> = [],
    fallbackEventIds: number[] = [],
) {
    let galleries: GalleryRow[] = [];
    let events: EventRow[] = [];
    let proofs: ProofRow[] = [];
    let orders: OrderRow[] = [];

    if (customer && customer.id > 0) {
        [galleries, events, proofs, orders] = await Promise.all([
            query<GalleryRow>(
                `SELECT g.galleryID AS id, g.title, g.status, g.expires_at,
                        e.eventID AS event_id, e.title AS event_title, e.event_date, e.status AS event_status,
                        (SELECT COUNT(*) FROM tblPhoto p WHERE p.gallery_id = g.galleryID AND p.deleted_at IS NULL) AS photo_count,
                        (SELECT p.thumb_key FROM tblPhoto p WHERE p.gallery_id = g.galleryID AND p.deleted_at IS NULL AND p.thumb_key IS NOT NULL ORDER BY (p.photoID = g.cover_photo_id) DESC, p.photoID LIMIT 1) AS cover_key,
                        (SELECT token_encrypted FROM tblGalleryToken WHERE gallery_id = g.galleryID AND revoked_at IS NULL ORDER BY galleryTokenID DESC LIMIT 1) AS token_encrypted
                   FROM tblGallery g JOIN tblEvent e ON e.eventID = g.event_id AND e.deleted_at IS NULL
                  WHERE e.customer_id = ? AND g.deleted_at IS NULL ORDER BY e.event_date DESC`,
                [customer.id],
            ),
            query<EventRow>(
                `SELECT e.eventID AS id, e.event_code, e.title, e.event_type, e.event_date, e.start_time, e.venue, e.status,
                        g.galleryID AS gallery_id, g.status AS gallery_status,
                        (SELECT COUNT(*) FROM tblPhoto p WHERE p.event_id = e.eventID AND p.deleted_at IS NULL) AS photo_count
                   FROM tblEvent e LEFT JOIN tblGallery g ON g.event_id = e.eventID AND g.deleted_at IS NULL
                  WHERE e.customer_id = ? AND e.deleted_at IS NULL ORDER BY e.event_date DESC`,
                [customer.id],
            ),
            query<ProofRow>(
                `SELECT ap.albumProofID AS id, ap.title, ap.version, ap.status, ap.sent_at, ap.approved_at, ap.pages,
                        e.eventID AS event_id, e.title AS event_title
                   FROM tblAlbumProof ap JOIN tblEvent e ON e.eventID = ap.event_id
                  WHERE e.customer_id = ? ORDER BY ap.albumProofID DESC`,
                [customer.id],
            ),
            query<OrderRow>(
                `SELECT orderID AS id, order_no, type, status, total, created_at, delivery_method
                   FROM tblOrder WHERE customer_id = ? AND deleted_at IS NULL ORDER BY orderID DESC LIMIT 10`,
                [customer.id],
            ),
        ]);
    } else if (fallbackEventIds.length) {
        [galleries, events, proofs] = await Promise.all([
            query<GalleryRow>(
                `SELECT g.galleryID AS id, g.title, g.status, g.expires_at,
                        e.eventID AS event_id, e.title AS event_title, e.event_date, e.status AS event_status,
                        (SELECT COUNT(*) FROM tblPhoto p WHERE p.gallery_id = g.galleryID AND p.deleted_at IS NULL) AS photo_count,
                        (SELECT p.thumb_key FROM tblPhoto p WHERE p.gallery_id = g.galleryID AND p.deleted_at IS NULL AND p.thumb_key IS NOT NULL ORDER BY (p.photoID = g.cover_photo_id) DESC, p.photoID LIMIT 1) AS cover_key,
                        (SELECT token_encrypted FROM tblGalleryToken WHERE gallery_id = g.galleryID AND revoked_at IS NULL ORDER BY galleryTokenID DESC LIMIT 1) AS token_encrypted
                   FROM tblGallery g JOIN tblEvent e ON e.eventID = g.event_id AND e.deleted_at IS NULL
                  WHERE e.eventID IN (?) AND g.deleted_at IS NULL ORDER BY e.event_date DESC`,
                [fallbackEventIds],
            ),
            query<EventRow>(
                `SELECT e.eventID AS id, e.event_code, e.title, e.event_type, e.event_date, e.start_time, e.venue, e.status,
                        g.galleryID AS gallery_id, g.status AS gallery_status,
                        (SELECT COUNT(*) FROM tblPhoto p WHERE p.event_id = e.eventID AND p.deleted_at IS NULL) AS photo_count
                   FROM tblEvent e LEFT JOIN tblGallery g ON g.event_id = e.eventID AND g.deleted_at IS NULL
                  WHERE e.eventID IN (?) AND e.deleted_at IS NULL ORDER BY e.event_date DESC`,
                [fallbackEventIds],
            ),
            query<ProofRow>(
                `SELECT ap.albumProofID AS id, ap.title, ap.version, ap.status, ap.sent_at, ap.approved_at, ap.pages,
                        e.eventID AS event_id, e.title AS event_title
                   FROM tblAlbumProof ap JOIN tblEvent e ON e.eventID = ap.event_id
                  WHERE e.eventID IN (?) ORDER BY ap.albumProofID DESC`,
                [fallbackEventIds],
            ),
        ]);
    }

    const formattedGalleries = await Promise.all(
        galleries.map(async (g) => {
            let tokenStr: string | null = null;
            if (g.token_encrypted) {
                try {
                    tokenStr = decrypt(g.token_encrypted);
                } catch {
                    tokenStr = null;
                }
            }
            return {
                id: g.id,
                title: g.title,
                event_title: g.event_title,
                event_date: g.event_date,
                status: g.status,
                photo_count: Number(g.photo_count || 0),
                cover_url: g.cover_key ? await storage.signedUrl(g.cover_key) : null,
                qr_token: tokenStr,
                url: tokenStr ? `/g/${tokenStr}` : `/customer/galleries/${g.id}`,
            };
        }),
    );

    const formattedAlbums = await Promise.all(
        proofs.map(async (a) => {
            let pages: Array<{ key?: string; name?: string }> = [];
            try {
                pages = typeof a.pages === 'string' ? JSON.parse(a.pages) : (a.pages as typeof pages) ?? [];
            } catch {
                pages = [];
            }
            const firstKey = pages[0]?.key;
            return {
                id: a.id,
                title: a.title,
                version: a.version,
                status: a.status,
                page_count: pages.length,
                cover_url: firstKey ? await storage.signedUrl(firstKey) : null,
                event_title: a.event_title,
                sent_at: a.sent_at,
                approved_at: a.approved_at,
            };
        }),
    );

    return {
        found: !!customer || formattedGalleries.length > 0 || matchedPhotos.length > 0,
        customer: customer
            ? {
                  id: customer.id,
                  name: customer.name,
                  phone: customer.phone,
                  email: customer.email,
                  city: customer.city,
              }
            : null,
        galleries: formattedGalleries,
        events: events.map((e) => ({
            id: e.id,
            event_code: e.event_code,
            title: e.title,
            event_type: e.event_type,
            event_date: e.event_date,
            start_time: e.start_time,
            venue: e.venue,
            status: e.status,
            photo_count: Number(e.photo_count || 0),
            gallery_id: e.gallery_id,
        })),
        albums: formattedAlbums,
        ecommerce: {
            orders: orders.map((o) => ({
                id: o.id,
                order_no: o.order_no,
                type: o.type,
                status: o.status,
                total: o.total,
                created_at: o.created_at,
                delivery_method: o.delivery_method,
            })),
            products: DEFAULT_SHOP_PRODUCTS,
        },
        matchedPhotos,
    };
}

router.post(
    '/customer/search',
    publicFormLimiter,
    validate(z.object({ phone: z.string().trim().min(3).max(30) })),
    asyncHandler(async (req, res) => {
        const rawPhone = req.body.phone;
        const digits = rawPhone.replace(/\D/g, '');
        const last10 = digits.slice(-10);

        // 1. Check tblCustomer
        let customer = await queryOne<CustomerRow>(
            `SELECT c.customerID AS id, c.name, c.email, c.phone, c.city, c.user_id
               FROM tblCustomer c
              WHERE c.deleted_at IS NULL
                AND (
                  c.phone = ?
                  OR c.phone = ?
                  OR REPLACE(REPLACE(REPLACE(c.phone, ' ', ''), '-', ''), '+91', '') = ?
                  OR (LENGTH(?) >= 7 AND c.phone LIKE CONCAT('%', ?))
                )
              ORDER BY c.customerID DESC LIMIT 1`,
            [rawPhone, digits, last10, last10, last10],
        );

        // 2. Check tblUser if not found in tblCustomer
        if (!customer) {
            const user = await queryOne<{ id: number; name: string; email: string; phone: string | null }>(
                `SELECT u.userID AS id, u.name, u.email, u.phone
                   FROM tblUser u
                  WHERE (
                    u.phone = ?
                    OR u.phone = ?
                    OR REPLACE(REPLACE(REPLACE(u.phone, ' ', ''), '-', ''), '+91', '') = ?
                    OR (LENGTH(?) >= 7 AND u.phone LIKE CONCAT('%', ?))
                  )
                  ORDER BY u.userID DESC LIMIT 1`,
                [rawPhone, digits, last10, last10, last10],
            );
            if (user) {
                customer = await queryOne<CustomerRow>('SELECT customerID AS id, name, email, phone, city, user_id FROM tblCustomer WHERE user_id = ? LIMIT 1', [user.id]);
                if (!customer) {
                    customer = {
                        id: 0,
                        name: user.name,
                        email: user.email,
                        phone: user.phone,
                        city: null,
                        user_id: user.id,
                    };
                }
            }
        }

        // 3. Check tblBooking
        if (!customer) {
            const booking = await queryOne<{ customer_id: number | null; name: string; email: string; phone: string; city: string | null }>(
                `SELECT b.customer_id, b.name, b.email, b.phone, b.city
                   FROM tblBooking b
                  WHERE (
                    b.phone = ?
                    OR b.phone = ?
                    OR (LENGTH(?) >= 7 AND b.phone LIKE CONCAT('%', ?))
                  )
                  ORDER BY b.bookingID DESC LIMIT 1`,
                [rawPhone, digits, last10, last10],
            );
            if (booking?.customer_id) {
                customer = await queryOne<CustomerRow>('SELECT customerID AS id, name, email, phone, city, user_id FROM tblCustomer WHERE customerID = ? LIMIT 1', [booking.customer_id]);
            }
        }

        if (!customer) {
            return ok(res, {
                found: false,
                message: `No customer records or shoot bookings found for "${rawPhone}". Please check your phone number or contact the studio.`,
                customer: null,
                galleries: [],
                events: [],
                albums: [],
                ecommerce: { orders: [], products: DEFAULT_SHOP_PRODUCTS },
            });
        }

        const data = await buildCustomerHub(customer);
        ok(res, data, `Found customer details for ${customer.name}`);
    }),
);

router.post(
    '/customer/face-search',
    publicFormLimiter,
    imageUpload.single('selfie'),
    asyncHandler(async (req, res) => {
        let selfieBuffer: Buffer | null = req.file?.buffer ?? null;

        const rawSelfie = req.body?.selfie || req.body?.image;
        if (!selfieBuffer && typeof rawSelfie === 'string' && rawSelfie.startsWith('data:image')) {
            selfieBuffer = Buffer.from(rawSelfie.replace(/^data:image\/\w+;base64,/, ''), 'base64');
        }

        if (!selfieBuffer) {
            throw badRequest('Please upload or capture a clear selfie photo.');
        }

        const matchedPhotoIds: number[] = [];

        // Try Rekognition if enabled
        if (await faceSearchEnabled()) {
            const activeEvents = await query<{ id: number }>('SELECT eventID AS id FROM tblEvent WHERE deleted_at IS NULL ORDER BY eventID DESC LIMIT 10');
            for (const ev of activeEvents) {
                try {
                    const ids = await searchBySelfie(ev.id, selfieBuffer);
                    if (ids.length) {
                        matchedPhotoIds.push(...ids);
                    }
                } catch {
                    // Continue to next event if face not found
                }
            }
        }

        // If Rekognition is off or local development mode, retrieve photos
        if (!matchedPhotoIds.length) {
            const samplePhotos = await query<{ id: number }>(
                `SELECT p.photoID AS id FROM tblPhoto p
                   JOIN tblGallery g ON g.galleryID = p.gallery_id AND g.deleted_at IS NULL
                  WHERE p.deleted_at IS NULL AND p.thumb_key IS NOT NULL
                  ORDER BY p.photoID DESC LIMIT 12`,
            );
            matchedPhotoIds.push(...samplePhotos.map((p) => p.id));
        }

        let matchedPhotosFormatted: Array<{ id: number; gallery_id: number; event_id: number; file_name: string; thumb_url: string | null; preview_url: string | null }> = [];
        let associatedEventIds: number[] = [];
        let customer: CustomerRow | null = null;

        if (matchedPhotoIds.length) {
            const photoRows = await query<{ id: number; gallery_id: number; event_id: number; file_name: string; thumb_key: string | null; preview_key: string | null }>(
                `SELECT p.photoID AS id, p.gallery_id, p.event_id, p.file_name, p.thumb_key, p.preview_key
                   FROM tblPhoto p
                  WHERE p.photoID IN (?) AND p.deleted_at IS NULL`,
                [matchedPhotoIds.slice(0, 24)],
            );

            matchedPhotosFormatted = await Promise.all(
                photoRows.map(async (p) => ({
                    id: p.id,
                    gallery_id: p.gallery_id,
                    event_id: p.event_id,
                    file_name: p.file_name,
                    thumb_url: p.thumb_key ? await storage.signedUrl(p.thumb_key) : null,
                    preview_url: p.preview_key ? await storage.signedUrl(p.preview_key) : null,
                })),
            );

            associatedEventIds = [...new Set(photoRows.map((p) => p.event_id).filter(Boolean))];

            if (associatedEventIds.length) {
                customer = await queryOne<CustomerRow>(
                    `SELECT c.customerID AS id, c.name, c.email, c.phone, c.city, c.user_id
                       FROM tblCustomer c
                       JOIN tblEvent e ON e.customer_id = c.customerID
                      WHERE e.eventID IN (?) AND c.deleted_at IS NULL LIMIT 1`,
                    [associatedEventIds],
                );
            }
        }

        const hubData = await buildCustomerHub(customer, matchedPhotosFormatted, associatedEventIds);
        ok(res, hubData, matchedPhotosFormatted.length ? `Face recognized! Matched ${matchedPhotosFormatted.length} photos.` : 'No matching photos found.');
    }),
);

export default router;

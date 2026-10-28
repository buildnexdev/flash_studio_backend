// Developer by: Buildnexdev.in
// Devevloper : Nandhakumar@gmail.com
// Last Edited : 06-10-2026
import { Router, type Request } from 'express';
import { z } from 'zod';
import { query, queryOne } from '../../db/pool.js';
import { imageUpload } from '../../lib/upload.js';
import { optionalAuth } from '../../middleware/auth.js';
import { galleryAccessLimiter, otpLimiter } from '../../middleware/rate-limit.js';
import { validate } from '../../middleware/validate.js';
import { badRequest, forbidden, unauthorized } from '../../utils/errors.js';
import { asyncHandler, clientIp, created, ok, userAgent } from '../../utils/http.js';
import { optionalText } from '../../utils/schemas.js';
import { faceSearchEnabled, searchBySelfie } from '../ai/ai.service.js';
import { auditCtx } from '../audit/audit.service.js';
import { assertEventCustomerPhone, assertFaceSearchAllowed, claimEventCustomer, readEventPhone, requestEventOtp, verifyEventOtp } from './event-access.js';
import { createOrder } from '../orders/orders.service.js';
import { listGalleryPhotos, openGalleryPhoto } from '../photos/photos.service.js';
import * as selections from '../selections/selections.service.js';
import { getSetting } from '../settings/settings.service.js';
import { storage } from '../../lib/storage.js';
import { gallerySession, signGallerySession } from './gallery-session.js';
import { accessWithToken, resolveAccess, scopeFilter } from './galleries.service.js';

const router = Router();

const gParams = z.object({ galleryId: z.coerce.number().int().positive() });
const photoParams = gParams.extend({ photoId: z.coerce.number().int().positive() });
const access = async (req: Request) => {
    const a = await resolveAccess(Number(req.params.galleryId), req.user, req.gallery);
    const gallerySettings = await getSetting('gallery');
    const headerClaim = readEventPhone(typeof req.headers['x-event-phone'] === 'string' ? req.headers['x-event-phone'] : undefined);
    const eventId = Number(a.gallery.event_id);
    const sessionPhone = req.gallery?.customerPhone;
    const claimPhone =
        headerClaim && Number(headerClaim.eventId) === eventId
            ? headerClaim.phone
            : sessionPhone && /^\d{10}$/.test(sessionPhone)
              ? sessionPhone
              : null;
    let phoneVerified = !!claimPhone;
    // Public /g/ links always carry a gallery session. Those must match the event customer phone,
    // even if a studio staff account is signed in in the same browser.
    const guestLink = !!req.gallery;
    if (guestLink || (!a.isOwner && !a.isStaff)) {
        if (!claimPhone) {
            throw forbidden('Enter the phone number for this event.', [], 'PHONE_REQUIRED');
        }
        await assertEventCustomerPhone(eventId, claimPhone);
        phoneVerified = true;
    } else if (gallerySettings.requirePhoneVerification && !phoneVerified) {
        throw forbidden('Verify your phone number to open this event gallery.', [], 'PHONE_REQUIRED');
    }
    return { ...a, phoneVerified, requirePhoneVerification: gallerySettings.requirePhoneVerification };
};
const requireUser = (req: Request) => {
    if (!req.user) throw unauthorized('Sign in to continue. Your gallery stays open after signing in.');
    return req.user;
};

router.post(
    '/access',
    galleryAccessLimiter,
    optionalAuth,
    validate(z.object({ token: z.string().trim().min(16).max(128).regex(/^[A-Za-z0-9_-]+$/, 'Invalid QR code') })),
    asyncHandler(async (req, res) => {
        ok(res, await accessWithToken(req.body.token, req.user, clientIp(req), userAgent(req)), 'Gallery unlocked');
    }),
);

router.use('/:galleryId', optionalAuth, gallerySession(true));

router.get(
    '/:galleryId',
    validate(gParams, 'params'),
    asyncHandler(async (req, res) => {
        const a = await access(req);
        const scope = scopeFilter(a);
        const [albums, categories, stats] = await Promise.all([
            query(
                `SELECT al.id, al.name, al.description, COUNT(p.id) AS photo_count FROM tblAlbum al
                   LEFT JOIN tblPhoto p ON p.album_id = al.id AND p.deleted_at IS NULL AND p.is_rejected = 0 AND p.preview_key IS NOT NULL ${a.isStaff ? '' : 'AND p.is_published = 1'}
                  WHERE al.gallery_id = ? AND al.deleted_at IS NULL ${a.scope === 'ALBUM' ? 'AND al.id = ?' : ''} GROUP BY al.id ORDER BY al.sort_order, al.id`,
                a.scope === 'ALBUM' ? [a.gallery.id, a.albumId] : [a.gallery.id],
            ),
            query(
                `SELECT m.category, COUNT(*) AS n FROM tblPhoto p JOIN tblPhotoMetadata m ON m.photo_id = p.id
                  WHERE p.gallery_id = ? AND p.deleted_at IS NULL AND p.is_rejected = 0 ${a.isStaff ? '' : 'AND p.is_published = 1'} AND m.category IS NOT NULL${scope.sql} GROUP BY m.category`,
                [a.gallery.id, ...scope.params],
            ),
            query(
                `SELECT COUNT(*) AS photos, MAX(p.id) AS latest_id FROM tblPhoto p
                  WHERE p.gallery_id = ? AND p.deleted_at IS NULL AND p.is_rejected = 0 AND p.preview_key IS NOT NULL ${a.isStaff ? '' : 'AND p.is_published = 1'}${scope.sql}`,
                [a.gallery.id, ...scope.params],
            ),
        ]);
        const pricing = await getSetting('pricing');
        const studio = await getSetting('studio');
        let coverKey = a.gallery.cover_key ?? null;
        if (!coverKey) {
            const coverPhoto = await queryOne<{ thumb_key: string | null; preview_key: string | null }>(
                `SELECT thumb_key, preview_key FROM tblPhoto
                  WHERE gallery_id = ? AND deleted_at IS NULL AND is_rejected = 0 AND is_published = 1
                    AND (thumb_key IS NOT NULL OR preview_key IS NOT NULL)
                  ORDER BY (id = ?) DESC, id LIMIT 1`,
                [a.gallery.id, a.gallery.cover_photo_id ?? 0],
            );
            coverKey = coverPhoto?.preview_key ?? coverPhoto?.thumb_key ?? null;
        }
        const coverUrl = coverKey ? await storage.signedUrl(coverKey) : null;
        ok(res, {
            id: a.gallery.id,
            title: a.gallery.title,
            description: a.gallery.description,
            status: a.gallery.status,
            eventId: a.gallery.event_id,
            eventTitle: a.gallery.event_title,
            eventDate: a.gallery.event_date,
            eventVenue: a.gallery.event_venue ?? null,
            coverUrl,
            eventStatus: a.gallery.event_status,
            isLive: a.gallery.status === 'LIVE',
            watermark: !!a.gallery.watermark_enabled,
            allowDownload: !!a.gallery.allow_download,
            expiresAt: a.gallery.expires_at,
            scope: a.scope,
            isOwner: a.isOwner,
            isStaff: a.isStaff,
            signedIn: !!req.user,
            photoCount: Number(stats[0]?.photos ?? 0),
            latestPhotoId: stats[0]?.latest_id ?? null,
            albums,
            categories,
            faceSearch: await faceSearchEnabled(),
            phoneVerification: a.requirePhoneVerification,
            phoneVerified: a.phoneVerified || a.isOwner || a.isStaff,
            selection: await selections.mySelectionState(a, req.user),
            pricing: {
                photoDownload: a.gallery.photo_price ?? pricing.photoDownload,
                prints: pricing.prints,
                frames: pricing.frames,
                canvas: pricing.canvas,
                courierFee: pricing.courierFee,
                currency: 'INR',
            },
            studio: { name: studio.name, phone: studio.phone, whatsapp: studio.whatsapp },
        });
    }),
);

router.get(
    '/:galleryId/photos',
    validate(gParams, 'params'),
    validate(
        z.object({
            page: z.coerce.number().int().min(1).default(1),
            pageSize: z.coerce.number().int().min(1).max(200).default(60),
            albumId: z.coerce.number().int().positive().optional(),
            view: z.enum(['all', 'favourites', 'selected', 'purchased']).default('all'),
            category: z.enum(['SINGLE', 'COUPLE', 'FAMILY', 'GROUP', 'OTHER']).optional(),
            tag: z.string().trim().max(40).optional(),
            since: z.coerce.number().int().min(0).optional(),
        }),
        'query',
    ),
    asyncHandler(async (req, res) => {
        ok(res, await listGalleryPhotos(await access(req), req.user, req.query as never));
    }),
);

router.get(
    '/:galleryId/photos/:photoId',
    validate(photoParams, 'params'),
    asyncHandler(async (req, res) => {
        ok(res, await openGalleryPhoto(await access(req), req.user, Number(req.params.photoId), clientIp(req)));
    }),
);

router.post(
    '/:galleryId/photos/:photoId/favourite',
    validate(photoParams, 'params'),
    validate(z.object({ on: z.boolean() })),
    asyncHandler(async (req, res) => {
        const user = requireUser(req);
        ok(res, await selections.toggleFavourite(await access(req), user, Number(req.params.photoId), req.body.on), req.body.on ? 'Added to favourites' : 'Removed from favourites');
    }),
);

router.post(
    '/:galleryId/photos/:photoId/select',
    validate(photoParams, 'params'),
    validate(z.object({ on: z.boolean() })),
    asyncHandler(async (req, res) => {
        const user = requireUser(req);
        ok(res, await selections.toggleSelection(await access(req), user, Number(req.params.photoId), req.body.on), req.body.on ? 'Selected for album' : 'Removed from selection');
    }),
);

router.post(
    '/:galleryId/photos/:photoId/comments',
    validate(photoParams, 'params'),
    validate(z.object({ body: z.string().trim().min(1).max(1000) })),
    asyncHandler(async (req, res) => {
        const user = requireUser(req);
        created(res, await selections.addComment(await access(req), user, Number(req.params.photoId), req.body.body, auditCtx(req)), 'Comment added');
    }),
);

router.delete(
    '/:galleryId/comments/:commentId',
    validate(gParams.extend({ commentId: z.coerce.number().int().positive() }), 'params'),
    asyncHandler(async (req, res) => {
        await selections.deleteComment(requireUser(req), Number(req.params.commentId));
        ok(res, null, 'Comment deleted');
    }),
);

router.post(
    '/:galleryId/selection/submit',
    validate(gParams, 'params'),
    validate(z.object({ note: optionalText(1000) })),
    asyncHandler(async (req, res) => {
        const user = requireUser(req);
        const a = await access(req);
        if (!a.isOwner) throw forbidden('Only the event owner can submit the album selection.');
        ok(res, await selections.submitSelection(a.gallery.event_id, user, req.body.note ?? null, auditCtx(req)), 'Selection submitted to the studio');
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

router.post(
    '/:galleryId/orders',
    validate(gParams, 'params'),
    validate(
        z.object({
            type: z.enum(['PHOTO_DOWNLOAD', 'PRINT', 'FRAME', 'CANVAS']),
            photoIds: z.array(z.coerce.number().int().positive()).max(500).optional(),
            items: z.array(z.object({ photoId: z.coerce.number().int().positive(), size: z.string().trim().min(1).max(30), quantity: z.coerce.number().int().min(1).max(50) })).max(100).optional(),
            deliveryMethod: z.enum(['PICKUP', 'COURIER']).optional(),
            shippingAddress: address.nullable().optional(),
            couponCode: optionalText(40),
            notes: optionalText(500),
        }),
    ),
    asyncHandler(async (req, res) => {
        const user = requireUser(req);
        if (!user.customerId) throw forbidden('Sign in with a customer account to buy photos.');
        created(res, await createOrder(req.body, user, await access(req), auditCtx(req)), 'Order created');
    }),
);

router.post(
    '/:galleryId/phone/claim',
    otpLimiter,
    validate(gParams, 'params'),
    validate(z.object({ phone: z.string().trim().min(8).max(20) })),
    asyncHandler(async (req, res) => {
        if (!req.gallery) throw unauthorized('Scan the QR code again to open this gallery.');
        const a = await resolveAccess(Number(req.params.galleryId), req.user, req.gallery);
        const claimed = await claimEventCustomer(Number(a.gallery.event_id), Number(a.gallery.id), req.body.phone);
        const session = signGallerySession({ ...req.gallery, customerPhone: claimed.phone });
        ok(res, { ...claimed, session }, 'Phone accepted');
    }),
);

router.post(
    '/:galleryId/phone/request',
    validate(gParams, 'params'),
    validate(z.object({ phone: z.string().trim().min(10).max(20) })),
    asyncHandler(async (req, res) => {
        const a = await resolveAccess(Number(req.params.galleryId), req.user, req.gallery);
        ok(res, await requestEventOtp(a.gallery.event_id, a.gallery.id, req.body.phone), 'Code sent if the number can receive messages');
    }),
);

router.post(
    '/:galleryId/phone/verify',
    validate(gParams, 'params'),
    validate(z.object({ phone: z.string().trim().min(10).max(20), code: z.string().regex(/^\d{6}$/), consent: z.boolean().default(false) })),
    asyncHandler(async (req, res) => {
        if (!req.gallery) throw unauthorized('Scan the QR code again to open this gallery.');
        const a = await resolveAccess(Number(req.params.galleryId), req.user, req.gallery);
        const verified = await verifyEventOtp(Number(a.gallery.event_id), Number(a.gallery.id), req.body.phone, req.body.code, req.body.consent);
        const session = signGallerySession({ ...req.gallery, customerPhone: verified.phone });
        ok(res, { ...verified, session }, 'Phone verified for this event');
    }),
);

router.post(
    '/:galleryId/face-search',
    validate(gParams, 'params'),
    imageUpload.single('selfie'),
    asyncHandler(async (req, res) => {
        const a = await access(req);
        if (!(await faceSearchEnabled())) throw badRequest('Face search is not enabled for this studio.');
        if (!req.file) throw badRequest('Upload a clear selfie.', [{ field: 'selfie', message: 'Required' }]);
        const consent = req.body.consent === true || req.body.consent === 'true' || req.body.consent === '1';
        const proof = typeof req.body.proof === 'string' ? req.body.proof : typeof req.headers['x-event-phone'] === 'string' ? req.headers['x-event-phone'] : undefined;
        await assertFaceSearchAllowed(a.gallery.event_id, proof, consent, a.isOwner || a.isStaff);
        const ids = await searchBySelfie(a.gallery.event_id, req.file.buffer);
        if (!ids.length) return ok(res, { items: [], total: 0, page: 1, pageSize: 200, totalPages: 0 }, 'No matching photos found. Try a clearer, front-facing selfie.');
        ok(res, await listGalleryPhotos(a, req.user, { page: 1, pageSize: 200, ids }), 'Photos matched to your selfie');
    }),
);
export default router;

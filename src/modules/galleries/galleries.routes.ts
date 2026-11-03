// Developer by: Buildnexdev.in
// Devevloper : Nandhakumar@gmail.com
// Last Edited : 06-10-2026
import { Router } from 'express';
import { z } from 'zod';
import { execute, queryOne } from '../../db/pool.js';
import { qrDataUrl, qrPng } from '../../lib/qr.js';
import { authenticate, requirePermission } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import { decrypt } from '../../utils/crypto.js';
import { badRequest } from '../../utils/errors.js';
import { asyncHandler, created, ok } from '../../utils/http.js';
import { pageQuery } from '../../utils/pagination.js';
import { boolish, idParam, money, optionalText } from '../../utils/schemas.js';
import { auditCtx } from '../audit/audit.service.js';
import { assertEventAccess } from '../events/events.service.js';
import { reprocessGallery } from '../photos/photos.service.js';
import * as galleries from './galleries.service.js';

const sqlDateTime = z
    .string()
    .trim()
    .regex(/^\d{4}-\d{2}-\d{2}([ T]\d{2}:\d{2}(:\d{2})?)?$/, 'Use YYYY-MM-DD or YYYY-MM-DD HH:mm')
    .transform((v) => (v.length === 10 ? `${v} 23:59:59` : `${v.replace('T', ' ')}${v.length === 16 ? ':00' : ''}`));

const galleryIdParam = z.object({ id: z.coerce.number().int().positive() });
const tokenParams = galleryIdParam.extend({ tokenId: z.coerce.number().int().positive() });
const albumParams = galleryIdParam.extend({ albumId: z.coerce.number().int().positive() });
const albumBody = z.object({ name: z.string().trim().min(1).max(120), description: optionalText(500), sortOrder: z.coerce.number().int().min(0).max(9999).default(0) });

const router = Router();
router.use(authenticate);

/** Photographers can display the live event QR on a phone/tablet for guests to scan. */
router.get(
    '/:id/live-qr',
    validate(galleryIdParam, 'params'),
    asyncHandler(async (req, res) => {
        const g = await galleries.loadGallery(Number(req.params.id));
        await assertEventAccess(req.user!, g.event_id, 'work');
        const t = await queryOne<{ id: number; token_encrypted: string; expires_at: Date | null }>(
            `SELECT id, token_encrypted, expires_at FROM tblGalleryToken
              WHERE gallery_id = ? AND scope = 'EVENT' AND revoked_at IS NULL AND (expires_at IS NULL OR expires_at > UTC_TIMESTAMP()) AND (max_uses IS NULL OR use_count < max_uses)
              ORDER BY id DESC LIMIT 1`,
            [g.id],
        );
        if (!t) return ok(res, null, 'No active QR code for this gallery yet');
        const url = galleries.galleryUrl(decrypt(t.token_encrypted));
        ok(res, { tokenId: t.id, url, qr: await qrDataUrl(url, 768), expiresAt: t.expires_at, galleryStatus: g.status });
    }),
);

router.use(requirePermission('galleries.manage'));

router.get(
    '/',
    validate(pageQuery.extend({ status: z.enum(['DRAFT', 'LIVE', 'PUBLISHED', 'ARCHIVED']).optional() }), 'query'),
    asyncHandler(async (req, res) => {
        const q = req.query as any;
        if (req.user?.companyId) q.companyId = req.user.companyId;
        ok(res, await galleries.listGalleries(q));
    }),
);

router.get(
    '/qr',
    validate(pageQuery.extend({ state: z.enum(['ACTIVE', 'REVOKED', 'EXPIRED', 'EXHAUSTED']).optional() }), 'query'),
    asyncHandler(async (req, res) => {
        const q = req.query as any;
        if (req.user?.companyId) q.companyId = req.user.companyId;
        ok(res, await galleries.listQrCodes(q));
    }),
);

router.post(
    '/',
    validate(z.object({ eventId: z.coerce.number().int().positive(), title: z.string().trim().min(2).max(160) })),
    asyncHandler(async (req, res) => {
        created(res, await galleries.createGallery(req.body.eventId, req.body.title, auditCtx(req)), 'Gallery created');
    }),
);

router.get(
    '/:id',
    validate(idParam, 'params'),
    asyncHandler(async (req, res) => {
        ok(res, await galleries.getGalleryAdmin(Number(req.params.id), req.user?.companyId));
    }),
);

router.put(
    '/:id',
    validate(idParam, 'params'),
    validate(
        z.object({
            title: z.string().trim().min(2).max(160),
            description: optionalText(2000),
            status: z.enum(['DRAFT', 'LIVE', 'PUBLISHED', 'ARCHIVED']),
            watermarkEnabled: boolish,
            allowDownload: boolish,
            autoPublish: boolish,
            photoPrice: money.nullable().optional(),
            expiresAt: sqlDateTime.nullable().optional(),
        }),
    ),
    asyncHandler(async (req, res) => {
        const id = Number(req.params.id);
        const result = await galleries.updateGallery(id, req.body, auditCtx(req));
        if (result.watermarkChanged) {
            const { queued } = await reprocessGallery(id, auditCtx(req));
            return ok(res, result.gallery, `Gallery updated. Regenerating ${queued} preview(s) with the new watermark setting.`);
        }
        ok(res, result.gallery, 'Gallery updated');
    }),
);

router.post(
    '/:id/reprocess',
    validate(idParam, 'params'),
    asyncHandler(async (req, res) => {
        ok(res, await reprocessGallery(Number(req.params.id), auditCtx(req)), 'Previews are being regenerated');
    }),
);

router.put(
    '/:id/cover',
    validate(idParam, 'params'),
    validate(z.object({ photoId: z.coerce.number().int().positive() })),
    asyncHandler(async (req, res) => {
        const id = Number(req.params.id);
        const p = await queryOne('SELECT id FROM tblPhoto WHERE id = ? AND gallery_id = ? AND deleted_at IS NULL', [req.body.photoId, id]);
        if (!p) throw badRequest('Photo not found in this gallery.');
        await execute('UPDATE tblGallery SET cover_photo_id = ? WHERE id = ?', [req.body.photoId, id]);
        ok(res, null, 'Cover photo updated');
    }),
);

router.post(
    '/:id/albums',
    validate(idParam, 'params'),
    validate(albumBody),
    asyncHandler(async (req, res) => {
        created(res, await galleries.saveAlbum(Number(req.params.id), null, req.body, auditCtx(req)), 'Album created');
    }),
);

router.put(
    '/:id/albums/:albumId',
    validate(albumParams, 'params'),
    validate(albumBody),
    asyncHandler(async (req, res) => {
        ok(res, await galleries.saveAlbum(Number(req.params.id), Number(req.params.albumId), req.body, auditCtx(req)), 'Album updated');
    }),
);

router.delete(
    '/:id/albums/:albumId',
    validate(albumParams, 'params'),
    asyncHandler(async (req, res) => {
        await galleries.deleteAlbum(Number(req.params.id), Number(req.params.albumId), auditCtx(req));
        ok(res, null, 'Album deleted; its photos were moved to the main gallery and album QR codes revoked');
    }),
);

router.post(
    '/:id/qr',
    validate(idParam, 'params'),
    validate(
        z.object({
            scope: z.enum(['EVENT', 'ALBUM', 'PHOTO']).default('EVENT'),
            albumId: z.coerce.number().int().positive().nullable().optional(),
            photoId: z.coerce.number().int().positive().nullable().optional(),
            label: optionalText(80),
            expiresAt: sqlDateTime.nullable().optional(),
            maxUses: z.coerce.number().int().min(1).max(1_000_000).nullable().optional(),
        }),
    ),
    asyncHandler(async (req, res) => {
        created(res, await galleries.generateQr(Number(req.params.id), req.body, auditCtx(req)), 'QR code generated');
    }),
);

router.post(
    '/:id/qr/revoke-all',
    validate(idParam, 'params'),
    asyncHandler(async (req, res) => {
        const n = await galleries.revokeQr(Number(req.params.id), 'all', auditCtx(req));
        ok(res, { revoked: n }, `${n} QR code(s) revoked`);
    }),
);

router.get(
    '/:id/qr/:tokenId',
    validate(tokenParams, 'params'),
    asyncHandler(async (req, res) => {
        ok(res, await galleries.tokenQr(Number(req.params.id), Number(req.params.tokenId)));
    }),
);

router.get(
    '/:id/qr/:tokenId/png',
    validate(tokenParams, 'params'),
    asyncHandler(async (req, res) => {
        const { url } = await galleries.tokenQr(Number(req.params.id), Number(req.params.tokenId));
        const png = await qrPng(url, 1200);
        res.setHeader('Content-Type', 'image/png');
        res.setHeader('Content-Disposition', `attachment; filename="gallery-${req.params.id}-qr-${req.params.tokenId}.png"`);
        res.setHeader('Cache-Control', 'no-store');
        res.send(png);
    }),
);

router.post(
    '/:id/qr/:tokenId/revoke',
    validate(tokenParams, 'params'),
    asyncHandler(async (req, res) => {
        const n = await galleries.revokeQr(Number(req.params.id), Number(req.params.tokenId), auditCtx(req));
        ok(res, { revoked: n }, n ? 'QR code revoked' : 'QR code was already revoked');
    }),
);

router.post(
    '/:id/qr/:tokenId/regenerate',
    validate(tokenParams, 'params'),
    asyncHandler(async (req, res) => {
        created(res, await galleries.regenerateQr(Number(req.params.id), Number(req.params.tokenId), auditCtx(req)), 'QR code regenerated; the old code no longer works');
    }),
);

export default router;

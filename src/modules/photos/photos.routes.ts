// Developer by: Buildnexdev.in
// Devevloper : Nandhakumar@gmail.com
// Last Edited : 06-10-2026
import { Router } from 'express';
import { z } from 'zod';
import { imageUpload } from '../../lib/upload.js';
import { authenticate, hasPermission, requirePermission } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import { badRequest, forbidden } from '../../utils/errors.js';
import { asyncHandler, ok } from '../../utils/http.js';
import { boolish, idParam, optionalText } from '../../utils/schemas.js';
import { cullingSummary } from '../ai/ai.service.js';
import { auditCtx } from '../audit/audit.service.js';
import { assertEventAccess } from '../events/events.service.js';
import * as photos from './photos.service.js';

const CATEGORIES = ['SINGLE', 'COUPLE', 'FAMILY', 'GROUP', 'OTHER'] as const;
const ids = z.array(z.coerce.number().int().positive()).min(1).max(1000);

const router = Router();
router.use(authenticate);

const uploadMeta = z.object({
    eventId: z.coerce.number().int().positive(),
    albumId: z.coerce.number().int().positive().optional().nullable(),
    cameraLabel: optionalText(40),
    clientUploadIds: z
        .union([z.string(), z.array(z.string())])
        .optional()
        .transform((v, ctx) => {
            if (v === undefined) return undefined;
            if (Array.isArray(v)) return v;
            if (v.trim().startsWith('[')) {
                try {
                    const parsed: unknown = JSON.parse(v);
                    if (Array.isArray(parsed)) return parsed.map(String);
                } catch {
                    /* reported below */
                }
                ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Must be a JSON array of strings' });
                return z.NEVER;
            }
            return [v];
        }),
});

router.post(
    '/upload',
    requirePermission('photos.upload', 'photos.manage'),
    imageUpload.array('files', 50),
    validate(uploadMeta),
    asyncHandler(async (req, res) => {
        const files = (req.files as Express.Multer.File[] | undefined) ?? [];
        const results = await photos.uploadPhotos(files, req.body, req.user!, auditCtx(req));
        const failed = results.filter((r) => !r.ok).length;
        const message = failed ? `${results.length - failed} uploaded, ${failed} failed` : `${results.length} photo(s) uploaded`;
        ok(res, { results, uploaded: results.length - failed, failed }, message);
    }),
);

router.get(
    '/upload-status/:id',
    validate(idParam, 'params'),
    asyncHandler(async (req, res) => {
        const eventId = Number(req.params.id);
        await assertEventAccess(req.user!, eventId, 'work');
        ok(res, await photos.uploadStatus(eventId));
    }),
);

router.post(
    '/:id/retry',
    requirePermission('photos.upload', 'photos.manage'),
    validate(idParam, 'params'),
    asyncHandler(async (req, res) => {
        await photos.retryProcessing(Number(req.params.id), req.user!);
        ok(res, null, 'Photo queued for processing');
    }),
);

router.get(
    '/',
    validate(
        z.object({
            page: z.coerce.number().int().min(1).default(1),
            pageSize: z.coerce.number().int().min(1).max(200).default(60),
            eventId: z.coerce.number().int().positive().optional(),
            galleryId: z.coerce.number().int().positive().optional(),
            albumId: z.union([z.literal('none'), z.coerce.number().int().positive()]).optional(),
            status: z.enum(photos.PHOTO_STATUSES).optional(),
            published: boolish.optional(),
            rejected: boolish.optional(),
            trash: boolish.optional(),
            editorId: z.coerce.number().int().positive().optional(),
            search: z.string().trim().max(100).optional(),
            flag: z.enum(['blurry', 'duplicate', 'eyes_closed']).optional(),
            category: z.enum(CATEGORIES).optional(),
            selected: boolish.optional(),
        }),
        'query',
    ),
    asyncHandler(async (req, res) => {
        const q = req.query as unknown as photos.PhotoFilter;
        if (!hasPermission(req.user, 'photos.manage', 'galleries.manage')) {
            if (hasPermission(req.user, 'photos.edit') && !q.eventId) q.editorId = req.user!.id;
            else if (q.eventId && hasPermission(req.user, 'photos.upload', 'photos.edit', 'events.assigned')) await assertEventAccess(req.user!, q.eventId, 'work');
            else throw forbidden();
            if (q.trash) throw forbidden();
        }
        ok(res, await photos.listPhotos(q));
    }),
);

router.get(
    '/editor/queue',
    requirePermission('photos.edit'),
    validate(z.object({ status: z.enum(photos.PHOTO_STATUSES).optional() }), 'query'),
    asyncHandler(async (req, res) => {
        ok(res, await photos.editorQueue(req.user!.id, (req.query as { status?: photos.PhotoStatus }).status));
    }),
);

router.post(
    '/bulk',
    requirePermission('photos.manage'),
    validate(
        z.discriminatedUnion('action', [
            z.object({ ids, action: z.enum(['publish', 'unpublish', 'approve', 'reject', 'unreject', 'delete', 'restore', 'purge', 'reprocess', 'deliver']) }),
            z.object({ ids, action: z.literal('move'), albumId: z.coerce.number().int().positive().nullable() }),
            z.object({ ids, action: z.literal('status'), status: z.enum(photos.PHOTO_STATUSES) }),
        ]),
    ),
    asyncHandler(async (req, res) => {
        const { ids: photoIds, ...op } = req.body as { ids: number[] } & photos.BulkAction;
        const result = await photos.bulkUpdate(photoIds, op as photos.BulkAction, auditCtx(req));
        ok(res, result, `${result.affected} photo(s) updated`);
    }),
);

router.post(
    '/assign-editor',
    requirePermission('photos.manage', 'staff.assign'),
    validate(z.object({ ids, editorId: z.coerce.number().int().positive() })),
    asyncHandler(async (req, res) => {
        const r = await photos.assignEditor(req.body.ids, req.body.editorId, auditCtx(req));
        ok(res, r, `${r.assigned} photo(s) assigned for editing`);
    }),
);

router.put(
    '/tags',
    requirePermission('photos.manage', 'ai.use'),
    validate(z.object({ ids, tags: z.array(z.string().trim().min(1).max(40)).max(30), category: z.enum(CATEGORIES).nullable().optional() })),
    asyncHandler(async (req, res) => {
        await photos.setPhotoTags(req.body.ids, req.body.tags, req.body.category, auditCtx(req));
        ok(res, null, 'Tags updated');
    }),
);

router.get(
    '/culling/:id',
    requirePermission('photos.manage', 'ai.use', 'photos.edit'),
    validate(idParam, 'params'),
    asyncHandler(async (req, res) => {
        await assertEventAccess(req.user!, Number(req.params.id), 'work');
        ok(res, await cullingSummary(Number(req.params.id)));
    }),
);

router.get(
    '/:id',
    validate(idParam, 'params'),
    asyncHandler(async (req, res) => {
        ok(res, await photos.getPhotoForStaff(Number(req.params.id), req.user!));
    }),
);

router.post(
    '/:id/edited',
    requirePermission('photos.edit', 'photos.manage'),
    validate(idParam, 'params'),
    imageUpload.single('file'),
    asyncHandler(async (req, res) => {
        if (!req.file) throw badRequest('Choose the edited image.', [{ field: 'file', message: 'Required' }]);
        ok(res, await photos.uploadEdited(Number(req.params.id), req.file, req.user!, auditCtx(req)), 'Edited photo uploaded');
    }),
);

export default router;

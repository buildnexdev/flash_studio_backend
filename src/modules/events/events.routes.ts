import { Router } from 'express';
import { z } from 'zod';
import { authenticate, hasPermission, requirePermission } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import { asyncHandler, created, ok } from '../../utils/http.js';
import { forbidden } from '../../utils/errors.js';
import { pageQuery } from '../../utils/pagination.js';
import { hhmm, idParam, optionalText, ymd } from '../../utils/schemas.js';
import { auditCtx } from '../audit/audit.service.js';
import * as events from './events.service.js';

const eventBody = z.object({
    customerId: z.coerce.number().int().positive(),
    bookingId: z.coerce.number().int().positive().optional().nullable(),
    title: z.string().trim().min(2).max(160),
    eventType: z.string().trim().min(2).max(60),
    eventDate: ymd,
    startTime: hhmm,
    endTime: hhmm,
    venue: optionalText(255),
    notes: optionalText(3000),
});

const router = Router();
router.use(authenticate);

router.get(
    '/',
    validate(pageQuery.extend({ status: z.enum(events.EVENT_STATUSES).optional(), from: ymd.optional(), to: ymd.optional(), customerId: z.coerce.number().int().optional() }), 'query'),
    asyncHandler(async (req, res) => {
        const q = req.query as unknown as events.EventFilter;
        if (!hasPermission(req.user, 'events.view', 'events.manage')) {
            if (hasPermission(req.user, 'events.assigned', 'photos.upload', 'photos.edit')) q.assignedTo = req.user!.id;
            else if (req.user!.customerId) q.customerId = req.user!.customerId;
            else throw forbidden();
        }
        ok(res, await events.listEvents(q));
    }),
);

router.get(
    '/mine',
    requirePermission('events.assigned', 'photos.upload', 'photos.edit'),
    validate(z.object({ scope: z.enum(['upcoming', 'all']).default('all') }), 'query'),
    asyncHandler(async (req, res) => {
        ok(res, await events.myAssignments(req.user!.id, (req.query as { scope: 'upcoming' | 'all' }).scope));
    }),
);

router.post(
    '/',
    requirePermission('events.manage'),
    validate(eventBody),
    asyncHandler(async (req, res) => {
        const id = await events.createEvent(req.body, auditCtx(req));
        created(res, await events.getEvent(id), 'Event created');
    }),
);

router.get(
    '/:id',
    validate(idParam, 'params'),
    asyncHandler(async (req, res) => {
        const id = Number(req.params.id);
        await events.assertEventAccess(req.user!, id, 'view');
        const event = await events.getEvent(id);
        if (!hasPermission(req.user, 'events.view', 'events.manage', 'events.assigned')) {
            // Customers see their event without internal staff/revenue detail
            const { staff, revenue, notes, ...rest } = event as Record<string, unknown>;
            return ok(res, rest);
        }
        ok(res, event);
    }),
);

router.put(
    '/:id',
    requirePermission('events.manage'),
    validate(idParam, 'params'),
    validate(eventBody),
    asyncHandler(async (req, res) => {
        ok(res, await events.updateEvent(Number(req.params.id), req.body, auditCtx(req)), 'Event updated');
    }),
);

router.delete(
    '/:id',
    requirePermission('events.manage'),
    validate(idParam, 'params'),
    asyncHandler(async (req, res) => {
        await events.deleteEvent(Number(req.params.id), auditCtx(req));
        ok(res, null, 'Event deleted');
    }),
);

const ACTION_MESSAGES: Record<events.EventAction, string> = {
    start: 'Event is live',
    stop: 'Shoot stopped, uploads continue',
    process: 'Event moved to processing',
    complete: 'Event completed and gallery published',
    cancel: 'Event cancelled',
    reopen: 'Event reopened',
};

for (const action of Object.keys(ACTION_MESSAGES) as events.EventAction[]) {
    router.post(
        `/:id/${action}`,
        validate(idParam, 'params'),
        asyncHandler(async (req, res) => {
            ok(res, await events.transitionEvent(Number(req.params.id), action, req.user!, auditCtx(req)), ACTION_MESSAGES[action]);
        }),
    );
}

router.post(
    '/:id/staff',
    requirePermission('staff.assign'),
    validate(idParam, 'params'),
    validate(
        z.object({
            userId: z.coerce.number().int().positive(),
            role: z.enum(['PHOTOGRAPHER', 'ASSISTANT', 'EDITOR', 'VIDEOGRAPHER', 'MANAGER', 'DELIVERY']).default('PHOTOGRAPHER'),
            cameraLabel: optionalText(40),
        }),
    ),
    asyncHandler(async (req, res) => {
        ok(res, await events.assignStaff(Number(req.params.id), req.body, auditCtx(req)), 'Staff assigned');
    }),
);

router.delete(
    '/:id/staff/:assignmentId',
    requirePermission('staff.assign'),
    validate(z.object({ id: z.coerce.number().int().positive(), assignmentId: z.coerce.number().int().positive() }), 'params'),
    asyncHandler(async (req, res) => {
        ok(res, await events.removeStaff(Number(req.params.id), Number(req.params.assignmentId), auditCtx(req)), 'Staff removed');
    }),
);

router.put(
    '/:id/my-task',
    validate(idParam, 'params'),
    validate(z.object({ status: z.enum(['ACCEPTED', 'IN_PROGRESS', 'DONE']) })),
    asyncHandler(async (req, res) => {
        await events.updateMyTask(Number(req.params.id), req.user!.id, req.body.status, auditCtx(req));
        ok(res, null, 'Task updated');
    }),
);

export default router;

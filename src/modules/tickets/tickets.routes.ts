import { Router, type Request } from 'express';
import { z } from 'zod';
import { authenticate } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import { asyncHandler, created, ok } from '../../utils/http.js';
import { idParam } from '../../utils/schemas.js';
import { audit, auditCtx } from '../audit/audit.service.js';
import * as tickets from './tickets.service.js';

const router = Router();
router.use(authenticate);

const status = z.enum(['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED']);
const category = z.enum(['GENERAL', 'ORDER', 'PHOTO_REQUEST', 'EVENT', 'PAYMENT', 'OTHER']);
const priority = z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']);
const ticketInput = z.object({
    subject: z.string().trim().min(3).max(180),
    category,
    priority,
    message: z.string().trim().min(3).max(5000),
    status: status.optional(),
});
const actorOf = (req: Request): tickets.TicketActor => ({
    id: req.user!.id,
    customerId: req.user!.customerId,
    isSuperAdmin: req.user!.roles.includes('SUPER_ADMIN'),
    isStaff: !req.user!.roles.includes('CUSTOMER'),
});

router.get(
    '/',
    validate(
        z.object({
            page: z.coerce.number().int().min(1).default(1),
            pageSize: z.coerce.number().int().min(1).max(100).default(20),
            search: z.string().trim().max(100).optional(),
            status: status.optional(),
        }),
        'query',
    ),
    asyncHandler(async (req, res) => {
        ok(res, await tickets.listTickets(actorOf(req), req.query as unknown as tickets.TicketFilter));
    }),
);

router.get(
    '/:id',
    validate(idParam, 'params'),
    asyncHandler(async (req, res) => {
        ok(res, await tickets.getTicket(Number(req.params.id), actorOf(req)));
    }),
);

router.post(
    '/',
    validate(ticketInput),
    asyncHandler(async (req, res) => {
        const { status: _status, ...input } = req.body as tickets.TicketInput;
        const ticket = await tickets.createTicket(input, actorOf(req));
        await audit(auditCtx(req), 'TICKET_CREATED', 'tickets', ticket.id);
        created(res, ticket, 'Ticket created');
    }),
);

router.put(
    '/:id',
    validate(idParam, 'params'),
    validate(ticketInput),
    asyncHandler(async (req, res) => {
        const ticket = await tickets.updateTicket(Number(req.params.id), req.body, actorOf(req));
        await audit(auditCtx(req), 'TICKET_UPDATED', 'tickets', ticket.id, { status: ticket.status });
        ok(res, ticket, 'Ticket updated');
    }),
);

router.delete(
    '/:id',
    validate(idParam, 'params'),
    asyncHandler(async (req, res) => {
        const id = Number(req.params.id);
        await tickets.deleteTicket(id, actorOf(req));
        await audit(auditCtx(req), 'TICKET_DELETED', 'tickets', id);
        ok(res, { id }, 'Ticket deleted');
    }),
);

export default router;

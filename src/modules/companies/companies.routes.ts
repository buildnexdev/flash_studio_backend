import { Router } from 'express';
import { z } from 'zod';
import { authenticate, hasRole } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import { forbidden } from '../../utils/errors.js';
import { asyncHandler, created, ok } from '../../utils/http.js';
import { email, idParam, optionalText, password, phone } from '../../utils/schemas.js';
import {
    createCompany,
    deleteCompanyRequest,
    listCompanies,
    listCompanyRequests,
    setCompanyStatus,
    updateCompany,
    updateCompanyRequestStatus,
} from './companies.service.js';

const router = Router();
router.use(authenticate);
router.use((req, _res, next) => {
    if (!hasRole(req.user, 'SUPER_ADMIN')) return next(forbidden('Only a super admin can manage studios.'));
    next();
});

router.get('/', asyncHandler(async (_req, res) => {
    ok(res, await listCompanies());
}));

router.get('/requests', asyncHandler(async (_req, res) => {
    ok(res, await listCompanyRequests());
}));

router.put(
    '/requests/:id',
    validate(idParam, 'params'),
    validate(z.object({ status: z.enum(['PENDING', 'CONTACTED', 'APPROVED', 'REJECTED']) })),
    asyncHandler(async (req, res) => {
        ok(res, await updateCompanyRequestStatus(Number(req.params.id), req.body.status), 'Request updated');
    }),
);

router.delete(
    '/requests/:id',
    validate(idParam, 'params'),
    asyncHandler(async (req, res) => {
        ok(res, await deleteCompanyRequest(Number(req.params.id)), 'Request removed');
    }),
);

router.post(
    '/',
    validate(
        z.object({
            name: z.string().trim().min(2, 'Enter the company name').max(120),
            ownerName: z.string().trim().min(2, 'Enter the owner/contact person name').max(120),
            ownerEmail: email,
            ownerPassword: password,
            phone: phone.optional().nullable(),
            address: optionalText(300),
            city: optionalText(80),
            tagline: optionalText(200),
            notes: optionalText(2000),
            modules: z.array(z.string()).optional(),
            requestId: z.number().int().positive().optional().nullable(),
            logoUrl: z.string().trim().optional().nullable(),
        }),
    ),
    asyncHandler(async (req, res) => {
        const studio = await createCompany(req.body);
        created(res, studio, `Studio created. Database ${studio.databaseName} is ready.`);
    }),
);

router.put(
    '/:id',
    validate(idParam, 'params'),
    validate(
        z.object({
            status: z.enum(['ACTIVE', 'SUSPENDED']).optional(),
            logoUrl: z.string().trim().optional().nullable(),
            name: z.string().trim().optional(),
            phone: phone.optional().nullable(),
            address: optionalText(300),
        }),
    ),
    asyncHandler(async (req, res) => {
        ok(res, await updateCompany(Number(req.params.id), req.body), 'Studio updated');
    }),
);

export default router;

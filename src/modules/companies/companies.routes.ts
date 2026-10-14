// Developer by: Buildnexdev.in
// Last Edited : 14-10-2026
import { Router } from 'express';
import { z } from 'zod';
import { authenticate, hasRole } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import { forbidden } from '../../utils/errors.js';
import { asyncHandler, created, ok } from '../../utils/http.js';
import { email, optionalText, password, phone } from '../../utils/schemas.js';
import { createCompany, listCompanies, setCompanyStatus } from './companies.service.js';

const router = Router();
router.use(authenticate);
router.use((req, _res, next) => {
    if (!hasRole(req.user, 'SUPER_ADMIN')) return next(forbidden('Only a super admin can manage studios.'));
    next();
});

router.get('/', asyncHandler(async (_req, res) => {
    ok(res, await listCompanies());
}));

router.post(
    '/',
    validate(
        z.object({
            name: z.string().trim().min(2).max(120),
            ownerName: z.string().trim().min(2).max(120),
            ownerEmail: email,
            ownerPassword: password,
            phone: phone.optional().nullable(),
            city: optionalText(80),
            tagline: optionalText(200),
        }),
    ),
    asyncHandler(async (req, res) => {
        const studio = await createCompany(req.body);
        created(res, studio, `Studio created. Database ${studio.databaseName} is ready.`);
    }),
);

router.put(
    '/:id',
    validate(z.object({ id: z.coerce.number().int().positive() }), 'params'),
    validate(z.object({ status: z.enum(['ACTIVE', 'SUSPENDED']) })),
    asyncHandler(async (req, res) => {
        ok(res, await setCompanyStatus(Number(req.params.id), req.body.status), 'Studio updated');
    }),
);

export default router;

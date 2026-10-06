// Developer by: Buildnexdev.in
// Devevloper : Nandhakumar@gmail.com
// Last Edited : 06-10-2026
import { Router } from 'express';
import { z } from 'zod';
import { PERMISSIONS, ROLES, type Permission, type RoleCode } from '../../config/rbac.js';
import { authenticate, requirePermission } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import { asyncHandler, created, ok } from '../../utils/http.js';
import { pageQuery } from '../../utils/pagination.js';
import { email, idParam, optionalText, password, phone } from '../../utils/schemas.js';
import { auditCtx } from '../audit/audit.service.js';
import * as users from './users.service.js';

const roleEnum = z.enum(ROLES);

const userBody = z.object({
    name: z.string().trim().min(2).max(120),
    email,
    phone: phone.optional().nullable(),
    password: password.optional(),
    roles: z.array(roleEnum).min(1, 'Choose at least one role'),
    status: z.enum(['ACTIVE', 'INACTIVE', 'LOCKED']).default('ACTIVE'),
    designation: optionalText(80),
    department: optionalText(80),
    cameraGear: optionalText(255),
    specialties: optionalText(255),
    software: optionalText(255),
});

const router = Router();
router.use(authenticate);

router.get(
    '/',
    requirePermission('users.manage', 'staff.manage'),
    validate(pageQuery.extend({ role: roleEnum.optional(), status: z.enum(['ACTIVE', 'INACTIVE', 'LOCKED']).optional(), staffOnly: z.coerce.boolean().optional() }), 'query'),
    asyncHandler(async (req, res) => {
        ok(res, await users.listUsers(req.query as unknown as users.UserFilter));
    }),
);

router.get(
    '/assignable',
    requirePermission('staff.assign', 'events.manage'),
    validate(z.object({ role: roleEnum.optional() }), 'query'),
    asyncHandler(async (req, res) => {
        ok(res, await users.assignableStaff((req.query as { role?: RoleCode }).role));
    }),
);

router.get(
    '/roles',
    requirePermission('users.manage', 'roles.manage'),
    asyncHandler(async (_req, res) => {
        ok(res, await users.listRoles());
    }),
);

router.put(
    '/roles/:code/permissions',
    requirePermission('roles.manage'),
    validate(z.object({ code: roleEnum }), 'params'),
    validate(z.object({ permissions: z.array(z.enum(Object.keys(PERMISSIONS) as [Permission, ...Permission[]])) })),
    asyncHandler(async (req, res) => {
        ok(res, await users.setRolePermissions(req.params.code as RoleCode, req.body.permissions, auditCtx(req)), 'Permissions updated');
    }),
);

router.get(
    '/:id',
    requirePermission('users.manage', 'staff.manage'),
    validate(idParam, 'params'),
    asyncHandler(async (req, res) => {
        ok(res, await users.getUser(Number(req.params.id)));
    }),
);

router.post(
    '/',
    requirePermission('users.manage', 'staff.manage'),
    validate(userBody),
    asyncHandler(async (req, res) => {
        created(res, await users.createUser(req.body, req.user!.roles, auditCtx(req)), 'User created');
    }),
);

router.put(
    '/:id',
    requirePermission('users.manage', 'staff.manage'),
    validate(idParam, 'params'),
    validate(userBody),
    asyncHandler(async (req, res) => {
        ok(res, await users.updateUser(Number(req.params.id), req.body, req.user!, auditCtx(req)), 'User updated');
    }),
);

router.delete(
    '/:id',
    requirePermission('users.manage'),
    validate(idParam, 'params'),
    asyncHandler(async (req, res) => {
        await users.deleteUser(Number(req.params.id), req.user!, auditCtx(req));
        ok(res, null, 'User deleted');
    }),
);

export default router;

// Developer by: Buildnexdev.in
// Devevloper : Nandhakumar@gmail.com
// Last Edited : 06-10-2026
import { Router, type Request } from 'express';
import { z } from 'zod';
import { documentUpload } from '../../lib/upload.js';
import { badRequest } from '../../utils/errors.js';
import { PERMISSIONS, ROLES, type Permission, type RoleCode } from '../../config/rbac.js';
import { authenticate, requireAdmin, requirePermission } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import { asyncHandler, created, ok } from '../../utils/http.js';
import { pageQuery } from '../../utils/pagination.js';
import { email, idParam, optionalText, password, phone } from '../../utils/schemas.js';
import { auditCtx } from '../audit/audit.service.js';
import * as users from './users.service.js';

const roleEnum = z.enum(ROLES);

const text = (max: number) => z.string().trim().max(max).optional();
const addressBody = z.object({ line1: text(160), line2: text(160), city: text(80), state: text(80), pincode: text(12), country: text(60) });
const profileBody = z.object({
    personal: z.object({ dob: text(10), gender: text(20), bloodGroup: text(5), joinedOn: text(10), emergencyName: text(120), emergencyPhone: text(20) }).optional(),
    address: addressBody.optional(),
    permanentAddress: addressBody.extend({ same: z.boolean().optional() }).optional(),
    education: z.array(z.object({ qualification: text(120), institution: text(160), field: text(120), year: text(10), grade: text(20) })).max(20).optional(),
    experience: z.array(z.object({ company: text(160), role: text(120), from: text(10), to: text(10), current: z.boolean().optional(), description: text(1000) })).max(30).optional(),
});

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
    profile: profileBody.optional(),
});

const router = Router();
router.use(authenticate);

router.get(
    '/',
    requirePermission('users.manage', 'staff.manage'),
    validate(pageQuery.extend({ role: roleEnum.optional(), status: z.enum(['ACTIVE', 'INACTIVE', 'LOCKED']).optional(), staffOnly: z.coerce.boolean().optional() }), 'query'),
    asyncHandler(async (req, res) => {
        const filter = req.query as unknown as users.UserFilter;
        if (!req.user!.roles.includes('SUPER_ADMIN')) filter.companyId = req.user!.companyId ?? -1;
        ok(res, await users.listUsers(filter));
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
        ok(res, await users.setRolePermissions(req.params.code as RoleCode, req.body.permissions, req.user!.roles, auditCtx(req)), 'Permissions updated');
    }),
);

router.put(
    '/:id/role',
    requirePermission('users.manage'),
    validate(idParam, 'params'),
    validate(z.object({ role: roleEnum })),
    asyncHandler(async (req, res) => {
        ok(
            res,
            await users.assignUserRole(Number(req.params.id), req.body.role, { id: req.user!.id, roles: req.user!.roles, companyId: req.user!.companyId }, auditCtx(req)),
            'Access updated',
        );
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

const actorOf = (req: Request) => ({ id: req.user!.id, roles: req.user!.roles, companyId: req.user!.companyId });

const pageAccessBody = z.object({
    role: roleEnum.optional(),
    pages: z.array(z.object({ key: z.string().max(40), view: z.boolean(), add: z.boolean(), edit: z.boolean(), delete: z.boolean() })).max(100),
});

router.get(
    '/access/:id',
    requireAdmin,
    validate(idParam, 'params'),
    asyncHandler(async (req, res) => {
        ok(res, await users.getPageAccess(Number(req.params.id), actorOf(req)));
    }),
);

router.put(
    '/access/:id',
    requireAdmin,
    validate(idParam, 'params'),
    validate(pageAccessBody),
    asyncHandler(async (req, res) => {
        ok(res, await users.setPageAccess(Number(req.params.id), req.body, actorOf(req), auditCtx(req)), 'Access updated');
    }),
);
const documentParams = z.object({ id: z.coerce.number().int().positive(), docId: z.coerce.number().int().positive() });

router.get(
    '/:id/documents',
    requirePermission('users.manage', 'staff.manage'),
    validate(idParam, 'params'),
    asyncHandler(async (req, res) => {
        ok(res, await users.listDocuments(Number(req.params.id), actorOf(req)));
    }),
);

router.post(
    '/:id/documents',
    requirePermission('users.manage', 'staff.manage'),
    validate(idParam, 'params'),
    documentUpload.single('file'),
    validate(z.object({ docType: z.enum(users.DOCUMENT_TYPES) })),
    asyncHandler(async (req, res) => {
        if (!req.file) throw badRequest('Choose a file to upload.', [{ field: 'file', message: 'Required' }]);
        created(res, await users.addDocument(Number(req.params.id), req.body.docType, req.file, actorOf(req), auditCtx(req)), 'Document uploaded');
    }),
);

router.delete(
    '/:id/documents/:docId',
    requirePermission('users.manage', 'staff.manage'),
    validate(documentParams, 'params'),
    asyncHandler(async (req, res) => {
        await users.removeDocument(Number(req.params.id), Number(req.params.docId), actorOf(req), auditCtx(req));
        ok(res, null, 'Document removed');
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

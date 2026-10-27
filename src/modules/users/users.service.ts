// Developer by: Buildnexdev.in
// Devevloper : Nandhakumar@gmail.com
// Last Edited : 06-10-2026
import { randomUUID } from 'node:crypto';
import { PERMISSIONS, ROLE_LEVEL, ROLES, roleRank, STAFF_ROLES, type Permission, type RoleCode } from '../../config/rbac.js';
import { execute, primaryCompanyId, query, queryOne, withTransaction } from '../../db/pool.js';
import { storage } from '../../lib/storage.js';
import { PAGE_KEYS, PAGES, roleRule, type PageRule } from '../../config/pages.js';
import { invalidateUserCache, loadPageRules } from '../../middleware/auth.js';
import { badRequest, conflict, forbidden, notFound } from '../../utils/errors.js';
import { likeTerm, offsetOf, orderBy, paged } from '../../utils/pagination.js';
import { audit, type AuditContext } from '../audit/audit.service.js';
import { hashPassword } from '../auth/auth.service.js';

export interface UserFilter {
    page: number;
    pageSize: number;
    search?: string;
    role?: RoleCode;
    status?: string;
    staffOnly?: boolean;
    companyId?: number;
    sort?: string;
    order: 'asc' | 'desc';
}

export async function listUsers(f: UserFilter) {
    const where = ['u.deleted_at IS NULL'];
    const params: unknown[] = [];
    if (f.search) {
        where.push('(u.name LIKE ? OR u.email LIKE ? OR u.phone LIKE ?)');
        const t = likeTerm(f.search);
        params.push(t, t, t);
    }
    if (f.status) { where.push('u.status = ?'); params.push(f.status); }
    if (f.role) { where.push('EXISTS (SELECT 1 FROM tblUserRole ur JOIN tblRole r ON r.id = ur.role_id WHERE ur.user_id = u.id AND r.code = ?)'); params.push(f.role); }
    if (f.staffOnly) { where.push("EXISTS (SELECT 1 FROM tblUserRole ur JOIN tblRole r ON r.id = ur.role_id WHERE ur.user_id = u.id AND r.code <> 'CUSTOMER')"); }
    if (f.companyId) { where.push('u.company_id = ?'); params.push(f.companyId); }
    const w = where.join(' AND ');
    const total = (await queryOne<{ n: number }>(`SELECT COUNT(*) AS n FROM tblUser u WHERE ${w}`, params))?.n ?? 0;
    const items = await query(
        `SELECT u.id, u.company_id, u.role_id, u.name, u.email, u.phone, u.status, u.last_login_at, u.created_at,
                (SELECT GROUP_CONCAT(r.code ORDER BY r.id) FROM tblUserRole ur JOIN tblRole r ON r.id = ur.role_id WHERE ur.user_id = u.id) AS roles,
                s.designation, s.department, p.camera_gear, p.specialties AS photographer_specialties, e.software,
                COALESCE(IF(JSON_VALID(u.staff_profile), NULLIF(JSON_UNQUOTE(JSON_EXTRACT(u.staff_profile, '$.personal.joinedOn')), 'null'), NULL), DATE_FORMAT(s.joined_on, '%Y-%m-%d')) AS joined_on,
                IF(JSON_VALID(u.staff_profile), NULLIF(JSON_UNQUOTE(JSON_EXTRACT(u.staff_profile, '$.address.city')), 'null'), NULL) AS city,
                (SELECT COUNT(*) FROM tblStaffDocument d WHERE d.user_id = u.id) AS documents,
                (SELECT COUNT(*) FROM tblUserPageAccess pa WHERE pa.user_id = u.id) AS custom_pages
           FROM tblUser u
           LEFT JOIN tblStaff s ON s.user_id = u.id
           LEFT JOIN tblPhotographer p ON p.user_id = u.id
           LEFT JOIN tblEditor e ON e.user_id = u.id
          WHERE ${w}
          ORDER BY ${orderBy(f.sort, { name: 'u.name', created: 'u.created_at', login: 'u.last_login_at' }, 'u.created_at', f.order)}
          LIMIT ? OFFSET ?`,
        [...params, f.pageSize, offsetOf(f)],
    );
    return paged(items.map((u) => ({ ...u, roles: u.roles ? String(u.roles).split(',') : [] })), total, f);
}

export interface StaffProfile {
    personal?: { dob?: string; gender?: string; bloodGroup?: string; joinedOn?: string; emergencyName?: string; emergencyPhone?: string; emergencyPhone2?: string; photoUrl?: string };
    address?: { line1?: string; line2?: string; city?: string; state?: string; pincode?: string; country?: string };
    permanentAddress?: { same?: boolean; line1?: string; line2?: string; city?: string; state?: string; pincode?: string; country?: string };
    education?: { qualification?: string; institution?: string; field?: string; year?: string; grade?: string }[];
    experience?: { company?: string; role?: string; from?: string; to?: string; current?: boolean; description?: string }[];
}

const parseProfile = (raw: unknown): StaffProfile => {
    if (typeof raw !== 'string' || !raw) return {};
    try {
        const v = JSON.parse(raw);
        return v && typeof v === 'object' ? (v as StaffProfile) : {};
    } catch {
        return {};
    }
};

export async function getUser(id: number) {
    const u = await queryOne<{ id: number; company_id: number | null; name: string; email: string | null; phone: string | null; status: string; staff_profile?: string | null }>(
        `SELECT u.id, u.company_id, u.role_id, u.name, u.email, u.phone, u.status, u.last_login_at, u.created_at, u.staff_profile,
                s.designation, s.department, s.joined_on, p.camera_gear, p.specialties AS photographer_specialties, p.day_rate, e.software, e.specialties AS editor_specialties
           FROM tblUser u LEFT JOIN tblStaff s ON s.user_id = u.id LEFT JOIN tblPhotographer p ON p.user_id = u.id LEFT JOIN tblEditor e ON e.user_id = u.id
          WHERE u.id = ? AND u.deleted_at IS NULL`,
        [id],
    );
    if (!u) throw notFound('User');
    const roles = await query<{ code: RoleCode }>('SELECT r.code FROM tblUserRole ur JOIN tblRole r ON r.id = ur.role_id WHERE ur.user_id = ?', [id]);
    const { staff_profile, ...rest } = u;
    return { ...rest, profile: parseProfile(staff_profile), roles: roles.map((r) => r.code) };
}

export interface StaffInput {
    name: string;
    email: string;
    phone?: string | null;
    password?: string;
    roles: RoleCode[];
    status?: 'ACTIVE' | 'INACTIVE' | 'LOCKED';
    designation?: string | null;
    department?: string | null;
    cameraGear?: string | null;
    specialties?: string | null;
    software?: string | null;
    /** Omitted keeps the stored profile (status toggles send only the core fields). */
    profile?: StaffProfile;
}

function guardRoles(actorRoles: RoleCode[], roles: RoleCode[]) {
    if (roles.includes('SUPER_ADMIN') && !actorRoles.includes('SUPER_ADMIN')) throw forbidden('Only a Super Admin can grant the Super Admin role.');
    for (const r of roles) if (!ROLES.includes(r)) throw badRequest(`Unknown role ${r}`);
}

async function syncProfiles(conn: Parameters<Parameters<typeof withTransaction>[0]>[0], userId: number, input: StaffInput) {
    const isStaff = input.roles.some((r) => STAFF_ROLES.includes(r));
    if (isStaff) {
        await execute(
            'INSERT INTO tblStaff (user_id, designation, department, joined_on) VALUES (?, ?, ?, CURDATE()) ON DUPLICATE KEY UPDATE designation = VALUES(designation), department = VALUES(department), is_active = 1',
            [userId, input.designation ?? null, input.department ?? null],
            conn,
        );
    }
    if (input.roles.includes('PHOTOGRAPHER')) {
        await execute('INSERT INTO tblPhotographer (user_id, camera_gear, specialties) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE camera_gear = VALUES(camera_gear), specialties = VALUES(specialties)', [userId, input.cameraGear ?? null, input.specialties ?? null], conn);
    }
    if (input.roles.includes('EDITOR_DESIGNER')) {
        await execute('INSERT INTO tblEditor (user_id, software, specialties) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE software = VALUES(software), specialties = VALUES(specialties)', [userId, input.software ?? null, input.specialties ?? null], conn);
    }
}

async function setRoles(conn: Parameters<Parameters<typeof withTransaction>[0]>[0], userId: number, roles: RoleCode[]) {
    await execute('DELETE FROM tblUserRole WHERE user_id = ?', [userId], conn);
    const ids = await query<{ id: number }>('SELECT id FROM tblRole WHERE code IN (?)', [roles], conn);
    for (const r of ids) await execute('INSERT INTO tblUserRole (user_id, role_id) VALUES (?, ?)', [userId, r.id], conn);
    const primary = await queryOne<{ id: number }>('SELECT id FROM tblRole WHERE code = ?', [roles[0]], conn);
    if (primary) await execute('UPDATE tblUser SET role_id = ? WHERE id = ?', [primary.id, userId], conn);
}

export async function createUser(input: StaffInput, actorRoles: RoleCode[], ctx: AuditContext) {
    guardRoles(actorRoles, input.roles);
    if (!input.password) throw badRequest('A password is required for new users.', [{ field: 'password', message: 'Required' }]);
    const dup = await queryOne('SELECT id FROM tblUser WHERE email = ? OR (? IS NOT NULL AND phone = ?)', [input.email, input.phone ?? null, input.phone ?? null]);
    if (dup) throw conflict('A user with this email or phone already exists.');
    const hash = await hashPassword(input.password);
    const id = await withTransaction(async (conn) => {
        const companyId = await primaryCompanyId(conn);
        const primaryRole = await queryOne<{ id: number }>('SELECT id FROM tblRole WHERE code = ?', [input.roles[0]], conn);
        if (!primaryRole) throw badRequest('A role is required.');
        const res = await execute(
            'INSERT INTO tblUser (company_id, role_id, name, email, phone, password_hash, status, staff_profile, email_verified_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, UTC_TIMESTAMP())',
            [companyId, primaryRole.id, input.name, input.email, input.phone ?? null, hash, input.status ?? 'ACTIVE', input.profile ? JSON.stringify(input.profile) : null],
            conn,
        );
        await setRoles(conn, res.insertId, input.roles);
        await syncProfiles(conn, res.insertId, input);
        if (input.roles.includes('CUSTOMER')) {
            await execute('INSERT INTO tblCustomer (user_id, name, email, phone, source) VALUES (?, ?, ?, ?, ?)', [res.insertId, input.name, input.email, input.phone ?? null, 'ADMIN'], conn);
        }
        return res.insertId;
    });
    await audit(ctx, 'USER_CREATED', 'users', id, { email: input.email, roles: input.roles });
    return getUser(id);
}

export async function updateUser(id: number, input: StaffInput, actor: { id: number; roles: RoleCode[] }, ctx: AuditContext) {
    const current = await getUser(id);
    guardRoles(actor.roles, input.roles);
    if ((current.roles as RoleCode[]).includes('SUPER_ADMIN') && !actor.roles.includes('SUPER_ADMIN')) throw forbidden('Only a Super Admin can edit a Super Admin.');
    if (id === actor.id && current.roles.includes('SUPER_ADMIN') && !input.roles.includes('SUPER_ADMIN')) throw badRequest('You cannot remove your own Super Admin role.');
    if (id === actor.id && input.status && input.status !== 'ACTIVE') throw badRequest('You cannot deactivate your own account.');
    const dup = await queryOne('SELECT id FROM tblUser WHERE (email = ? OR (? IS NOT NULL AND phone = ?)) AND id <> ?', [input.email, input.phone ?? null, input.phone ?? null, id]);
    if (dup) throw conflict('Another user already uses this email or phone.');

    await withTransaction(async (conn) => {
        await execute('UPDATE tblUser SET name = ?, email = ?, phone = ?, status = ? WHERE id = ?', [input.name, input.email, input.phone ?? null, input.status ?? 'ACTIVE', id], conn);
        if (input.profile) await execute('UPDATE tblUser SET staff_profile = ? WHERE id = ?', [JSON.stringify(input.profile), id], conn);
        if (input.password) await execute('UPDATE tblUser SET password_hash = ?, token_version = token_version + 1 WHERE id = ?', [await hashPassword(input.password), id], conn);
        await setRoles(conn, id, input.roles);
        await syncProfiles(conn, id, input);
        if (input.status && input.status !== 'ACTIVE') {
            await execute('UPDATE tblRefreshToken SET revoked_at = UTC_TIMESTAMP() WHERE user_id = ? AND revoked_at IS NULL', [id], conn);
            await execute('UPDATE tblUser SET token_version = token_version + 1 WHERE id = ?', [id], conn);
        }
    });
    invalidateUserCache(id);
    const changedRoles = JSON.stringify([...current.roles].sort()) !== JSON.stringify([...input.roles].sort());
    await audit(ctx, 'USER_UPDATED', 'users', id, { status: input.status, passwordReset: !!input.password });
    if (changedRoles) await audit(ctx, 'PERMISSION_CHANGED', 'users', id, { from: current.roles, to: input.roles });
    return getUser(id);
}

export async function deleteUser(id: number, actor: { id: number; roles: RoleCode[] }, ctx: AuditContext) {
    if (id === actor.id) throw badRequest('You cannot delete your own account.');
    const u = await getUser(id);
    if ((u.roles as RoleCode[]).includes('SUPER_ADMIN') && !actor.roles.includes('SUPER_ADMIN')) throw forbidden();
    await execute("UPDATE tblUser SET deleted_at = UTC_TIMESTAMP(), status = 'INACTIVE', email = CONCAT('deleted+', id, '@invalid'), phone = NULL, token_version = token_version + 1 WHERE id = ?", [id]);
    await execute('UPDATE tblRefreshToken SET revoked_at = UTC_TIMESTAMP() WHERE user_id = ? AND revoked_at IS NULL', [id]);
    invalidateUserCache(id);
    await audit(ctx, 'USER_DELETED', 'users', id, { email: (u as { email?: string | null }).email ?? null });
}

export async function listRoles() {
    const roles = await query<{ id: number; code: RoleCode; name: string; description: string | null; level: number; users: number }>(
        `SELECT r.id, r.code, r.name, r.description, r.level,
                (SELECT COUNT(*) FROM tblUserRole ur JOIN tblUser u ON u.id = ur.user_id AND u.deleted_at IS NULL WHERE ur.role_id = r.id) AS users
           FROM tblRole r
          ORDER BY CASE WHEN r.level = 100 THEN 0 WHEN r.level = 0 THEN 99 ELSE r.level END, r.name`,
    );
    const grants = await query<{ role_id: number; code: Permission }>('SELECT rp.role_id, p.code FROM tblRolePermission rp JOIN tblPermission p ON p.id = rp.permission_id');
    const permissions = Object.entries(PERMISSIONS).map(([code, [module, description]]) => ({ code, module, description }));
    return {
        roles: roles.map((r) => ({ ...r, permissions: grants.filter((g) => g.role_id === r.id).map((g) => g.code) })),
        permissions,
    };
}

export async function setRolePermissions(roleCode: RoleCode, permissions: Permission[], actorRoles: RoleCode[], ctx: AuditContext) {
    if (roleCode === 'SUPER_ADMIN') throw badRequest('Super Admin always has every permission.');
    if (!actorRoles.includes('SUPER_ADMIN') && (ROLE_LEVEL[roleCode] === 100 || ROLE_LEVEL[roleCode] === 1)) {
        throw forbidden('Only a Super Admin can change owner or platform access.');
    }
    if (roleCode === 'CUSTOMER' && !permissions.includes('customer.portal')) throw badRequest('The customer panel has to stay available.');
    const role = await queryOne<{ id: number }>('SELECT id FROM tblRole WHERE code = ?', [roleCode]);
    if (!role) throw notFound('Role');
    for (const p of permissions) if (!(p in PERMISSIONS)) throw badRequest(`Unknown permission ${p}`);
    const before = await query<{ code: string }>('SELECT p.code FROM tblRolePermission rp JOIN tblPermission p ON p.id = rp.permission_id WHERE rp.role_id = ?', [role.id]);
    await withTransaction(async (conn) => {
        await execute('DELETE FROM tblRolePermission WHERE role_id = ?', [role.id], conn);
        if (permissions.length) {
            const ids = await query<{ id: number }>('SELECT id FROM tblPermission WHERE code IN (?)', [permissions], conn);
            for (const p of ids) await execute('INSERT INTO tblRolePermission (role_id, permission_id) VALUES (?, ?)', [role.id, p.id], conn);
        }
    });
    invalidateUserCache();
    await audit(ctx, 'PERMISSION_CHANGED', 'roles', roleCode, { from: before.map((b) => b.code), to: permissions });
    return listRoles();
}

/** Replace a user's role. Company owners and admins stay inside their company and cannot grant level 100 or level 1. */
export async function assignUserRole(userId: number, role: RoleCode, actor: { id: number; roles: RoleCode[]; companyId: number | null }, ctx: AuditContext) {
    if (userId === actor.id) throw badRequest('You cannot change your own access level.');
    if (!ROLES.includes(role)) throw badRequest(`Unknown role ${role}`);
    const current = await getUser(userId);
    const currentRoles = current.roles as RoleCode[];
    if (!actor.roles.includes('SUPER_ADMIN')) {
        if (!actor.companyId || Number(current.company_id) !== actor.companyId) throw forbidden('You can only assign access inside your company.');
        if (ROLE_LEVEL[role] === 100 || ROLE_LEVEL[role] === 1) throw forbidden('Only a Super Admin can assign owner access.');
        if (currentRoles.some((code) => ROLE_LEVEL[code] === 100 || ROLE_LEVEL[code] === 1)) throw forbidden('Only a Super Admin can change an owner account.');
    }
    await withTransaction(async (conn) => {
        await setRoles(conn, userId, [role]);
        await syncProfiles(conn, userId, { name: String(current.name), email: String(current.email ?? ''), roles: [role] });
        if (role === 'CUSTOMER') {
            await execute(
                'INSERT INTO tblCustomer (user_id, name, email, phone, source) SELECT ?, name, email, phone, ? FROM tblUser WHERE id = ? AND NOT EXISTS (SELECT 1 FROM tblCustomer WHERE user_id = ?)',
                [userId, 'ADMIN', userId, userId],
                conn,
            );
        }
    });
    invalidateUserCache(userId);
    await audit(ctx, 'PERMISSION_CHANGED', 'users', userId, { from: currentRoles, to: [role] });
    return getUser(userId);
}

/** Staff that can be assigned to events, filtered by role. */
export async function assignableStaff(role?: RoleCode) {
    return query(
        `SELECT DISTINCT u.id, u.name, u.email, u.phone, r.code AS role
           FROM tblUser u JOIN tblUserRole ur ON ur.user_id = u.id JOIN tblRole r ON r.id = ur.role_id
          WHERE u.deleted_at IS NULL AND u.status = 'ACTIVE' AND r.code <> 'CUSTOMER' ${role ? 'AND r.code = ?' : ''}
          ORDER BY u.name`,
        role ? [role] : [],
    );
}

export const DOCUMENT_TYPES = ['AADHAAR', 'PAN', 'PHOTO', 'RESUME', 'CERTIFICATE', 'OFFER_LETTER', 'BANK', 'OTHER'] as const;
export type DocumentType = (typeof DOCUMENT_TYPES)[number];

type Actor = { id: number; roles: RoleCode[]; companyId: number | null };

async function guardDocumentAccess(userId: number, actor: Actor) {
    const u = await getUser(userId);
    if (!actor.roles.includes('SUPER_ADMIN') && Number(u.company_id) !== actor.companyId) throw forbidden('You can only manage documents inside your company.');
    return u;
}

export async function listDocuments(userId: number, actor: Actor) {
    await guardDocumentAccess(userId, actor);
    const rows = await query<{ id: number; doc_type: string; file_name: string; storage_key: string; mime_type: string; size_bytes: number; created_at: string }>(
        'SELECT id, doc_type, file_name, storage_key, mime_type, size_bytes, created_at FROM tblStaffDocument WHERE user_id = ? ORDER BY created_at DESC, id DESC',
        [userId],
    );
    return Promise.all(rows.map(async ({ storage_key, ...d }) => ({ ...d, url: await storage.signedUrl(storage_key) })));
}

export async function addDocument(userId: number, docType: DocumentType, file: { buffer: Buffer; originalname: string; mimetype: string; size: number }, actor: Actor, ctx: AuditContext) {
    await guardDocumentAccess(userId, actor);
    const ext = (/\.(pdf|jpe?g|png|webp)$/i.exec(file.originalname)?.[1] ?? 'pdf').toLowerCase();
    const key = `staff-docs/${userId}/${randomUUID()}.${ext}`;
    await storage.put(key, file.buffer, file.mimetype);
    const name = file.originalname.replace(/[^\w .()-]+/g, '_').slice(0, 160);
    const res = await execute('INSERT INTO tblStaffDocument (user_id, doc_type, file_name, storage_key, mime_type, size_bytes, uploaded_by) VALUES (?, ?, ?, ?, ?, ?, ?)', [userId, docType, name, key, file.mimetype, file.size, actor.id]);
    await audit(ctx, 'USER_DOCUMENT_ADDED', 'users', userId, { documentId: res.insertId, docType });
    return listDocuments(userId, actor);
}

export async function removeDocument(userId: number, documentId: number, actor: Actor, ctx: AuditContext) {
    await guardDocumentAccess(userId, actor);
    const doc = await queryOne<{ storage_key: string }>('SELECT storage_key FROM tblStaffDocument WHERE id = ? AND user_id = ?', [documentId, userId]);
    if (!doc) throw notFound('Document');
    await execute('DELETE FROM tblStaffDocument WHERE id = ?', [documentId]);
    await storage.delete(doc.storage_key).catch(() => undefined);
    await audit(ctx, 'USER_DOCUMENT_REMOVED', 'users', userId, { documentId });
}

export type PageRuleInput = { key: string } & PageRule;

/** Page rules for one user, plus what every role allows by default. */
export async function getPageAccess(userId: number, actor: Actor) {
    const target = await getUser(userId);
    guardPageAccess(target, actor);
    const grants = await query<{ code: RoleCode; permission: string | null }>(
        'SELECT r.code, p.code AS permission FROM tblRole r LEFT JOIN tblRolePermission rp ON rp.role_id = r.id LEFT JOIN tblPermission p ON p.id = rp.permission_id',
    );
    const byRole = new Map<RoleCode, Set<string>>();
    for (const g of grants) {
        if (!byRole.has(g.code)) byRole.set(g.code, new Set());
        if (g.permission) byRole.get(g.code)!.add(g.permission);
    }
    const roleDefaults = Object.fromEntries(
        [...byRole.entries()].map(([code, perms]) => [code, Object.fromEntries(PAGES.map((p) => [p.key, code === 'SUPER_ADMIN' ? { view: true, add: true, edit: true, delete: true } : roleRule(p, perms)]))]),
    );
    const rules = await loadPageRules(userId);
    const roleRows = await query<{ code: RoleCode; name: string; level: number }>('SELECT code, name, level FROM tblRole');
    const roles = roleRows
        .filter((r) => actor.roles.includes('SUPER_ADMIN') || (r.level !== 100 && r.level !== 1))
        .sort((a, b) => roleRank(a.level) - roleRank(b.level));
    return {
        user: { id: target.id, name: target.name, email: target.email, phone: target.phone, status: target.status, roles: target.roles },
        pages: PAGES.map((p) => ({ key: p.key, label: p.label, group: p.group, hasManage: p.manage.length > 0 })),
        roles,
        roleDefaults,
        overrides: Object.fromEntries([...rules].filter(([key]) => PAGE_KEYS.includes(key))),
    };
}

function guardPageAccess(target: { id: number; company_id: number | null; roles: string[] }, actor: Actor) {
    if (target.id === actor.id) throw badRequest('You cannot change your own access.');
    const roles = target.roles as RoleCode[];
    if (!actor.roles.includes('SUPER_ADMIN')) {
        if (!actor.companyId || Number(target.company_id) !== actor.companyId) throw forbidden('You can only change access inside your company.');
        if (roles.some((r) => ROLE_LEVEL[r] === 100 || ROLE_LEVEL[r] === 1)) throw forbidden('Only a Super Admin can change an owner account.');
    }
}

export async function setPageAccess(userId: number, input: { role?: RoleCode; pages: PageRuleInput[] }, actor: Actor, ctx: AuditContext) {
    const target = await getUser(userId);
    guardPageAccess(target, actor);
    const currentRole = (target.roles as RoleCode[])[0];
    if (input.role && input.role !== currentRole) await assignUserRole(userId, input.role, actor, ctx);
    const role = input.role ?? currentRole;
    if (role === 'SUPER_ADMIN' && input.pages.length) throw badRequest('Super Admin always has every page. Page rules do not apply.');
    for (const p of input.pages) if (!PAGE_KEYS.includes(p.key)) throw badRequest(`Unknown page ${p.key}`);
    await withTransaction(async (conn) => {
        await execute('DELETE FROM tblUserPageAccess WHERE user_id = ?', [userId], conn);
        for (const p of input.pages) {
            const view = p.view || p.add || p.edit || p.delete;
            await execute(
                'INSERT INTO tblUserPageAccess (user_id, page_key, can_view, can_add, can_edit, can_delete, updated_by) VALUES (?, ?, ?, ?, ?, ?, ?)',
                [userId, p.key, view ? 1 : 0, p.add ? 1 : 0, p.edit ? 1 : 0, p.delete ? 1 : 0, actor.id],
                conn,
            );
        }
    });
    invalidateUserCache(userId);
    await audit(ctx, 'PERMISSION_CHANGED', 'users', userId, { pages: input.pages.map((p) => p.key), role });
    return getPageAccess(userId, actor);
}

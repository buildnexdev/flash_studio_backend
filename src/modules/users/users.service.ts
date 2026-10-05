import { PERMISSIONS, ROLES, STAFF_ROLES, type Permission, type RoleCode } from '../../config/rbac.js';
import { execute, query, queryOne, withTransaction } from '../../db/pool.js';
import { invalidateUserCache } from '../../middleware/auth.js';
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
    const w = where.join(' AND ');
    const total = (await queryOne<{ n: number }>(`SELECT COUNT(*) AS n FROM tblUser u WHERE ${w}`, params))?.n ?? 0;
    const items = await query(
        `SELECT u.id, u.name, u.email, u.phone, u.status, u.last_login_at, u.created_at,
                (SELECT GROUP_CONCAT(r.code ORDER BY r.id) FROM tblUserRole ur JOIN tblRole r ON r.id = ur.role_id WHERE ur.user_id = u.id) AS roles,
                s.designation, s.department, p.camera_gear, p.specialties AS photographer_specialties, e.software
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

export async function getUser(id: number) {
    const u = await queryOne(
        `SELECT u.id, u.name, u.email, u.phone, u.status, u.last_login_at, u.created_at,
                s.designation, s.department, s.joined_on, p.camera_gear, p.specialties AS photographer_specialties, p.day_rate, e.software, e.specialties AS editor_specialties
           FROM tblUser u LEFT JOIN tblStaff s ON s.user_id = u.id LEFT JOIN tblPhotographer p ON p.user_id = u.id LEFT JOIN tblEditor e ON e.user_id = u.id
          WHERE u.id = ? AND u.deleted_at IS NULL`,
        [id],
    );
    if (!u) throw notFound('User');
    const roles = await query<{ code: RoleCode }>('SELECT r.code FROM tblUserRole ur JOIN tblRole r ON r.id = ur.role_id WHERE ur.user_id = ?', [id]);
    return { ...u, roles: roles.map((r) => r.code) };
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
}

export async function createUser(input: StaffInput, actorRoles: RoleCode[], ctx: AuditContext) {
    guardRoles(actorRoles, input.roles);
    if (!input.password) throw badRequest('A password is required for new users.', [{ field: 'password', message: 'Required' }]);
    const dup = await queryOne('SELECT id FROM tblUser WHERE email = ? OR (? IS NOT NULL AND phone = ?)', [input.email, input.phone ?? null, input.phone ?? null]);
    if (dup) throw conflict('A user with this email or phone already exists.');
    const hash = await hashPassword(input.password);
    const id = await withTransaction(async (conn) => {
        const res = await execute('INSERT INTO tblUser (name, email, phone, password_hash, status, email_verified_at) VALUES (?, ?, ?, ?, ?, UTC_TIMESTAMP())', [input.name, input.email, input.phone ?? null, hash, input.status ?? 'ACTIVE'], conn);
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
    const roles = await query<{ id: number; code: RoleCode; name: string; description: string | null; users: number }>(
        'SELECT r.id, r.code, r.name, r.description, (SELECT COUNT(*) FROM tblUserRole ur JOIN tblUser u ON u.id = ur.user_id AND u.deleted_at IS NULL WHERE ur.role_id = r.id) AS users FROM tblRole r ORDER BY r.id',
    );
    const grants = await query<{ role_id: number; code: Permission }>('SELECT rp.role_id, p.code FROM tblRolePermission rp JOIN tblPermission p ON p.id = rp.permission_id');
    const permissions = Object.entries(PERMISSIONS).map(([code, [module, description]]) => ({ code, module, description }));
    return {
        roles: roles.map((r) => ({ ...r, permissions: grants.filter((g) => g.role_id === r.id).map((g) => g.code) })),
        permissions,
    };
}

export async function setRolePermissions(roleCode: RoleCode, permissions: Permission[], ctx: AuditContext) {
    if (roleCode === 'SUPER_ADMIN') throw badRequest('Super Admin always has every permission.');
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

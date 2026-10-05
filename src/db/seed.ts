import bcrypt from 'bcryptjs';
import { pathToFileURL } from 'node:url';
import { config } from '../config/env.js';
import { PERMISSIONS, ROLE_LABELS, ROLE_PERMISSIONS, ROLES, type RoleCode } from '../config/rbac.js';
import { DEFAULT_SETTINGS } from '../modules/settings/settings.service.js';
import { closePool, execute, json, query, queryOne } from './pool.js';

/** Default password for the non-production test accounts (override with SEED_PASSWORD). */
export const TEST_PASSWORD = process.env.SEED_PASSWORD || 'PhotoLab@2026';

export const TEST_USERS: { role: RoleCode; name: string; email: string; phone: string }[] = [
    { role: 'SUPER_ADMIN', name: 'Super Admin', email: 'admin@photolab.test', phone: '9000000001' },
    { role: 'STUDIO_OWNER', name: 'Studio Owner', email: 'owner@photolab.test', phone: '9000000002' },
    { role: 'MANAGER', name: 'Studio Manager', email: 'manager@photolab.test', phone: '9000000003' },
    { role: 'PHOTOGRAPHER', name: 'Arjun Photographer', email: 'photographer@photolab.test', phone: '9000000004' },
    { role: 'EDITOR_DESIGNER', name: 'Meera Editor', email: 'editor@photolab.test', phone: '9000000005' },
    { role: 'PRINTER_DELIVERY_STAFF', name: 'Ravi Print & Delivery', email: 'delivery@photolab.test', phone: '9000000006' },
    { role: 'CUSTOMER', name: 'Priya Customer', email: 'customer@photolab.test', phone: '9000000007' },
];

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

async function seedRbac(resetPermissions: boolean) {
    for (const [code, [module, description]] of Object.entries(PERMISSIONS)) {
        await execute('INSERT INTO tblPermission (code, module, description) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE module = VALUES(module), description = VALUES(description)', [code, module, description]);
    }
    for (const code of ROLES) {
        await execute('INSERT INTO tblRole (code, name, is_system) VALUES (?, ?, 1) ON DUPLICATE KEY UPDATE name = VALUES(name)', [code, ROLE_LABELS[code]]);
        const role = await queryOne<{ id: number }>('SELECT id FROM tblRole WHERE code = ?', [code]);
        if (!role) continue;
        const existing = await queryOne<{ n: number }>('SELECT COUNT(*) AS n FROM tblRolePermission WHERE role_id = ?', [role.id]);
        // Keep permission changes made by admins unless explicitly reset; always grant SUPER_ADMIN everything.
        if ((existing?.n ?? 0) > 0 && !resetPermissions && code !== 'SUPER_ADMIN') continue;
        if (resetPermissions || code === 'SUPER_ADMIN') await execute('DELETE FROM tblRolePermission WHERE role_id = ?', [role.id]);
        const perms = ROLE_PERMISSIONS[code];
        if (perms.length) {
            await execute('INSERT IGNORE INTO tblRolePermission (role_id, permission_id) SELECT ?, id FROM tblPermission WHERE code IN (?)', [role.id, perms]);
        }
    }
}

async function ensureUser(u: { role: RoleCode; name: string; email: string; phone: string | null }, password: string): Promise<number> {
    const existing = await queryOne<{ id: number; password_hash: string | null }>('SELECT id, password_hash FROM tblUser WHERE email = ?', [u.email]);
    let userId: number;
    if (existing) {
        userId = existing.id;
        if (!existing.password_hash || !existing.password_hash.startsWith('$2')) {
            const hash = await bcrypt.hash(password, 12);
            await execute('UPDATE tblUser SET password_hash = ? WHERE id = ?', [hash, userId]);
        }
    } else {
        const hash = await bcrypt.hash(password, 12);
        userId = (
            await execute('INSERT INTO tblUser (name, email, phone, password_hash, email_verified_at) VALUES (?, ?, ?, ?, UTC_TIMESTAMP())', [u.name, u.email, u.phone, hash])
        ).insertId;
    }
    await execute('INSERT IGNORE INTO tblUserRole (user_id, role_id) SELECT ?, id FROM tblRole WHERE code = ?', [userId, u.role]);
    if (u.role === 'CUSTOMER') {
        await execute("INSERT IGNORE INTO tblCustomer (user_id, name, email, phone, city, source) VALUES (?, ?, ?, ?, 'Chennai', 'WEBSITE')", [userId, u.name, u.email, u.phone]);
    } else {
        await execute('INSERT IGNORE INTO tblStaff (user_id, designation, joined_on) VALUES (?, ?, CURDATE())', [userId, ROLE_LABELS[u.role]]);
        if (u.role === 'PHOTOGRAPHER') await execute("INSERT IGNORE INTO tblPhotographer (user_id, camera_gear, specialties) VALUES (?, 'Sony A7 IV, 24-70mm f/2.8', 'Weddings, candid')", [userId]);
        if (u.role === 'EDITOR_DESIGNER') await execute("INSERT IGNORE INTO tblEditor (user_id, software, specialties) VALUES (?, 'Lightroom, Photoshop', 'Retouching, album design')", [userId]);
    }
    return userId;
}

async function seedCatalog() {
    const has = await queryOne<{ n: number }>('SELECT COUNT(*) AS n FROM tblService');
    if ((has?.n ?? 0) > 0) return false;
    const services = [
        { name: 'Wedding Photography', icon: 'heart', summary: 'Candid and traditional coverage of your big day.', base: 7500000 },
        { name: 'Pre-Wedding Shoot', icon: 'sparkles', summary: 'Story-driven couple portraits at locations you love.', base: 2500000 },
        { name: 'Birthday & Events', icon: 'cake', summary: 'Birthdays, baby showers, anniversaries and parties.', base: 1500000 },
        { name: 'Corporate Events', icon: 'briefcase', summary: 'Conferences, launches and team portraits.', base: 2000000 },
        { name: 'Portrait & Studio', icon: 'camera', summary: 'Professional portraits, family and kids in our studio.', base: 500000 },
    ];
    const serviceIds: number[] = [];
    for (const [i, s] of services.entries()) {
        serviceIds.push((await execute('INSERT INTO tblService (name, slug, summary, icon, base_price, sort_order) VALUES (?, ?, ?, ?, ?, ?)', [s.name, slug(s.name), s.summary, s.icon, s.base, i])).insertId);
    }
    const packages = [
        { service: 0, name: 'Wedding Silver', price: 7500000, photos: 400, digital: true, album: false, hours: 8, featured: false, features: ['1 photographer', '8 hours coverage', '400 edited photos', 'Online QR gallery', 'All digital files'] },
        { service: 0, name: 'Wedding Gold', price: 12500000, photos: 800, digital: true, album: true, hours: 12, featured: true, features: ['2 photographers', 'Full-day coverage', '800 edited photos', 'Live QR gallery for guests', '40-page premium album', 'All digital files'] },
        { service: 0, name: 'Wedding Platinum', price: 20000000, photos: 1500, digital: true, album: true, hours: 24, featured: false, features: ['3 photographers + drone', 'Two-day coverage', '1500 edited photos', 'Live QR gallery', 'Two premium albums', 'Same-day highlights'] },
        { service: 1, name: 'Pre-Wedding Classic', price: 2500000, photos: 150, digital: true, album: false, hours: 4, featured: false, features: ['2 locations', '4 hours', '150 edited photos', 'Online gallery'] },
        { service: 2, name: 'Celebration Basic', price: 1500000, photos: 200, digital: false, album: false, hours: 4, featured: false, features: ['1 photographer', '4 hours', 'Watermarked QR gallery', 'Buy HD photos individually'] },
        { service: 4, name: 'Studio Portrait', price: 500000, photos: 20, digital: true, album: false, hours: 1, featured: false, features: ['1-hour studio session', '20 retouched portraits', 'Digital files'] },
    ];
    for (const [i, p] of packages.entries()) {
        await execute(
            `INSERT INTO tblPackage (service_id, name, slug, description, price, advance_percent, features, photo_count, includes_digital, includes_album, duration_hours, is_featured, sort_order)
             VALUES (?, ?, ?, ?, ?, 30, ?, ?, ?, ?, ?, ?, ?)`,
            [serviceIds[p.service], p.name, slug(p.name), `${p.name} package`, p.price, json(p.features), p.photos, p.digital ? 1 : 0, p.album ? 1 : 0, p.hours, p.featured ? 1 : 0, i],
        );
    }
    await execute("INSERT INTO tblCoupon (code, description, type, value, min_amount, max_discount, applies_to) VALUES ('WELCOME10', '10% off photo orders', 'PERCENT', 10, 0, 50000, 'ORDER')");
    return true;
}

async function seedSettings() {
    for (const [key, value] of Object.entries(DEFAULT_SETTINGS)) {
        await execute('INSERT IGNORE INTO tblSetting (`key`, value, is_public) VALUES (?, ?, ?)', [key, json(value), key === 'studio' ? 1 : 0]);
    }
}

export async function runSeed(opts: { resetPermissions?: boolean; log?: boolean } = {}) {
    const log = opts.log ?? true;
    await seedRbac(!!opts.resetPermissions);
    await seedSettings();
    const catalog = await seedCatalog();

    if (config.isProd) {
        const email = process.env.SEED_ADMIN_EMAIL;
        const password = process.env.SEED_ADMIN_PASSWORD;
        const admins = await query("SELECT u.id FROM tblUser u JOIN tblUserRole ur ON ur.user_id = u.id JOIN tblRole r ON r.id = ur.role_id WHERE r.code = 'SUPER_ADMIN'");
        if (!admins.length) {
            if (!email || !password || password.length < 12) throw new Error('Set SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD (12+ characters) to create the first admin in production.');
            await ensureUser({ role: 'SUPER_ADMIN', name: process.env.SEED_ADMIN_NAME || 'Administrator', email, phone: null }, password);
            if (log) console.log(`[seed] created super admin ${email}`);
        }
    } else {
        for (const u of TEST_USERS) await ensureUser(u, TEST_PASSWORD);
        const t = await queryOne<{ n: number }>('SELECT COUNT(*) AS n FROM tblTestimonial');
        if ((t?.n ?? 0) === 0) {
            const rows = [
                ['Ananya & Karthik', 'Wedding, Chennai', 'The live QR gallery was a hit - our guests found and downloaded their photos during the reception itself!', 5],
                ['Rahul Menon', 'Corporate launch', 'Professional, punctual and the edited photos were delivered within three days.', 5],
                ['Divya S', 'Baby shower', 'Beautiful candid shots and the album design process was so easy with online proofs.', 5],
            ];
            for (const [i, r] of rows.entries()) await execute('INSERT INTO tblTestimonial (name, event_label, quote, rating, sort_order) VALUES (?, ?, ?, ?, ?)', [...r, i]);
        }
    }
    if (log) {
        console.log(`[seed] roles & permissions ready${catalog ? ', starter catalog created' : ''}`);
        if (!config.isProd) console.log(`[seed] test accounts (password "${TEST_PASSWORD}"): ${TEST_USERS.map((u) => u.email).join(', ')}`);
    }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
    runSeed({ resetPermissions: process.argv.includes('--reset-permissions') })
        .then(() => closePool())
        .catch(async (err) => {
            console.error('[seed] failed:', err);
            await closePool().catch(() => undefined);
            process.exit(1);
        });
}

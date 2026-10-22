// Developer by: Buildnexdev.in
// Last Edited : 21-10-2026
import bcrypt from 'bcryptjs';
import { databaseUrlFor, execute, platformDatabaseName, platformExecute, platformQuery, platformQueryOne, poolForDatabase, queryOne, runInTenant } from '../../db/pool.js';
import { runMigrations } from '../../db/migrate.js';
import { ensureUser, seedCatalog, seedRbac, seedSettings } from '../../db/seed.js';
import { sendEmail } from '../../lib/channels.js';
import { devPay, paymentProvider } from '../../lib/payments.js';
import { badRequest, conflict, forbidden, notFound } from '../../utils/errors.js';
import { DEFAULT_SETTINGS, updateSetting } from '../settings/settings.service.js';

export interface CompanyInput {
    name: string;
    ownerName: string;
    ownerEmail: string;
    ownerPassword: string;
    phone?: string | null;
    city?: string | null;
    tagline?: string | null;
}

const slugify = (name: string) =>
    name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '')
        .slice(0, 48);

/** Instance database: letters and numbers from the company name, plus "db". "Wass Photo" → wassphotodb. */
export function studioDatabaseName(name: string): string {
    const base = name.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 48);
    if (!base) throw badRequest('Company name needs letters or numbers.', [{ field: 'name', message: 'Use letters or numbers' }]);
    const database = `${base}db`;
    if (database.length > 64) throw badRequest('Company name is too long.', [{ field: 'name', message: 'Use a shorter name' }]);
    return database;
}

export async function listCompanies() {
    return platformQuery(
        `SELECT id, name, slug, database_name, status, email, phone, city, owner_name, owner_email, is_primary, created_at
           FROM tblCompany ORDER BY is_primary DESC, name`,
    );
}

export async function resolveTenant(slug: string) {
    const row = await platformQueryOne<{ slug: string; database_name: string; status: string; name: string }>(
        'SELECT slug, database_name, status, name FROM tblCompany WHERE slug = ?',
        [slug.trim().toLowerCase()],
    );
    if (!row) throw notFound('Studio');
    if (row.status !== 'ACTIVE') throw forbidden('This studio is suspended. Contact the platform administrator.');
    return {
        pool: poolForDatabase(row.database_name),
        database: row.database_name,
        slug: row.slug,
        name: row.name,
    };
}

export async function createCompany(input: CompanyInput) {
    const slug = slugify(input.name);
    if (!slug) throw badRequest('Studio name needs letters or numbers.', [{ field: 'name', message: 'Use letters or numbers' }]);
    const databaseName = studioDatabaseName(input.name);
    if (databaseName === platformDatabaseName()) {
        throw conflict('That studio name is already used by the platform database.');
    }
    const dup = await platformQueryOne('SELECT id FROM tblCompany WHERE slug = ? OR database_name = ?', [slug, databaseName]);
    if (dup) throw conflict('A studio with this name already exists.');

    await runMigrations({ databaseUrl: databaseUrlFor(databaseName), log: true });
    const scope = { pool: poolForDatabase(databaseName), database: databaseName, slug };
    await runInTenant(scope, async () => {
        await seedRbac(false);
        await seedSettings();
        await seedCatalog();
        await updateSetting(
            'studio',
            {
                ...DEFAULT_SETTINGS.studio,
                name: input.name.trim(),
                tagline: input.tagline?.trim() || DEFAULT_SETTINGS.studio.tagline,
                email: input.ownerEmail,
                phone: input.phone?.trim() || '',
                city: input.city?.trim() || '',
            },
            null,
        );
        await updateSetting('gallery', { ...DEFAULT_SETTINGS.gallery, watermarkText: input.name.trim() }, null);
        await ensureUser(
            { role: 'STUDIO_OWNER', name: input.ownerName.trim(), email: input.ownerEmail.trim().toLowerCase(), phone: input.phone?.trim() || null },
            input.ownerPassword,
        );
    });

    const res = await platformExecute(
        `INSERT INTO tblCompany (name, slug, database_name, status, email, phone, city, owner_name, owner_email, is_primary)
         VALUES (?, ?, ?, 'ACTIVE', ?, ?, ?, ?, ?, 0)`,
        [input.name.trim(), slug, databaseName, input.ownerEmail.trim().toLowerCase(), input.phone?.trim() || null, input.city?.trim() || null, input.ownerName.trim(), input.ownerEmail.trim().toLowerCase()],
    );
    return {
        id: res.insertId,
        name: input.name.trim(),
        slug,
        databaseName,
        ownerEmail: input.ownerEmail.trim().toLowerCase(),
        ownerPassword: input.ownerPassword,
    };
}

export async function setCompanyStatus(id: number, status: 'ACTIVE' | 'SUSPENDED') {
    const row = await platformQueryOne<{ id: number; is_primary: number; name: string }>('SELECT id, is_primary, name FROM tblCompany WHERE id = ?', [id]);
    if (!row) throw notFound('Studio');
    if (row.is_primary && status === 'SUSPENDED') throw conflict('The primary studio cannot be suspended.');
    await platformExecute('UPDATE tblCompany SET status = ? WHERE id = ?', [status, id]);
    return platformQueryOne('SELECT id, name, slug, database_name, status, is_primary FROM tblCompany WHERE id = ?', [id]);
}

export const COMPANY_MODULES = [
    { code: 'asset', label: 'Asset management', price: 999 },
    { code: 'staff', label: 'Staff management', price: 999 },
    { code: 'event', label: 'Event management', price: 1499 },
    { code: 'report', label: 'Report', price: 0 },
    { code: 'ecommerce', label: 'Ecommerce', price: 1999 },
] as const;

export type CompanyModuleCode = (typeof COMPANY_MODULES)[number]['code'];

export interface CompanySignupInput {
    name: string;
    phone: string;
    address: string;
    logo: string;
    ownerName: string;
    ownerEmail: string;
    password: string;
    gstNumber: string;
    aboutUs: string;
    aadhaarNumber: string;
    panNumber: string;
    modules: CompanyModuleCode[];
}

async function ignoreSchemaError(sql: string) {
    try {
        await platformExecute(sql);
    } catch (err) {
        const code = (err as { errno?: number }).errno;
        if (code === 1060 || code === 1061 || code === 1050) return;
        throw err;
    }
}

/** Adds the company profile columns on the platform database if this server has not migrated yet. */
export async function ensureCompanyPlatformSchema() {
    const alters = [
        'ALTER TABLE tblCompany ADD COLUMN address VARCHAR(300) NULL',
        'ALTER TABLE tblCompany ADD COLUMN logo_url MEDIUMTEXT NULL',
        'ALTER TABLE tblCompany ADD COLUMN gst_number VARCHAR(20) NULL',
        'ALTER TABLE tblCompany ADD COLUMN about_us TEXT NULL',
        'ALTER TABLE tblCompany ADD COLUMN aadhaar_number VARCHAR(12) NULL',
        'ALTER TABLE tblCompany ADD COLUMN pan_number VARCHAR(10) NULL',
        'ALTER TABLE tblCompany ADD COLUMN modules VARCHAR(200) NULL',
        'ALTER TABLE tblCompany ADD UNIQUE KEY uq_company_phone (phone)',
        'ALTER TABLE tblCompany ADD UNIQUE KEY uq_company_gst (gst_number)',
        'ALTER TABLE tblCompany ADD UNIQUE KEY uq_company_aadhaar (aadhaar_number)',
        'ALTER TABLE tblCompany ADD UNIQUE KEY uq_company_pan (pan_number)',
    ];
    for (const sql of alters) await ignoreSchemaError(sql);
    await ignoreSchemaError(
        `CREATE TABLE IF NOT EXISTS tblCompanySignup (
            companySignupID INT UNSIGNED NOT NULL AUTO_INCREMENT,
            payload MEDIUMTEXT NOT NULL,
            amount_paise INT UNSIGNED NOT NULL,
            provider_order_id VARCHAR(80) NOT NULL,
            status ENUM('PENDING', 'PAID') NOT NULL DEFAULT 'PENDING',
            company_id INT UNSIGNED NULL,
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (companySignupID),
            UNIQUE KEY uq_signup_order (provider_order_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
    );
}

const phoneDigits = (phone: string) => phone.replace(/\D/g, '').slice(-10);

/** True when this phone is already stored on a company or a user. */
export async function registrationPhoneTaken(phone: string): Promise<boolean> {
    const digits = phoneDigits(phone);
    if (!/^\d{10}$/.test(digits)) return false;
    const normalized = "RIGHT(REPLACE(REPLACE(REPLACE(IFNULL(phone, ''), ' ', ''), '-', ''), '+', ''), 10)";
    const company = await platformQueryOne(`SELECT companyID FROM tblCompany WHERE phone IS NOT NULL AND ${normalized} = ? LIMIT 1`, [digits]);
    const user = await platformQueryOne(`SELECT userID FROM tblUser WHERE deleted_at IS NULL AND phone IS NOT NULL AND ${normalized} = ? LIMIT 1`, [digits]);
    return Boolean(company || user);
}

/** First registration step: a new 10-digit number that is not on tblCompany or tblUser. */
export async function checkRegistrationPhone(phone: string) {
    const digits = phone.replace(/\D/g, '');
    if (!/^\d{10}$/.test(digits)) {
        throw badRequest('Enter a 10-digit phone number.', [{ field: 'phone', message: 'Enter a 10-digit phone number.' }]);
    }
    if (await registrationPhoneTaken(digits)) {
        throw badRequest('This phone number already exists. Enter a new number.', [{ field: 'phone', message: 'This phone number already exists. Enter a new number.' }]);
    }
    return { available: true as const };
}

export async function findCompanyDuplicates(input: { name?: string; phone?: string; ownerEmail?: string; gstNumber?: string; aadhaarNumber?: string; panNumber?: string }) {
    await ensureCompanyPlatformSchema();
    const errors: { field: string; message: string }[] = [];
    const phone = input.phone?.replace(/[\s-]/g, '') || '';
    const email = input.ownerEmail?.trim().toLowerCase() || '';
    const gst = input.gstNumber?.trim().toUpperCase() || '';
    const aadhaar = input.aadhaarNumber?.replace(/\D/g, '') || '';
    const pan = input.panNumber?.trim().toUpperCase() || '';
    let slug = '';
    let databaseName = '';
    if (input.name?.trim()) {
        slug = slugify(input.name);
        try {
            databaseName = studioDatabaseName(input.name);
        } catch {
            databaseName = '';
        }
    }
    const row = await platformQueryOne<{
        email: string | null;
        gst_number: string | null;
        aadhaar_number: string | null;
        pan_number: string | null;
        slug: string | null;
        database_name: string | null;
    }>(
        `SELECT
            MAX(CASE WHEN owner_email = ? OR email = ? THEN email END) AS email,
            MAX(CASE WHEN gst_number = ? THEN gst_number END) AS gst_number,
            MAX(CASE WHEN aadhaar_number = ? THEN aadhaar_number END) AS aadhaar_number,
            MAX(CASE WHEN pan_number = ? THEN pan_number END) AS pan_number,
            MAX(CASE WHEN slug = ? OR database_name = ? THEN slug END) AS slug,
            MAX(CASE WHEN slug = ? OR database_name = ? THEN database_name END) AS database_name
         FROM tblCompany`,
        [email, email, gst, aadhaar, pan, slug, databaseName, slug, databaseName],
    );
    if (phone && (await registrationPhoneTaken(phone))) errors.push({ field: 'phone', message: 'This phone number already exists. Enter a new number.' });
    if (email && row?.email) errors.push({ field: 'ownerEmail', message: 'This email is already registered.' });
    if (gst && row?.gst_number) errors.push({ field: 'gstNumber', message: 'This GST number is already registered.' });
    if (aadhaar && row?.aadhaar_number) errors.push({ field: 'aadhaarNumber', message: 'This Aadhaar number is already registered.' });
    if (pan && row?.pan_number) errors.push({ field: 'panNumber', message: 'This PAN number is already registered.' });
    if ((slug && row?.slug) || (databaseName && row?.database_name) || (databaseName && databaseName === platformDatabaseName())) {
        errors.push({ field: 'name', message: 'A company with this name already exists.' });
    }
    if (errors.length) throw badRequest('Some details are already registered.', errors);
    return { ok: true as const };
}

export async function startCompanyCheckout(input: CompanySignupInput) {
    await findCompanyDuplicates(input);
    if (!input.modules.length) throw badRequest('Select at least one module.', [{ field: 'modules', message: 'Select at least one module' }]);
    const unknown = input.modules.filter((code) => !COMPANY_MODULES.some((m) => m.code === code));
    if (unknown.length) throw badRequest('Unknown module selected.');
    const amountPaise = 0;
    const passwordHash = await bcrypt.hash(input.password, 12);
    const payload = JSON.stringify({
        ...input,
        password: undefined,
        passwordHash,
        phone: input.phone.replace(/[\s-]/g, ''),
        ownerEmail: input.ownerEmail.trim().toLowerCase(),
        gstNumber: input.gstNumber.trim().toUpperCase(),
        panNumber: input.panNumber.trim().toUpperCase(),
        aadhaarNumber: input.aadhaarNumber.replace(/\D/g, ''),
    });
    const order =
        amountPaise === 0
            ? { id: `free_${Date.now().toString(36)}`, amount: 0, currency: 'INR' }
            : await paymentProvider.createOrder(amountPaise, 'INR', `nammaqr-${Date.now().toString(36)}`, { purpose: 'company-signup' });
    const res = await platformExecute(
        'INSERT INTO tblCompanySignup (payload, amount_paise, provider_order_id, status) VALUES (?, ?, ?, ?)',
        [payload, amountPaise, order.id, 'PENDING'],
    );
    return {
        signupId: res.insertId,
        amount: amountPaise,
        currency: 'INR',
        provider: amountPaise === 0 ? ('free' as const) : paymentProvider.name,
        keyId: amountPaise === 0 ? null : paymentProvider.publicKey,
        providerOrderId: order.id,
        description: 'Nammaqr company registration',
        modules: COMPANY_MODULES.filter((m) => input.modules.includes(m.code)),
    };
}

export async function devpayCompanyCheckout(signupId: number, outcome: 'success' | 'failure') {
    if (!devPay) throw badRequest('Test checkout is not available.');
    const row = await platformQueryOne<{ provider_order_id: string; status: string; amount_paise: number }>(
        'SELECT provider_order_id, status, amount_paise FROM tblCompanySignup WHERE id = ?',
        [signupId],
    );
    if (!row || row.status !== 'PENDING') throw notFound('Registration');
    return devPay.checkout(row.provider_order_id, outcome);
}

async function openInstance(input: CompanySignupInput & { passwordHash: string }, databaseName: string, slug: string) {
    await runMigrations({ databaseUrl: databaseUrlFor(databaseName), log: true });
    const scope = { pool: poolForDatabase(databaseName), database: databaseName, slug };
    await runInTenant(scope, async () => {
        await seedRbac(false);
        await seedSettings();
        await seedCatalog();
        await updateSetting(
            'studio',
            {
                ...DEFAULT_SETTINGS.studio,
                name: input.name.trim(),
                tagline: 'Moments beyond time',
                email: input.ownerEmail,
                phone: input.phone,
                address: input.address.slice(0, 255),
                about: input.aboutUs,
                gstin: input.gstNumber,
            },
            null,
        );
        await updateSetting('gallery', { ...DEFAULT_SETTINGS.gallery, watermarkText: input.name.trim() }, null);
        let company = await queryOne<{ id: number }>('SELECT id FROM tblCompany ORDER BY is_primary DESC, id ASC LIMIT 1');
        if (!company) {
            const created = await execute(
                `INSERT INTO tblCompany (name, slug, database_name, status, email, phone, address, owner_name, owner_email, is_primary)
                 VALUES (?, ?, ?, 'ACTIVE', ?, ?, ?, ?, ?, 1)`,
                [input.name.trim(), slug, databaseName, input.ownerEmail, input.phone, input.address.trim().slice(0, 300), input.ownerName.trim(), input.ownerEmail],
            );
            company = { id: created.insertId };
        }
        const role = await queryOne<{ id: number }>('SELECT id FROM tblRole WHERE code = ?', ['STUDIO_OWNER']);
        if (!role) throw new Error('Role STUDIO_OWNER is not seeded');
        const userId = (
            await execute(
                'INSERT INTO tblUser (company_id, role_id, name, email, phone, password_hash, status, email_verified_at) VALUES (?, ?, ?, ?, ?, ?, ?, UTC_TIMESTAMP())',
                [company.id, role.id, input.ownerName.trim(), input.ownerEmail, input.phone, input.passwordHash, 'ACTIVE'],
            )
        ).insertId;
        await execute('INSERT IGNORE INTO tblUserRole (user_id, role_id) VALUES (?, ?)', [userId, role.id]);
        await execute('INSERT IGNORE INTO tblStaff (user_id, designation, joined_on) VALUES (?, ?, CURDATE())', [userId, 'Studio owner']);
    });
}

export async function completeCompanySignup(input: { signupId: number; providerOrderId?: string; providerPaymentId?: string; signature?: string }) {
    await ensureCompanyPlatformSchema();
    const row = await platformQueryOne<{ id: number; payload: string; amount_paise: number; provider_order_id: string; status: string; company_id: number | null }>(
        'SELECT id, payload, amount_paise, provider_order_id, status, company_id FROM tblCompanySignup WHERE id = ?',
        [input.signupId],
    );
    if (!row) throw notFound('Registration');
    if (row.status === 'PAID' && row.company_id) {
        const done = await platformQueryOne<{ slug: string; database_name: string; name: string }>('SELECT slug, database_name, name FROM tblCompany WHERE id = ?', [row.company_id]);
        return { alreadyRegistered: true, slug: done?.slug, databaseName: done?.database_name, name: done?.name };
    }
    if (row.amount_paise > 0) {
        if (!input.providerOrderId || !input.providerPaymentId || !input.signature) throw badRequest('Payment was not completed.');
        if (input.providerOrderId !== row.provider_order_id) throw badRequest('Payment does not match this registration.');
        if (!paymentProvider.verifySignature(input.providerOrderId, input.providerPaymentId, input.signature)) throw badRequest('Payment could not be verified.');
        const payment = await paymentProvider.fetchPayment(input.providerPaymentId);
        if (payment.status !== 'captured' && payment.status !== 'authorized') throw badRequest('Payment was not successful.');
        if (payment.amount !== row.amount_paise) throw badRequest('Payment amount does not match.');
    }

    const saved = JSON.parse(row.payload) as CompanySignupInput & { passwordHash: string };
    await findCompanyDuplicates(saved);
    const slug = slugify(saved.name);
    const databaseName = studioDatabaseName(saved.name);
    const inserted = await platformExecute(
        `INSERT INTO tblCompany (name, slug, database_name, status, email, phone, address, owner_name, owner_email, is_primary, logo_url, gst_number, about_us, aadhaar_number, pan_number, modules)
         VALUES (?, ?, ?, 'ACTIVE', ?, ?, ?, ?, ?, 0, ?, ?, ?, ?, ?, ?)`,
        [
            saved.name.trim(),
            slug,
            databaseName,
            saved.ownerEmail,
            saved.phone,
            saved.address.trim(),
            saved.ownerName.trim(),
            saved.ownerEmail,
            saved.logo,
            saved.gstNumber,
            saved.aboutUs.trim(),
            saved.aadhaarNumber,
            saved.panNumber,
            saved.modules.join(','),
        ],
    );
    try {
        await openInstance(saved, databaseName, slug);
    } catch (err) {
        await platformExecute('DELETE FROM tblCompany WHERE companyID = ?', [inserted.insertId]);
        if (/^[a-z0-9_]+$/.test(databaseName) && databaseName !== platformDatabaseName()) {
            await platformExecute(`DROP DATABASE IF EXISTS \`${databaseName}\``).catch(() => undefined);
        }
        throw badRequest(`The studio could not be created. Nothing was kept. ${(err as Error).message}`);
    }
    await platformExecute('UPDATE tblCompanySignup SET status = ?, company_id = ? WHERE id = ?', ['PAID', inserted.insertId, row.id]);
    const moduleLabels = COMPANY_MODULES.filter((m) => saved.modules.includes(m.code)).map((m) => m.label).join(', ');
    const mail = await sendEmail(
        saved.ownerEmail,
        'Welcome to Nammaqr',
        `Congratulations, ${saved.ownerName.trim()}!\n\n${saved.name.trim()} is now registered on Nammaqr.\nStudio code: ${slug}\nSign in with ${saved.ownerEmail} or ${saved.phone}.\nModules: ${moduleLabels}.\n\nMoments beyond time.`,
    );
    return { slug, databaseName, name: saved.name.trim(), emailSent: mail.sent, alreadyRegistered: false };
}

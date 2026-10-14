// Developer by: Buildnexdev.in
// Last Edited : 14-10-2026
import { databaseUrlFor, platformDatabaseName, platformExecute, platformQuery, platformQueryOne, poolForDatabase, runInTenant } from '../../db/pool.js';
import { runMigrations } from '../../db/migrate.js';
import { ensureUser, seedCatalog, seedRbac, seedSettings } from '../../db/seed.js';
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

export function studioDatabaseName(name: string): string {
    const slug = slugify(name).replace(/-/g, '_');
    if (!slug) throw badRequest('Studio name needs letters or numbers.', [{ field: 'name', message: 'Use letters or numbers' }]);
    const database = `${slug}_photo_lab`;
    if (database.length > 64) throw badRequest('Studio name is too long.', [{ field: 'name', message: 'Use a shorter name' }]);
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

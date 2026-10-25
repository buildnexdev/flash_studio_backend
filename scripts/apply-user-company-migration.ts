/** One-off: apply user company/role columns when PKs are already userID/companyID. */
import mysql from 'mysql2/promise';
import { config } from '../src/config/env.js';

const url = new URL(config.DATABASE_URL);
const sslMode = url.searchParams.get('ssl-mode');
url.searchParams.delete('ssl-mode');
const db = decodeURIComponent(url.pathname.replace(/^\//, ''));
const conn = await mysql.createConnection({
    uri: url.toString(),
    multipleStatements: true,
    ssl: sslMode ? { rejectUnauthorized: false } : undefined,
});
await conn.query(`USE \`${db}\``);

const [cols] = await conn.query<mysql.RowDataPacket[]>(
    `SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'tblUser'`,
    [db],
);
const names = new Set(cols.map((c) => c.COLUMN_NAME as string));
if (!names.has('company_id') || !names.has('role_id')) {
    // add columns below
} else {
    console.log('tblUser has company_id/role_id — backfilling and enforcing NOT NULL if needed');
}

const userPk = names.has('userID') ? 'userID' : 'id';
const [companyPkRow] = await conn.query<mysql.RowDataPacket[]>(
    `SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'tblCompany' AND COLUMN_KEY = 'PRI'`,
    [db],
);
const companyPk = (companyPkRow[0]?.COLUMN_NAME as string) ?? 'id';
const [rolePkRow] = await conn.query<mysql.RowDataPacket[]>(
    `SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'tblRole' AND COLUMN_KEY = 'PRI'`,
    [db],
);
const rolePk = (rolePkRow[0]?.COLUMN_NAME as string) ?? 'id';

console.log(`Applying company_id/role_id (user PK: ${userPk}, company PK: ${companyPk}, role PK: ${rolePk})`);

await conn.query('SET FOREIGN_KEY_CHECKS = 0');
try {
    if (!names.has('company_id')) {
        await conn.query(`ALTER TABLE tblUser ADD COLUMN company_id INT UNSIGNED NULL AFTER ${userPk}`);
    }
    if (!names.has('role_id')) {
        await conn.query(`ALTER TABLE tblUser ADD COLUMN role_id INT UNSIGNED NULL AFTER company_id`);
    }
    await conn.query(`
        UPDATE tblUser u
        JOIN (
            SELECT user_id, MIN(role_id) AS role_id FROM tblUserRole GROUP BY user_id
        ) ur ON ur.user_id = u.${userPk}
        SET u.role_id = ur.role_id
        WHERE u.role_id IS NULL
    `);
    const [defaultRole] = await conn.query<mysql.RowDataPacket[]>(
        `SELECT ${rolePk} AS id FROM tblRole WHERE code = 'STUDIO_OWNER' LIMIT 1`,
    );
    const fallbackRoleId = defaultRole[0]?.id as number | undefined;
    if (fallbackRoleId) {
        await conn.query(`UPDATE tblUser SET role_id = ? WHERE role_id IS NULL`, [fallbackRoleId]);
    }
    await conn.query(`
        UPDATE tblUser u
        JOIN tblCompany c ON c.is_primary = 1
        SET u.company_id = c.${companyPk}
        WHERE u.company_id IS NULL
    `);
    const [defaultCo] = await conn.query<mysql.RowDataPacket[]>(
        `SELECT ${companyPk} AS id FROM tblCompany ORDER BY is_primary DESC, ${companyPk} ASC LIMIT 1`,
    );
    const fallbackCoId = defaultCo[0]?.id as number | undefined;
    if (fallbackCoId) {
        await conn.query(`UPDATE tblUser SET company_id = ? WHERE company_id IS NULL`, [fallbackCoId]);
    }
    const [nullRoles] = await conn.query<mysql.RowDataPacket[]>(`SELECT COUNT(*) AS n FROM tblUser WHERE role_id IS NULL`);
    const [nullCo] = await conn.query<mysql.RowDataPacket[]>(`SELECT COUNT(*) AS n FROM tblUser WHERE company_id IS NULL`);
    if ((nullRoles[0]?.n as number) > 0 || (nullCo[0]?.n as number) > 0) {
        throw new Error('Some users still missing company_id or role_id; seed roles/companies first.');
    }
    await conn.query(`ALTER TABLE tblUser MODIFY company_id INT UNSIGNED NOT NULL`);
    await conn.query(`ALTER TABLE tblUser MODIFY role_id INT UNSIGNED NOT NULL`);
    await conn.query(`ALTER TABLE tblUser ADD KEY idx_users_company (company_id)`).catch(() => undefined);
    await conn.query(`ALTER TABLE tblUser ADD KEY idx_users_role (role_id)`).catch(() => undefined);
    await conn.query(
        `ALTER TABLE tblUser ADD CONSTRAINT fk_user_company FOREIGN KEY (company_id) REFERENCES tblCompany (${companyPk})`,
    ).catch(() => undefined);
    await conn.query(
        `ALTER TABLE tblUser ADD CONSTRAINT fk_user_role FOREIGN KEY (role_id) REFERENCES tblRole (${rolePk})`,
    ).catch(() => undefined);

    for (const name of ['005_user_company_role.sql', '007_user_company_role_pk.sql']) {
        await conn.query('INSERT IGNORE INTO tblSchemaMigration (name) VALUES (?)', [name]);
    }
    console.log('Done.');
} finally {
    await conn.query('SET FOREIGN_KEY_CHECKS = 1');
    await conn.end();
}

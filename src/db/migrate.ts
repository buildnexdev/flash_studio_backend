/* 
 * Developer by: Buildnexdev.in
 * Devevloper : Nandhakumar@gmail.com
 * Last Edited : 06-10-2026
*/
import { existsSync } from 'node:fs';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import mysql from 'mysql2/promise';
import { config } from '../config/env.js';
import { loadPrimaryKeyColumns, renamePrimaryKeys, rewriteReferencedPrimaryKeys } from './primary-keys.js';

function resolveMigrationsDir(): string {
    const here = path.dirname(fileURLToPath(import.meta.url));
    const candidates = [
        path.resolve(here, 'migrations'),
        path.resolve(here, '../../src/db/migrations'),
        path.resolve(here, '../src/db/migrations'),
        path.resolve(process.cwd(), 'src/db/migrations'),
        path.resolve(process.cwd(), 'flash_studio_backend/src/db/migrations'),
    ];
    for (const c of candidates) {
        if (existsSync(c)) return c;
    }
    return path.resolve(here, 'migrations');
}

const migrationsDir = resolveMigrationsDir();

/** Keep SQL that follows a leading `--` comment. The comment is not the whole statement. */
function stripLeadingComments(chunk: string): string {
    let rest = chunk.trim();
    while (rest.startsWith('--') || rest.startsWith('#')) {
        const nl = rest.search(/\r?\n/);
        if (nl === -1) return '';
        rest = rest.slice(nl + 1).trim();
    }
    while (rest.startsWith('/*')) {
        const end = rest.indexOf('*/');
        if (end === -1) return '';
        rest = rest.slice(end + 2).trim();
    }
    return rest;
}

/*
 * SPLIT THE URL INTO THE SERVER URL AND THE DATABASE NAME
 */
function splitUrl(url: string) {
    const parsed = new URL(url);
    const database = decodeURIComponent(parsed.pathname.replace(/^\//, ''));
    if (!/^[A-Za-z0-9_]+$/.test(database)) throw new Error(`Invalid database name "${database}"`);
    parsed.pathname = '/';
    return { serverUrl: parsed.toString(), database };
}

/*
 * RUN THE MIGRATIONS
 */
export async function runMigrations(options: { reset?: boolean; log?: boolean; databaseUrl?: string } = {}): Promise<string[]> {
    const { serverUrl, database } = splitUrl(options.databaseUrl ?? config.DATABASE_URL);
    const log = options.log ?? true;
    const parsed = new URL(serverUrl);
    const sslMode = parsed.searchParams.get('ssl-mode') ?? parsed.searchParams.get('sslMode');
    parsed.searchParams.delete('ssl-mode');
    parsed.searchParams.delete('sslMode');
    const ssl =
        sslMode && /required|verify/i.test(sslMode)
            ? { rejectUnauthorized: false }
            : undefined;
    const server = await mysql.createConnection({
        uri: parsed.toString(),
        multipleStatements: true,
        ...(ssl ? { ssl } : {}),
    });
    try {
        if (options.reset) {
            if (config.isProd) throw new Error('Refusing to reset the database in production.');
            await server.query(`DROP DATABASE IF EXISTS \`${database}\``);
        }
        await server.query(`CREATE DATABASE IF NOT EXISTS \`${database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
        await server.query(`USE \`${database}\``);
        await server.query("SET time_zone = '+00:00'");
        await server.query(`CREATE TABLE IF NOT EXISTS tblSchemaMigration (
            name VARCHAR(190) NOT NULL PRIMARY KEY,
            applied_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);

        const [rows] = await server.query('SELECT name FROM tblSchemaMigration');
        const applied = new Set((rows as { name: string }[]).map((r) => r.name));
        const pkByTable = await loadPrimaryKeyColumns(server);
        const files = (await readdir(migrationsDir)).filter((f) => f.endsWith('.sql')).sort();
        const ran: string[] = [];
        for (const file of files) {
            if (applied.has(file)) continue;
            const sql = await readFile(path.join(migrationsDir, file), 'utf8');
            if (log) console.log(`[migrate] applying ${file}`);
            const statements = sql
                .split(/;\s*(?:\r?\n|$)/)
                .map(stripLeadingComments)
                .filter((s) => s.length > 0);
            let skipRest = false;
            for (const statement of statements) {
                if (skipRest) break;
                try {
                    await server.query(rewriteReferencedPrimaryKeys(`${statement};`, pkByTable));
                } catch (err) {
                    const code = (err as { errno?: number }).errno;
                    // 005 and 007 each target one primary-key name. Unknown column means this file is for the other shape.
                    if (code === 1054 && (file.startsWith('007_') || file === '005_user_company_role.sql')) {
                        skipRest = true;
                        continue;
                    }
                    // Duplicate column, duplicate key, or table left behind by a failed attempt
                    if (code === 1050 || code === 1060 || code === 1061 || code === 1022 || code === 1062 || code === 1826) continue;
                    throw err;
                }
            }
            await server.query('INSERT INTO tblSchemaMigration (name) VALUES (?)', [file]);
            ran.push(file);
        }
        const renamed = await renamePrimaryKeys(server, log);
        if (log && !renamed.length) console.log('[migrate] primary keys already use tableID names');
        if (log) console.log(ran.length ? `[migrate] ${ran.length} migration(s) applied to ${database}` : `[migrate] ${database} is up to date`);
        return ran;
    } finally {
        await server.end();
    }
}

/*
 * CHECK IF THE MIGRATIONS ARE BEING RUN DIRECTLY
 */
const isDirectRun = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isDirectRun) {
    runMigrations({ reset: process.argv.includes('--reset') })
        .then(() => process.exit(0))
        .catch((err) => {
            console.error('[migrate] failed:', err.message);
            process.exit(1);
        });
}

// Developer by: Buildnexdev.in
// Devevloper : Nandhakumar@gmail.com
// Last Edited : 06-10-2026
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import mysql from 'mysql2/promise';
import { config } from '../config/env.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const migrationsDir = path.resolve(here, 'migrations');

function splitUrl(url: string) {
    const parsed = new URL(url);
    const database = decodeURIComponent(parsed.pathname.replace(/^\//, ''));
    if (!/^[A-Za-z0-9_]+$/.test(database)) throw new Error(`Invalid database name "${database}"`);
    parsed.pathname = '/';
    return { serverUrl: parsed.toString(), database };
}

export async function runMigrations(options: { reset?: boolean; log?: boolean } = {}): Promise<string[]> {
    const { serverUrl, database } = splitUrl(config.DATABASE_URL);
    const log = options.log ?? true;
    const parsed = new URL(serverUrl);
    const sslMode = parsed.searchParams.get('ssl-mode') ?? parsed.searchParams.get('sslMode');
    parsed.searchParams.delete('ssl-mode');
    parsed.searchParams.delete('sslMode');
    const ssl =
        sslMode && /required|verify/i.test(sslMode)
            ? { rejectUnauthorized: true }
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
        const files = (await readdir(migrationsDir)).filter((f) => f.endsWith('.sql')).sort();
        const ran: string[] = [];
        for (const file of files) {
            if (applied.has(file)) continue;
            const sql = await readFile(path.join(migrationsDir, file), 'utf8');
            if (log) console.log(`[migrate] applying ${file}`);
            const statements = sql
                .split(/;\s*(?:\r?\n|$)/)
                .map((s) => s.trim())
                .filter((s) => s && !s.startsWith('--'));
            for (const statement of statements) {
                try {
                    await server.query(`${statement};`);
                } catch (err) {
                    const code = (err as { errno?: number }).errno;
                    // Duplicate column / duplicate key — safe when re-running partial migrations
                    if (code === 1060 || code === 1061) continue;
                    throw err;
                }
            }
            await server.query('INSERT INTO tblSchemaMigration (name) VALUES (?)', [file]);
            ran.push(file);
        }
        if (log) console.log(ran.length ? `[migrate] ${ran.length} migration(s) applied to ${database}` : `[migrate] ${database} is up to date`);
        return ran;
    } finally {
        await server.end();
    }
}

const isDirectRun = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isDirectRun) {
    runMigrations({ reset: process.argv.includes('--reset') })
        .then(() => process.exit(0))
        .catch((err) => {
            console.error('[migrate] failed:', err.message);
            process.exit(1);
        });
}

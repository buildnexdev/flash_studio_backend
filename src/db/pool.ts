// Developer by: Buildnexdev.in
// Devevloper : Nandhakumar@gmail.com
// Last Edited : 14-10-2026
import { AsyncLocalStorage } from 'node:async_hooks';
import mysql, { type Pool, type PoolConnection, type ResultSetHeader, type RowDataPacket } from 'mysql2/promise';
import { config } from '../config/env.js';
import { aliasPrimaryKeyFields, rewriteSql } from './primary-keys.js';

export interface TenantScope {
    pool: Pool;
    database: string;
    slug: string | null;
}

const tenantStore = new AsyncLocalStorage<TenantScope>();

function connectionParts(databaseUrl: string) {
    const url = new URL(databaseUrl);
    const sslMode = url.searchParams.get('ssl-mode') ?? url.searchParams.get('sslMode');
    url.searchParams.delete('ssl-mode');
    url.searchParams.delete('sslMode');
    const database = decodeURIComponent(url.pathname.replace(/^\//, ''));
    const ssl = sslMode && /required|verify/i.test(sslMode) ? { rejectUnauthorized: false } : undefined;
    return { uri: url.toString(), ssl, database };
}

function attachUtc(p: Pool) {
    p.on('connection', (conn) => {
        conn.query("SET time_zone = '+00:00'");
    });
    return p;
}

function openPool(databaseUrl: string): Pool {
    const { uri, ssl } = connectionParts(databaseUrl);
    return attachUtc(
        mysql.createPool({
            uri,
            ...(ssl ? { ssl } : {}),
            connectionLimit: config.isTest ? 5 : 10,
            waitForConnections: true,
            timezone: 'Z',
            dateStrings: ['DATE'],
            decimalNumbers: true,
            supportBigNumbers: true,
            bigNumberStrings: false,
            charset: 'utf8mb4',
        }),
    );
}

const platform = connectionParts(config.DATABASE_URL);

export const pool: Pool = openPool(config.DATABASE_URL);

const studioPools = new Map<string, Pool>();

export function platformDatabaseName(): string {
    return platform.database;
}

export function databaseUrlFor(database: string): string {
    if (!/^[A-Za-z0-9_]+$/.test(database)) throw new Error(`Invalid database name "${database}"`);
    const url = new URL(config.DATABASE_URL);
    url.pathname = `/${database}`;
    return url.toString();
}

/** Pool for a studio database. The platform database reuses the main pool. */
export function poolForDatabase(database: string): Pool {
    if (database === platform.database) return pool;
    const existing = studioPools.get(database);
    if (existing) return existing;
    const created = openPool(databaseUrlFor(database));
    studioPools.set(database, created);
    return created;
}

export function currentPool(): Pool {
    return tenantStore.getStore()?.pool ?? pool;
}

export function currentDatabaseKey(): string {
    return tenantStore.getStore()?.database ?? platform.database;
}

export function currentStudioSlug(): string | null {
    return tenantStore.getStore()?.slug ?? null;
}

export function runInTenant<T>(scope: TenantScope, fn: () => T): T {
    return tenantStore.run(scope, fn);
}

export type Db = Pool | PoolConnection;
export type Row = RowDataPacket & Record<string, any>;

export async function query<T = Row>(sql: string, params: unknown[] = [], db?: Db): Promise<T[]> {
    const target = db ?? currentPool();
    const [rows] = await target.query<RowDataPacket[]>(rewriteSql(sql), params);
    aliasPrimaryKeyFields(rows);
    return rows as unknown as T[];
}

export async function queryOne<T = Row>(sql: string, params: unknown[] = [], db?: Db): Promise<T | null> {
    const rows = await query<T>(sql, params, db);
    return rows[0] ?? null;
}

/** Studio row new users are attached to. Prefers the primary company. */
export async function primaryCompanyId(db?: Db): Promise<number> {
    const row = await queryOne<{ id: number }>('SELECT id FROM tblCompany ORDER BY is_primary DESC, id ASC LIMIT 1', [], db);
    if (!row) throw new Error('No company is available to assign to the user.');
    return row.id;
}

export async function execute(sql: string, params: unknown[] = [], db?: Db): Promise<ResultSetHeader> {
    const target = db ?? currentPool();
    const [result] = await target.query<ResultSetHeader>(rewriteSql(sql), params);
    return result;
}

/** Always the platform database, even inside a studio request. */
export const platformQuery = <T = Row>(sql: string, params: unknown[] = []) => query<T>(sql, params, pool);
export const platformQueryOne = <T = Row>(sql: string, params: unknown[] = []) => queryOne<T>(sql, params, pool);
export const platformExecute = (sql: string, params: unknown[] = []) => execute(sql, params, pool);

export async function withTransaction<T>(fn: (conn: PoolConnection) => Promise<T>): Promise<T> {
    const conn = await currentPool().getConnection();
    try {
        await conn.beginTransaction();
        const result = await fn(conn);
        await conn.commit();
        return result;
    } catch (err) {
        await conn.rollback();
        throw err;
    } finally {
        conn.release();
    }
}

/** Serialise a value for a JSON column. */
export const json = (value: unknown): string | null => (value === undefined || value === null ? null : JSON.stringify(value));

export async function closePool(): Promise<void> {
    await Promise.all([pool.end(), ...[...studioPools.values()].map((p) => p.end())]);
    studioPools.clear();
}

import mysql, { type Pool, type PoolConnection, type ResultSetHeader, type RowDataPacket } from 'mysql2/promise';
import { config } from '../config/env.js';

export const pool: Pool = mysql.createPool({
    uri: config.DATABASE_URL,
    connectionLimit: config.isTest ? 5 : 15,
    waitForConnections: true,
    timezone: 'Z',
    dateStrings: ['DATE'],
    decimalNumbers: true,
    supportBigNumbers: true,
    bigNumberStrings: false,
    charset: 'utf8mb4',
});

// Store and read every DATETIME as UTC
pool.on('connection', (conn) => {
    conn.query("SET time_zone = '+00:00'");
});

export type Db = Pool | PoolConnection;
export type Row = RowDataPacket & Record<string, any>;

export async function query<T = Row>(sql: string, params: unknown[] = [], db: Db = pool): Promise<T[]> {
    const [rows] = await db.query<RowDataPacket[]>(sql, params);
    return rows as unknown as T[];
}

export async function queryOne<T = Row>(sql: string, params: unknown[] = [], db: Db = pool): Promise<T | null> {
    const rows = await query<T>(sql, params, db);
    return rows[0] ?? null;
}

export async function execute(sql: string, params: unknown[] = [], db: Db = pool): Promise<ResultSetHeader> {
    const [result] = await db.query<ResultSetHeader>(sql, params);
    return result;
}

export async function withTransaction<T>(fn: (conn: PoolConnection) => Promise<T>): Promise<T> {
    const conn = await pool.getConnection();
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
    await pool.end();
}

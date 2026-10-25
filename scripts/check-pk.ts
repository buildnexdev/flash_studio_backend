import mysql from 'mysql2/promise';
import { config } from '../src/config/env.js';

const url = new URL(config.DATABASE_URL);
const sslMode = url.searchParams.get('ssl-mode');
url.searchParams.delete('ssl-mode');
const db = decodeURIComponent(url.pathname.replace(/^\//, ''));
const conn = await mysql.createConnection({
    uri: url.toString(),
    ssl: sslMode ? { rejectUnauthorized: false } : undefined,
});
await conn.query(`USE \`${db}\``);
const [cols] = await conn.query<mysql.RowDataPacket[]>(
    `SELECT TABLE_NAME, COLUMN_NAME FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = ? AND TABLE_NAME IN ('tblCompany','tblUser') AND COLUMN_KEY = 'PRI'`,
    [db],
);
console.log('PK columns:', cols);
const [userCols] = await conn.query<mysql.RowDataPacket[]>(
    `SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'tblUser' ORDER BY ORDINAL_POSITION`,
    [db],
);
console.log('tblUser columns:', userCols.map((r) => r.COLUMN_NAME));
const [migs] = await conn.query<mysql.RowDataPacket[]>('SELECT name FROM tblSchemaMigration ORDER BY name');
console.log('migrations:', migs.map((r) => r.name));
await conn.end();

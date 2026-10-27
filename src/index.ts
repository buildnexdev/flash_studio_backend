// Developer by: Buildnexdev.in
// Devevloper : Nandhakumar@gmail.com
// Last Edited : 06-10-2026
import { createServer } from 'node:http';
import { createApp } from './app.js';
import { config } from './config/env.js';
import { renamePrimaryKeys } from './db/primary-keys.js';
import { ensureFlashStudio } from './db/seed.js';
import { closePool, pool } from './db/pool.js';
import { storage } from './lib/storage.js';
import { getIo, initRealtime } from './lib/realtime.js';
import { photoQueue, recoverPendingPhotos } from './modules/photos/photos.service.js';

async function main() {
    await pool.query('SELECT 1').catch((err: Error) => {
        throw new Error(`Cannot connect to MySQL (${err.message}). Check DATABASE_URL and run "npm run db:migrate".`);
    });

    const renamed = await renamePrimaryKeys(pool, true);
    if (renamed.length) console.log(`[photolab] primary keys aligned (${renamed.length} table(s))`);

    const flash = await ensureFlashStudio().catch((err: { errno?: number; message?: string }) => {
        if (err.errno === 1146) {
            console.warn('[photolab] studio registry is missing. Run npm run db:migrate.');
            return null;
        }
        throw err;
    });
    if (flash?.seeded) console.log(`[photolab] FlashLight Photography website content saved in ${flash.database}`);

    const app = createApp();
    const server = createServer(app);
    initRealtime(server);

    server.listen(config.PORT, () => {
        const storageLabel = storage.name === 's3' ? `s3 bucket ${config.AWS_BUCKET} (${config.AWS_REGION})` : 'local disk';
        console.log(`[photolab] API listening on ${config.BACKEND_URL} (port ${config.PORT}, ${config.NODE_ENV}, storage: ${storageLabel})`);
        if (storage.name === 'local') {
            const missing = [
                !config.AWS_BUCKET ? 'AWS_S3_BUCKET' : '',
                !config.AWS_ACCESS_KEY ? 'AWS_ACCESS_KEY_ID' : '',
                !config.AWS_SECRET_KEY ? 'AWS_SECRET_ACCESS_KEY' : '',
            ].filter(Boolean);
            console.warn(`[photolab] storage is local disk. Missing S3 settings: ${missing.join(', ') || 'none'}. Set STORAGE_DRIVER=s3 as well.`);
        }
    });

    const recovered = await recoverPendingPhotos();
    if (recovered) console.log(`[photolab] re-queued ${recovered} unprocessed photo(s)`);

    let shuttingDown = false;
    const shutdown = async (signal: string) => {
        if (shuttingDown) return;
        shuttingDown = true;
        console.log(`[photolab] ${signal} received, shutting down gracefully`);
        const force = setTimeout(() => process.exit(1), 25_000);
        force.unref();
        server.close();
        getIo()?.close();
        await photoQueue.idle().catch(() => undefined);
        await closePool().catch(() => undefined);
        process.exit(0);
    };
    process.on('SIGINT', () => void shutdown('SIGINT'));
    process.on('SIGTERM', () => void shutdown('SIGTERM'));
    process.on('unhandledRejection', (err) => console.error('[photolab] unhandled rejection', err));
}

main().catch((err) => {
    console.error('[photolab] failed to start:', err instanceof Error ? err.message : err);
    process.exit(1);
});

import { createServer } from 'node:http';
import { createApp } from './app.js';
import { config } from './config/env.js';
import { closePool, pool } from './db/pool.js';
import { getIo, initRealtime } from './lib/realtime.js';
import { photoQueue, recoverPendingPhotos } from './modules/photos/photos.service.js';

async function main() {
    await pool.query('SELECT 1').catch((err: Error) => {
        throw new Error(`Cannot connect to MySQL (${err.message}). Check DATABASE_URL and run "npm run db:migrate".`);
    });

    const app = createApp();
    const server = createServer(app);
    initRealtime(server);

    server.listen(config.PORT, () => {
        console.log(`[photolab] API listening on ${config.BACKEND_URL} (port ${config.PORT}, ${config.NODE_ENV})`);
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

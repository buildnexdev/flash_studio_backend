import { afterAll } from 'vitest';
import { closePool } from '../src/db/pool.js';
import { photoQueue } from '../src/modules/photos/photos.service.js';

afterAll(async () => {
    await photoQueue.idle();
    await closePool();
});

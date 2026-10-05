import { rm } from 'node:fs/promises';

export default async function setup() {
    if (!/_test\b|_test$/.test(new URL(process.env.DATABASE_URL ?? '').pathname)) {
        throw new Error('Refusing to run tests: DATABASE_URL must point at a *_test database.');
    }
    const { runMigrations } = await import('../src/db/migrate.js');
    const { runSeed } = await import('../src/db/seed.js');
    const { closePool } = await import('../src/db/pool.js');
    await rm('./storage-test', { recursive: true, force: true });
    await runMigrations({ reset: true, log: false });
    await runSeed({ log: false });
    await closePool();

    return async () => {
        await rm('./storage-test', { recursive: true, force: true });
    };
}

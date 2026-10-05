import { defineConfig } from 'vitest/config';

/**
 * Tests run against a separate database (photolab_test) that is dropped and re-created
 * on every run, with local storage in ./storage-test and the devpay test gateway.
 */
const testEnv: Record<string, string> = {
    NODE_ENV: 'test',
    DATABASE_URL: process.env.TEST_DATABASE_URL ?? 'mysql://root:root@localhost:3306/photolab_test',
    JWT_SECRET: 'test-jwt-secret-0123456789abcdefghijklmnopqrstuvwxyz',
    JWT_REFRESH_SECRET: 'test-refresh-secret-0123456789abcdefghijklmnopqrstuvwxyz',
    APP_SECRET: 'test-app-secret-0123456789abcdefghijklmnopqrstuvwxyz',
    FRONTEND_URL: 'http://localhost:5173',
    BACKEND_URL: 'http://localhost:4000',
    STORAGE_DRIVER: 'local',
    LOCAL_STORAGE_DIR: './storage-test',
    PAYMENT_PROVIDER: 'devpay',
    AI_FACE_PROVIDER: 'off',
    AI_CULLING_ENABLED: 'true',
    OTP_ENABLED: 'true',
    SMTP_HOST: '',
    WHATSAPP_TOKEN: '',
    SMS_GATEWAY_URL: '',
    UPLOAD_CONCURRENCY: '2',
};
Object.assign(process.env, testEnv);

export default defineConfig({
    test: {
        environment: 'node',
        include: ['tests/**/*.test.ts'],
        globalSetup: ['tests/global-setup.ts'],
        setupFiles: ['tests/setup.ts'],
        env: testEnv,
        fileParallelism: false,
        testTimeout: 60_000,
        hookTimeout: 120_000,
    },
});

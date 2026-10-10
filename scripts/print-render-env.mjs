/**
 * Prints Render dashboard env vars from local .env (never commit output).
 * Usage: node scripts/print-render-env.mjs
 */
import 'dotenv/config';

const keys = [
    'NODE_ENV',
    'PORT',
    'DATABASE_URL',
    'JWT_SECRET',
    'JWT_REFRESH_SECRET',
    'APP_SECRET',
    'FRONTEND_URL',
    'BACKEND_URL',
    'CORS_ORIGINS',
    'STORAGE_DRIVER',
    'AWS_ACCESS_KEY_ID',
    'AWS_SECRET_ACCESS_KEY',
    'AWS_REGION',
    'AWS_S3_BUCKET',
    'PAYMENT_PROVIDER',
    'RAZORPAY_KEY_ID',
    'RAZORPAY_KEY_SECRET',
    'RAZORPAY_WEBHOOK_SECRET',
    'MAX_UPLOAD_MB',
];

for (const key of keys) {
    const value = process.env[key] ?? process.env[key.replace('AWS_S3_BUCKET', 'AWS_BUCKET')] ?? '';
    console.log(`${key}=${value}`);
}

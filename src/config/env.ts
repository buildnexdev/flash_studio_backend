// Developer by: Buildnexdev.in
// Devevloper : Nandhakumar@gmail.com
// Last Edited : 06-10-2026
import 'dotenv/config';
import { z } from 'zod';

const bool = z
    .string()
    .optional()
    .transform((v) => v === 'true' || v === '1');

const schema = z.object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.coerce.number().int().positive().default(4000),
    DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),

    JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
    JWT_REFRESH_SECRET: z.string().min(32, 'JWT_REFRESH_SECRET must be at least 32 characters'),
    APP_SECRET: z.string().min(32, 'APP_SECRET must be at least 32 characters'),
    ACCESS_TOKEN_TTL: z.string().default('15m'),
    REFRESH_TOKEN_DAYS: z.coerce.number().int().positive().default(30),

    FRONTEND_URL: z.string().url().default('http://localhost:5173'),
    BACKEND_URL: z.string().url().default('http://localhost:4000'),
    CORS_ORIGINS: z.string().optional().default(''),

    STORAGE_DRIVER: z.enum(['local', 's3']).default('local'),
    LOCAL_STORAGE_DIR: z.string().default('./storage'),
    AWS_ACCESS_KEY: z.string().optional().default(''),
    AWS_SECRET_KEY: z.string().optional().default(''),
    AWS_REGION: z.string().default('ap-south-1'),
    AWS_BUCKET: z.string().optional().default(''),
    S3_ENDPOINT: z.string().optional().default(''),
    S3_FORCE_PATH_STYLE: bool,
    SIGNED_URL_TTL_SECONDS: z.coerce.number().int().min(30).max(86400).default(300),

    PAYMENT_PROVIDER: z.enum(['razorpay', 'devpay']).default('razorpay'),
    /** Allow devpay checkout while NODE_ENV=production (local/staging only — never on public prod without Razorpay). */
    ALLOW_DEVPAY: bool,
    RAZORPAY_KEY_ID: z.string().optional().default(''),
    RAZORPAY_KEY_SECRET: z.string().optional().default(''),
    RAZORPAY_WEBHOOK_SECRET: z.string().optional().default(''),
    CURRENCY: z.string().length(3).default('INR'),

    SMTP_HOST: z.string().optional().default(''),
    SMTP_PORT: z.coerce.number().int().default(587),
    SMTP_SECURE: bool,
    SMTP_USER: z.string().optional().default(''),
    SMTP_PASSWORD: z.string().optional().default(''),
    MAIL_FROM: z.string().default('BuildNexDev Studio <no-reply@example.com>'),

    WHATSAPP_TOKEN: z.string().optional().default(''),
    WHATSAPP_PHONE_NUMBER_ID: z.string().optional().default(''),
    SMS_GATEWAY_URL: z.string().optional().default(''),
    SMS_GATEWAY_TOKEN: z.string().optional().default(''),

    OTP_ENABLED: z
        .string()
        .optional()
        .transform((v) => v !== 'false'),

    AI_FACE_PROVIDER: z.enum(['off', 'rekognition']).default('off'),
    AI_CULLING_ENABLED: z
        .string()
        .optional()
        .transform((v) => v !== 'false'),

    MAX_UPLOAD_MB: z.coerce.number().int().min(1).max(200).default(40),
    UPLOAD_CONCURRENCY: z.coerce.number().int().min(1).max(8).default(2),
});

/** Accept common AWS / Render env names alongside our documented keys. */
const envSource = {
    ...process.env,
    AWS_ACCESS_KEY: process.env.AWS_ACCESS_KEY || process.env.AWS_ACCESS_KEY_ID || '',
    AWS_SECRET_KEY: process.env.AWS_SECRET_KEY || process.env.AWS_SECRET_ACCESS_KEY || '',
    AWS_BUCKET: process.env.AWS_BUCKET || process.env.AWS_S3_BUCKET || '',
};

const parsed = schema.safeParse(envSource);
if (!parsed.success) {
    const problems = parsed.error.issues.map((i) => `  - ${i.path.join('.')}: ${i.message}`).join('\n');
    throw new Error(`Invalid environment configuration:\n${problems}`);
}

const env = parsed.data;

if (env.NODE_ENV === 'production') {
    if (env.PAYMENT_PROVIDER === 'devpay' && !env.ALLOW_DEVPAY) {
        throw new Error('PAYMENT_PROVIDER=devpay is not allowed in production unless ALLOW_DEVPAY=true. Configure Razorpay for live payments.');
    }
    if (
        env.PAYMENT_PROVIDER === 'razorpay' &&
        (!env.RAZORPAY_KEY_ID || !env.RAZORPAY_KEY_SECRET || !env.RAZORPAY_WEBHOOK_SECRET)
    ) {
        console.warn('[photolab] Razorpay is not fully configured; payment endpoints may fail until keys are set on Render.');
    }
    if (env.STORAGE_DRIVER === 's3' && (!env.AWS_BUCKET || !env.AWS_ACCESS_KEY || !env.AWS_SECRET_KEY)) {
        console.warn('[photolab] S3 storage is not fully configured; file uploads will fail until AWS_S3_BUCKET is set on Render.');
    }
}

export const config = {
    ...env,
    isProd: env.NODE_ENV === 'production',
    isTest: env.NODE_ENV === 'test',
    corsOrigins: [env.FRONTEND_URL, ...env.CORS_ORIGINS.split(',').map((s) => s.trim()).filter(Boolean)],
    maxUploadBytes: env.MAX_UPLOAD_MB * 1024 * 1024,
};

export type AppConfig = typeof config;

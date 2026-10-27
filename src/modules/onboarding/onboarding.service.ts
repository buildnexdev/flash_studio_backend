// Developer by: Buildnexdev.in
import { config } from '../../config/env.js';
import { json, platformDatabaseName, platformExecute, platformQuery, platformQueryOne, poolForDatabase, queryOne } from '../../db/pool.js';
import { paymentProvider } from '../../lib/payments.js';
import { AppError, badRequest, conflict, notFound } from '../../utils/errors.js';
import { randomToken } from '../../utils/crypto.js';
import { createCompany } from '../companies/companies.service.js';
import { ONBOARDING_MODULES, quoteOnboarding, type OnboardingModuleId } from './onboarding.catalog.js';

export interface OnboardingPayload {
    phone: string;
    email: string;
    password: string;
    companyEmail: string;
    companyName: string;
    ownerName: string;
    about: string;
    modules: OnboardingModuleId[];
    logoBase64?: string | null;
}

type Row = {
    id: number;
    token: string;
    payload_json: OnboardingPayload;
    amount_paise: number;
    provider_order_id: string | null;
    status: string;
    company_slug: string | null;
};

export function listModuleCatalog() {
    return Object.values(ONBOARDING_MODULES);
}

/** Digits-only key for comparing phones across tblCompany / tblUser. */
export function phoneDigits(raw: string) {
    return raw.replace(/\D/g, '');
}

async function findUserByPhoneDigits(digits: string, databaseName: string) {
    if (!digits) return null;
    return queryOne<{ id: number }>(
        `SELECT id FROM tblUser
          WHERE deleted_at IS NULL AND phone IS NOT NULL AND phone <> ''
            AND REPLACE(REPLACE(REPLACE(phone, ' ', ''), '-', ''), '+', '') = ?
          LIMIT 1`,
        [digits],
        poolForDatabase(databaseName),
    );
}

/** Ensures phone is not used on platform tblCompany, platform tblUser, or any studio tblUser. */
export async function assertPhoneAvailableForSignup(rawPhone: string) {
    const digits = phoneDigits(rawPhone);
    if (digits.length < 8 || digits.length > 15) {
        throw badRequest('Enter a valid phone number.', [{ field: 'phone', message: 'Enter a valid phone number' }]);
    }

    const company = await platformQueryOne<{ id: number; name: string }>(
        `SELECT id, name FROM tblCompany
          WHERE phone IS NOT NULL AND phone <> ''
            AND REPLACE(REPLACE(REPLACE(phone, ' ', ''), '-', ''), '+', '') = ?
          LIMIT 1`,
        [digits],
    );
    if (company) {
        throw conflict('This phone number is already registered to a studio. Sign in or use a different number.');
    }

    const onPlatformUser = await findUserByPhoneDigits(digits, platformDatabaseName());
    if (onPlatformUser) {
        throw conflict('An account with this phone number already exists. Please sign in.');
    }

    const studios = await platformQuery<{ database_name: string }>('SELECT database_name FROM tblCompany');
    for (const row of studios) {
        if (row.database_name === platformDatabaseName()) continue;
        try {
            const tenantUser = await findUserByPhoneDigits(digits, row.database_name);
            if (tenantUser) {
                throw conflict('This phone number is already in use. Sign in or choose another number.');
            }
        } catch (err) {
            if (err instanceof AppError) throw err;
            // Studio DB missing or unreachable — skip so signup is not blocked by a dead tenant.
        }
    }

    return { available: true as const, phone: digits };
}

export async function checkPhoneAvailable(rawPhone: string) {
    return assertPhoneAvailableForSignup(rawPhone);
}

export async function quote(modules: string[]) {
    try {
        return quoteOnboarding(modules);
    } catch (e) {
        throw badRequest(e instanceof Error ? e.message : 'Invalid module selection.');
    }
}

export async function startOnboarding(input: OnboardingPayload) {
    await assertPhoneAvailableForSignup(input.phone);
    const plan = quoteOnboarding(input.modules);
    const token = randomToken(16);
    await platformExecute(
        `INSERT INTO tblOnboarding (token, payload_json, amount_paise, status) VALUES (?, ?, ?, 'PENDING')`,
        [token, json(input), plan.amountPaise],
    );
    const receipt = `ob_${token}`.slice(0, 40);
    let order;
    try {
        order = await paymentProvider.createOrder(plan.amountPaise, config.CURRENCY, receipt, {
            purpose: 'onboarding',
            token,
        });
    } catch (e) {
        const msg = e instanceof Error ? e.message : 'Could not start payment.';
        throw badRequest(msg.includes('Razorpay') ? `${msg} Set PAYMENT_PROVIDER=devpay for local testing.` : msg);
    }
    await platformExecute(`UPDATE tblOnboarding SET provider_order_id = ? WHERE token = ?`, [order.id, token]);
    return {
        token,
        amount: order.amount,
        currency: order.currency,
        provider: paymentProvider.name,
        keyId: paymentProvider.publicKey || null,
        providerOrderId: order.id,
        quote: plan,
        studioName: 'Nammaqr',
        description: `Nammaqr studio setup — ${input.companyName}`,
        prefill: { name: input.ownerName, email: input.email, contact: input.phone },
    };
}

function parsePayload(raw: Row['payload_json']): OnboardingPayload {
    if (typeof raw === 'string') return JSON.parse(raw) as OnboardingPayload;
    return raw;
}

async function loadPending(token: string) {
    const row = await platformQueryOne<Row>(
        `SELECT id, token, payload_json, amount_paise, provider_order_id, status, company_slug FROM tblOnboarding WHERE token = ?`,
        [token],
    );
    if (!row) throw notFound('Signup session');
    if (row.status === 'COMPLETED') throw conflict('This company is already created. Sign in with your admin account.');
    if (row.status !== 'PENDING') throw badRequest('This signup session is no longer valid.');
    return { ...row, payload_json: parsePayload(row.payload_json) };
}

async function finalizeCompany(row: Row) {
    const payload = row.payload_json;
    const company = await createCompany({
        name: payload.companyName,
        ownerName: payload.ownerName,
        ownerEmail: payload.email,
        ownerPassword: payload.password,
        phone: payload.phone,
        tagline: payload.about.slice(0, 200) || null,
        companyEmail: payload.companyEmail,
        about: payload.about,
        modules: payload.modules,
    });

    await platformExecute(`UPDATE tblOnboarding SET status = 'COMPLETED', company_slug = ? WHERE token = ?`, [company.slug, row.token]);

    return {
        companyName: company.name,
        slug: company.slug,
        adminEmail: payload.email,
        adminPhone: payload.phone,
        modules: payload.modules,
        message: 'Company created. Sign in with your admin phone or email and password.',
    };
}

export async function completeOnboarding(token: string, providerOrderId: string, providerPaymentId: string, signature: string) {
    const row = await loadPending(token);
    if (row.provider_order_id !== providerOrderId) throw badRequest('Payment order mismatch.');
    if (!paymentProvider.verifySignature(providerOrderId, providerPaymentId, signature)) {
        throw badRequest('Payment verification failed.');
    }
    const payment = await paymentProvider.fetchPayment(providerPaymentId);
    if (payment.amount !== row.amount_paise) throw badRequest('Paid amount does not match the plan.');
    if (payment.status !== 'captured' && payment.status !== 'authorized') throw badRequest('Payment was not completed.');
    return finalizeCompany(row);
}

/** DevPay test gateway — signature still verified server-side. */
export async function completeOnboardingDevPay(token: string, providerOrderId: string, providerPaymentId: string, signature: string) {
    if (config.isProd && !config.ALLOW_DEVPAY) throw badRequest('Test gateway is not available in production.');
    const row = await loadPending(token);
    if (row.provider_order_id !== providerOrderId) throw badRequest('Payment order mismatch.');
    if (!paymentProvider.verifySignature(providerOrderId, providerPaymentId, signature)) {
        throw badRequest('Payment verification failed.');
    }
    return finalizeCompany(row);
}

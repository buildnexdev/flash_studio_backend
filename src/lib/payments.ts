// Developer by: Buildnexdev.in
// Devevloper : Nandhakumar@gmail.com
// Last Edited : 06-10-2026
import { config } from '../config/env.js';
import { hmacHex, randomToken, safeEqual } from '../utils/crypto.js';

export interface ProviderOrder {
    id: string;
    amount: number;
    currency: string;
}

export interface ProviderPayment {
    id: string;
    orderId: string;
    amount: number;
    status: 'created' | 'authorized' | 'captured' | 'refunded' | 'failed';
    method: string | null;
}

export interface PaymentProvider {
    readonly name: 'razorpay' | 'devpay';
    readonly publicKey: string;
    createOrder(amount: number, currency: string, receipt: string, notes: Record<string, string>): Promise<ProviderOrder>;
    /** Checkout callback signature: HMAC_SHA256(order_id + "|" + payment_id, key_secret). */
    verifySignature(orderId: string, paymentId: string, signature: string): boolean;
    fetchPayment(paymentId: string): Promise<ProviderPayment>;
    verifyWebhook(rawBody: Buffer, signature: string): boolean;
    refund(paymentId: string, amount: number): Promise<{ id: string; amount: number }>;
}

class RazorpayProvider implements PaymentProvider {
    readonly name = 'razorpay' as const;
    get publicKey() {
        return config.RAZORPAY_KEY_ID;
    }

    private async call<T>(method: 'GET' | 'POST', path: string, body?: unknown): Promise<T> {
        if (!config.RAZORPAY_KEY_ID || !config.RAZORPAY_KEY_SECRET) throw new Error('Razorpay is not configured (RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET).');
        const res = await fetch(`https://api.razorpay.com/v1${path}`, {
            method,
            headers: {
                Authorization: `Basic ${Buffer.from(`${config.RAZORPAY_KEY_ID}:${config.RAZORPAY_KEY_SECRET}`).toString('base64')}`,
                'Content-Type': 'application/json',
            },
            body: body ? JSON.stringify(body) : undefined,
            signal: AbortSignal.timeout(15_000),
        });
        const data = (await res.json().catch(() => ({}))) as any;
        if (!res.ok) throw new Error(`Razorpay ${path} failed: ${data?.error?.description ?? res.status}`);
        return data as T;
    }

    async createOrder(amount: number, currency: string, receipt: string, notes: Record<string, string>): Promise<ProviderOrder> {
        const o = await this.call<{ id: string; amount: number; currency: string }>('POST', '/orders', { amount, currency, receipt: receipt.slice(0, 40), notes, payment_capture: 1 });
        return { id: o.id, amount: o.amount, currency: o.currency };
    }

    verifySignature(orderId: string, paymentId: string, signature: string): boolean {
        return safeEqual(hmacHex(config.RAZORPAY_KEY_SECRET, `${orderId}|${paymentId}`), signature);
    }

    async fetchPayment(paymentId: string): Promise<ProviderPayment> {
        const p = await this.call<{ id: string; order_id: string; amount: number; status: ProviderPayment['status']; method: string }>('GET', `/payments/${encodeURIComponent(paymentId)}`);
        return { id: p.id, orderId: p.order_id, amount: p.amount, status: p.status, method: p.method ?? null };
    }

    verifyWebhook(rawBody: Buffer, signature: string): boolean {
        if (!config.RAZORPAY_WEBHOOK_SECRET || !signature) return false;
        return safeEqual(hmacHex(config.RAZORPAY_WEBHOOK_SECRET, rawBody.toString('utf8')), signature);
    }

    async refund(paymentId: string, amount: number) {
        const r = await this.call<{ id: string; amount: number }>('POST', `/payments/${encodeURIComponent(paymentId)}/refund`, { amount });
        return { id: r.id, amount: r.amount };
    }
}

/**
 * Local test gateway. It never runs in production (blocked in config/env.ts).
 * The test checkout endpoint "pays" an order and returns a signature that the normal
 * backend verification path checks exactly like a Razorpay signature.
 */
class DevPayProvider implements PaymentProvider {
    readonly name = 'devpay' as const;
    readonly publicKey = 'devpay_test_key';
    private readonly secret = hmacHex(config.APP_SECRET, 'devpay-secret');
    private readonly orders = new Map<string, ProviderOrder>();
    private readonly payments = new Map<string, ProviderPayment>();

    async createOrder(amount: number, currency: string): Promise<ProviderOrder> {
        const order = { id: `devpay_order_${randomToken(9)}`, amount, currency };
        this.orders.set(order.id, order);
        return order;
    }

    /** Simulate the customer completing (or failing) checkout. */
    checkout(orderId: string, outcome: 'success' | 'failure', method = 'upi') {
        const order = this.orders.get(orderId);
        if (!order) throw new Error('Unknown test order');
        const id = `devpay_pay_${randomToken(9)}`;
        const payment: ProviderPayment = { id, orderId, amount: order.amount, status: outcome === 'success' ? 'captured' : 'failed', method };
        this.payments.set(id, payment);
        return { razorpay_order_id: orderId, razorpay_payment_id: id, razorpay_signature: hmacHex(this.secret, `${orderId}|${id}`), status: payment.status };
    }

    verifySignature(orderId: string, paymentId: string, signature: string): boolean {
        return safeEqual(hmacHex(this.secret, `${orderId}|${paymentId}`), signature);
    }

    async fetchPayment(paymentId: string): Promise<ProviderPayment> {
        const p = this.payments.get(paymentId);
        if (!p) throw new Error('Unknown test payment');
        return p;
    }

    signWebhook(rawBody: string): string {
        return hmacHex(this.secret, rawBody);
    }

    verifyWebhook(rawBody: Buffer, signature: string): boolean {
        return !!signature && safeEqual(hmacHex(this.secret, rawBody.toString('utf8')), signature);
    }

    async refund(paymentId: string, amount: number) {
        const p = this.payments.get(paymentId);
        if (p) p.status = 'refunded';
        return { id: `devpay_rfnd_${randomToken(6)}`, amount };
    }
}

function createPaymentProvider(): PaymentProvider {
    const hasRazorpay = Boolean(config.RAZORPAY_KEY_ID && config.RAZORPAY_KEY_SECRET);
    if (config.PAYMENT_PROVIDER === 'devpay' || config.ALLOW_DEVPAY) {
        if (config.PAYMENT_PROVIDER === 'devpay' && config.isProd && !config.ALLOW_DEVPAY) {
            throw new Error('PAYMENT_PROVIDER=devpay requires ALLOW_DEVPAY=true when NODE_ENV=production.');
        }
        if (!hasRazorpay || config.PAYMENT_PROVIDER === 'devpay') {
            if (config.isProd) console.warn('[photolab] Using devpay test gateway (ALLOW_DEVPAY). Configure Razorpay before go-live.');
            else console.warn('[photolab] Razorpay keys missing — using devpay test gateway.');
            return new DevPayProvider();
        }
    }
    if (hasRazorpay) return new RazorpayProvider();
    if (!config.isProd) {
        console.warn('[photolab] Razorpay keys missing — using devpay test gateway.');
        return new DevPayProvider();
    }
    return new RazorpayProvider();
}

export const paymentProvider: PaymentProvider = createPaymentProvider();
export const devPay = paymentProvider instanceof DevPayProvider ? paymentProvider : null;

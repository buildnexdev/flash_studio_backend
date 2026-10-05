import sharp from 'sharp';
import request from 'supertest';
import { expect } from 'vitest';
import { createApp } from '../src/app.js';
import { TEST_PASSWORD } from '../src/db/seed.js';

export const app = createApp();
export const api = () => request(app);
export const PASSWORD = TEST_PASSWORD;

let counter = 0;
export const unique = (prefix: string) => `${prefix}${Date.now().toString(36)}${(counter++).toString(36)}`;

export const bearer = (token: string) => ({ Authorization: `Bearer ${token}` });

export async function login(identifier: string, password = PASSWORD): Promise<string> {
    const res = await api().post('/api/auth/login').send({ identifier, password });
    expect(res.status, JSON.stringify(res.body)).toBe(200);
    return res.body.data.accessToken as string;
}

export async function registerCustomer(name = 'Test Customer') {
    const email = `${unique('cust')}@example.com`;
    const res = await api().post('/api/auth/register').send({ name, email, password: 'Customer123' });
    expect(res.status, JSON.stringify(res.body)).toBe(201);
    return { email, token: res.body.data.accessToken as string, user: res.body.data.user as { id: number; customerId: number } };
}

/** A distinct photo-like JPEG (random noise so every file has a different checksum). */
export function noiseJpeg(width = 1400, height = 933): Promise<Buffer> {
    return sharp({
        create: { width, height, channels: 3, background: { r: 90 + Math.floor(Math.random() * 100), g: 120, b: 160 }, noise: { type: 'gaussian', mean: 128, sigma: 40 } },
    })
        .jpeg({ quality: 82 })
        .toBuffer();
}

/** Money helper: rupees to paise. */
export const inr = (rupees: number) => Math.round(rupees * 100);

/** Pay a payment intent through the devpay test gateway and the real backend verification endpoint. */
export async function payWithDevpay(token: string, target: { bookingId?: number; orderId?: number; purpose?: 'ADVANCE' | 'BALANCE' }) {
    const intent = await api().post('/api/payments/create').set(bearer(token)).send(target);
    expect(intent.status, JSON.stringify(intent.body)).toBe(201);
    const checkout = await api().post('/api/payments/devpay/checkout').set(bearer(token)).send({ paymentId: intent.body.data.paymentId, outcome: 'success' });
    expect(checkout.status, JSON.stringify(checkout.body)).toBe(200);
    const verify = await api()
        .post('/api/payments/verify')
        .set(bearer(token))
        .send({
            paymentId: intent.body.data.paymentId,
            providerOrderId: checkout.body.data.razorpay_order_id,
            providerPaymentId: checkout.body.data.razorpay_payment_id,
            signature: checkout.body.data.razorpay_signature,
        });
    expect(verify.status, JSON.stringify(verify.body)).toBe(200);
    expect(verify.body.data.status).toBe('SUCCESS');
    return { intent: intent.body.data, payment: verify.body.data };
}

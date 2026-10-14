import { beforeAll, describe, expect, it } from 'vitest';
import { devPay } from '../../src/lib/payments.js';
import { api, bearer, login, payWithDevpay, registerCustomer } from '../helpers.js';

let admin: string;
let packageId: number;
let packagePrice: number;

async function packageOrder(token: string) {
    const res = await api().post('/api/orders').set(bearer(token)).send({ type: 'PACKAGE', packageId });
    expect(res.status, JSON.stringify(res.body)).toBe(201);
    return res.body.data as { id: number; total: number };
}

beforeAll(async () => {
    admin = await login('admin@photolab.test');
    const pkgs = (await api().get('/api/public/packages')).body.data as { id: number; name: string; price: number }[];
    const p = (pkgs.find((x) => x.name === 'Wedding Silver Collection') ?? pkgs[0])!;
    packageId = p.id;
    packagePrice = Number(p.price);
});

describe('payments', () => {
    it('prices orders on the server and ignores client-supplied amounts', async () => {
        const c = await registerCustomer();
        const res = await api().post('/api/orders').set(bearer(c.token)).send({ type: 'PACKAGE', packageId, total: 1, amount: 1 });
        expect(res.body.data.total).toBe(packagePrice);
        const intent = await api().post('/api/payments/create').set(bearer(c.token)).send({ orderId: res.body.data.id, amount: 100 });
        expect(intent.body.data.amount).toBe(packagePrice);
    });

    it('confirms a payment from a signed gateway webhook and ignores replays', async () => {
        const c = await registerCustomer();
        const order = await packageOrder(c.token);
        const intent = (await api().post('/api/payments/create').set(bearer(c.token)).send({ orderId: order.id })).body.data;
        const done = devPay!.checkout(intent.providerOrderId, 'success');
        const body = JSON.stringify({
            event: 'payment.captured',
            payload: { payment: { entity: { id: done.razorpay_payment_id, order_id: intent.providerOrderId, amount: intent.amount, method: 'upi' } } },
        });

        const forged = await api().post('/api/payments/webhook').set('Content-Type', 'application/json').set('X-Razorpay-Signature', 'f'.repeat(64)).send(body);
        expect(forged.status).toBe(403);

        const hook = await api().post('/api/payments/webhook').set('Content-Type', 'application/json').set('X-Razorpay-Signature', devPay!.signWebhook(body)).send(body);
        expect(hook.status).toBe(200);
        expect(hook.body.data.handled).toBe(true);
        const replay = await api().post('/api/payments/webhook').set('Content-Type', 'application/json').set('X-Razorpay-Signature', devPay!.signWebhook(body)).send(body);
        expect(replay.status).toBe(200);

        const o = await api().get(`/api/orders/${order.id}`).set(bearer(c.token));
        expect(o.body.data.status).toBe('COMPLETED');
        expect(o.body.data.payments.filter((p: { status: string }) => p.status === 'SUCCESS').length).toBe(1);
        expect(o.body.data.invoice.invoice_no).toMatch(/^INV-\d{6}-\d{4}$/);
    });

    it('rejects webhooks whose amount does not match the payment', async () => {
        const c = await registerCustomer();
        const order = await packageOrder(c.token);
        const intent = (await api().post('/api/payments/create').set(bearer(c.token)).send({ orderId: order.id })).body.data;
        const body = JSON.stringify({ event: 'payment.captured', payload: { payment: { entity: { id: 'pay_x', order_id: intent.providerOrderId, amount: 100 } } } });
        const res = await api().post('/api/payments/webhook').set('Content-Type', 'application/json').set('X-Razorpay-Signature', devPay!.signWebhook(body)).send(body);
        expect(res.body.data.handled).toBe(false);
        expect((await api().get(`/api/orders/${order.id}`).set(bearer(c.token))).body.data.status).toBe('CREATED');
    });

    it('marks declined payments as failed without fulfilling the order', async () => {
        const c = await registerCustomer();
        const order = await packageOrder(c.token);
        const intent = (await api().post('/api/payments/create').set(bearer(c.token)).send({ orderId: order.id })).body.data;
        const done = (await api().post('/api/payments/devpay/checkout').set(bearer(c.token)).send({ paymentId: intent.paymentId, outcome: 'failure' })).body.data;
        const res = await api()
            .post('/api/payments/verify')
            .set(bearer(c.token))
            .send({ paymentId: intent.paymentId, providerOrderId: done.razorpay_order_id, providerPaymentId: done.razorpay_payment_id, signature: done.razorpay_signature });
        expect(res.status).toBe(400);
        const p = await api().get(`/api/payments/${intent.paymentId}`).set(bearer(c.token));
        expect(p.body.data.status).toBe('FAILED');
        expect((await api().get(`/api/orders/${order.id}`).set(bearer(c.token))).body.data.status).toBe('CREATED');
        // The customer can retry with a fresh payment
        await payWithDevpay(c.token, { orderId: order.id });
    });

    it('prevents paying or verifying another customer’s order', async () => {
        const a = await registerCustomer();
        const b = await registerCustomer();
        const order = await packageOrder(a.token);
        expect((await api().post('/api/payments/create').set(bearer(b.token)).send({ orderId: order.id })).status).toBe(404);
        const intent = (await api().post('/api/payments/create').set(bearer(a.token)).send({ orderId: order.id })).body.data;
        const done = devPay!.checkout(intent.providerOrderId, 'success');
        const steal = await api()
            .post('/api/payments/verify')
            .set(bearer(b.token))
            .send({ paymentId: intent.paymentId, providerOrderId: done.razorpay_order_id, providerPaymentId: done.razorpay_payment_id, signature: done.razorpay_signature });
        expect(steal.status).toBe(404);
        expect((await api().get(`/api/payments/${intent.paymentId}`).set(bearer(b.token))).status).toBe(404);
    });

    it('records offline payments and processes refunds', async () => {
        const c = await registerCustomer();
        const order = await packageOrder(c.token);
        const wrong = await api().post('/api/payments/offline').set(bearer(admin)).send({ orderId: order.id, amount: 100, method: 'cash' });
        expect(wrong.status).toBe(400);
        const rec = await api().post('/api/payments/offline').set(bearer(admin)).send({ orderId: order.id, amount: order.total, method: 'cash', reference: 'Receipt 42' });
        expect(rec.status, JSON.stringify(rec.body)).toBe(201);
        expect(rec.body.data.status).toBe('SUCCESS');
        const partial = await api().post(`/api/payments/${rec.body.data.id}/refund`).set(bearer(admin)).send({ amount: 10000, reason: 'Goodwill discount' });
        expect(partial.body.data).toMatchObject({ status: 'SUCCESS', refunded_amount: 10000 });
        const rest = await api().post(`/api/payments/${rec.body.data.id}/refund`).set(bearer(admin)).send({ reason: 'Cancelled' });
        expect(rest.body.data.status).toBe('REFUNDED');
        expect((await api().post(`/api/payments/${rec.body.data.id}/refund`).set(bearer(admin)).send({ reason: 'Again' })).status).toBe(409);
    });
});

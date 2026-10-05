import { describe, expect, it } from 'vitest';
import { api, bearer, login, PASSWORD, registerCustomer, unique } from '../helpers.js';

const xhr = { 'X-Requested-With': 'XMLHttpRequest' };
const cookieFrom = (res: { headers: Record<string, unknown> }) => {
    const raw = res.headers['set-cookie'] as string[] | undefined;
    return raw?.find((c) => c.startsWith('pl_rt='))?.split(';')[0] ?? '';
};

describe('authentication', () => {
    it('uses the standard response envelope', async () => {
        const res = await api().get('/api/health');
        expect(res.body).toMatchObject({ success: true, message: 'OK' });
        const bad = await api().post('/api/auth/login').send({ identifier: 'x' });
        expect(bad.status).toBe(422);
        expect(bad.body.success).toBe(false);
        expect(Array.isArray(bad.body.errors)).toBe(true);
    });

    it('registers a customer and returns a session with the refresh token only in an httpOnly cookie', async () => {
        const email = `${unique('reg')}@example.com`;
        const res = await api().post('/api/auth/register').send({ name: 'New Person', email, password: 'Secret123' });
        expect(res.status).toBe(201);
        expect(res.body.data.user.roles).toEqual(['CUSTOMER']);
        expect(res.body.data.user.customerId).toBeGreaterThan(0);
        expect(res.body.data.refreshToken).toBeUndefined();
        expect(res.body.data.home).toBe('/customer/dashboard');
        const cookie = (res.headers['set-cookie'] as unknown as string[]).find((c) => c.startsWith('pl_rt='))!;
        expect(cookie).toMatch(/HttpOnly/i);
        expect(cookie).toMatch(/SameSite=Strict/i);
        const dup = await api().post('/api/auth/register').send({ name: 'Again', email, password: 'Secret123' });
        expect(dup.status).toBe(409);
    });

    it('enforces password rules', async () => {
        const res = await api().post('/api/auth/register').send({ name: 'Weak', email: `${unique('w')}@example.com`, password: 'short' });
        expect(res.status).toBe(422);
        expect(res.body.errors.some((e: { field: string }) => e.field === 'password')).toBe(true);
    });

    it('rejects bad credentials with a generic message and locks after repeated failures', async () => {
        const { email } = await registerCustomer();
        for (let i = 0; i < 5; i++) {
            const r = await api().post('/api/auth/login').send({ identifier: email, password: 'Wrong1234' });
            expect(r.status).toBe(401);
            expect(r.body.message).toBe('Incorrect email/phone or password.');
        }
        const locked = await api().post('/api/auth/login').send({ identifier: email, password: 'Customer123' });
        expect(locked.status).toBe(429);
        const unknown = await api().post('/api/auth/login').send({ identifier: 'nobody@example.com', password: 'Whatever1' });
        expect(unknown.status).toBe(401);
        expect(unknown.body.message).toBe('Incorrect email/phone or password.');
    });

    it('rotates refresh tokens and revokes the family on reuse', async () => {
        const res = await api().post('/api/auth/login').send({ identifier: 'manager@photolab.test', password: PASSWORD });
        const first = cookieFrom(res);
        expect(first).toMatch(/^pl_rt=/);

        const noHeader = await api().post('/api/auth/refresh').set('Cookie', first);
        expect(noHeader.status).toBe(403);

        const rotated = await api().post('/api/auth/refresh').set('Cookie', first).set(xhr);
        expect(rotated.status).toBe(200);
        const second = cookieFrom(rotated);
        expect(second).not.toBe(first);

        const replay = await api().post('/api/auth/refresh').set('Cookie', first).set(xhr);
        expect(replay.status).toBe(401);
        const afterReuse = await api().post('/api/auth/refresh').set('Cookie', second).set(xhr);
        expect(afterReuse.status).toBe(401);
    });

    it('gives native apps the refresh token in the body', async () => {
        const res = await api().post('/api/auth/login').set('X-Client', 'mobile').send({ identifier: 'photographer@photolab.test', password: PASSWORD });
        expect(res.body.data.refreshToken).toBeTruthy();
        const r = await api().post('/api/auth/refresh').set('X-Client', 'mobile').send({ refreshToken: res.body.data.refreshToken });
        expect(r.status).toBe(200);
        expect(r.body.data.refreshToken).toBeTruthy();
    });

    it('invalidates live access tokens on logout from all devices', async () => {
        const { token } = await registerCustomer();
        expect((await api().get('/api/auth/me').set(bearer(token))).status).toBe(200);
        expect((await api().post('/api/auth/logout-all').set(bearer(token))).status).toBe(200);
        expect((await api().get('/api/auth/me').set(bearer(token))).status).toBe(401);
    });

    it('signs in with a one-time code', async () => {
        const { email } = await registerCustomer();
        const req = await api().post('/api/auth/otp/request').send({ destination: email, purpose: 'LOGIN' });
        expect(req.status).toBe(200);
        const code = req.body.data.devCode as string;
        expect(code).toMatch(/^\d{6}$/);
        const wrong = await api().post('/api/auth/otp/verify').send({ destination: email, purpose: 'LOGIN', code: code === '000000' ? '111111' : '000000' });
        expect(wrong.status).toBe(400);
        const ok = await api().post('/api/auth/otp/verify').send({ destination: email, purpose: 'LOGIN', code });
        expect(ok.status).toBe(200);
        expect(ok.body.data.accessToken).toBeTruthy();
        const reuse = await api().post('/api/auth/otp/verify').send({ destination: email, purpose: 'LOGIN', code });
        expect(reuse.status).toBe(400);
    });

    it('does not reveal whether an account exists when requesting codes or resets', async () => {
        const otp = await api().post('/api/auth/otp/request').send({ destination: 'ghost@example.com' });
        expect(otp.status).toBe(200);
        expect(otp.body.data.devCode).toBeUndefined();
        const reset = await api().post('/api/auth/forgot-password').send({ email: 'ghost@example.com' });
        expect(reset.status).toBe(200);
    });

    it('resets a password with the emailed token and revokes old sessions', async () => {
        const { email, token } = await registerCustomer();
        const fp = await api().post('/api/auth/forgot-password').send({ email });
        const link = new URL(fp.body.data.devResetLink, 'http://x');
        const resetToken = link.searchParams.get('token')!;
        const bad = await api().post('/api/auth/reset-password').send({ email, token: 'x'.repeat(20), password: 'NewPass123' });
        expect(bad.status).toBe(400);
        const ok = await api().post('/api/auth/reset-password').send({ email, token: resetToken, password: 'NewPass123' });
        expect(ok.status).toBe(200);
        expect((await api().get('/api/auth/me').set(bearer(token))).status).toBe(401);
        await login(email, 'NewPass123');
    });
});

import { beforeAll, describe, expect, it } from 'vitest';
import { api, bearer, login, registerCustomer, unique } from '../helpers.js';

let admin: string, owner: string, manager: string, photographer: string, editor: string, printer: string, customer: string;

beforeAll(async () => {
    [admin, owner, manager, photographer, editor, printer] = await Promise.all(
        ['admin', 'owner', 'manager', 'photographer', 'editor', 'delivery'].map((u) => login(`${u}@photolab.test`)),
    );
    customer = await login('customer@photolab.test');
});

describe('RBAC', () => {
    it('requires authentication on protected APIs', async () => {
        for (const path of ['/api/bookings', '/api/customers', '/api/payments', '/api/reports/dashboard', '/api/photos', '/api/settings', '/api/audit-logs']) {
            const res = await api().get(path);
            expect(res.status, path).toBe(401);
            expect(res.body.success).toBe(false);
        }
        const forged = await api().get('/api/bookings').set(bearer('eyJhbGciOiJIUzI1NiJ9.e30.invalid'));
        expect(forged.status).toBe(401);
    });

    it('keeps customers out of studio administration', async () => {
        const checks: [string, string][] = [
            ['get', '/api/customers'],
            ['get', '/api/reports/dashboard'],
            ['get', '/api/audit-logs'],
            ['get', '/api/users'],
            ['get', '/api/galleries'],
            ['get', '/api/printing'],
            ['get', '/api/delivery'],
            ['post', '/api/payments/offline'],
        ];
        for (const [method, path] of checks) {
            const res = await (api() as unknown as Record<string, (p: string) => ReturnType<ReturnType<typeof api>['get']>>)[method](path).set(bearer(customer)).send({});
            expect(res.status, `${method} ${path}`).toBe(403);
        }
        const settings = await api().put('/api/settings/studio').set(bearer(customer)).send({ name: 'Hacked' });
        expect(settings.status).toBe(403);
    });

    it('limits each staff role to its own area', async () => {
        expect((await api().get('/api/payments').set(bearer(photographer))).status).toBe(403);
        expect((await api().get('/api/customers').set(bearer(photographer))).status).toBe(403);
        expect((await api().get('/api/bookings').set(bearer(printer))).status).toBe(403);
        expect((await api().post('/api/photos/bulk').set(bearer(editor)).send({ ids: [1], action: 'delete' })).status).toBe(403);
        expect((await api().get('/api/printing').set(bearer(printer))).status).toBe(200);
        expect((await api().get('/api/photos/editor/queue').set(bearer(editor))).status).toBe(200);
        expect((await api().get('/api/reports/dashboard').set(bearer(manager))).status).toBe(200);
        expect((await api().get('/api/audit-logs').set(bearer(manager))).status).toBe(403);
        expect((await api().get('/api/audit-logs').set(bearer(owner))).status).toBe(200);
    });

    it('only super admins can edit role permissions or grant super admin', async () => {
        const r1 = await api().put('/api/users/roles/MANAGER/permissions').set(bearer(owner)).send({ permissions: ['dashboard.view'] });
        expect(r1.status).toBe(403);
        const r2 = await api()
            .post('/api/users')
            .set(bearer(owner))
            .send({ name: 'Sneaky', email: `${unique('sa')}@example.com`, password: 'Sneaky1234', roles: ['SUPER_ADMIN'] });
        expect(r2.status).toBe(403);
        const r3 = await api()
            .post('/api/users')
            .set(bearer(admin))
            .send({ name: 'New Shooter', email: `${unique('ph')}@example.com`, password: 'Shooter123', roles: ['PHOTOGRAPHER'] });
        expect(r3.status).toBe(201);
    });

    it('isolates customer records from other customers', async () => {
        const a = await registerCustomer('Customer A');
        const b = await registerCustomer('Customer B');
        const booking = await api()
            .post('/api/bookings')
            .set(bearer(a.token))
            .send({ eventType: 'Birthday', eventDate: new Date(Date.now() + 20 * 86400000).toISOString().slice(0, 10) });
        expect(booking.status).toBe(201);
        const id = booking.body.data.id;
        expect((await api().get(`/api/bookings/${id}`).set(bearer(a.token))).status).toBe(200);
        expect((await api().get(`/api/bookings/${id}`).set(bearer(b.token))).status).toBe(404);
        const list = await api().get('/api/bookings').set(bearer(b.token));
        expect(list.body.data.items.find((x: { id: number }) => x.id === id)).toBeUndefined();
    });

    it('limits photographers to events they are assigned to', async () => {
        const c = await registerCustomer('Event Owner');
        const ev = await api()
            .post('/api/events')
            .set(bearer(manager))
            .send({ customerId: c.user.customerId, title: 'Unassigned shoot', eventType: 'Portrait', eventDate: new Date(Date.now() + 5 * 86400000).toISOString().slice(0, 10) });
        expect(ev.status).toBe(201);
        const id = ev.body.data.id;
        expect([403, 404]).toContain((await api().get(`/api/events/${id}`).set(bearer(photographer))).status);
        expect([403, 404]).toContain((await api().post(`/api/events/${id}/start`).set(bearer(photographer))).status);
        const me = await api().get('/api/auth/me').set(bearer(photographer));
        await api().post(`/api/events/${id}/staff`).set(bearer(manager)).send({ userId: me.body.data.user.id, role: 'PHOTOGRAPHER' }).expect(200);
        expect((await api().get(`/api/events/${id}`).set(bearer(photographer))).status).toBe(200);
        expect((await api().post(`/api/events/${id}/complete`).set(bearer(photographer))).status).toBe(403);
    });
});

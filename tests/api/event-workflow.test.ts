import { describe, expect, it } from 'vitest';
import { api, bearer, login, registerCustomer } from '../helpers.js';

const futureDate = (days: number) => new Date(Date.now() + days * 86400000).toISOString().slice(0, 10);

describe('event management workflow', () => {
    it('blocks a second event in the same time slot and reports a free slot', async () => {
        const admin = await login('admin@photolab.test');
        const customer = await registerCustomer('Slot Customer');
        const eventDate = futureDate(80 + (Date.now() % 40));
        const body = { customerId: customer.user.customerId, title: 'Morning wedding', eventType: 'Wedding', eventDate, startTime: '09:00', endTime: '12:00', venue: 'Hall A' };
        const first = await api().post('/api/events').set(bearer(admin)).send(body);
        expect(first.status, JSON.stringify(first.body)).toBe(201);

        const clash = await api().post('/api/events').set(bearer(admin)).send({ ...body, title: 'Overlap wedding' });
        expect(clash.status).toBe(409);

        const free = await api().get('/api/events/availability').query({ date: eventDate, start: '13:00', end: '15:00' }).set(bearer(admin));
        expect(free.status).toBe(200);
        expect(free.body.data.available).toBe(true);

        const busy = await api().get('/api/events/availability').query({ date: eventDate, start: '10:00', end: '11:00' }).set(bearer(admin));
        expect(busy.body.data.available).toBe(false);
    });

    it('emails a quotation PDF, tracks a revision, and keeps another customer out', async () => {
        const admin = await login('admin@photolab.test');
        const customer = await registerCustomer('Quote Customer');
        const other = await registerCustomer('Other Customer');
        const eventDate = futureDate(140);
        const booking = await api().post('/api/bookings').set(bearer(admin)).send({
            customerId: customer.user.customerId,
            eventType: 'Reception',
            eventDate,
            startTime: '16:00',
            endTime: '20:00',
            venue: 'Hall B',
        });
        expect(booking.status, JSON.stringify(booking.body)).toBe(201);
        const bookingId = booking.body.data.id;

        const quote = await api()
            .post(`/api/bookings/${bookingId}/quotations`)
            .set(bearer(admin))
            .send({
                items: [
                    { description: 'Photography coverage', quantity: 1, unitPrice: 2500000 },
                    { description: 'Album and digital delivery', quantity: 1, unitPrice: 800000 },
                ],
                discount: 0,
                taxPercent: 18,
                advancePercent: 40,
                terms: '40% advance confirms the date. Balance before delivery.',
                notes: 'Edited gallery, album selection and permitted downloads.',
            });
        expect(quote.status, JSON.stringify(quote.body)).toBe(201);
        const quotationId = quote.body.data.quotations[0].id;

        const sent = await api().post(`/api/bookings/quotations/${quotationId}/send`).set(bearer(admin));
        expect(sent.status, JSON.stringify(sent.body)).toBe(200);
        const pdf = await api().get(`/api/bookings/quotations/${quotationId}/pdf`).set(bearer(customer.token)).buffer(true).parse((res, cb) => {
            const chunks: Buffer[] = [];
            res.on('data', (chunk: Buffer) => chunks.push(chunk));
            res.on('end', () => cb(null, Buffer.concat(chunks)));
        });
        expect(pdf.status).toBe(200);
        expect(pdf.headers['content-type']).toMatch(/application\/pdf/);
        expect(Buffer.isBuffer(pdf.body) ? pdf.body.subarray(0, 5).toString() : String(pdf.body).slice(0, 5)).toBe('%PDF-');

        const declined = await api().post(`/api/bookings/quotations/${quotationId}/respond`).set(bearer(customer.token)).send({ decision: 'REJECT' });
        expect(declined.status).toBe(200);
        const revised = await api().post(`/api/bookings/quotations/${quotationId}/revise`).set(bearer(admin)).send({ note: 'Added an extra photographer' });
        expect(revised.status, JSON.stringify(revised.body)).toBe(200);
        const drafts = revised.body.data.quotations.filter((row: { status: string }) => row.status === 'DRAFT');
        expect(drafts[0].revision).toBe(2);

        const hidden = await api().get(`/api/bookings/${bookingId}`).set(bearer(other.token));
        expect(hidden.status).toBe(404);
    });

    it('rejects an unknown studio and an expired event QR', async () => {
        const admin = await login('admin@photolab.test');
        const missing = await api().get('/api/events').set('X-Studio-Slug', 'studio-that-does-not-exist');
        expect(missing.status).toBe(404);

        const customer = await registerCustomer('QR Customer');
        const eventDate = futureDate(200);
        const created = await api().post('/api/events').set(bearer(admin)).send({
            customerId: customer.user.customerId,
            title: 'Evening portraits',
            eventType: 'Portrait',
            eventDate,
            startTime: '18:00',
            endTime: '20:00',
        });
        expect(created.status, JSON.stringify(created.body)).toBe(201);
        const eventId = created.body.data.id;
        await api().post(`/api/events/${eventId}/start`).set(bearer(admin)).expect(200);
        const detail = await api().get(`/api/events/${eventId}`).set(bearer(admin));
        const galleryId = detail.body.data.gallery.id;
        const soon = new Date(Date.now() + 2500).toISOString().slice(0, 19).replace('T', ' ');
        const qr = await api().post(`/api/galleries/${galleryId}/qr`).set(bearer(admin)).send({ scope: 'EVENT', label: 'Short link', expiresAt: soon });
        expect(qr.status, JSON.stringify(qr.body)).toBe(201);
        const token = qr.body.data.url.split('/g/')[1];
        await new Promise((resolve) => setTimeout(resolve, 4000));
        const expired = await api().post('/api/gallery/access').send({ token });
        expect(expired.status).toBe(401);

        const live = await api().post(`/api/galleries/${galleryId}/qr`).set(bearer(admin)).send({ scope: 'EVENT', label: 'Guest link' });
        const liveToken = live.body.data.url.split('/g/')[1];
        const access = await api().post('/api/gallery/access').send({ token: liveToken });
        expect(access.status).toBe(200);
        const session = access.body.data.session;
        const otherGallery = await api().get(`/api/gallery/${galleryId + 99999}`).set('X-Gallery-Session', session);
        expect(otherGallery.status).toBeGreaterThanOrEqual(401);

        const saved = await api().put(`/api/customers/${customer.user.customerId}`).set(bearer(admin)).send({ name: 'QR Customer', phone: '9876501234' });
        expect(saved.status, JSON.stringify(saved.body)).toBe(200);
        const rejected = await api().post(`/api/gallery/${galleryId}/phone/claim`).set('X-Gallery-Session', session).send({ phone: '9000000000' });
        expect(rejected.status).toBe(403);
        const claimed = await api().post(`/api/gallery/${galleryId}/phone/claim`).set('X-Gallery-Session', session).send({ phone: '9876501234' });
        expect(claimed.status, JSON.stringify(claimed.body)).toBe(200);
        expect(claimed.body.data.session).toBeTruthy();
        const locked = await api().get(`/api/gallery/${galleryId}`).set('X-Gallery-Session', session);
        expect(locked.status).toBe(403);
        const openedByClaim = await api().get(`/api/gallery/${galleryId}`).set('X-Gallery-Session', claimed.body.data.session);
        expect(openedByClaim.status, JSON.stringify(openedByClaim.body)).toBe(200);

        const code = await api().post(`/api/gallery/${galleryId}/phone/request`).set('X-Gallery-Session', session).send({ phone: '9876501234' });
        expect(code.status, JSON.stringify(code.body)).toBe(200);
        expect(code.body.data.devCode).toMatch(/^\d{6}$/);
        const verified = await api().post(`/api/gallery/${galleryId}/phone/verify`).set('X-Gallery-Session', session).send({ phone: '9876501234', code: code.body.data.devCode, consent: true });
        expect(verified.status, JSON.stringify(verified.body)).toBe(200);
        expect(verified.body.data.proof).toBeTruthy();
        const opened = await api().get(`/api/gallery/${galleryId}`).set('X-Gallery-Session', session).set('X-Event-Phone', verified.body.data.proof);
        expect(opened.status).toBe(200);
        expect(opened.body.data.eventId).toBe(eventId);
    });
});

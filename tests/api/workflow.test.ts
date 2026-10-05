import { beforeAll, describe, expect, it } from 'vitest';
import { photoQueue } from '../../src/modules/photos/photos.service.js';
import { api, bearer, login, noiseJpeg, payWithDevpay, registerCustomer, unique } from '../helpers.js';

/** Turn an absolute signed URL into a path the in-process app can serve. */
const localPath = (url: string) => {
    const u = new URL(url);
    return `${u.pathname}${u.search}`;
};

const futureDate = (days: number) => new Date(Date.now() + days * 86400000).toISOString().slice(0, 10);

/**
 * Full studio workflow, in order:
 * enquiry -> quotation -> acceptance -> advance payment -> confirmation -> event & staff -> live shoot & upload ->
 * QR gallery -> HD purchase & signed download -> selection -> editing -> completion -> album proof & revision ->
 * printing -> delivery -> balance payment -> booking completed -> reports & audit.
 */
describe('booking-to-delivery workflow', () => {
    let admin: string, photographer: string, editor: string, printer: string;
    let photographerId: number, editorId: number;
    const customerEmail = `${unique('bride')}@example.com`;
    let customer: string, customerId: number;
    let bookingId: number, eventId: number, galleryId: number;
    let photoIds: number[] = [];
    let qrToken: string, qrTokenId: number, gallerySession: string;
    let bookingTotal: number, advance: number;

    beforeAll(async () => {
        [admin, photographer, editor, printer] = await Promise.all(['admin', 'photographer', 'editor', 'delivery'].map((u) => login(`${u}@photolab.test`)));
        photographerId = (await api().get('/api/auth/me').set(bearer(photographer))).body.data.user.id;
        editorId = (await api().get('/api/auth/me').set(bearer(editor))).body.data.user.id;
    });

    it('1. receives a website enquiry for a package', async () => {
        const packages = await api().get('/api/public/packages');
        const gold = packages.body.data.find((p: { name: string }) => p.name === 'Wedding Gold');
        expect(gold.includes_digital).toBe(1);
        const res = await api()
            .post('/api/public/enquiry')
            .send({ name: 'Ananya Rao', email: customerEmail, phone: '9876543210', eventType: 'Wedding', eventDate: futureDate(40), venue: 'Grand Palace, Chennai', packageId: gold.id, guests: 300 });
        expect(res.status, JSON.stringify(res.body)).toBe(201);
        bookingId = res.body.data.id;
        const b = await api().get(`/api/bookings/${bookingId}`).set(bearer(admin));
        expect(b.body.data.status).toBe('ENQUIRY');
        expect(b.body.data.source).toBe('WEBSITE');
    });

    it('2. rejects honeypot spam on the public form', async () => {
        const res = await api().post('/api/public/enquiry').send({ name: 'Bot', email: 'bot@example.com', phone: '9999999999', eventType: 'Wedding', eventDate: futureDate(10), website: 'http://spam' });
        expect(res.status).toBe(422);
    });

    it('3. sends a quotation that the customer accepts after registering', async () => {
        const q = await api()
            .post(`/api/bookings/${bookingId}/quotations`)
            .set(bearer(admin))
            .send({ items: [{ description: 'Wedding Gold - full day, 2 photographers', quantity: 1, unitPrice: 10000000 }, { description: 'Drone coverage', quantity: 1, unitPrice: 1500000 }], discount: 500000, taxPercent: 18, advancePercent: 30 });
        expect(q.status, JSON.stringify(q.body)).toBe(201);
        const quotation = q.body.data.quotations[0];
        expect(quotation.total).toBe(Math.round((11500000 - 500000) * 1.18));
        await api().post(`/api/bookings/quotations/${quotation.id}/send`).set(bearer(admin)).expect(200);

        const reg = await api().post('/api/auth/register').send({ name: 'Ananya Rao', email: customerEmail, password: 'Wedding2026' });
        expect(reg.status).toBe(201);
        customer = reg.body.data.accessToken;
        customerId = reg.body.data.user.customerId;

        const mine = await api().get('/api/bookings').set(bearer(customer));
        expect(mine.body.data.items.map((x: { id: number }) => x.id)).toContain(bookingId);

        const acc = await api().post(`/api/bookings/quotations/${quotation.id}/respond`).set(bearer(customer)).send({ decision: 'ACCEPT' });
        expect(acc.status).toBe(200);
        expect(acc.body.data.status).toBe('ADVANCE_PENDING');
        bookingTotal = acc.body.data.total_amount;
        advance = acc.body.data.advance_amount;
        expect(advance).toBe(Math.round(bookingTotal * 0.3));
        expect(acc.body.data.can_pay_advance).toBe(true);
    });

    it('4. never trusts the client: a forged payment signature is rejected', async () => {
        const intent = await api().post('/api/payments/create').set(bearer(customer)).send({ bookingId });
        expect(intent.status).toBe(201);
        expect(intent.body.data.amount).toBe(advance);
        const res = await api()
            .post('/api/payments/verify')
            .set(bearer(customer))
            .send({ paymentId: intent.body.data.paymentId, providerOrderId: intent.body.data.providerOrderId, providerPaymentId: 'pay_forged_123', signature: 'a'.repeat(64) });
        expect(res.status).toBe(400);
        const b = await api().get(`/api/bookings/${bookingId}`).set(bearer(customer));
        expect(b.body.data.status).toBe('ADVANCE_PENDING');
        expect(b.body.data.paid_amount).toBe(0);
    });

    it('5. confirms the booking and creates the event after the advance is paid', async () => {
        const { payment } = await payWithDevpay(customer, { bookingId });
        expect(payment.amount).toBe(advance);
        expect(payment.invoice_no).toMatch(/^INV-/);
        const b = await api().get(`/api/bookings/${bookingId}`).set(bearer(admin));
        expect(b.body.data.status).toBe('CONFIRMED');
        expect(b.body.data.paid_amount).toBe(advance);
        expect(b.body.data.event).toBeTruthy();
        eventId = b.body.data.event.id;
        const e = await api().get(`/api/events/${eventId}`).set(bearer(admin));
        galleryId = e.body.data.gallery.id;
        expect(e.body.data.status).toBe('UPCOMING');
    });

    it('6. assigns the photographer, who cannot upload before the event starts', async () => {
        await api().post(`/api/events/${eventId}/staff`).set(bearer(admin)).send({ userId: photographerId, role: 'PHOTOGRAPHER', cameraLabel: 'CAM-A' }).expect(200);
        const mine = await api().get('/api/events/mine').set(bearer(photographer));
        expect(mine.body.data.map((x: { event_id?: number; id?: number }) => x.event_id ?? x.id)).toContain(eventId);
        // The event list must work under ONLY_FULL_GROUP_BY, for managers and for assigned staff
        const all = await api().get('/api/events').query({ pageSize: 100 }).set(bearer(admin)).expect(200);
        expect(all.body.data.items.find((x: { id: number }) => x.id === eventId)?.gallery_id).toBe(galleryId);
        const assigned = await api().get('/api/events').query({ pageSize: 100 }).set(bearer(photographer)).expect(200);
        expect(assigned.body.data.items.map((x: { id: number }) => x.id)).toContain(eventId);
        const early = await api().post('/api/photos/upload').set(bearer(photographer)).field('eventId', String(eventId)).attach('files', await noiseJpeg(), 'early.jpg');
        expect(early.status).toBe(409);
    });

    it('7. goes live and processes uploaded photos with idempotent retries', async () => {
        const start = await api().post(`/api/events/${eventId}/start`).set(bearer(photographer));
        expect(start.status, JSON.stringify(start.body)).toBe(200);
        const ids = ['cam-a-0001', 'cam-a-0002', 'cam-a-0003'];
        let req = api().post('/api/photos/upload').set(bearer(photographer)).field('eventId', String(eventId)).field('cameraLabel', 'CAM-A').field('clientUploadIds', JSON.stringify(ids));
        for (const [i] of ids.entries()) req = req.attach('files', await noiseJpeg(), `IMG_000${i + 1}.jpg`);
        const up = await req;
        expect(up.status, JSON.stringify(up.body)).toBe(200);
        expect(up.body.data.uploaded).toBe(3);
        photoIds = up.body.data.results.map((r: { photoId: number }) => r.photoId);

        // A retried upload from the offline queue must not create a duplicate
        const retry = await api().post('/api/photos/upload').set(bearer(photographer)).field('eventId', String(eventId)).field('clientUploadIds', JSON.stringify(['cam-a-0001'])).attach('files', await noiseJpeg(), 'IMG_0001.jpg');
        expect(retry.body.data.results[0]).toMatchObject({ duplicate: true, photoId: photoIds[0] });

        // Non-images are refused even with an image extension
        const fake = await api().post('/api/photos/upload').set(bearer(photographer)).field('eventId', String(eventId)).attach('files', Buffer.from('not really a jpeg'), 'evil.jpg');
        expect(fake.body.data.failed).toBe(1);

        // Malformed idempotency keys are a validation error, not a server error
        const badIds = await api().post('/api/photos/upload').set(bearer(photographer)).field('eventId', String(eventId)).field('clientUploadIds', '[cam-a-0001]').attach('files', await noiseJpeg(), 'IMG_0009.jpg');
        expect(badIds.status).toBe(422);

        await photoQueue.idle();
        const status = await api().get(`/api/photos/upload-status/${eventId}`).set(bearer(photographer));
        expect(status.body.data.counts.PREVIEW).toBe(3);
        const list = await api().get(`/api/photos?eventId=${eventId}`).set(bearer(admin));
        expect(list.body.data.items.every((p: { is_published: number }) => p.is_published === 1)).toBe(true);
    });

    it('8. opens the gallery with a QR code and serves only signed, watermarked previews', async () => {
        const qr = await api().post(`/api/galleries/${galleryId}/qr`).set(bearer(admin)).send({ scope: 'EVENT', label: 'Reception table' });
        expect(qr.status).toBe(201);
        expect(qr.body.data.qr).toMatch(/^data:image\/png;base64,/);
        qrToken = qr.body.data.url.split('/g/')[1];
        qrTokenId = qr.body.data.id;

        expect((await api().get(`/api/gallery/${galleryId}`)).status).toBe(401);
        expect((await api().post('/api/gallery/access').send({ token: 'x'.repeat(32) })).status).toBe(401);

        const access = await api().post('/api/gallery/access').send({ token: qrToken });
        expect(access.status).toBe(200);
        gallerySession = access.body.data.session;

        const info = await api().get(`/api/gallery/${galleryId}`).set('X-Gallery-Session', gallerySession);
        expect(info.body.data).toMatchObject({ photoCount: 3, watermark: true, isLive: true, isOwner: false });
        expect(info.body.data.pricing.photoDownload).toBe(9900);

        const photos = await api().get(`/api/gallery/${galleryId}/photos`).set('X-Gallery-Session', gallerySession);
        expect(photos.body.data.total).toBe(3);
        expect(JSON.stringify(photos.body.data)).not.toMatch(/original_key|originals\//);

        const open = await api().get(`/api/gallery/${galleryId}/photos/${photoIds[0]}`).set('X-Gallery-Session', gallerySession);
        expect(open.body.data.can_download).toBe(false);
        const file = await api().get(localPath(open.body.data.preview_url));
        expect(file.status).toBe(200);
        expect(file.headers['content-type']).toBe('image/jpeg');
        const tampered = localPath(open.body.data.preview_url).replace(/sig=[0-9a-f]{4}/, 'sig=0000');
        expect((await api().get(tampered)).status).toBe(403);

        const fav = await api().post(`/api/gallery/${galleryId}/photos/${photoIds[0]}/favourite`).set('X-Gallery-Session', gallerySession).send({ on: true });
        expect(fav.status).toBe(401);
    });

    it('9. sells an HD download to a guest and unlocks a signed original only after payment', async () => {
        const guest = await registerCustomer('Wedding Guest');
        const order = await api()
            .post(`/api/gallery/${galleryId}/orders`)
            .set(bearer(guest.token))
            .set('X-Gallery-Session', gallerySession)
            .send({ type: 'PHOTO_DOWNLOAD', photoIds: [photoIds[0]], couponCode: 'welcome10' });
        expect(order.status, JSON.stringify(order.body)).toBe(201);
        expect(order.body.data.total).toBe(8910);
        expect(order.body.data.status).toBe('CREATED');

        expect((await api().post(`/api/downloads/${photoIds[0]}`).set(bearer(guest.token))).status).toBe(403);
        await payWithDevpay(guest.token, { orderId: order.body.data.id });

        const o = await api().get(`/api/orders/${order.body.data.id}`).set(bearer(guest.token));
        expect(o.body.data.status).toBe('COMPLETED');

        const dl = await api().post(`/api/downloads/${photoIds[0]}`).set(bearer(guest.token));
        expect(dl.status).toBe(200);
        const file = await api().get(localPath(dl.body.data.url));
        expect(file.status).toBe(200);
        expect(file.headers['content-disposition']).toMatch(/attachment/);

        expect((await api().post(`/api/downloads/${photoIds[1]}`).set(bearer(guest.token))).status).toBe(403);
        const again = await api().post(`/api/gallery/${galleryId}/orders`).set(bearer(guest.token)).set('X-Gallery-Session', gallerySession).send({ type: 'PHOTO_DOWNLOAD', photoIds: [photoIds[0]] });
        expect(again.status).toBe(409);
    });

    it('10. lets the event owner download everything included in the package', async () => {
        const dl = await api().post(`/api/downloads/${photoIds[1]}`).set(bearer(customer));
        expect(dl.status).toBe(200);
        const all = await api().get('/api/downloads').set(bearer(customer));
        expect(all.body.data[0].photos.length).toBe(3);
    });

    it('11. scopes album QR codes to the album and enforces scan limits', async () => {
        const album = await api().post(`/api/galleries/${galleryId}/albums`).set(bearer(admin)).send({ name: 'Family portraits' });
        await api().post('/api/photos/bulk').set(bearer(admin)).send({ ids: [photoIds[2]], action: 'move', albumId: album.body.data.id }).expect(200);
        const qr = await api().post(`/api/galleries/${galleryId}/qr`).set(bearer(admin)).send({ scope: 'ALBUM', albumId: album.body.data.id, maxUses: 1 });
        const token = qr.body.data.url.split('/g/')[1];
        const s = (await api().post('/api/gallery/access').send({ token })).body.data.session;
        const photos = await api().get(`/api/gallery/${galleryId}/photos`).set('X-Gallery-Session', s);
        expect(photos.body.data.items.map((p: { id: number }) => p.id)).toEqual([photoIds[2]]);
        expect((await api().get(`/api/gallery/${galleryId}/photos/${photoIds[0]}`).set('X-Gallery-Session', s)).status).toBe(404);
        expect((await api().post('/api/gallery/access').send({ token })).status).toBe(401);
    });

    it('12. collects the album selection and the studio confirms it', async () => {
        await api().post(`/api/gallery/${galleryId}/photos/${photoIds[0]}/select`).set(bearer(customer)).send({ on: true }).expect(200);
        const sel = await api().post(`/api/gallery/${galleryId}/photos/${photoIds[1]}/select`).set(bearer(customer)).send({ on: true });
        expect(sel.body.data.count).toBe(2);
        await api().post(`/api/gallery/${galleryId}/photos/${photoIds[1]}/comments`).set(bearer(customer)).send({ body: 'Please brighten this one' }).expect(201);
        const submit = await api().post(`/api/gallery/${galleryId}/selection/submit`).set(bearer(customer)).send({ note: 'Our favourites' });
        expect(submit.body.data).toMatchObject({ status: 'SUBMITTED', count: 2 });
        expect((await api().post(`/api/gallery/${galleryId}/photos/${photoIds[2]}/select`).set(bearer(customer)).send({ on: true })).status).toBe(409);

        const staffView = await api().get(`/api/selections/event/${eventId}`).set(bearer(admin));
        expect(staffView.body.data.photos.length).toBe(2);
        expect(staffView.body.data.comments.length).toBe(1);
        const conf = await api().post(`/api/selections/event/${eventId}/confirm`).set(bearer(admin)).send({ customerId });
        expect(conf.body.data.photos).toBe(2);
    });

    it('13. runs the editing queue and approval', async () => {
        await api().post('/api/photos/assign-editor').set(bearer(admin)).send({ ids: [photoIds[0], photoIds[1]], editorId }).expect(200);
        const queue = await api().get('/api/photos/editor/queue').set(bearer(editor));
        expect(queue.body.data.find((q: { event_id: number }) => q.event_id === eventId).editing).toBe(2);
        const up = await api().post(`/api/photos/${photoIds[0]}/edited`).set(bearer(editor)).attach('file', await noiseJpeg(), 'edited.jpg');
        expect(up.status, JSON.stringify(up.body)).toBe(200);
        await photoQueue.idle();
        const other = await api().post(`/api/photos/${photoIds[2]}/edited`).set(bearer(editor)).attach('file', await noiseJpeg(), 'x.jpg');
        expect(other.status).toBe(403);
        await api().post('/api/photos/bulk').set(bearer(admin)).send({ ids: [photoIds[0]], action: 'approve' }).expect(200);
        const p = await api().get(`/api/photos/${photoIds[0]}`).set(bearer(admin));
        expect(p.body.data.status).toBe('APPROVED');
        expect(p.body.data.edited_url).toBeTruthy();
    });

    it('14. completes the event and publishes the gallery', async () => {
        await api().post(`/api/events/${eventId}/stop`).set(bearer(photographer)).expect(200);
        const done = await api().post(`/api/events/${eventId}/complete`).set(bearer(admin));
        expect(done.status, JSON.stringify(done.body)).toBe(200);
        const e = await api().get(`/api/events/${eventId}`).set(bearer(admin));
        expect(e.body.data.status).toBe('COMPLETED');
        expect(e.body.data.gallery.status).toBe('PUBLISHED');
    });

    it('15. handles album proofs with a revision round, then approval creates the print job', async () => {
        const v1 = await api().post('/api/proofs').set(bearer(editor)).field('eventId', String(eventId)).field('title', 'Wedding album').attach('files', await noiseJpeg(1800, 900), 'spread-01.jpg').attach('files', await noiseJpeg(1800, 900), 'spread-02.jpg');
        expect(v1.status, JSON.stringify(v1.body)).toBe(201);
        expect((await api().get('/api/proofs').set(bearer(customer))).body.data.total).toBe(0);
        await api().post(`/api/proofs/${v1.body.data.id}/send`).set(bearer(editor)).expect(200);
        const view = await api().get(`/api/proofs/${v1.body.data.id}`).set(bearer(customer));
        expect(view.body.data.pages.length).toBe(2);
        expect(view.body.data.can_respond).toBe(true);
        const rev = await api().post(`/api/proofs/${v1.body.data.id}/respond`).set(bearer(customer)).send({ decision: 'REVISION', notes: 'Swap the photos on page 2', pageRefs: '2' });
        expect(rev.body.data.status).toBe('REVISION_REQUESTED');

        const v2 = await api().post('/api/proofs').set(bearer(editor)).field('eventId', String(eventId)).field('title', 'Wedding album').attach('files', await noiseJpeg(1800, 900), 'spread-01.jpg').attach('files', await noiseJpeg(1800, 900), 'spread-02b.jpg');
        expect(v2.body.data.version).toBe(2);
        await api().post(`/api/proofs/${v2.body.data.id}/send`).set(bearer(editor)).expect(200);
        const approve = await api().post(`/api/proofs/${v2.body.data.id}/respond`).set(bearer(customer)).send({ decision: 'APPROVE' });
        expect(approve.body.data.status).toBe('APPROVED');
        expect(approve.body.data.orderId).toBeGreaterThan(0);

        const jobs = await api().get('/api/printing').set(bearer(printer));
        const job = jobs.body.data.items.find((j: { order_id: number }) => j.order_id === approve.body.data.orderId);
        expect(job.kind).toBe('ALBUM');
        const files = await api().get(`/api/printing/${job.id}/files`).set(bearer(printer));
        expect(files.body.data.length).toBe(2);

        expect((await api().put(`/api/printing/${job.id}`).set(bearer(printer)).send({ status: 'READY' })).status).toBe(409);
        for (const status of ['PRINTING', 'PRINTED', 'READY']) {
            const r = await api().put(`/api/printing/${job.id}`).set(bearer(printer)).send({ status, notes: status === 'PRINTING' ? 'Matte finish' : undefined });
            expect(r.status, JSON.stringify(r.body)).toBe(200);
        }
        const order = await api().get(`/api/orders/${approve.body.data.orderId}`).set(bearer(customer));
        expect(order.body.data.status).toBe('READY');
        expect(order.body.data.prints[0].notes).toBe('Matte finish');

        const deliveries = await api().get('/api/delivery?status=READY').set(bearer(printer));
        const d = deliveries.body.data.items.find((x: { order_id: number }) => x.order_id === approve.body.data.orderId);
        const handed = await api().put(`/api/delivery/${d.id}`).set(bearer(printer)).send({ status: 'DELIVERED', notes: 'Collected by the bride' });
        expect(handed.status, JSON.stringify(handed.body)).toBe(200);
        expect((await api().get(`/api/orders/${approve.body.data.orderId}`).set(bearer(customer))).body.data.status).toBe('DELIVERED');
    });

    it('16. collects the balance and completes the booking', async () => {
        const before = await api().get(`/api/bookings/${bookingId}`).set(bearer(customer));
        expect(before.body.data.can_pay_balance).toBe(true);
        expect(before.body.data.balance_due).toBe(bookingTotal - advance);
        const { payment } = await payWithDevpay(customer, { bookingId, purpose: 'BALANCE' });
        expect(payment.amount).toBe(bookingTotal - advance);
        const deliver = await api().post(`/api/bookings/${bookingId}/deliver`).set(bearer(admin));
        expect(deliver.body.data.status).toBe('COMPLETED');
        expect((await api().post('/api/payments/create').set(bearer(customer)).send({ bookingId })).status).toBe(409);
    });

    it('17. revoking a QR code immediately withdraws gallery access', async () => {
        await api().post(`/api/galleries/${galleryId}/qr/${qrTokenId}/revoke`).set(bearer(admin)).expect(200);
        expect((await api().get(`/api/gallery/${galleryId}`).set('X-Gallery-Session', gallerySession)).status).toBe(401);
        expect((await api().post('/api/gallery/access').send({ token: qrToken })).status).toBe(401);
        const regen = await api().post(`/api/galleries/${galleryId}/qr/${qrTokenId}/regenerate`).set(bearer(admin));
        expect(regen.status).toBe(201);
        expect(regen.body.data.url).not.toContain(qrToken);
    });

    it('18. reports revenue, keeps an audit trail and issues invoices', async () => {
        const dash = await api().get('/api/reports/dashboard?range=today').set(bearer(admin));
        expect(dash.body.data.cards.todaysRevenue).toBeGreaterThanOrEqual(bookingTotal + 8910);
        expect(dash.body.data.cards.photoSales).toBeGreaterThanOrEqual(1);
        expect(dash.body.data.charts.revenue.length).toBe(1);

        const csv = await api().get('/api/reports/payments?range=today&format=csv').set(bearer(admin));
        expect(csv.headers['content-type']).toMatch(/text\/csv/);
        expect(csv.text).toContain('Payment');

        const audit = await api().get('/api/audit-logs?module=payments&action=PAYMENT_SUCCESS').set(bearer(admin));
        expect(audit.body.data.total).toBeGreaterThanOrEqual(3);
        const qrAudit = await api().get('/api/audit-logs?action=QR_REVOKED').set(bearer(admin));
        expect(qrAudit.body.data.total).toBeGreaterThanOrEqual(1);

        const invoices = await api().get('/api/invoices').set(bearer(customer));
        expect(invoices.body.data.total).toBe(2);
        const inv = await api().get(`/api/invoices/${invoices.body.data.items[0].id}`).set(bearer(customer));
        expect(inv.body.data.studio.name).toBeTruthy();

        const notes = await api().get('/api/notifications').set(bearer(customer));
        const types = notes.body.data.items.map((n: { type: string }) => n.type);
        expect(types).toEqual(expect.arrayContaining(['PAYMENT_SUCCESS', 'BOOKING_CONFIRMED', 'ALBUM_PROOF_READY', 'SELECTION_CONFIRMED']));
    });
});

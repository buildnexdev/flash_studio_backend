import sharp from 'sharp';
import { describe, expect, it } from 'vitest';
import { blurScore, dHash, hamming, inspectImage, makeVariants } from '../../src/lib/images.js';
import { devPay, paymentProvider } from '../../src/lib/payments.js';
import { signLocal, verifyLocalSignature, assertSafeKey } from '../../src/lib/storage.js';
import { computeDiscount } from '../../src/modules/catalog/catalog.service.js';
import { computeQuotation } from '../../src/modules/bookings/bookings.service.js';
import { inclusiveTax } from '../../src/modules/orders/orders.service.js';
import { toCsv, type ReportResult } from '../../src/modules/reports/reports.service.js';
import { decrypt, encrypt, safeEqual, sha256 } from '../../src/utils/crypto.js';
import { eachDay, resolveRange } from '../../src/utils/dates.js';
import { noiseJpeg } from '../helpers.js';

describe('crypto', () => {
    it('encrypts and decrypts with AES-GCM and detects tampering', () => {
        const box = encrypt('qr-token-123');
        expect(box).not.toContain('qr-token-123');
        expect(decrypt(box)).toBe('qr-token-123');
        const tampered = box.slice(0, -2) + (box.endsWith('A') ? 'B' : 'A') + box.slice(-1);
        expect(() => decrypt(tampered)).toThrow();
    });

    it('compares secrets in constant time', () => {
        expect(safeEqual(sha256('a'), sha256('a'))).toBe(true);
        expect(safeEqual(sha256('a'), sha256('b'))).toBe(false);
        expect(safeEqual('short', 'longer-value')).toBe(false);
    });
});

describe('date ranges (studio timezone UTC+05:30)', () => {
    const now = new Date('2026-10-01T20:00:00Z'); // 02 Oct 01:30 IST

    it('resolves today in studio local time', () => {
        const r = resolveRange({ range: 'today' }, now);
        expect(r.from).toBe('2026-10-02');
        expect(r.startUtc).toBe('2026-10-01 18:30:00');
        expect(r.endUtc).toBe('2026-10-02 18:30:00');
    });

    it('resolves this week from Monday and this month from the 1st', () => {
        expect(resolveRange({ range: 'this_week' }, now).from).toBe('2026-09-28');
        expect(resolveRange({ range: 'this_month' }, now).from).toBe('2026-10-01');
        expect(resolveRange({ range: 'yesterday' }, now).from).toBe('2026-10-01');
    });

    it('validates custom ranges', () => {
        expect(() => resolveRange({ range: 'custom' }, now)).toThrow(/From and a To/);
        expect(() => resolveRange({ range: 'custom', from: '2026-10-05', to: '2026-10-01' }, now)).toThrow(/on or before/);
        expect(eachDay('2026-09-29', '2026-10-02')).toEqual(['2026-09-29', '2026-09-30', '2026-10-01', '2026-10-02']);
    });
});

describe('pricing maths', () => {
    it('applies percentage coupons with a cap and flat coupons', () => {
        expect(computeDiscount({ type: 'PERCENT', value: 10, max_discount: 50000 }, 100000)).toBe(10000);
        expect(computeDiscount({ type: 'PERCENT', value: 50, max_discount: 20000 }, 100000)).toBe(20000);
        expect(computeDiscount({ type: 'FLAT', value: 5000, max_discount: null }, 3000)).toBe(3000);
    });

    it('computes quotations with discount and tax', () => {
        const q = computeQuotation([{ description: 'Coverage', quantity: 1, unitPrice: 100000 }, { description: 'Album', quantity: 2, unitPrice: 25000 }], 10000, 18);
        expect(q.subtotal).toBe(150000);
        expect(q.tax).toBe(25200);
        expect(q.total).toBe(165200);
    });

    it('extracts inclusive GST', () => {
        expect(inclusiveTax(11800, 18)).toBe(1800);
        expect(inclusiveTax(0, 18)).toBe(0);
    });
});

describe('signed storage URLs', () => {
    it('accepts a valid signature and rejects expired or modified links', () => {
        const exp = Math.floor(Date.now() / 1000) + 60;
        const sig = signLocal('events/1/originals/a.jpg', exp, '');
        expect(verifyLocalSignature('events/1/originals/a.jpg', exp, '', sig)).toBe(true);
        expect(verifyLocalSignature('events/1/originals/b.jpg', exp, '', sig)).toBe(false);
        expect(verifyLocalSignature('events/1/originals/a.jpg', exp, 'other.jpg', sig)).toBe(false);
        const old = Math.floor(Date.now() / 1000) - 1;
        expect(verifyLocalSignature('events/1/originals/a.jpg', old, '', signLocal('events/1/originals/a.jpg', old, ''))).toBe(false);
    });

    it('rejects path traversal keys', () => {
        expect(() => assertSafeKey('../etc/passwd')).toThrow();
        expect(() => assertSafeKey('/abs/path.jpg')).toThrow();
        expect(assertSafeKey('events/1/thumbs/x.jpg')).toBe('events/1/thumbs/x.jpg');
    });
});

describe('payment signatures (devpay mirrors Razorpay HMAC verification)', () => {
    it('verifies only genuine checkout signatures', async () => {
        expect(devPay).not.toBeNull();
        const order = await paymentProvider.createOrder(9900, 'INR', 'r1', {});
        const done = devPay!.checkout(order.id, 'success');
        expect(paymentProvider.verifySignature(done.razorpay_order_id, done.razorpay_payment_id, done.razorpay_signature)).toBe(true);
        expect(paymentProvider.verifySignature(done.razorpay_order_id, done.razorpay_payment_id, 'f'.repeat(64))).toBe(false);
        expect(paymentProvider.verifySignature('order_other', done.razorpay_payment_id, done.razorpay_signature)).toBe(false);
        const body = JSON.stringify({ event: 'payment.captured' });
        expect(paymentProvider.verifyWebhook(Buffer.from(body), devPay!.signWebhook(body))).toBe(true);
        expect(paymentProvider.verifyWebhook(Buffer.from(body + ' '), devPay!.signWebhook(body))).toBe(false);
    });
});

describe('image pipeline', () => {
    it('validates real image bytes and rejects other files', async () => {
        const jpg = await noiseJpeg(800, 600);
        const info = await inspectImage(jpg);
        expect(info.width).toBe(800);
        expect(info.mime).toBe('image/jpeg');
        await expect(inspectImage(Buffer.from('<?php echo 1; ?>'))).rejects.toThrow();
    });

    it('creates watermarked preview and thumbnail variants without EXIF', async () => {
        const src = await sharp({ create: { width: 3000, height: 2000, channels: 3, background: '#4a6fa5' } })
            .withMetadata({ exif: { IFD0: { Copyright: 'secret-owner' } } })
            .jpeg()
            .toBuffer();
        const v = await makeVariants(src, { watermark: 'BuildNexDev Studio', previewSize: 1600, thumbSize: 480 });
        const [pm, tm] = await Promise.all([sharp(v.preview).metadata(), sharp(v.thumb).metadata()]);
        expect(Math.max(pm.width!, pm.height!)).toBe(1600);
        expect(Math.max(tm.width!, tm.height!)).toBe(480);
        expect(pm.exif).toBeUndefined();
        // The watermark changes the pixels compared with an unwatermarked render
        const plain = await makeVariants(src, { watermark: null, previewSize: 1600, thumbSize: 480 });
        expect(Buffer.compare(plain.preview, v.preview)).not.toBe(0);
    });

    it('detects near-duplicates and blur', async () => {
        const scene = (svg: string) =>
            sharp(Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="600" height="400">${svg}</svg>`)).jpeg({ quality: 92 }).toBuffer();
        const a = await scene(
            '<defs><linearGradient id="g"><stop offset="0" stop-color="#123"/><stop offset="1" stop-color="#fc8"/></linearGradient></defs>' +
                '<rect width="600" height="400" fill="url(#g)"/><circle cx="200" cy="180" r="90" fill="#e33"/><rect x="380" y="220" width="160" height="120" fill="#2a6"/>',
        );
        const recompressed = await sharp(a).resize(450).jpeg({ quality: 55 }).toBuffer();
        const different = await scene('<rect width="600" height="400" fill="#fff"/><rect x="300" width="300" height="400" fill="#000"/><circle cx="450" cy="200" r="60" fill="#fff"/>');
        expect(hamming(await dHash(a), await dHash(recompressed))).toBeLessThanOrEqual(5);
        expect(hamming(await dHash(a), await dHash(different))).toBeGreaterThan(5);
        const blurred = await sharp(a).blur(12).toBuffer();
        expect(await blurScore(blurred)).toBeLessThan(await blurScore(a));
    });
});

describe('CSV export', () => {
    it('neutralises spreadsheet formula injection and formats money', () => {
        const report: ReportResult = {
            type: 'customers',
            title: 't',
            range: resolveRange({ range: 'today' }),
            summary: {},
            columns: [
                { key: 'name', label: 'Customer' },
                { key: 'spend', label: 'Spend', kind: 'money' },
            ],
            rows: [{ name: '=HYPERLINK("http://evil")', spend: 123450 }],
        };
        const csv = toCsv(report);
        expect(csv).toContain(`"'=HYPERLINK(""http://evil"")"`);
        expect(csv).toContain('1234.50');
    });
});

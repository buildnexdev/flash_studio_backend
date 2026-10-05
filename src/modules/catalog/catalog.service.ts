import { execute, json, query, queryOne, type Db, pool } from '../../db/pool.js';
import { normalizeJpeg, inspectImage } from '../../lib/images.js';
import { storage } from '../../lib/storage.js';
import { uuid } from '../../utils/crypto.js';
import { badRequest, conflict, notFound } from '../../utils/errors.js';
import { audit, type AuditContext } from '../audit/audit.service.js';

const slugify = (s: string) =>
    s
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '')
        .slice(0, 120) || `item-${Date.now()}`;

async function uniqueSlug(table: 'services' | 'packages', name: string, exceptId?: number) {
    const base = slugify(name);
    let slug = base;
    for (let i = 2; await queryOne(`SELECT id FROM ${table} WHERE slug = ? AND id <> ?`, [slug, exceptId ?? 0]); i++) slug = `${base}-${i}`;
    return slug;
}

/* ---------------- Services ---------------- */

export interface ServiceInput {
    name: string;
    summary?: string | null;
    description?: string | null;
    icon?: string | null;
    basePrice: number;
    isActive: boolean;
    sortOrder: number;
}

export const listServices = (activeOnly = false) =>
    query(`SELECT * FROM tblService WHERE deleted_at IS NULL ${activeOnly ? 'AND is_active = 1' : ''} ORDER BY sort_order, name`);

export async function saveService(id: number | null, input: ServiceInput, ctx: AuditContext) {
    const slug = await uniqueSlug('services', input.name, id ?? undefined);
    const values = [input.name, slug, input.summary ?? null, input.description ?? null, input.icon ?? null, input.basePrice, input.isActive ? 1 : 0, input.sortOrder];
    if (id) {
        const res = await execute('UPDATE tblService SET name = ?, slug = ?, summary = ?, description = ?, icon = ?, base_price = ?, is_active = ?, sort_order = ? WHERE id = ? AND deleted_at IS NULL', [...values, id]);
        if (!res.affectedRows) throw notFound('Service');
    } else {
        id = (await execute('INSERT INTO tblService (name, slug, summary, description, icon, base_price, is_active, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?, ?)', values)).insertId;
    }
    await audit(ctx, 'SERVICE_SAVED', 'catalog', id, { name: input.name });
    return queryOne('SELECT * FROM tblService WHERE id = ?', [id]);
}

export async function deleteService(id: number, ctx: AuditContext) {
    await execute('UPDATE tblService SET deleted_at = UTC_TIMESTAMP(), is_active = 0 WHERE id = ?', [id]);
    await audit(ctx, 'SERVICE_DELETED', 'catalog', id);
}

/* ---------------- Packages ---------------- */

export interface PackageInput {
    serviceId?: number | null;
    name: string;
    description?: string | null;
    price: number;
    advancePercent: number;
    features: string[];
    photoCount?: number | null;
    includesDigital: boolean;
    includesAlbum: boolean;
    durationHours?: number | null;
    isFeatured: boolean;
    isActive: boolean;
    sortOrder: number;
}

export const listPackages = (activeOnly = false) =>
    query(
        `SELECT p.*, s.name AS service_name FROM tblPackage p LEFT JOIN tblService s ON s.id = p.service_id
          WHERE p.deleted_at IS NULL ${activeOnly ? 'AND p.is_active = 1' : ''} ORDER BY p.sort_order, p.price`,
    );

export const getPackage = (id: number, db: Db = pool) => queryOne('SELECT * FROM tblPackage WHERE id = ? AND deleted_at IS NULL', [id], db);

export async function savePackage(id: number | null, input: PackageInput, ctx: AuditContext) {
    const slug = await uniqueSlug('packages', input.name, id ?? undefined);
    const values = [
        input.serviceId ?? null,
        input.name,
        slug,
        input.description ?? null,
        input.price,
        input.advancePercent,
        json(input.features),
        input.photoCount ?? null,
        input.includesDigital ? 1 : 0,
        input.includesAlbum ? 1 : 0,
        input.durationHours ?? null,
        input.isFeatured ? 1 : 0,
        input.isActive ? 1 : 0,
        input.sortOrder,
    ];
    if (id) {
        const res = await execute(
            `UPDATE tblPackage SET service_id = ?, name = ?, slug = ?, description = ?, price = ?, advance_percent = ?, features = ?, photo_count = ?,
                    includes_digital = ?, includes_album = ?, duration_hours = ?, is_featured = ?, is_active = ?, sort_order = ? WHERE id = ? AND deleted_at IS NULL`,
            [...values, id],
        );
        if (!res.affectedRows) throw notFound('Package');
    } else {
        id = (
            await execute(
                `INSERT INTO tblPackage (service_id, name, slug, description, price, advance_percent, features, photo_count, includes_digital, includes_album, duration_hours, is_featured, is_active, sort_order)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                values,
            )
        ).insertId;
    }
    await audit(ctx, 'PACKAGE_SAVED', 'catalog', id, { name: input.name, price: input.price });
    return getPackage(id);
}

export async function deletePackage(id: number, ctx: AuditContext) {
    await execute('UPDATE tblPackage SET deleted_at = UTC_TIMESTAMP(), is_active = 0 WHERE id = ?', [id]);
    await audit(ctx, 'PACKAGE_DELETED', 'catalog', id);
}

/* ---------------- Coupons ---------------- */

export interface CouponInput {
    code: string;
    description?: string | null;
    type: 'PERCENT' | 'FLAT';
    value: number;
    minAmount: number;
    maxDiscount?: number | null;
    appliesTo: 'ALL' | 'ORDER' | 'BOOKING';
    startsAt?: string | null;
    endsAt?: string | null;
    usageLimit?: number | null;
    isActive: boolean;
}

export const listCoupons = () => query('SELECT * FROM tblCoupon WHERE deleted_at IS NULL ORDER BY id DESC');

export async function saveCoupon(id: number | null, input: CouponInput, ctx: AuditContext) {
    if (input.type === 'PERCENT' && input.value > 100) throw badRequest('A percentage coupon cannot exceed 100%.', [{ field: 'value', message: 'Max 100' }]);
    const code = input.code.trim().toUpperCase();
    const dup = await queryOne('SELECT id FROM tblCoupon WHERE code = ? AND id <> ? AND deleted_at IS NULL', [code, id ?? 0]);
    if (dup) throw conflict('A coupon with this code already exists.');
    const values = [code, input.description ?? null, input.type, input.value, input.minAmount, input.maxDiscount ?? null, input.appliesTo, input.startsAt ?? null, input.endsAt ?? null, input.usageLimit ?? null, input.isActive ? 1 : 0];
    if (id) {
        await execute('UPDATE tblCoupon SET code = ?, description = ?, type = ?, value = ?, min_amount = ?, max_discount = ?, applies_to = ?, starts_at = ?, ends_at = ?, usage_limit = ?, is_active = ? WHERE id = ?', [...values, id]);
    } else {
        id = (await execute('INSERT INTO tblCoupon (code, description, type, value, min_amount, max_discount, applies_to, starts_at, ends_at, usage_limit, is_active) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', values)).insertId;
    }
    await audit(ctx, 'COUPON_SAVED', 'catalog', id, { code });
    return queryOne('SELECT * FROM tblCoupon WHERE id = ?', [id]);
}

export async function deleteCoupon(id: number, ctx: AuditContext) {
    await execute('UPDATE tblCoupon SET deleted_at = UTC_TIMESTAMP(), is_active = 0 WHERE id = ?', [id]);
    await audit(ctx, 'COUPON_DELETED', 'catalog', id);
}

export interface CouponResult {
    couponId: number;
    code: string;
    discount: number;
}

/** Pure discount calculation, shared by orders and bookings. */
export function computeDiscount(c: { type: 'PERCENT' | 'FLAT'; value: number; max_discount: number | null }, amount: number): number {
    const raw = c.type === 'PERCENT' ? Math.floor((amount * c.value) / 100) : c.value;
    return Math.max(0, Math.min(raw, c.max_discount ?? Number.MAX_SAFE_INTEGER, amount));
}

export async function evaluateCoupon(codeRaw: string, amount: number, scope: 'ORDER' | 'BOOKING', db: Db = pool): Promise<CouponResult> {
    const code = codeRaw.trim().toUpperCase();
    const c = await queryOne<{ id: number; code: string; type: 'PERCENT' | 'FLAT'; value: number; min_amount: number; max_discount: number | null; applies_to: string; starts_at: Date | null; ends_at: Date | null; usage_limit: number | null; used_count: number; is_active: number }>(
        'SELECT * FROM tblCoupon WHERE code = ? AND deleted_at IS NULL',
        [code],
        db,
    );
    const invalid = (msg: string) => badRequest(msg, [{ field: 'couponCode', message: msg }]);
    if (!c || !c.is_active) throw invalid('This coupon code is not valid.');
    const now = new Date();
    if (c.starts_at && new Date(c.starts_at) > now) throw invalid('This coupon is not active yet.');
    if (c.ends_at && new Date(c.ends_at) < now) throw invalid('This coupon has expired.');
    if (c.usage_limit !== null && c.used_count >= c.usage_limit) throw invalid('This coupon has reached its usage limit.');
    if (c.applies_to !== 'ALL' && c.applies_to !== scope) throw invalid(`This coupon cannot be used for ${scope === 'ORDER' ? 'orders' : 'bookings'}.`);
    if (amount < c.min_amount) throw invalid(`Minimum amount for this coupon is ₹${(c.min_amount / 100).toFixed(2)}.`);
    return { couponId: c.id, code: c.code, discount: computeDiscount(c, amount) };
}

/* ---------------- Portfolio & testimonials ---------------- */

export const listPortfolio = (category?: string) =>
    query(`SELECT id, title, category, description, is_featured, sort_order, created_at FROM tblPortfolioItem WHERE deleted_at IS NULL ${category ? 'AND category = ?' : ''} ORDER BY is_featured DESC, sort_order, id DESC`, category ? [category] : []);

export async function addPortfolioItem(file: Buffer, input: { title: string; category: string; description?: string | null; isFeatured: boolean }, ctx: AuditContext) {
    try {
        await inspectImage(file);
    } catch (err) {
        throw badRequest((err as Error).message, [{ field: 'file', message: (err as Error).message }]);
    }
    const key = `public/portfolio/${uuid()}.jpg`;
    await storage.put(key, await normalizeJpeg(file, 2000, 85), 'image/jpeg');
    const id = (await execute('INSERT INTO tblPortfolioItem (title, category, description, image_key, is_featured) VALUES (?, ?, ?, ?, ?)', [input.title, input.category, input.description ?? null, key, input.isFeatured ? 1 : 0])).insertId;
    await audit(ctx, 'PORTFOLIO_ADDED', 'website', id, { title: input.title });
    return queryOne('SELECT id, title, category, description, is_featured, sort_order, created_at FROM tblPortfolioItem WHERE id = ?', [id]);
}

export async function updatePortfolioItem(id: number, input: { title: string; category: string; description?: string | null; isFeatured: boolean; sortOrder: number }, ctx: AuditContext) {
    await execute('UPDATE tblPortfolioItem SET title = ?, category = ?, description = ?, is_featured = ?, sort_order = ? WHERE id = ? AND deleted_at IS NULL', [input.title, input.category, input.description ?? null, input.isFeatured ? 1 : 0, input.sortOrder, id]);
    await audit(ctx, 'PORTFOLIO_UPDATED', 'website', id);
}

export async function deletePortfolioItem(id: number, ctx: AuditContext) {
    const row = await queryOne<{ image_key: string }>('SELECT image_key FROM tblPortfolioItem WHERE id = ?', [id]);
    if (!row) throw notFound('Portfolio item');
    await execute('UPDATE tblPortfolioItem SET deleted_at = UTC_TIMESTAMP() WHERE id = ?', [id]);
    await storage.delete(row.image_key).catch(() => undefined);
    await audit(ctx, 'PORTFOLIO_DELETED', 'website', id);
}

export async function portfolioImageUrl(id: number): Promise<string> {
    const row = await queryOne<{ image_key: string }>('SELECT image_key FROM tblPortfolioItem WHERE id = ? AND deleted_at IS NULL', [id]);
    if (!row) throw notFound('Image');
    return storage.signedUrl(row.image_key, { ttlSeconds: 3600 });
}

export const listTestimonials = (publishedOnly = false) =>
    query(`SELECT * FROM tblTestimonial WHERE deleted_at IS NULL ${publishedOnly ? 'AND is_published = 1' : ''} ORDER BY sort_order, id DESC`);

export async function saveTestimonial(id: number | null, input: { name: string; eventLabel?: string | null; quote: string; rating: number; isPublished: boolean; sortOrder: number }, ctx: AuditContext) {
    const values = [input.name, input.eventLabel ?? null, input.quote, input.rating, input.isPublished ? 1 : 0, input.sortOrder];
    if (id) await execute('UPDATE tblTestimonial SET name = ?, event_label = ?, quote = ?, rating = ?, is_published = ?, sort_order = ? WHERE id = ?', [...values, id]);
    else id = (await execute('INSERT INTO tblTestimonial (name, event_label, quote, rating, is_published, sort_order) VALUES (?, ?, ?, ?, ?, ?)', values)).insertId;
    await audit(ctx, 'TESTIMONIAL_SAVED', 'website', id);
    return queryOne('SELECT * FROM tblTestimonial WHERE id = ?', [id]);
}

export async function deleteTestimonial(id: number, ctx: AuditContext) {
    await execute('UPDATE tblTestimonial SET deleted_at = UTC_TIMESTAMP() WHERE id = ?', [id]);
    await audit(ctx, 'TESTIMONIAL_DELETED', 'website', id);
}

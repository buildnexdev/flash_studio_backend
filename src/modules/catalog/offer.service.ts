// Developer by: Buildnexdev.in
// Devevloper : Nandhakumar@gmail.com
// Last Edited : 06-10-2026
import { execute, query, queryOne } from '../../db/pool.js';
import { notFound } from '../../utils/errors.js';
import { audit, type AuditContext } from '../audit/audit.service.js';

export interface OfferInput {
    name: string;
    description?: string | null;
    posterUrl?: string | null;
    discountType: 'PERCENT' | 'FLAT';
    discountValue: number;
    startDate: string;
    endDate: string;
    minOrder?: number;
    maxDiscount?: number | null;
    usageLimit?: number | null;
    isActive: boolean;
}

export async function listOffers(activeOnly = false) {
    return query(
        `SELECT * FROM tblOffer 
         ${activeOnly ? "WHERE is_active = 1 AND start_date <= NOW() AND end_date >= NOW()" : ""} 
         ORDER BY id DESC`
    );
}

export async function getOffer(id: number) {
    const offer = await queryOne('SELECT * FROM tblOffer WHERE id = ?', [id]);
    if (!offer) throw notFound('Offer');
    return offer;
}

export async function saveOffer(id: number | null, input: OfferInput, ctx: AuditContext) {
    const values = [
        input.name,
        input.description ?? null,
        input.posterUrl ?? null,
        input.discountType,
        input.discountValue,
        input.startDate,
        input.endDate,
        input.minOrder ?? 0,
        input.maxDiscount ?? null,
        input.usageLimit ?? null,
        input.isActive ? 1 : 0,
    ];

    if (id) {
        await execute(
            `UPDATE tblOffer SET name = ?, description = ?, poster_url = ?, discount_type = ?, discount_value = ?, start_date = ?, end_date = ?, min_order = ?, max_discount = ?, usage_limit = ?, is_active = ? WHERE id = ?`,
            [...values, id]
        );
    } else {
        id = (
            await execute(
                `INSERT INTO tblOffer (name, description, poster_url, discount_type, discount_value, start_date, end_date, min_order, max_discount, usage_limit, is_active) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                values
            )
        ).insertId;
    }

    await audit(ctx, 'OFFER_SAVED', 'catalog', id, { name: input.name });
    return getOffer(id);
}

export async function deleteOffer(id: number, ctx: AuditContext) {
    await execute('DELETE FROM tblOffer WHERE id = ?', [id]);
    await audit(ctx, 'OFFER_DELETED', 'catalog', id);
}

// Developer by: Buildnexdev.in
// Devevloper : Nandhakumar@gmail.com
// Last Edited : 06-10-2026
import { execute, query, queryOne } from '../../db/pool.js';
import { badRequest, notFound } from '../../utils/errors.js';
import { audit, type AuditContext } from '../audit/audit.service.js';

export interface AssetInput {
    assetCode: string;
    name: string;
    category: 'CAMERA' | 'LENS' | 'FLASH' | 'TRIPOD' | 'LIGHTS' | 'MEMORY_CARD' | 'LAPTOP' | 'PRINTER' | 'STUDIO_EQUIPMENT' | 'OTHER';
    purchaseDate?: string | null;
    purchasePrice: number;
    currentValue: number;
    assetCondition: 'EXCELLENT' | 'GOOD' | 'FAIR' | 'POOR' | 'DAMAGED';
    location?: string | null;
    status: 'AVAILABLE' | 'ASSIGNED' | 'IN_USE' | 'MAINTENANCE' | 'DAMAGED' | 'LOST' | 'RETIRED';
    maintenanceDate?: string | null;
    notes?: string | null;
}

export async function listAssets(options: { category?: string; status?: string } = {}) {
    const conditions: string[] = [];
    const params: unknown[] = [];

    if (options.category) {
        conditions.push('category = ?');
        params.push(options.category);
    }
    if (options.status) {
        conditions.push('status = ?');
        params.push(options.status);
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    return query(`SELECT * FROM tblAsset ${where} ORDER BY id DESC`, params);
}

export async function getAsset(id: number) {
    const asset = await queryOne('SELECT * FROM tblAsset WHERE id = ?', [id]);
    if (!asset) throw notFound('Asset');
    const assignments = await query(
        `SELECT aa.*, u.name AS staff_name, e.title AS event_title 
         FROM tblAssetAssignment aa 
         LEFT JOIN tblStaff s ON s.id = aa.staff_id 
         LEFT JOIN tblUser u ON u.id = s.user_id 
         LEFT JOIN tblEvent e ON e.id = aa.event_id 
         WHERE aa.asset_id = ? ORDER BY aa.id DESC`,
        [id]
    );
    return { ...asset, assignments };
}

export async function saveAsset(id: number | null, input: AssetInput, ctx: AuditContext) {
    const code = input.assetCode.trim().toUpperCase();
    const dup = await queryOne('SELECT id FROM tblAsset WHERE asset_code = ? AND id <> ?', [code, id ?? 0]);
    if (dup) throw badRequest('Asset code already exists.');

    const values = [
        code,
        input.name,
        input.category,
        input.purchaseDate ?? null,
        input.purchasePrice,
        input.currentValue,
        input.assetCondition,
        input.location ?? null,
        input.status,
        input.maintenanceDate ?? null,
        input.notes ?? null,
    ];

    if (id) {
        await execute(
            `UPDATE tblAsset SET asset_code = ?, name = ?, category = ?, purchase_date = ?, purchase_price = ?, current_value = ?, asset_condition = ?, location = ?, status = ?, maintenance_date = ?, notes = ? WHERE id = ?`,
            [...values, id]
        );
    } else {
        id = (
            await execute(
                `INSERT INTO tblAsset (asset_code, name, category, purchase_date, purchase_price, current_value, asset_condition, location, status, maintenance_date, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                values
            )
        ).insertId;
    }

    await audit(ctx, 'ASSET_SAVED', 'system', id, { code, name: input.name });
    return getAsset(id);
}

export async function assignAsset(assetId: number, staffId: number | null, eventId: number | null, notes: string | null, ctx: AuditContext) {
    const asset = await queryOne<{ id: number }>('SELECT id FROM tblAsset WHERE id = ?', [assetId]);
    if (!asset) throw notFound('Asset');

    await execute(
        'INSERT INTO tblAssetAssignment (asset_id, staff_id, event_id, notes) VALUES (?, ?, ?, ?)',
        [assetId, staffId ?? null, eventId ?? null, notes ?? null]
    );

    await execute("UPDATE tblAsset SET status = 'ASSIGNED' WHERE id = ?", [assetId]);
    await audit(ctx, 'ASSET_ASSIGNED', 'system', assetId, { staffId, eventId });
    return getAsset(assetId);
}

export async function returnAsset(assetId: number, condition: string, notes: string | null, ctx: AuditContext) {
    await execute(
        "UPDATE tblAssetAssignment SET returned_at = NOW(), notes = CONCAT(IFNULL(notes, ''), ' [Returned condition: ', ?, ']') WHERE asset_id = ? AND returned_at IS NULL",
        [condition, assetId]
    );

    await execute(
        "UPDATE tblAsset SET status = 'AVAILABLE', asset_condition = ? WHERE id = ?",
        [condition, assetId]
    );

    await audit(ctx, 'ASSET_RETURNED', 'system', assetId, { condition });
    return getAsset(assetId);
}

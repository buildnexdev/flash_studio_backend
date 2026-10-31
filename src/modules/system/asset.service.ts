// Developer by: Buildnexdev.in
// Devevloper : Nandhakumar@gmail.com
// Last Edited : 27-10-2026
import { execute, query, queryOne } from '../../db/pool.js';
import { badRequest, notFound } from '../../utils/errors.js';
import { nextNumber } from '../../utils/numbering.js';
import { audit, type AuditContext } from '../audit/audit.service.js';

export interface AssetInput {
    assetCode?: string | null;
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

export async function listAssets(options: { category?: string; status?: string; companyId?: number } = {}) {
    const conditions: string[] = [];
    const params: unknown[] = [];

    if (options.companyId) {
        conditions.push('company_id = ?');
        params.push(options.companyId);
    }
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

export async function getAsset(id: number, companyId?: number | null) {
    const where = ['id = ?'];
    const params: unknown[] = [id];
    if (companyId) {
        where.push('company_id = ?');
        params.push(companyId);
    }
    const asset = await queryOne(`SELECT * FROM tblAsset WHERE ${where.join(' AND ')}`, params);
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
    let code: string;
    if (id) {
        const existing = await queryOne<{ asset_code: string }>('SELECT asset_code FROM tblAsset WHERE id = ?', [id]);
        if (!existing) throw notFound('Asset');
        code = existing.asset_code;
    } else {
        code = (input.assetCode?.trim() || (await nextNumber('asset'))).toUpperCase();
        const dup = await queryOne('SELECT id FROM tblAsset WHERE asset_code = ?', [code]);
        if (dup) throw badRequest('Asset code already exists.');
    }

    const values = [
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
            `UPDATE tblAsset SET name = ?, category = ?, purchase_date = ?, purchase_price = ?, current_value = ?, asset_condition = ?, location = ?, status = ?, maintenance_date = ?, notes = ? WHERE id = ?`,
            [...values, id],
        );
    } else {
        const companyId = ctx.companyId ?? 1;
        id = (
            await execute(
                `INSERT INTO tblAsset (company_id, asset_code, name, category, purchase_date, purchase_price, current_value, asset_condition, location, status, maintenance_date, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [companyId, code, ...values],
            )
        ).insertId;
    }

    await audit(ctx, 'ASSET_SAVED', 'system', id, { code, name: input.name });
    return getAsset(id);
}

export async function listEventAssets(eventId: number) {
    return query(
        `SELECT aa.id AS assignment_id, a.id, a.asset_code, a.name, a.category, a.status, a.asset_condition,
                aa.assigned_at, aa.notes, aa.staff_id, u.name AS staff_name
           FROM tblAssetAssignment aa
           JOIN tblAsset a ON a.id = aa.asset_id
           LEFT JOIN tblStaff s ON s.id = aa.staff_id
           LEFT JOIN tblUser u ON u.id = s.user_id
          WHERE aa.event_id = ? AND aa.returned_at IS NULL
          ORDER BY aa.id DESC`,
        [eventId],
    );
}

export async function assignAsset(assetId: number, staffId: number | null, eventId: number | null, notes: string | null, ctx: AuditContext) {
    const asset = await queryOne<{ id: number; status: string; company_id: number | null }>('SELECT id, status, company_id FROM tblAsset WHERE id = ?', [assetId]);
    if (!asset) throw notFound('Asset');
    if (!['AVAILABLE', 'ASSIGNED'].includes(asset.status)) throw badRequest('This asset is not available to assign.');
    if (eventId) {
        const event = await queryOne('SELECT id FROM tblEvent WHERE id = ? AND deleted_at IS NULL', [eventId]);
        if (!event) throw notFound('Event');
        const open = await queryOne('SELECT id FROM tblAssetAssignment WHERE asset_id = ? AND returned_at IS NULL', [assetId]);
        if (open) throw badRequest('This asset is already allocated. Return it before assigning again.');
    }

    const companyId = ctx.companyId ?? asset.company_id ?? 1;
    await execute('INSERT INTO tblAssetAssignment (company_id, asset_id, staff_id, event_id, notes) VALUES (?, ?, ?, ?, ?)', [companyId, assetId, staffId ?? null, eventId ?? null, notes ?? null]);
    await execute("UPDATE tblAsset SET status = 'ASSIGNED' WHERE id = ?", [assetId]);
    await audit(ctx, 'ASSET_ASSIGNED', 'system', assetId, { staffId, eventId });
    return getAsset(assetId);
}

export async function returnAsset(assetId: number, condition: string, notes: string | null, ctx: AuditContext) {
    const open = await queryOne<{ id: number }>('SELECT id FROM tblAssetAssignment WHERE asset_id = ? AND returned_at IS NULL ORDER BY id DESC LIMIT 1', [assetId]);
    if (!open) throw badRequest('No open assignment for this asset.');

    await execute(
        "UPDATE tblAssetAssignment SET returned_at = UTC_TIMESTAMP(), notes = CONCAT(IFNULL(notes, ''), IF(? IS NULL OR ? = '', '', CONCAT(' [Returned: ', ?, ']'))) WHERE id = ?",
        [notes, notes, notes ?? '', open.id],
    );
    await execute("UPDATE tblAsset SET status = 'AVAILABLE', asset_condition = ? WHERE id = ?", [condition, assetId]);
    await audit(ctx, 'ASSET_RETURNED', 'system', assetId, { condition });
    return getAsset(assetId);
}

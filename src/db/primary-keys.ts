// Primary key column for each table: tblUser.id -> userID, tblCompany.id -> companyID.
import type { Connection, RowDataPacket } from 'mysql2/promise';

export const TABLE_PK: Record<string, string> = {
    tblalbum: 'albumID',
    tblalbumproof: 'albumProofID',
    tblalbumrevision: 'albumRevisionID',
    tblasset: 'assetID',
    tblassetassignment: 'assetAssignmentID',
    tblauditlog: 'auditLogID',
    tblbooking: 'bookingID',
    tblcart: 'cartID',
    tblcartitem: 'cartItemID',
    tblcompany: 'companyID',
    tblcompanysignup: 'companySignupID',
    tblcoupon: 'couponID',
    tblcustomer: 'customerID',
    tbldeliveryorder: 'deliveryOrderID',
    tbldownload: 'downloadID',
    tbleditor: 'editorID',
    tblevent: 'eventID',
    tbleventaccess: 'eventAccessID',
    tbleventstaff: 'eventStaffID',
    tblfinancetransaction: 'financeTransactionID',
    tblgallery: 'galleryID',
    tblgalleryaccesslog: 'galleryAccessLogID',
    tblgallerytoken: 'galleryTokenID',
    tblinvoice: 'invoiceID',
    tblnotification: 'notificationID',
    tbloffer: 'offerID',
    tblorder: 'orderID',
    tblorderitem: 'orderItemID',
    tblotpcode: 'otpCodeID',
    tblpackage: 'packageID',
    tblpayment: 'paymentID',
    tblpermission: 'permissionID',
    tblphoto: 'photoID',
    tblphotocomment: 'photoCommentID',
    tblphotoface: 'photoFaceID',
    tblphotofavourite: 'photoFavouriteID',
    tblphotographer: 'photographerID',
    tblphotoselection: 'photoSelectionID',
    tblphotoview: 'photoViewID',
    tblportfolioitem: 'portfolioItemID',
    tblprintorder: 'printOrderID',
    tblproduct: 'productID',
    tblproductcategory: 'productCategoryID',
    tblproductvariant: 'productVariantID',
    tblquotation: 'quotationID',
    tblquotationitem: 'quotationItemID',
    tblreferral: 'referralID',
    tblrefreshtoken: 'refreshTokenID',
    tblreward: 'rewardID',
    tblrole: 'roleID',
    tblselectionsubmission: 'selectionSubmissionID',
    tblservice: 'serviceID',
    tblstaff: 'staffID',
    tblstaffdocument: 'staffDocumentID',
    tblsupportmessage: 'supportMessageID',
    tblsupportticket: 'supportTicketID',
    tbltestimonial: 'testimonialID',
    tbluser: 'userID',
};

const PK_NAMES = new Set(Object.values(TABLE_PK));

const NOT_ALIAS = new Set([
    'where', 'set', 'on', 'join', 'left', 'right', 'inner', 'outer', 'cross', 'order', 'group', 'limit', 'having',
    'union', 'values', 'select', 'and', 'or', 'using', 'natural', 'ignore', 'for', 'lock', 'share', 'by', 'asc',
    'desc', 'distinct', 'all', 'as', 'into', 'from', 'update', 'delete', 'insert', 'replace', 'with', 'straight_join',
]);

const qi = (name: string) => `\`${name.replace(/`/g, '``')}\``;

export function primaryKeyName(table: string): string | undefined {
    return TABLE_PK[table.toLowerCase().replace(/`/g, '')];
}

/** Rewrite SQL written against `id` so it uses userID / companyID / roleID and the rest. */
export function rewriteSql(sql: string): string {
    const aliasToPk = new Map<string, string>();
    const tables: string[] = [];
    const fromJoin = /\b(?:FROM|JOIN|UPDATE|INTO)\s+(`?)(tbl[A-Za-z0-9_]+)\1(?:\s+(?:AS\s+)?(`?)([A-Za-z_][A-Za-z0-9_]*)\3)?/gi;
    let match: RegExpExecArray | null;
    while ((match = fromJoin.exec(sql))) {
        const pk = primaryKeyName(match[2]);
        if (!pk) continue;
        tables.push(match[2].toLowerCase());
        aliasToPk.set(match[2].toLowerCase(), pk);
        const alias = match[4];
        if (alias && !NOT_ALIAS.has(alias.toLowerCase())) aliasToPk.set(alias.toLowerCase(), pk);
    }

    let out = sql.replace(/\b([A-Za-z_][A-Za-z0-9_]*)\.`?id`?\b/g, (full, alias: string) => {
        const pk = aliasToPk.get(alias.toLowerCase());
        return pk ? full.replace(/\.`?id`?$/i, `.${pk}`) : full;
    });

    const distinct = [...new Set(tables)];
    if (distinct.length === 1) {
        const pk = primaryKeyName(distinct[0]);
        if (pk) out = out.replace(/\bid\b/g, pk);
    }
    return out;
}

/** Keep API rows on `id` when the query selected a single renamed primary key. */
export function aliasPrimaryKeyFields(rows: unknown): void {
    if (!Array.isArray(rows)) return;
    for (const row of rows) {
        if (!row || typeof row !== 'object' || Array.isArray(row)) continue;
        const record = row as Record<string, unknown>;
        if ('id' in record) continue;
        const keys = Object.keys(record).filter((key) => PK_NAMES.has(key));
        if (keys.length === 1) record.id = record[keys[0]];
    }
}

type SqlConn = Pick<Connection, 'query'>;

interface FkRow extends RowDataPacket {
    CONSTRAINT_NAME: string;
    TABLE_NAME: string;
    COLUMN_NAME: string;
    REFERENCED_TABLE_NAME: string;
    DELETE_RULE: string;
    UPDATE_RULE: string;
}

interface IdColumn extends RowDataPacket {
    TABLE_NAME: string;
    COLUMN_TYPE: string;
    IS_NULLABLE: string;
    EXTRA: string;
}

/** Rename each table's `id` primary key and point foreign keys at the new column. Safe to run again. */
export async function renamePrimaryKeys(conn: SqlConn, log = true): Promise<string[]> {
    const [idColumns] = await conn.query<IdColumn[]>(
        `SELECT c.TABLE_NAME, c.COLUMN_TYPE, c.IS_NULLABLE, c.EXTRA
           FROM information_schema.COLUMNS c
           JOIN (
                SELECT TABLE_NAME
                  FROM information_schema.STATISTICS
                 WHERE TABLE_SCHEMA = DATABASE() AND INDEX_NAME = 'PRIMARY'
                 GROUP BY TABLE_NAME
                HAVING COUNT(*) = 1 AND SUM(COLUMN_NAME = 'id') = 1
           ) p ON p.TABLE_NAME = c.TABLE_NAME
          WHERE c.TABLE_SCHEMA = DATABASE() AND c.COLUMN_NAME = 'id' AND c.TABLE_NAME LIKE 'tbl%'`,
    );
    const pending = idColumns.filter((col) => primaryKeyName(col.TABLE_NAME));
    if (!pending.length) return [];

    const [fks] = await conn.query<FkRow[]>(
        `SELECT k.CONSTRAINT_NAME, k.TABLE_NAME, k.COLUMN_NAME, k.REFERENCED_TABLE_NAME, r.DELETE_RULE, r.UPDATE_RULE
           FROM information_schema.KEY_COLUMN_USAGE k
           JOIN information_schema.REFERENTIAL_CONSTRAINTS r
             ON r.CONSTRAINT_SCHEMA = k.TABLE_SCHEMA AND r.CONSTRAINT_NAME = k.CONSTRAINT_NAME AND r.TABLE_NAME = k.TABLE_NAME
          WHERE k.TABLE_SCHEMA = DATABASE() AND k.REFERENCED_COLUMN_NAME = 'id'
          ORDER BY k.CONSTRAINT_NAME, k.ORDINAL_POSITION`,
    );

    const renamed: string[] = [];
    await conn.query('SET FOREIGN_KEY_CHECKS = 0');
    try {
        for (const fk of fks) await conn.query(`ALTER TABLE ${qi(fk.TABLE_NAME)} DROP FOREIGN KEY ${qi(fk.CONSTRAINT_NAME)}`);
        for (const col of pending) {
            const next = primaryKeyName(col.TABLE_NAME);
            if (!next || !/^[a-z0-9(), ]+$/i.test(col.COLUMN_TYPE)) continue;
            const nullable = col.IS_NULLABLE === 'YES' ? 'NULL' : 'NOT NULL';
            const extra = /auto_increment/i.test(col.EXTRA) ? ' AUTO_INCREMENT' : '';
            await conn.query(`ALTER TABLE ${qi(col.TABLE_NAME)} CHANGE COLUMN \`id\` ${qi(next)} ${col.COLUMN_TYPE} ${nullable}${extra}`);
            renamed.push(`${col.TABLE_NAME}.id -> ${next}`);
            if (log) console.log(`[migrate] ${col.TABLE_NAME}.id -> ${next}`);
        }
        for (const fk of fks) {
            const target = primaryKeyName(fk.REFERENCED_TABLE_NAME);
            if (!target) continue;
            await conn.query(
                `ALTER TABLE ${qi(fk.TABLE_NAME)} ADD CONSTRAINT ${qi(fk.CONSTRAINT_NAME)} FOREIGN KEY (${qi(fk.COLUMN_NAME)}) REFERENCES ${qi(fk.REFERENCED_TABLE_NAME)} (${qi(target)}) ON DELETE ${fk.DELETE_RULE} ON UPDATE ${fk.UPDATE_RULE}`,
            );
        }
    } finally {
        await conn.query('SET FOREIGN_KEY_CHECKS = 1');
    }
    return renamed;
}

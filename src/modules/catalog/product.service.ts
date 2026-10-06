// Developer by: Buildnexdev.in
// Devevloper : Nandhakumar@gmail.com
// Last Edited : 06-10-2026
import { execute, json, query, queryOne, pool } from '../../db/pool.js';
import { badRequest, notFound } from '../../utils/errors.js';
import { audit, type AuditContext } from '../audit/audit.service.js';

const slugify = (s: string) =>
    s
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '')
        .slice(0, 120) || `prod-${Date.now()}`;

/* ---------------- Categories ---------------- */

export interface ProductCategoryInput {
    name: string;
    description?: string | null;
    imageUrl?: string | null;
    isActive: boolean;
    sortOrder: number;
}

export async function listProductCategories(activeOnly = false) {
    return query(`SELECT * FROM tblProductCategory WHERE deleted_at IS NULL ${activeOnly ? 'AND is_active = 1' : ''} ORDER BY sort_order, name`);
}

export async function saveProductCategory(id: number | null, input: ProductCategoryInput, ctx: AuditContext) {
    const slug = slugify(input.name);
    const values = [input.name, slug, input.description ?? null, input.imageUrl ?? null, input.isActive ? 1 : 0, input.sortOrder];
    if (id) {
        await execute('UPDATE tblProductCategory SET name = ?, slug = ?, description = ?, image_url = ?, is_active = ?, sort_order = ? WHERE id = ?', [...values, id]);
    } else {
        id = (await execute('INSERT INTO tblProductCategory (name, slug, description, image_url, is_active, sort_order) VALUES (?, ?, ?, ?, ?, ?)', values)).insertId;
    }
    await audit(ctx, 'PRODUCT_CATEGORY_SAVED', 'catalog', id, { name: input.name });
    return queryOne('SELECT * FROM tblProductCategory WHERE id = ?', [id]);
}

export async function deleteProductCategory(id: number, ctx: AuditContext) {
    await execute('UPDATE tblProductCategory SET deleted_at = UTC_TIMESTAMP(), is_active = 0 WHERE id = ?', [id]);
    await audit(ctx, 'PRODUCT_CATEGORY_DELETED', 'catalog', id);
}

/* ---------------- Products ---------------- */

export interface ProductInput {
    categoryId?: number | null;
    sku: string;
    name: string;
    description?: string | null;
    images?: string[];
    price: number;
    discountPrice?: number | null;
    stock: number;
    status: 'DRAFT' | 'ACTIVE' | 'OUT_OF_STOCK' | 'ARCHIVED';
    isFeatured: boolean;
    customizationEnabled: boolean;
}

export async function listProducts(options: { categoryId?: number; search?: string; activeOnly?: boolean; isFeatured?: boolean } = {}) {
    const conditions: string[] = ['p.deleted_at IS NULL'];
    const params: unknown[] = [];

    if (options.activeOnly) conditions.push("p.status = 'ACTIVE'");
    if (options.isFeatured) conditions.push('p.is_featured = 1');
    if (options.categoryId) {
        conditions.push('p.category_id = ?');
        params.push(options.categoryId);
    }
    if (options.search) {
        conditions.push('(p.name LIKE ? OR p.sku LIKE ? OR p.description LIKE ?)');
        const s = `%${options.search}%`;
        params.push(s, s, s);
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    return query(
        `SELECT p.*, c.name AS category_name 
         FROM tblProduct p 
         LEFT JOIN tblProductCategory c ON c.id = p.category_id 
         ${where} 
         ORDER BY p.is_featured DESC, p.id DESC`,
        params,
    );
}

export async function getProduct(idOrSlug: string | number) {
    const isId = typeof idOrSlug === 'number' || /^\d+$/.test(String(idOrSlug));
    const field = isId ? 'p.id' : 'p.slug';
    const product = await queryOne<Record<string, unknown>>(
        `SELECT p.*, c.name AS category_name 
         FROM tblProduct p 
         LEFT JOIN tblProductCategory c ON c.id = p.category_id 
         WHERE ${field} = ? AND p.deleted_at IS NULL`,
        [idOrSlug],
    );
    if (!product) throw notFound('Product');

    const variants = await query('SELECT * FROM tblProductVariant WHERE product_id = ?', [product.id]);
    return { ...product, variants };
}

export async function saveProduct(id: number | null, input: ProductInput, ctx: AuditContext) {
    const slug = slugify(input.name);
    const imagesJson = input.images ? json(input.images) : null;
    const values = [
        input.categoryId ?? null,
        input.sku.trim().toUpperCase(),
        input.name,
        slug,
        input.description ?? null,
        imagesJson,
        input.price,
        input.discountPrice ?? null,
        input.stock,
        input.status,
        input.isFeatured ? 1 : 0,
        input.customizationEnabled ? 1 : 0,
    ];

    if (id) {
        await execute(
            `UPDATE tblProduct SET category_id = ?, sku = ?, name = ?, slug = ?, description = ?, images = ?, price = ?, discount_price = ?, stock = ?, status = ?, is_featured = ?, customization_enabled = ? WHERE id = ?`,
            [...values, id],
        );
    } else {
        id = (
            await execute(
                `INSERT INTO tblProduct (category_id, sku, name, slug, description, images, price, discount_price, stock, status, is_featured, customization_enabled) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                values,
            )
        ).insertId;
    }

    await audit(ctx, 'PRODUCT_SAVED', 'catalog', id, { name: input.name, sku: input.sku });
    return getProduct(id);
}

export async function deleteProduct(id: number, ctx: AuditContext) {
    await execute("UPDATE tblProduct SET deleted_at = UTC_TIMESTAMP(), status = 'ARCHIVED' WHERE id = ?", [id]);
    await audit(ctx, 'PRODUCT_DELETED', 'catalog', id);
}

/* ---------------- Cart Management ---------------- */

export interface AddCartItemInput {
    customerId?: number | null;
    sessionId?: string | null;
    productId: number;
    variantId?: number | null;
    quantity: number;
    customization?: Record<string, unknown> | null;
}

export async function getOrCreateCart(customerId?: number | null, sessionId?: string | null) {
    let cart: { id: number } | null = null;
    if (customerId) {
        cart = await queryOne<{ id: number }>('SELECT id FROM tblCart WHERE customer_id = ? ORDER BY id DESC LIMIT 1', [customerId]);
    } else if (sessionId) {
        cart = await queryOne<{ id: number }>('SELECT id FROM tblCart WHERE session_id = ? ORDER BY id DESC LIMIT 1', [sessionId]);
    }

    if (!cart) {
        const id = (await execute('INSERT INTO tblCart (customer_id, session_id) VALUES (?, ?)', [customerId ?? null, sessionId ?? null])).insertId;
        cart = { id };
    }
    return cart;
}

export async function getCartDetails(cartId: number) {
    const items = await query<Record<string, unknown>[]>(
        `SELECT ci.*, p.name AS product_name, p.sku, p.images, p.price AS product_price, p.discount_price, v.name AS variant_name
         FROM tblCartItem ci
         JOIN tblProduct p ON p.id = ci.product_id
         LEFT JOIN tblProductVariant v ON v.id = ci.variant_id
         WHERE ci.cart_id = ?`,
        [cartId],
    );

    let subtotal = 0;
    const processedItems = items.map((item) => {
        const unitPrice = (item.discount_price as number) || (item.product_price as number);
        const itemTotal = unitPrice * (item.quantity as number);
        subtotal += itemTotal;
        return {
            ...item,
            unit_price: unitPrice,
            total_price: itemTotal,
        };
    });

    return {
        cartId,
        items: processedItems,
        subtotal,
        itemCount: processedItems.reduce((acc, i) => acc + (i.quantity as number), 0),
    };
}

export async function addToCart(input: AddCartItemInput) {
    const product = await queryOne<{ id: number; price: number; discount_price: number | null; stock: number; status: string }>(
        'SELECT id, price, discount_price, stock, status FROM tblProduct WHERE id = ? AND deleted_at IS NULL',
        [input.productId],
    );
    if (!product || product.status !== 'ACTIVE') throw badRequest('Product is not available for purchase.');

    const cart = await getOrCreateCart(input.customerId, input.sessionId);
    const unitPrice = product.discount_price || product.price;

    const existingItem = await queryOne<{ id: number; quantity: number }>(
        'SELECT id, quantity FROM tblCartItem WHERE cart_id = ? AND product_id = ? AND (variant_id = ? OR (variant_id IS NULL AND ? IS NULL))',
        [cart.id, input.productId, input.variantId ?? null, input.variantId ?? null],
    );

    if (existingItem) {
        const newQty = existingItem.quantity + input.quantity;
        const newTotal = unitPrice * newQty;
        await execute('UPDATE tblCartItem SET quantity = ?, total_price = ?, customization = ? WHERE id = ?', [newQty, newTotal, input.customization ? json(input.customization) : null, existingItem.id]);
    } else {
        const itemTotal = unitPrice * input.quantity;
        await execute(
            'INSERT INTO tblCartItem (cart_id, product_id, variant_id, quantity, customization, unit_price, total_price) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [cart.id, input.productId, input.variantId ?? null, input.quantity, input.customization ? json(input.customization) : null, unitPrice, itemTotal],
        );
    }

    return getCartDetails(cart.id);
}

export async function updateCartItemQuantity(cartItemId: number, quantity: number) {
    if (quantity <= 0) {
        await execute('DELETE FROM tblCartItem WHERE id = ?', [cartItemId]);
    } else {
        const item = await queryOne<{ cart_id: number; unit_price: number }>('SELECT cart_id, unit_price FROM tblCartItem WHERE id = ?', [cartItemId]);
        if (!item) throw notFound('Cart item');
        const newTotal = item.unit_price * quantity;
        await execute('UPDATE tblCartItem SET quantity = ?, total_price = ? WHERE id = ?', [quantity, newTotal, cartItemId]);
    }
}

export async function removeCartItem(cartItemId: number) {
    await execute('DELETE FROM tblCartItem WHERE id = ?', [cartItemId]);
}

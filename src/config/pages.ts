// Developer by: Buildnexdev.in
// Last Edited : 25-10-2026
import type { Permission } from './rbac.js';

export const PAGE_ACTIONS = ['view', 'add', 'edit', 'delete'] as const;
export type PageAction = (typeof PAGE_ACTIONS)[number];
export type PageRule = Record<PageAction, boolean>;

export interface PageDef {
    key: string;
    label: string;
    group: string;
    /** Permissions that open the page (granted by View). */
    view: Permission[];
    /** Permissions needed to change data (granted by Add, Edit or Delete). */
    manage: Permission[];
    /** API prefixes whose requests are checked against the user's page rule. */
    api: string[];
}

/** Admin pages that can be switched on or off per user. */
export const PAGES: PageDef[] = [
    { key: 'dashboard', label: 'Dashboard', group: 'Overview', view: ['dashboard.view'], manage: [], api: [] },
    { key: 'staff', label: 'Staff', group: 'User management', view: ['staff.manage'], manage: ['staff.manage', 'users.manage'], api: ['/api/users'] },
    { key: 'customers', label: 'Customers', group: 'Customer management', view: ['customers.view'], manage: ['customers.manage'], api: ['/api/customers'] },
    { key: 'bookings', label: 'Bookings', group: 'Customer management', view: ['bookings.view'], manage: ['bookings.manage'], api: ['/api/bookings'] },
    { key: 'events', label: 'Events', group: 'Event management', view: ['events.view'], manage: ['events.manage', 'staff.assign'], api: ['/api/events'] },
    { key: 'galleries', label: 'Galleries and QR', group: 'Event management', view: ['galleries.manage'], manage: ['galleries.manage'], api: ['/api/galleries'] },
    { key: 'photos', label: 'Photos', group: 'Event management', view: ['photos.manage'], manage: ['photos.manage'], api: ['/api/photos'] },
    { key: 'services', label: 'Services', group: 'Package management', view: ['pricing.manage'], manage: ['pricing.manage'], api: ['/api/catalog/services'] },
    { key: 'packages', label: 'Packages', group: 'Package management', view: ['pricing.manage'], manage: ['pricing.manage'], api: ['/api/catalog/packages'] },
    { key: 'coupons', label: 'Coupons', group: 'Package management', view: ['pricing.manage'], manage: ['pricing.manage'], api: ['/api/catalog/coupons'] },
    { key: 'orders', label: 'Orders', group: 'Operations management', view: ['orders.view'], manage: ['orders.manage'], api: ['/api/orders'] },
    { key: 'printing', label: 'Printing', group: 'Operations management', view: ['printing.manage'], manage: ['printing.manage'], api: ['/api/printing'] },
    { key: 'delivery', label: 'Delivery', group: 'Operations management', view: ['delivery.manage'], manage: ['delivery.manage'], api: ['/api/delivery'] },
    { key: 'equipment', label: 'Studio equipment', group: 'Asset management', view: ['events.view'], manage: ['events.manage'], api: ['/api/assets'] },
    { key: 'payments', label: 'Payments', group: 'Finance management', view: ['payments.view'], manage: ['payments.manage'], api: ['/api/payments'] },
    { key: 'reports', label: 'Reports', group: 'Reports management', view: ['reports.view'], manage: [], api: ['/api/reports'] },
    { key: 'website', label: 'Website content', group: 'System settings', view: ['pricing.manage'], manage: ['pricing.manage'], api: ['/api/catalog/portfolio', '/api/catalog/testimonials'] },
    { key: 'settings', label: 'Settings', group: 'System settings', view: ['settings.manage'], manage: ['settings.manage'], api: ['/api/settings'] },
    { key: 'audit', label: 'Audit logs', group: 'System settings', view: ['audit.view'], manage: [], api: ['/api/audit-logs'] },
];

export const PAGE_KEYS = PAGES.map((p) => p.key);

/** Shared lookups other pages depend on; never blocked by a page rule. */
const OPEN_PATHS = ['/api/users/assignable', '/api/users/access', '/api/users/roles'];

/** What a set of role permissions allows on each page. */
export function roleRule(page: PageDef, perms: Set<string>): PageRule {
    const view = [...page.view, ...page.manage].some((p) => perms.has(p));
    const write = page.manage.length > 0 && page.manage.some((p) => perms.has(p));
    return { view, add: write, edit: write, delete: write };
}

/** Role permissions adjusted by the user's page rules. */
export function applyPageRules(rolePerms: Set<Permission>, rules: Map<string, PageRule>): Set<Permission> {
    const added = new Set<Permission>();
    const removed = new Set<Permission>();
    for (const page of PAGES) {
        const rule = rules.get(page.key);
        if (!rule) continue;
        const write = rule.add || rule.edit || rule.delete;
        if (rule.view) page.view.forEach((p) => added.add(p));
        else [...page.view, ...page.manage].forEach((p) => removed.add(p));
        if (write) page.manage.forEach((p) => added.add(p));
        else page.manage.forEach((p) => removed.add(p));
    }
    const out = new Set([...rolePerms].filter((p) => !removed.has(p)));
    added.forEach((p) => out.add(p));
    return out;
}

/** The page rule that applies to an API request, with the action it performs. */
export function matchPageRequest(method: string, path: string): { page: PageDef; action: PageAction } | null {
    if (OPEN_PATHS.some((p) => path === p || path.startsWith(`${p}/`))) return null;
    let best: { page: PageDef; prefix: string } | null = null;
    for (const page of PAGES) {
        for (const prefix of page.api) {
            if ((path === prefix || path.startsWith(`${prefix}/`)) && (!best || prefix.length > best.prefix.length)) best = { page, prefix };
        }
    }
    if (!best) return null;
    const m = method.toUpperCase();
    const rest = path.slice(best.prefix.length).replace(/\/+$/, '');
    const action: PageAction = m === 'GET' || m === 'HEAD' ? 'view' : m === 'DELETE' ? 'delete' : m === 'POST' && !rest ? 'add' : 'edit';
    return { page: best.page, action };
}

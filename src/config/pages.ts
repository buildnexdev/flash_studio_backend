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
    { key: 'staff', label: 'Staff', group: 'Master', view: ['staff.manage'], manage: ['staff.manage', 'users.manage'], api: ['/api/users'] },
    { key: 'customers', label: 'Customers', group: 'Master', view: ['customers.view'], manage: ['customers.manage'], api: ['/api/customers'] },
    { key: 'services', label: 'Services', group: 'Master', view: ['pricing.manage'], manage: ['pricing.manage'], api: ['/api/catalog/services'] },
    { key: 'packages', label: 'Packages', group: 'Master', view: ['pricing.manage'], manage: ['pricing.manage'], api: ['/api/catalog/packages'] },
    { key: 'coupons', label: 'Coupons', group: 'Master', view: ['pricing.manage'], manage: ['pricing.manage'], api: ['/api/catalog/coupons'] },
    { key: 'website', label: 'Website content', group: 'Master', view: ['pricing.manage'], manage: ['pricing.manage'], api: ['/api/catalog/portfolio', '/api/catalog/testimonials'] },
    { key: 'settings', label: 'Settings', group: 'Master', view: ['settings.manage'], manage: ['settings.manage'], api: ['/api/settings'] },
    { key: 'audit', label: 'Audit logs', group: 'Master', view: ['audit.view'], manage: [], api: ['/api/audit-logs'] },
    { key: 'bookings', label: 'Bookings', group: 'Operation', view: ['bookings.view'], manage: ['bookings.manage'], api: ['/api/bookings'] },
    { key: 'events', label: 'Events', group: 'Operation', view: ['events.view'], manage: ['events.manage', 'staff.assign'], api: ['/api/events'] },
    { key: 'galleries', label: 'Galleries and QR', group: 'Operation', view: ['galleries.manage'], manage: ['galleries.manage'], api: ['/api/galleries'] },
    { key: 'photos', label: 'Photos', group: 'Operation', view: ['photos.manage'], manage: ['photos.manage'], api: ['/api/photos'] },
    { key: 'orders', label: 'Orders', group: 'Operation', view: ['orders.view'], manage: ['orders.manage'], api: ['/api/orders'] },
    { key: 'printing', label: 'Printing', group: 'Operation', view: ['printing.manage'], manage: ['printing.manage'], api: ['/api/printing'] },
    { key: 'delivery', label: 'Delivery', group: 'Operation', view: ['delivery.manage'], manage: ['delivery.manage'], api: ['/api/delivery'] },
    { key: 'equipment', label: 'Asset management', group: 'Operation', view: ['events.view'], manage: ['events.manage'], api: ['/api/assets'] },
    { key: 'payments', label: 'Payments management', group: 'Finance', view: ['payments.view'], manage: ['payments.manage'], api: ['/api/payments'] },
    { key: 'payroll', label: 'Payroll', group: 'Finance', view: ['payments.view', 'staff.manage'], manage: ['payments.manage', 'staff.manage'], api: ['/api/payroll'] },
    { key: 'endOfDay', label: 'End of day', group: 'Finance', view: ['payments.view', 'reports.view'], manage: ['payments.manage'], api: ['/api/closing'] },
    { key: 'endOfMonth', label: 'End of month', group: 'Finance', view: ['payments.view', 'reports.view'], manage: ['payments.manage'], api: ['/api/closing'] },
    { key: 'reports', label: 'All reports', group: 'Report', view: ['reports.view'], manage: [], api: ['/api/reports'] },
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
    const action: PageAction = m === 'POST' ? 'add' : m === 'PUT' || m === 'PATCH' ? 'edit' : m === 'DELETE' ? 'delete' : 'view';
    return { page: best.page, action };
}

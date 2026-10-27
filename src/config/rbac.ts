// Developer by: Buildnexdev.in
// Devevloper : Nandhakumar@gmail.com
// Last Edited : 06-10-2026
export const ROLES = [
    'SUPER_ADMIN',
    'STUDIO_OWNER',
    'COMPANY_ADMIN',
    'MANAGER',
    'PHOTOGRAPHER',
    'EDITOR_DESIGNER',
    'STAFF',
    'PRINTER_DELIVERY_STAFF',
    'REPORT_MANAGER',
    'FINANCE',
    'CUSTOMER',
] as const;

export type RoleCode = (typeof ROLES)[number];

export const STAFF_ROLES: RoleCode[] = ['SUPER_ADMIN', 'STUDIO_OWNER', 'COMPANY_ADMIN', 'MANAGER', 'PHOTOGRAPHER', 'EDITOR_DESIGNER', 'STAFF', 'PRINTER_DELIVERY_STAFF', 'REPORT_MANAGER', 'FINANCE'];

/** 100 platform, 1 company owner/admin, 2–7 company roles, 0 customer panel. */
export const ROLE_LEVEL: Record<RoleCode, number> = {
    SUPER_ADMIN: 100,
    STUDIO_OWNER: 1,
    COMPANY_ADMIN: 1,
    MANAGER: 2,
    PHOTOGRAPHER: 3,
    EDITOR_DESIGNER: 4,
    STAFF: 5,
    PRINTER_DELIVERY_STAFF: 5,
    REPORT_MANAGER: 6,
    FINANCE: 7,
    CUSTOMER: 0,
};

/** Lower rank is the account that wins when a user has more than one role. */
export const roleRank = (level: number) => (level === 100 ? 0 : level === 0 ? 1000 : level);

export function primaryRole(roles: readonly string[]): RoleCode | undefined {
    const known = roles.filter((role): role is RoleCode => (ROLES as readonly string[]).includes(role));
    known.sort((a, b) => roleRank(ROLE_LEVEL[a]) - roleRank(ROLE_LEVEL[b]));
    return known[0];
}

export const ROLE_LABELS: Record<RoleCode, string> = {
    SUPER_ADMIN: 'Super Admin',
    STUDIO_OWNER: 'Company Owner',
    COMPANY_ADMIN: 'Company Admin',
    MANAGER: 'Manager',
    PHOTOGRAPHER: 'Photographer',
    EDITOR_DESIGNER: 'Editor',
    STAFF: 'Staff',
    PRINTER_DELIVERY_STAFF: 'Print & Delivery Staff',
    REPORT_MANAGER: 'Report Manager',
    FINANCE: 'Finance Team',
    CUSTOMER: 'Customer',
};

/** Every permission in the system: code -> [module, description] */
export const PERMISSIONS = {
    'users.manage': ['users', 'Create, update and deactivate users'],
    'roles.manage': ['users', 'Edit roles and permissions'],
    'settings.manage': ['settings', 'Change studio settings and pricing'],
    'audit.view': ['security', 'View audit logs'],
    'reports.view': ['reports', 'View reports and analytics'],
    'dashboard.view': ['dashboard', 'View the studio dashboard'],
    'customers.view': ['customers', 'View customers'],
    'customers.manage': ['customers', 'Create and update tblCustomer'],
    'bookings.view': ['bookings', 'View bookings and enquiries'],
    'bookings.manage': ['bookings', 'Create and update tblBooking and quotations'],
    'events.view': ['events', 'View all events'],
    'events.manage': ['events', 'Create, edit, start and complete events'],
    'events.assigned': ['events', 'Work on events assigned to me'],
    'staff.assign': ['events', 'Assign staff to events'],
    'staff.manage': ['staff', 'Manage staff, photographer and editor profiles'],
    'galleries.manage': ['galleries', 'Manage galleries, albums and QR codes'],
    'photos.upload': ['photos', 'Upload photos to events'],
    'photos.manage': ['photos', 'Move, delete, approve and reject photos'],
    'photos.edit': ['photos', 'Work on the editing queue and upload edits'],
    'proofs.manage': ['albums', 'Create album proofs and handle revisions'],
    'payments.view': ['payments', 'View payments'],
    'payments.manage': ['payments', 'Record offline payments and refunds'],
    'orders.view': ['orders', 'View orders'],
    'orders.manage': ['orders', 'Update tblOrder'],
    'pricing.manage': ['pricing', 'Manage services, packages, coupons and website content'],
    'printing.manage': ['printing', 'Work on print jobs'],
    'delivery.manage': ['delivery', 'Work on deliveries'],
    'notifications.send': ['notifications', 'Send notifications to customers'],
    'ai.use': ['ai', 'Use AI culling and smart search tools'],
    'customer.portal': ['customer', 'Use the customer portal'],
} as const satisfies Record<string, readonly [string, string]>;

export type Permission = keyof typeof PERMISSIONS;

const ALL = Object.keys(PERMISSIONS).filter((p) => p !== 'customer.portal') as Permission[];

export const ROLE_PERMISSIONS: Record<RoleCode, Permission[]> = {
    SUPER_ADMIN: ALL,
    STUDIO_OWNER: ALL,
    COMPANY_ADMIN: ALL,
    MANAGER: [
        'dashboard.view',
        'customers.view',
        'customers.manage',
        'bookings.view',
        'bookings.manage',
        'events.view',
        'events.manage',
        'staff.assign',
        'galleries.manage',
        'photos.upload',
        'photos.manage',
        'proofs.manage',
        'payments.view',
        'orders.view',
        'orders.manage',
        'printing.manage',
        'delivery.manage',
        'notifications.send',
        'reports.view',
        'ai.use',
    ],
    PHOTOGRAPHER: ['events.assigned', 'photos.upload'],
    EDITOR_DESIGNER: ['events.assigned', 'photos.edit', 'proofs.manage'],
    STAFF: ['orders.view', 'printing.manage', 'delivery.manage', 'events.assigned'],
    PRINTER_DELIVERY_STAFF: ['orders.view', 'printing.manage', 'delivery.manage'],
    REPORT_MANAGER: ['dashboard.view', 'reports.view', 'bookings.view', 'orders.view', 'payments.view', 'customers.view'],
    FINANCE: ['dashboard.view', 'payments.view', 'payments.manage', 'orders.view', 'reports.view'],
    CUSTOMER: ['customer.portal'],
};

/** Where each role lands after login. */
export const ROLE_HOME: Record<RoleCode, string> = {
    SUPER_ADMIN: '/admin/dashboard',
    STUDIO_OWNER: '/admin/dashboard',
    COMPANY_ADMIN: '/admin/dashboard',
    MANAGER: '/admin/dashboard',
    PHOTOGRAPHER: '/photographer/dashboard',
    EDITOR_DESIGNER: '/editor/dashboard',
    STAFF: '/delivery/dashboard',
    PRINTER_DELIVERY_STAFF: '/delivery/dashboard',
    REPORT_MANAGER: '/admin/reports',
    FINANCE: '/admin/payments',
    CUSTOMER: '/customer/dashboard',
};

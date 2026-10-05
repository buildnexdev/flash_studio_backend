export const ROLES = [
    'SUPER_ADMIN',
    'STUDIO_OWNER',
    'MANAGER',
    'PHOTOGRAPHER',
    'EDITOR_DESIGNER',
    'PRINTER_DELIVERY_STAFF',
    'CUSTOMER',
] as const;

export type RoleCode = (typeof ROLES)[number];

export const STAFF_ROLES: RoleCode[] = ['SUPER_ADMIN', 'STUDIO_OWNER', 'MANAGER', 'PHOTOGRAPHER', 'EDITOR_DESIGNER', 'PRINTER_DELIVERY_STAFF'];

export const ROLE_LABELS: Record<RoleCode, string> = {
    SUPER_ADMIN: 'Super Admin',
    STUDIO_OWNER: 'Studio Owner',
    MANAGER: 'Manager',
    PHOTOGRAPHER: 'Photographer',
    EDITOR_DESIGNER: 'Editor / Designer',
    PRINTER_DELIVERY_STAFF: 'Printer / Delivery Staff',
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
    STUDIO_OWNER: ALL.filter((p) => !['roles.manage'].includes(p)),
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
    PRINTER_DELIVERY_STAFF: ['orders.view', 'printing.manage', 'delivery.manage'],
    CUSTOMER: ['customer.portal'],
};

/** Where each role lands after login. */
export const ROLE_HOME: Record<RoleCode, string> = {
    SUPER_ADMIN: '/admin/dashboard',
    STUDIO_OWNER: '/admin/dashboard',
    MANAGER: '/admin/dashboard',
    PHOTOGRAPHER: '/photographer/dashboard',
    EDITOR_DESIGNER: '/editor/dashboard',
    PRINTER_DELIVERY_STAFF: '/delivery/dashboard',
    CUSTOMER: '/customer/dashboard',
};

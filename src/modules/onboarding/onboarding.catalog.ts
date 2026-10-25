// Developer by: Buildnexdev.in
export const ONBOARDING_BASE_PAISE = 199_900;

export const ONBOARDING_MODULES = {
    qr: { id: 'qr', label: 'QR galleries', description: 'Live event QR codes & guest galleries', pricePaise: 99_900 },
    events: { id: 'events', label: 'Event management', description: 'Schedules, albums, and deliverables', pricePaise: 149_900 },
    assets: { id: 'assets', label: 'Assets management', description: 'Gear, props, and studio inventory', pricePaise: 99_900 },
    staff: { id: 'staff', label: 'Staff management', description: 'Roles, photographers, and editors', pricePaise: 99_900 },
    ecommerce: { id: 'ecommerce', label: 'E-commerce', description: 'Print shop, products, and orders', pricePaise: 199_900 },
    website: { id: 'website', label: 'Website management', description: 'Public site, portfolio, and SEO', pricePaise: 149_900 },
} as const;

export type OnboardingModuleId = keyof typeof ONBOARDING_MODULES;

export function quoteOnboarding(modules: string[]) {
    const unique = [...new Set(modules.filter((m): m is OnboardingModuleId => m in ONBOARDING_MODULES))];
    if (!unique.length) throw new Error('Select at least one module.');
    const lines = unique.map((id) => {
        const m = ONBOARDING_MODULES[id];
        return { id, label: m.label, amountPaise: m.pricePaise };
    });
    const modulesTotal = lines.reduce((s, l) => s + l.amountPaise, 0);
    const amountPaise = ONBOARDING_BASE_PAISE + modulesTotal;
    return { amountPaise, currency: 'INR', lines, basePaise: ONBOARDING_BASE_PAISE };
}

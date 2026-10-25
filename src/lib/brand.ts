import { config } from '../config/env.js';

export const BRAND_NAME = 'Nammaqr Photography';
export const BRAND_TAGLINE = 'Moments beyond time';

/** Absolute URL to the platform emblem (served from `/brand/nq-emblem.png`). */
export function brandLogoUrl(): string {
    return new URL('/brand/nq-emblem.png', config.BACKEND_URL).toString();
}

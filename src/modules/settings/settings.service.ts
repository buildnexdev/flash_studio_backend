// Developer by: Buildnexdev.in
// Devevloper : Nandhakumar@gmail.com
// Last Edited : 06-10-2026
import { z } from 'zod';
import { execute, json, query } from '../../db/pool.js';

export const settingSchemas = {
    studio: z.object({
        name: z.string().trim().min(2).max(120),
        tagline: z.string().trim().max(200).default(''),
        email: z.string().trim().email().or(z.literal('')).default(''),
        phone: z.string().trim().max(20).default(''),
        whatsapp: z.string().trim().max(20).default(''),
        address: z.string().trim().max(255).default(''),
        city: z.string().trim().max(80).default(''),
        mapUrl: z.string().trim().max(500).default(''),
        hours: z.string().trim().max(120).default(''),
        about: z.string().trim().max(3000).default(''),
        gstin: z.string().trim().max(20).default(''),
        instagram: z.string().trim().max(200).default(''),
        facebook: z.string().trim().max(200).default(''),
        youtube: z.string().trim().max(200).default(''),
    }),
    pricing: z.object({
        photoDownload: z.number().int().min(0),
        taxPercent: z.number().min(0).max(40),
        prints: z.record(z.string().max(20), z.number().int().min(0)),
        frames: z.record(z.string().max(20), z.number().int().min(0)),
        canvas: z.record(z.string().max(20), z.number().int().min(0)),
        album: z.number().int().min(0),
        courierFee: z.number().int().min(0),
    }),
    gallery: z.object({
        watermarkText: z.string().trim().min(1).max(60),
        defaultExpiryDays: z.number().int().min(1).max(3650),
        previewSize: z.number().int().min(600).max(3000),
        thumbSize: z.number().int().min(200).max(1000),
    }),
    notifications: z.object({
        email: z.boolean(),
        whatsapp: z.boolean(),
        sms: z.boolean(),
    }),
    ai: z.object({
        faceSearch: z.boolean(),
        culling: z.boolean(),
        blurThreshold: z.number().min(1).max(500),
    }),
    website: z.object({
        bannerActive: z.boolean().default(true),
        bannerDiscount: z.string().default('10% OFF'),
        bannerText: z.string().default('Bookings Open! Enjoy an exclusive 10% discount on all Wedding & Milestone packages'),
        couponCode: z.string().default('WELCOME10'),
        heroSubtitle: z.string().default('Stories told in light, delivered as they unfold across your celebrations.'),
        historyText: z.string().default('Founded with a passion for authentic visual storytelling, PhotoLab Studio has spent over a decade documenting life’s most cherished celebrations.'),
        whyChooseUs: z.array(z.string()).default([
            'Instant Live QR Event Galleries for Guests',
            'Full High-Resolution Master Digital Downloads',
            'Handcrafted Flush-Mount Archival Albums',
            'Dedicated Lead Photographers & Master Retouchers',
            'Transparent All-Inclusive Pricing & Timely Delivery',
        ]),
        slides: z
            .array(
                z.object({
                    id: z.string(),
                    title: z.string(),
                    subtitle: z.string(),
                    imageUrl: z.string(),
                    tag: z.string(),
                    lens: z.string().optional(),
                    shutter: z.string().optional(),
                    iso: z.string().optional(),
                }),
            )
            .optional(),
    }),
};

export type SettingKey = keyof typeof settingSchemas;
export type Settings = { [K in SettingKey]: z.infer<(typeof settingSchemas)[K]> };

export const DEFAULT_SETTINGS: Settings = {
    studio: {
        name: 'BuildNexDev Studio',
        tagline: 'Wedding, portrait and event photography',
        email: '',
        phone: '',
        whatsapp: '',
        address: '',
        city: '',
        mapUrl: '',
        hours: 'Mon - Sat, 10:00 AM - 8:00 PM',
        about: '',
        gstin: '',
        instagram: '',
        facebook: '',
        youtube: '',
    },
    pricing: {
        photoDownload: 9900,
        taxPercent: 18,
        prints: { '4x6': 2500, '5x7': 4000, '8x10': 9000, '12x18': 25000 },
        frames: { '8x10': 79900, '12x18': 149900 },
        canvas: { '12x18': 199900, '16x24': 299900 },
        album: 1499900,
        courierFee: 15000,
    },
    gallery: { watermarkText: 'BuildNexDev Studio', defaultExpiryDays: 90, previewSize: 1600, thumbSize: 480 },
    notifications: { email: true, whatsapp: false, sms: false },
    ai: { faceSearch: false, culling: true, blurThreshold: 60 },
    website: {
        bannerActive: true,
        bannerDiscount: '10% OFF',
        bannerText: 'Bookings Open! Enjoy an exclusive 10% discount on all Wedding & Milestone packages',
        couponCode: 'WELCOME10',
        heroSubtitle: 'Stories told in light, delivered as they unfold across your celebrations.',
        historyText: 'Founded with a passion for authentic visual storytelling, PhotoLab Studio has spent over a decade documenting life’s most cherished celebrations.',
        whyChooseUs: [
            'Instant Live QR Event Galleries for Guests',
            'Full High-Resolution Master Digital Downloads',
            'Handcrafted Flush-Mount Archival Albums',
            'Dedicated Lead Photographers & Master Retouchers',
            'Transparent All-Inclusive Pricing & Timely Delivery',
        ],
        slides: [
            {
                id: '1',
                title: 'Timeless Wedding & Milestone Imagery',
                subtitle: 'Authentic emotion, master framing, and effortless digital delivery for your big day.',
                imageUrl: 'https://images.unsplash.com/photo-1519741497674-611481863552?auto=format&fit=crop&w=2000&q=85',
                tag: 'Wedding & Grand Celebrations',
                lens: '85mm f/1.4 GM',
                shutter: '1/800s',
                iso: '100',
            },
            {
                id: '2',
                title: 'Birthdays & Intimate Ceremonies',
                subtitle: 'Preserving laughter, candlelit milestones, and candid family bonds with editorial warmth.',
                imageUrl: 'https://images.unsplash.com/photo-1511285560929-80b456fea0bc?auto=format&fit=crop&w=2000&q=85',
                tag: 'Birthdays & Housewarming',
                lens: '35mm f/1.4 Art',
                shutter: '1/500s',
                iso: '200',
            },
        ],
    },
};

export const PUBLIC_SETTING_KEYS: SettingKey[] = ['studio', 'website'];

let cache: { value: Settings; expires: number } | null = null;

export async function getSettings(): Promise<Settings> {
    if (cache && cache.expires > Date.now()) return cache.value;
    const rows = await query<{ key: SettingKey; value: unknown }>('SELECT `key`, value FROM tblSetting');
    const merged = structuredClone(DEFAULT_SETTINGS) as Record<SettingKey, unknown>;
    for (const row of rows) {
        if (row.key in settingSchemas) {
            const value = typeof row.value === 'string' ? JSON.parse(row.value) : row.value;
            merged[row.key] = { ...(merged[row.key] as object), ...(value as object) };
        }
    }
    cache = { value: merged as Settings, expires: Date.now() + 15_000 };
    return merged as Settings;
}

export async function getSetting<K extends SettingKey>(key: K): Promise<Settings[K]> {
    return (await getSettings())[key];
}

export async function updateSetting<K extends SettingKey>(key: K, value: unknown, userId: number | null): Promise<Settings[K]> {
    const parsed = settingSchemas[key].parse(value) as Settings[K];
    await execute(
        'INSERT INTO tblSetting (`key`, value, is_public, updated_by) VALUES (?, ?, ?, ?) ON DUPLICATE KEY UPDATE value = VALUES(value), updated_by = VALUES(updated_by)',
        [key, json(parsed), PUBLIC_SETTING_KEYS.includes(key) ? 1 : 0, userId],
    );
    cache = null;
    return parsed;
}

export function clearSettingsCache(): void {
    cache = null;
}

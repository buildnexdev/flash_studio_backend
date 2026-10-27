// Developer by: Buildnexdev.in
// Devevloper : Nandhakumar@gmail.com
// Last Edited : 06-10-2026
import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../../config/env.js';
import { unauthorized } from '../../utils/errors.js';

/** Short-lived session granted after a valid QR token is presented. */
export interface GallerySession {
    galleryId: number;
    tokenId: number;
    scope: 'EVENT' | 'ALBUM' | 'PHOTO';
    albumId: number | null;
    photoId: number | null;
    sessionId: string;
    /** Set after the visitor enters the event customer's phone on a /g/ link. */
    customerPhone?: string;
}

const SECRET = () => `${config.JWT_SECRET}:gallery`;
export const GALLERY_SESSION_HOURS = 6;

export function signGallerySession(s: GallerySession): string {
    return jwt.sign({ ...s, typ: 'gallery' }, SECRET(), { expiresIn: `${GALLERY_SESSION_HOURS}h`, issuer: 'photolab' });
}

export function verifyGallerySession(token: string): GallerySession | null {
    try {
        const p = jwt.verify(token, SECRET(), { issuer: 'photolab' }) as GallerySession & { typ: string };
        if (p.typ !== 'gallery') return null;
        const phone = typeof p.customerPhone === 'string' ? p.customerPhone.replace(/\D/g, '').slice(-10) : undefined;
        return {
            galleryId: p.galleryId,
            tokenId: p.tokenId,
            scope: p.scope,
            albumId: p.albumId,
            photoId: p.photoId,
            sessionId: p.sessionId,
            ...(phone && phone.length === 10 ? { customerPhone: phone } : {}),
        };
    } catch {
        return null;
    }
}

/** Attach req.gallery from the X-Gallery-Session header when present. */
export function gallerySession(required: boolean) {
    return (req: Request, _res: Response, next: NextFunction) => {
        const header = req.headers['x-gallery-session'];
        const session = typeof header === 'string' ? verifyGallerySession(header) : null;
        if (session) req.gallery = session;
        if (required && !session && !req.user) return next(unauthorized('Scan the QR code again to open this gallery.'));
        next();
    };
}

import type { AuthUser } from '../middleware/auth.js';
import type { GallerySession } from '../modules/galleries/gallery-session.js';

declare global {
    namespace Express {
        interface Request {
            user?: AuthUser;
            gallery?: GallerySession;
            rawBody?: Buffer;
        }
    }
}

export {};

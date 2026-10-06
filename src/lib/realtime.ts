// Developer by: Buildnexdev.in
// Devevloper : Nandhakumar@gmail.com
// Last Edited : 06-10-2026
import type { Server as HttpServer } from 'node:http';
import { Server, type Socket } from 'socket.io';
import { config } from '../config/env.js';
import { hasPermission, userFromAccessToken, type AuthUser } from '../middleware/auth.js';
import { verifyGallerySession } from '../modules/galleries/gallery-session.js';
import { query, queryOne } from '../db/pool.js';

let io: Server | null = null;

export const rooms = {
    user: (id: number) => `user:${id}`,
    gallery: (id: number) => `gallery:${id}`,
    event: (id: number) => `event:${id}`,
    staff: 'staff',
};

async function canWatchEvent(user: AuthUser, eventId: number): Promise<boolean> {
    if (hasPermission(user, 'events.view', 'events.manage')) return true;
    const row = await queryOne('SELECT 1 FROM tblEventStaff WHERE event_id = ? AND user_id = ?', [eventId, user.id]);
    return !!row;
}

export function initRealtime(server: HttpServer): Server {
    io = new Server(server, {
        cors: { origin: config.corsOrigins, credentials: true },
        path: '/socket.io',
    });

    io.use(async (socket, next) => {
        const auth = socket.handshake.auth as { token?: string; gallerySession?: string };
        if (auth?.token) {
            const user = await userFromAccessToken(auth.token).catch(() => null);
            if (user) socket.data.user = user;
        }
        if (auth?.gallerySession) {
            const session = verifyGallerySession(auth.gallerySession);
            if (session) socket.data.gallery = session;
        }
        next();
    });

    io.on('connection', (socket: Socket) => {
        const user = socket.data.user as AuthUser | undefined;
        if (user) {
            socket.join(rooms.user(user.id));
            if (user.roles.some((r) => r !== 'CUSTOMER')) socket.join(rooms.staff);
        }
        const gallery = socket.data.gallery as { galleryId: number } | undefined;
        if (gallery) socket.join(rooms.gallery(gallery.galleryId));

        socket.on('gallery:join', async (galleryId: number, ack?: (ok: boolean) => void) => {
            const id = Number(galleryId);
            let allowed = gallery?.galleryId === id;
            if (!allowed && user) {
                if (hasPermission(user, 'galleries.manage')) allowed = true;
                else if (user.customerId) {
                    const own = await query('SELECT 1 FROM tblGallery g JOIN tblEvent e ON e.id = g.event_id WHERE g.id = ? AND e.customer_id = ?', [id, user.customerId]);
                    allowed = own.length > 0;
                }
            }
            if (allowed) socket.join(rooms.gallery(id));
            ack?.(allowed);
        });

        socket.on('event:join', async (eventId: number, ack?: (ok: boolean) => void) => {
            const allowed = !!user && (await canWatchEvent(user, Number(eventId)));
            if (allowed) socket.join(rooms.event(Number(eventId)));
            ack?.(allowed);
        });
    });

    return io;
}

export function emitTo(room: string, event: string, payload: unknown): void {
    io?.to(room).emit(event, payload);
}

export function getIo(): Server | null {
    return io;
}

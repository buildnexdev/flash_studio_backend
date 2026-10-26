import jwt from 'jsonwebtoken';
import { config } from '../../config/env.js';
import { execute, queryOne } from '../../db/pool.js';
import { sendSms, sendWhatsApp } from '../../lib/channels.js';
import { badRequest, forbidden, tooMany } from '../../utils/errors.js';
import { numericCode, sha256 } from '../../utils/crypto.js';
import { toSqlDateTime } from '../../utils/dates.js';
import { getSetting } from '../settings/settings.service.js';

const TTL_MINUTES = 10;
const ACCESS_HOURS = 12;

const digits = (phone: string) => phone.replace(/\D/g, '').slice(-10);

export function signEventPhone(eventId: number, phone: string): string {
    return jwt.sign({ typ: 'event-phone', eventId, phone }, `${config.JWT_SECRET}:event-phone`, { expiresIn: `${ACCESS_HOURS}h`, issuer: 'photolab' });
}

export function readEventPhone(token: string | undefined): { eventId: number; phone: string } | null {
    if (!token) return null;
    try {
        const payload = jwt.verify(token, `${config.JWT_SECRET}:event-phone`, { issuer: 'photolab' }) as { typ?: string; eventId?: number; phone?: string };
        if (payload.typ !== 'event-phone' || !payload.eventId || !payload.phone) return null;
        return { eventId: payload.eventId, phone: payload.phone };
    } catch {
        return null;
    }
}

export async function requestEventOtp(eventId: number, galleryId: number, phoneRaw: string) {
    const phone = digits(phoneRaw);
    if (!/^\d{10}$/.test(phone)) throw badRequest('Enter a 10-digit phone number.', [{ field: 'phone', message: 'Enter 10 digits' }]);
    const recent = await queryOne<{ n: number }>('SELECT COUNT(*) AS n FROM tblOtpCode WHERE destination = ? AND purpose = ? AND created_at > DATE_SUB(UTC_TIMESTAMP(), INTERVAL 15 MINUTE)', [phone, 'EVENT_ACCESS']);
    if ((recent?.n ?? 0) >= 5) throw tooMany('Too many codes requested. Please wait a few minutes.');
    const code = numericCode(6);
    await execute("UPDATE tblOtpCode SET consumed_at = UTC_TIMESTAMP() WHERE destination = ? AND purpose = 'EVENT_ACCESS' AND consumed_at IS NULL", [phone]);
    await execute("INSERT INTO tblOtpCode (destination, purpose, code_hash, expires_at) VALUES (?, 'EVENT_ACCESS', ?, ?)", [
        phone,
        sha256(`${phone}:${code}`),
        toSqlDateTime(new Date(Date.now() + TTL_MINUTES * 60_000)),
    ]);
    const studio = await getSetting('studio');
    const message = `${studio.name}: your event gallery code is ${code}. It expires in ${TTL_MINUTES} minutes.`;
    const wa = await sendWhatsApp(phone, message);
    const sent = wa.sent ? wa : await sendSms(phone, message);
    void galleryId;
    void eventId;
    return { sent: true as const, ...(!config.isProd && !sent.sent ? { devCode: code } : {}) };
}

export async function verifyEventOtp(eventId: number, galleryId: number, phoneRaw: string, code: string, consent: boolean) {
    const phone = digits(phoneRaw);
    const row = await queryOne<{ id: number; code_hash: string; attempts: number; expires_at: Date }>(
        "SELECT id, code_hash, attempts, expires_at FROM tblOtpCode WHERE destination = ? AND purpose = 'EVENT_ACCESS' AND consumed_at IS NULL ORDER BY id DESC LIMIT 1",
        [phone],
    );
    const invalid = badRequest('The code is invalid or has expired.');
    if (!row || new Date(row.expires_at) < new Date() || row.attempts >= 5) throw invalid;
    if (row.code_hash !== sha256(`${phone}:${code}`)) {
        await execute('UPDATE tblOtpCode SET attempts = attempts + 1 WHERE id = ?', [row.id]);
        throw invalid;
    }
    await execute('UPDATE tblOtpCode SET consumed_at = UTC_TIMESTAMP() WHERE id = ?', [row.id]);
    const expires = new Date(Date.now() + ACCESS_HOURS * 3_600_000);
    await execute('INSERT INTO tblEventAccess (event_id, gallery_id, phone, consent, verified_at, expires_at) VALUES (?, ?, ?, ?, UTC_TIMESTAMP(), ?)', [
        eventId,
        galleryId,
        phone,
        consent ? 1 : 0,
        toSqlDateTime(expires),
    ]);
    return { verified: true, phone, proof: signEventPhone(eventId, phone), expiresAt: expires.toISOString() };
}

export async function assertFaceSearchAllowed(eventId: number, proof: string | undefined, consent: boolean, isOwner: boolean) {
    if (!consent) throw forbidden('Face search needs your consent to compare a selfie with this event only.');
    if (isOwner) return;
    const claim = readEventPhone(proof);
    if (!claim || claim.eventId !== eventId) throw forbidden('Verify your phone for this event before using face search.');
    const row = await queryOne(
        'SELECT id FROM tblEventAccess WHERE event_id = ? AND phone = ? AND consent = 1 AND expires_at > UTC_TIMESTAMP() ORDER BY id DESC LIMIT 1',
        [eventId, claim.phone],
    );
    if (!row) throw forbidden('Phone verification for this event has expired. Request a new code.');
}

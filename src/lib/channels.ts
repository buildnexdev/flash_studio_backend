// Developer by: Buildnexdev.in
// Devevloper : Nandhakumar@gmail.com
// Last Edited : 06-10-2026
import nodemailer, { type Transporter } from 'nodemailer';
import { config } from '../config/env.js';
import { BRAND_NAME, brandLogoUrl } from './brand.js';

/**
 * Outbound delivery channels. Each channel is only active when configured in the environment;
 * otherwise send() resolves with { sent: false, reason } so callers can record why nothing went out.
 */
export interface ChannelResult {
    sent: boolean;
    reason?: string;
}

let transporter: Transporter | null = null;

function mailer(): Transporter | null {
    if (!config.SMTP_HOST) return null;
    transporter ??= nodemailer.createTransport({
        host: config.SMTP_HOST,
        port: config.SMTP_PORT,
        secure: config.SMTP_SECURE,
        auth: config.SMTP_USER ? { user: config.SMTP_USER, pass: config.SMTP_PASSWORD } : undefined,
    });
    return transporter;
}

const escapeHtml = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

export async function sendEmail(to: string, subject: string, text: string, link?: string): Promise<ChannelResult> {
    const t = mailer();
    if (!t) return { sent: false, reason: 'SMTP not configured' };
    if (config.isTest) return { sent: false, reason: 'test mode' };
    const url = link ? new URL(link, config.FRONTEND_URL).toString() : null;
    const logo = brandLogoUrl();
    const html = `<div style="font-family:Arial,sans-serif;font-size:15px;color:#1c1917;line-height:1.6;max-width:560px">
        <p style="margin:0 0 16px"><img src="${escapeHtml(logo)}" alt="${escapeHtml(BRAND_NAME)}" width="72" height="72" style="display:block;height:72px;width:auto;max-width:160px;object-fit:contain" /></p>
        <p style="margin:0 0 12px">${escapeHtml(text).replace(/\n/g, '<br>')}</p>
        ${url ? `<p style="margin:16px 0 0"><a href="${escapeHtml(url)}" style="display:inline-block;background:#b45309;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none;font-weight:600">Open</a></p>` : ''}
        <p style="margin:24px 0 0;font-size:12px;color:#78716c">${escapeHtml(BRAND_NAME)}</p>
    </div>`;
    try {
        await t.sendMail({ from: config.MAIL_FROM, to, subject, text: url ? `${text}\n\n${url}` : text, html });
        return { sent: true };
    } catch (err) {
        console.error('[email] send failed', (err as Error).message);
        return { sent: false, reason: 'SMTP error' };
    }
}

const digits = (phone: string) => phone.replace(/\D/g, '');

/** WhatsApp Cloud API text message. Business-initiated messages outside a 24h window need approved templates. */
export async function sendWhatsApp(phone: string, message: string): Promise<ChannelResult> {
    if (!config.WHATSAPP_TOKEN || !config.WHATSAPP_PHONE_NUMBER_ID) return { sent: false, reason: 'WhatsApp not configured' };
    if (config.isTest) return { sent: false, reason: 'test mode' };
    try {
        const res = await fetch(`https://graph.facebook.com/v20.0/${config.WHATSAPP_PHONE_NUMBER_ID}/messages`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${config.WHATSAPP_TOKEN}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ messaging_product: 'whatsapp', to: digits(phone), type: 'text', text: { body: message } }),
            signal: AbortSignal.timeout(10_000),
        });
        return res.ok ? { sent: true } : { sent: false, reason: `WhatsApp HTTP ${res.status}` };
    } catch (err) {
        return { sent: false, reason: (err as Error).message };
    }
}

/** Generic HTTP SMS gateway: SMS_GATEWAY_URL may contain {to} and {message} placeholders; otherwise JSON is POSTed. */
export async function sendSms(phone: string, message: string): Promise<ChannelResult> {
    if (!config.SMS_GATEWAY_URL) return { sent: false, reason: 'SMS gateway not configured' };
    if (config.isTest) return { sent: false, reason: 'test mode' };
    try {
        const hasPlaceholders = config.SMS_GATEWAY_URL.includes('{to}');
        const url = hasPlaceholders
            ? config.SMS_GATEWAY_URL.replace('{to}', encodeURIComponent(digits(phone))).replace('{message}', encodeURIComponent(message))
            : config.SMS_GATEWAY_URL;
        const res = await fetch(url, {
            method: hasPlaceholders ? 'GET' : 'POST',
            headers: {
                ...(config.SMS_GATEWAY_TOKEN ? { Authorization: `Bearer ${config.SMS_GATEWAY_TOKEN}` } : {}),
                ...(hasPlaceholders ? {} : { 'Content-Type': 'application/json' }),
            },
            body: hasPlaceholders ? undefined : JSON.stringify({ to: digits(phone), message }),
            signal: AbortSignal.timeout(10_000),
        });
        return res.ok ? { sent: true } : { sent: false, reason: `SMS HTTP ${res.status}` };
    } catch (err) {
        return { sent: false, reason: (err as Error).message };
    }
}

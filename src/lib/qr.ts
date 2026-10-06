// Developer by: Buildnexdev.in
// Devevloper : Nandhakumar@gmail.com
// Last Edited : 06-10-2026
import QRCode from 'qrcode';

const options = { errorCorrectionLevel: 'M' as const, margin: 2, color: { dark: '#0f172a', light: '#ffffff' } };

export const qrDataUrl = (text: string, width = 512) => QRCode.toDataURL(text, { ...options, width });

export const qrPng = (text: string, width = 1024) => QRCode.toBuffer(text, { ...options, width, type: 'png' });

export const qrSvg = (text: string) => QRCode.toString(text, { ...options, type: 'svg' });

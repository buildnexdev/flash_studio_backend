import type { Request, Response, NextFunction } from 'express';
import { encryptPayload, decryptPayload } from '../utils/crypto.js';

/**
 * Middleware that transparently decrypts incoming request payloads and
 * encrypts outgoing response payloads for enhanced network security.
 */
export function cryptoMiddleware(req: Request, res: Response, next: NextFunction) {
    const isExcluded =
        req.path === '/api/health' ||
        req.path.startsWith('/crypto-tool') ||
        req.path.startsWith('/api/payments/webhook') ||
        req.path.startsWith('/api/files/');

    if (isExcluded) {
        return next();
    }

    const clientRequestedEncryption = req.headers['x-encrypted'] === 'true';

    // 1. Decrypt incoming request payload if present
    if (req.body && typeof req.body === 'object') {
        const cipher = req.body.payload ?? req.body.encryptedData;
        if (typeof cipher === 'string' && cipher.includes(':')) {
            try {
                req.body = decryptPayload(cipher);
                // Mark request so we know it came encrypted
                (req as any).__wasEncrypted = true;
            } catch (err) {
                return res.status(400).json({
                    success: false,
                    message: 'Decryption failed: malformed or invalid payload.',
                    code: 'BAD_REQUEST',
                });
            }
        }
    }

    // 2. Encrypt outgoing response if client supports/requested encryption or sent encrypted payload
    const shouldEncryptResponse = !isExcluded && (clientRequestedEncryption || (req as any).__wasEncrypted);

    if (shouldEncryptResponse) {
        const originalJson = res.json.bind(res);
        res.json = function (body: any) {
            res.setHeader('X-Encrypted', 'true');
            try {
                const encrypted = encryptPayload(body);
                return originalJson({ payload: encrypted });
            } catch (err) {
                console.error('[crypto] Failed to encrypt response:', err);
                return originalJson(body);
            }
        };
    }

    next();
}

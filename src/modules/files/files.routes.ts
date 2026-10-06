// Developer by: Buildnexdev.in
// Devevloper : Nandhakumar@gmail.com
// Last Edited : 06-10-2026
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { Router } from 'express';
import { contentTypeFor, localStorageDriver, verifyLocalSignature } from '../../lib/storage.js';
import { forbidden, notFound } from '../../utils/errors.js';
import { asyncHandler } from '../../utils/http.js';

/** Serves private files for the local storage driver, only with a valid, unexpired HMAC signature. */
const router = Router();

router.get(
    /^\/(.+)$/,
    asyncHandler(async (req, res) => {
        if (!localStorageDriver) throw notFound('File');
        const key = decodeURIComponent((req.params as Record<string, string>)[0]);
        const exp = Number(req.query.exp);
        const sig = typeof req.query.sig === 'string' ? req.query.sig : '';
        const dn = typeof req.query.dn === 'string' ? req.query.dn : '';
        if (!sig || !verifyLocalSignature(key, exp, dn, sig)) throw forbidden('This link has expired. Refresh the page to get a new one.');
        let file: string;
        try {
            file = localStorageDriver.resolve(key);
        } catch {
            throw notFound('File');
        }
        const info = await stat(file).catch(() => null);
        if (!info?.isFile()) throw notFound('File');
        const maxAge = Math.max(0, exp - Math.floor(Date.now() / 1000));
        res.setHeader('Content-Type', contentTypeFor(key));
        res.setHeader('Content-Length', String(info.size));
        res.setHeader('Cache-Control', `private, max-age=${maxAge}`);
        res.setHeader('X-Content-Type-Options', 'nosniff');
        res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
        res.setHeader('Content-Disposition', dn ? `attachment; filename="${dn}"` : 'inline');
        createReadStream(file).on('error', () => res.destroy()).pipe(res);
    }),
);

export default router;

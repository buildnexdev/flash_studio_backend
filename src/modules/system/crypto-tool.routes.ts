import { Router } from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';
import { decryptPayload, encryptPayload } from '../../utils/crypto.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const cryptoToolRouter = Router();

// 1. Serve the Web Tool UI
cryptoToolRouter.get('/', (_req, res) => {
    // Locate the HTML file in src or dist
    let htmlPath = path.join(__dirname, 'crypto-tool.html');
    if (!fs.existsSync(htmlPath)) {
        htmlPath = path.join(process.cwd(), 'src', 'modules', 'system', 'crypto-tool.html');
    }
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.sendFile(htmlPath);
});

// 2. Decrypt endpoint for the web tool
cryptoToolRouter.post('/api/decrypt', (req, res) => {
    try {
        const cipher = req.body?.payload ?? req.body?.encryptedData;
        if (!cipher || typeof cipher !== 'string') {
            return res.status(400).json({ success: false, message: 'Missing encrypted payload string.' });
        }
        const decrypted = decryptPayload(cipher.trim());
        return res.json({ success: true, data: decrypted });
    } catch (err: any) {
        return res.status(400).json({
            success: false,
            message: `Decryption failed: ${err.message || 'Invalid or malformed ciphertext'}`
        });
    }
});

// 3. Encrypt endpoint for the web tool
cryptoToolRouter.post('/api/encrypt', (req, res) => {
    try {
        const data = req.body?.data;
        if (data === undefined) {
            return res.status(400).json({ success: false, message: 'Missing data to encrypt.' });
        }
        const payload = encryptPayload(data);
        return res.json({ success: true, payload });
    } catch (err: any) {
        return res.status(400).json({
            success: false,
            message: `Encryption failed: ${err.message || 'Error creating cipher'}`
        });
    }
});

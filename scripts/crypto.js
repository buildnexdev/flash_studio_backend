import crypto from 'node:crypto';
import 'dotenv/config';

const secretStr = process.env.API_CRYPTO_SECRET || process.env.APP_SECRET || 'photolab-secure-payload-encryption-secret-key-2026!';
const keyBuffer = crypto.createHash('sha256').update(secretStr).digest();

export function encryptPayload(data) {
    const json = typeof data === 'string' ? data : JSON.stringify(data);
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-cbc', keyBuffer, iv);
    let encrypted = cipher.update(json, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return `${iv.toString('hex')}:${encrypted}`;
}

export function decryptPayload(payload) {
    if (!payload || !payload.includes(':')) throw new Error('Invalid encrypted payload format (expected iv:ciphertext)');
    const [ivHex, encHex] = payload.split(':');
    const iv = Buffer.from(ivHex, 'hex');
    const decipher = crypto.createDecipheriv('aes-256-cbc', keyBuffer, iv);
    let decrypted = decipher.update(encHex, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    try {
        return JSON.parse(decrypted);
    } catch {
        return decrypted;
    }
}

const [action, ...args] = process.argv.slice(2);
const input = args.join(' ').trim();

if (!action || !input) {
    console.log('Usage:');
    console.log('  node scripts/crypto.js decrypt "<payload>"');
    console.log('  node scripts/crypto.js encrypt \'<json>\'');
    process.exit(0);
}

if (action === 'decrypt') {
    try {
        const result = decryptPayload(input);
        console.log('\n--- Decrypted Result ---');
        console.dir(result, { depth: null, colors: true });
    } catch (e) {
        console.error('Failed to decrypt:', e.message);
    }
} else if (action === 'encrypt') {
    try {
        const result = encryptPayload(input);
        console.log('\n--- Encrypted Payload ---');
        console.log(result);
    } catch (e) {
        console.error('Failed to encrypt:', e.message);
    }
} else {
    console.log('Unknown action. Use "decrypt" or "encrypt".');
}

// Flash Studio - Camera FTP Bridge (Zero Dependencies)
// Developer: Buildnexdev.in
import net from 'net';
import fs from 'fs';
import path from 'path';
import os from 'os';

// Configuration
const FTP_PORT = 2121; // Port 2121 avoids needing Administrator privileges on Windows
const DEFAULT_SAVE_DIR = path.resolve(process.env.SAVE_DIR || 'C:\\Shoots\\Live');
const USERNAME = process.env.FTP_USER || 'camera';
const PASSWORD = process.env.FTP_PASS || '1234';

// Ensure save directory exists
if (!fs.existsSync(DEFAULT_SAVE_DIR)) {
    fs.mkdirSync(DEFAULT_SAVE_DIR, { recursive: true });
}

// Get Local IPv4 addresses
function getLocalIps() {
    const interfaces = os.networkInterfaces();
    const ips = [];
    for (const name of Object.keys(interfaces)) {
        for (const netInfo of interfaces[name] || []) {
            if (netInfo.family === 'IPv4' && !netInfo.internal) {
                ips.push({ name, ip: netInfo.address });
            }
        }
    }
    return ips;
}

const localIps = getLocalIps();
const primaryIp = localIps.find(i => !i.ip.startsWith('169.254'))?.ip || '127.0.0.1';

// Active clients tracking
let totalUploaded = 0;

const server = net.createServer((socket) => {
    let authenticated = false;
    let username = '';
    let currentDir = '/';
    let dataServer = null;
    let dataSocket = null;
    let dataSocketPromise = null;
    let dataSocketResolver = null;
    let isTransferring = false;

    socket.setEncoding('utf8');

    function send(code, msg) {
        socket.write(`${code} ${msg}\r\n`);
    }

    function resetData() {
        if (dataServer) {
            try { dataServer.close(); } catch {}
            dataServer = null;
        }
        dataSocket = null;
        dataSocketPromise = null;
        dataSocketResolver = null;
    }

    send(220, 'Flash Studio Camera FTP Bridge Ready');

    let buffer = '';

    socket.on('data', async (chunk) => {
        buffer += chunk;
        const lines = buffer.split('\r\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed) continue;

            const spaceIdx = trimmed.indexOf(' ');
            const cmd = (spaceIdx === -1 ? trimmed : trimmed.slice(0, spaceIdx)).toUpperCase();
            const arg = spaceIdx === -1 ? '' : trimmed.slice(spaceIdx + 1).trim();

            console.log(`[FTP CMD] ${cmd} ${cmd === 'PASS' ? '****' : arg}`);

            switch (cmd) {
                case 'USER':
                    username = arg;
                    send(331, `User ${arg} accepted, provide password`);
                    break;

                case 'PASS':
                    if (username === USERNAME && arg === PASSWORD) {
                        authenticated = true;
                        send(230, 'User logged in, proceed.');
                    } else {
                        send(530, 'Authentication failed');
                    }
                    break;

                case 'SYST':
                    send(215, 'UNIX Type: L8');
                    break;

                case 'FEAT':
                    socket.write('211-Features:\r\n PASV\r\n UTF8\r\n211 End\r\n');
                    break;

                case 'PWD':
                case 'XPWD':
                    send(257, `"${currentDir}" is current directory.`);
                    break;

                case 'TYPE':
                    send(200, `Type set to ${arg.toUpperCase()}`);
                    break;

                case 'PASV': {
                    resetData();
                    dataSocketPromise = new Promise((resolve) => {
                        dataSocketResolver = resolve;
                    });

                    dataServer = net.createServer((dSocket) => {
                        dataSocket = dSocket;
                        if (dataSocketResolver) dataSocketResolver(dSocket);
                    });

                    dataServer.listen(0, primaryIp, () => {
                        const port = dataServer.address().port;
                        const p1 = Math.floor(port / 256);
                        const p2 = port % 256;
                        const ipParts = primaryIp.split('.').join(',');
                        send(227, `Entering Passive Mode (${ipParts},${p1},${p2})`);
                    });
                    break;
                }

                case 'EPSV': {
                    resetData();
                    dataSocketPromise = new Promise((resolve) => {
                        dataSocketResolver = resolve;
                    });

                    dataServer = net.createServer((dSocket) => {
                        dataSocket = dSocket;
                        if (dataSocketResolver) dataSocketResolver(dSocket);
                    });

                    dataServer.listen(0, primaryIp, () => {
                        const port = dataServer.address().port;
                        send(229, `Entering Extended Passive Mode (|||${port}|)`);
                    });
                    break;
                }

                case 'CWD':
                case 'XCWD':
                    if (arg === '..' || arg === '/') currentDir = '/';
                    else currentDir = path.posix.join(currentDir, arg);
                    send(250, `Directory successfully changed to "${currentDir}".`);
                    break;

                case 'MKD':
                case 'XMKD': {
                    const dirPath = path.join(DEFAULT_SAVE_DIR, arg);
                    try {
                        fs.mkdirSync(dirPath, { recursive: true });
                        send(257, `"${arg}" directory created.`);
                    } catch {
                        send(550, 'Failed to create directory.');
                    }
                    break;
                }

                case 'STOR': {
                    const filename = path.basename(arg);
                    const destPath = path.join(DEFAULT_SAVE_DIR, filename);
                    send(150, `Opening BINARY mode data connection for ${filename}`);

                    try {
                        const dSocket = dataSocket || await dataSocketPromise;
                        const writeStream = fs.createWriteStream(destPath);

                        dSocket.pipe(writeStream);

                        writeStream.on('finish', () => {
                            totalUploaded++;
                            console.log(`[SUCCESS] Photo Received: ${filename} -> Saved to: ${destPath} (Total: ${totalUploaded})`);
                            send(226, 'Transfer complete.');
                            resetData();
                        });

                        writeStream.on('error', (err) => {
                            console.error(`[ERROR] File write error:`, err);
                            send(451, 'Error writing file.');
                            resetData();
                        });
                    } catch (err) {
                        console.error('[ERROR] Data connection failed:', err);
                        send(425, 'Cannot open data connection.');
                        resetData();
                    }
                    break;
                }

                case 'NOOP':
                    send(200, 'OK');
                    break;

                case 'QUIT':
                    send(221, 'Goodbye.');
                    socket.end();
                    break;

                default:
                    send(502, 'Command not implemented.');
                    break;
            }
        }
    });

    socket.on('close', () => {
        resetData();
    });

    socket.on('error', (err) => {
        console.error('[SOCKET ERROR]', err.message);
        resetData();
    });
});

server.listen(FTP_PORT, '0.0.0.0', () => {
    console.clear();
    console.log('\x1b[32m%s\x1b[0m', '================================================================');
    console.log('\x1b[1m\x1b[36m%s\x1b[0m', '       ⚡ FLASH STUDIO - CAMERA LAPTOP FTP BRIDGE READY ⚡       ');
    console.log('\x1b[32m%s\x1b[0m', '================================================================');
    console.log('');
    console.log('\x1b[33m%s\x1b[0m', 'Enter these settings in your SONY / CANON / NIKON Camera:');
    console.log('----------------------------------------------------------------');
    localIps.forEach((item, index) => {
        console.log(`  \x1b[1mHost Name (IP ${index + 1})\x1b[0m : \x1b[32m${item.ip}\x1b[0m  (${item.name})`);
    });
    console.log(`  \x1b[1mPort Number    \x1b[0m : \x1b[32m${FTP_PORT}\x1b[0m`);
    console.log(`  \x1b[1mUser Name      \x1b[0m : \x1b[32m${USERNAME}\x1b[0m`);
    console.log(`  \x1b[1mPassword       \x1b[0m : \x1b[32m${PASSWORD}\x1b[0m`);
    console.log(`  \x1b[1mSecure Protocol\x1b[0m : \x1b[32mOFF\x1b[0m (Standard FTP)`);
    console.log(`  \x1b[1mDirectory      \x1b[0m : \x1b[32m/\x1b[0m`);
    console.log('----------------------------------------------------------------');
    console.log(`  \x1b[35mTarget Save Folder: \x1b[0m\x1b[4m${DEFAULT_SAVE_DIR}\x1b[0m`);
    console.log('');
    console.log('\x1b[36m%s\x1b[0m', 'HOW IT WORKS:');
    console.log('  1. Connect your Camera to this Laptop via Wi-Fi or Hotspot.');
    console.log('  2. In Camera: Menu -> Network -> FTP Transfer Func. -> Auto Transfer: ON');
    console.log('  3. In Chrome: Open Flash Studio -> Upload Page -> Click "Connect camera folder"');
    console.log(`     and select "${DEFAULT_SAVE_DIR}".`);
    console.log('  4. Photos shot on camera appear live in the gallery!');
    console.log('\x1b[32m%s\x1b[0m', '================================================================');
    console.log('Waiting for camera connections... (Press Ctrl+C to stop)');
    console.log('');
});

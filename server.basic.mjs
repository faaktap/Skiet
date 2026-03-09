import http from 'http';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

// Recreate __dirname for ES Modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Passenger handles the actual port; this is a fallback
const port = process.env.PORT || 3000;
const urlFront = '/skiet';

// ---------------------------------------------------------
// RELATIVE PATHING (No hardcoded absolute paths!)
// __dirname is: /home/actlocal/nodevenv/skiet
// Go up two levels (../../) to /home/actlocal, then into public_html/skiet
// ---------------------------------------------------------
const MP3_DIR = path.join(__dirname, '../../public_html/skiet');
const LOG_FILE = path.join(__dirname, 'prop_log.txt');


// ==========================================
// WORKER FUNCTIONS
// ==========================================

async function getMp3Files() {
    try {
        const files = await fs.readdir(MP3_DIR);
        return files.filter(file => file.toLowerCase().endsWith('.mp3'));
    } catch (err) {
        logMe('Error', `Could not read MP3 directory at ${MP3_DIR}: ${err.message}`);
        return [];
    }
}

async function writeLog(data, ip) {
    const msg = data.message || 'Unknown event';
    const soundY = data.soundY || 'None';
    const soundX = data.soundX || 'None';
    const logEntry = `IP: ${ip} | Cock: ${soundY} | Shoot: ${soundX} | Event: ${msg}`;
    
    // Using your custom logMe function
    logMe('Action', logEntry);
}

// Your custom logging function
export function logMe(str, str2) {
    const timestamp = new Date().toISOString();
    const logMessage = str2 ? `[${timestamp}] ${str} ${str2}` : `[${timestamp}] ${str}`;
    
    console.log(logMessage); 
    
    // Append to the prop log file
    fs.appendFile(LOG_FILE, `\n${logMessage}`, err => {
        if (err) console.error(`Failed to write to log:`, err);
    });
}


// ==========================================
// MAIN SERVER LOOP (Pure API)
// ==========================================

const server = http.createServer(async (req, res) => {
    
    // Strip Passenger subfolder prefix
    let cleanUrl = req.url;
    if (cleanUrl.startsWith(urlFront)) {
        cleanUrl = cleanUrl.slice(urlFront.length);
        if (cleanUrl === '') cleanUrl = '/'; 
    }

    const url = new URL(cleanUrl, `http://${req.headers.host}`);
    
    // Ignore Favicon requests silently
    if (url.pathname === '/favicon.ico') {
        res.writeHead(204);
        return res.end();
    }

    // 1. Get list of MP3s
    if (req.method === 'GET' && url.pathname === '/api/sounds') {
        try {
            const mp3s = await getMp3Files();
            res.writeHead(200, { 'Content-Type': 'application/json' });
            return res.end(JSON.stringify(mp3s));
        } catch (e) {
            res.writeHead(500);
            return res.end(JSON.stringify({ error: 'Failed to read directory' }));
        }
    }

    // 2. Write to Log
    if (req.method === 'POST' && url.pathname === '/api/log') {
        let body = '';
        req.on('data', chunk => { body += chunk.toString(); });
        req.on('end', async () => {
            try {
                const data = JSON.parse(body);
                const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress; 
                await writeLog(data, ip);
                
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: true }));
            } catch (e) {
                res.writeHead(500);
                res.end(JSON.stringify({ error: 'Log write failed' }));
            }
        });
        return; 
    }

    // 3. Catch-All for unknown API routes
    logMe('404 Drop', `Unhandled API request: ${url.pathname}`);
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'API Endpoint Not Found' }));
});

server.listen(port, () => {
    logMe('Startup', `🎬 Digital Prop API Server running on port ${port}`);
});
const http = require('http');
const fs = require('fs/promises');
const { createReadStream, existsSync } = require('fs');
const path = require('path');

const PORT = 3000;
const LOG_FILE = path.join(__dirname, 'prop_log.txt');

// ==========================================
// WORKER FUNCTIONS (The Heavy Lifting)
// ==========================================

async function getMp3Files() {
    const files = await fs.readdir(__dirname);
    return files.filter(file => file.toLowerCase().endsWith('.mp3'));
}

async function writeLog(data, ip) {
    const timestamp = new Date().toISOString().replace('T', ' ').substring(0, 19);
    const msg = data.message || 'Unknown event';
    const soundY = data.soundY || 'None';
    const soundX = data.soundX || 'None';
    
    const logEntry = `[${timestamp}] IP: ${ip} | Cock: ${soundY} | Shoot: ${soundX} | Event: ${msg}\n`;
    await fs.appendFile(LOG_FILE, logEntry);
}

async function readLogs() {
    try {
        return await fs.readFile(LOG_FILE, 'utf-8');
    } catch (err) {
        return "No logs found yet. Start shaking the prop!";
    }
}

function serveStaticFile(res, filePath) {
    // Basic security to prevent directory traversal
    const safePath = path.normalize(filePath).replace(/^(\.\.[\/\\])+/, '');
    
    if (!existsSync(safePath)) {
        res.writeHead(404);
        return res.end('File not found');
    }

    const ext = path.extname(safePath).toLowerCase();
    const mimeTypes = {
        '.html': 'text/html',
        '.mp3': 'audio/mpeg',
        '.js': 'text/javascript',
        '.css': 'text/css'
    };
    
    res.writeHead(200, { 'Content-Type': mimeTypes[ext] || 'application/octet-stream' });
    
    // We don't load the MP3 into memory; we stream it directly to the browser
    createReadStream(safePath).pipe(res);
}


// ==========================================
// MAIN SERVER LOOP
// ==========================================

const server = http.createServer();

server.on('request', async (req, res) => {
    // Parse the URL
    const url = new URL(req.url, `http://${req.headers.host}`);
    
    // --------------------------------------
    // API ENDPOINTS
    // --------------------------------------
    
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

    // 2. View Logs
    if (req.method === 'GET' && url.pathname === '/api/logs') {
        const logs = await readLogs();
        res.writeHead(200, { 'Content-Type': 'text/plain' });
        return res.end(logs);
    }

    // 3. Write to Log
    if (req.method === 'POST' && url.pathname === '/api/log') {
        let body = '';
        req.on('data', chunk => { body += chunk.toString(); });
        req.on('end', async () => {
            try {
                const data = JSON.parse(body);
                // Get the real IP if behind a proxy, otherwise use socket
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

    // --------------------------------------
    // STATIC FILE ROUTING
    // --------------------------------------
    
    // Default to index.html if asking for root
    const requestPath = url.pathname === '/' ? '/index.html' : url.pathname;
    serveStaticFile(res, path.join(__dirname, requestPath));
});

server.listen(PORT, () => {
    console.log(`🎬 Digital Prop Server running at http://localhost:${PORT}`);
    console.log(`📜 View logs at http://localhost:${PORT}/api/logs`);
});
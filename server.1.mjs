/*
Error
FileNotFoundError: [Errno 2] No such file or directory: '/home/actlocal/public_html/skiet/.htaccess'
Traceback (most recent call last):
File "/opt/cloudlinux/venv/lib64/python3.11/site-packages/clselector/cl_selector.py", line 246, in run
self.run_stop()
File "/opt/cloudlinux/venv/lib64/python3.11/site-packages/clselector/cl_selector.py", line 482, in run_stop
self._print_data(self._selector_lib.stop_app(self._opts['--app-root'],
^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
File "/opt/cloudlinux/venv/lib64/python3.11/site-packages/clselector/selectorlib.py", line 962, in stop_app
self.selector_old_lib.stop(user, app_root, doc_root, self.apps_manager)
File "/opt/cloudlinux/venv/lib64/python3.11/site-packages/clselect/clselectctlnodejsuser.py", line 375, in stop
clpassenger.remove_passenger_lines_from_htaccess(htaccess_filename)
File "/opt/cloudlinux/venv/lib64/python3.11/site-packages/clselect/clpassenger.py", line 357, in remove_passenger_lines_from_htaccess
lines = file_readlines(htaccess_filename, errors='surrogateescape')
^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
File "/opt/cloudlinux/venv/lib64/python3.11/site-packages/clselect/utils.py", line 211, in file_readlines
stream = open(path, errors=errors)
^^^^^^^^^^^^^^^^^^^^^^^^^
FileNotFoundError: [Errno 2] No such file or directory: '/home/actlocal/public_html/skiet/.htaccess'
*/

import http from 'http';
import fs from 'fs/promises';
import { createReadStream, existsSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Recreate __dirname for ES Modules (Required in Node 18)
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const hostname = '127.0.0.1'
const port = 61002;
const urlFront = '/skiet';
const LOG_FILE = path.join(__dirname, 'prop_log.txt');

const LOGS_DIR = './logs';

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
    
    // Stream the file directly to the browser
    createReadStream(safePath).pipe(res);
}


// ==========================================
// MAIN SERVER LOOP
// ==========================================

const server = http.createServer((req, res) => {
  // This is a placeholder for the actual mainRequestHandler logic,
  // which will be defined below using the requestHandlers object.
  // We need the 'server' instance to be available before defining mainRequestHandler
  // so it can be passed to createRequestHandlers.
});


logMe('-------------------------------------------------------------------');
logMe(`Launch Server - v1.1a - ${hostname},${port}`);
logMe(`filename and __dirname', ${__dirname}, ${__filename}`);
logMe('-------------------------------------------------------------------');



server.on('request', async (req, res) => {
    
    // --- PASSENGER FIX ---
    // Strip the '/skiet' subfolder from the URL so our routes match perfectly
    let cleanUrl = req.url;
    if (cleanUrl.startsWith(urlFront)) {
        cleanUrl = cleanUrl.slice(urlFront.length);
        if (cleanUrl === '') cleanUrl = '/'; // Ensure root is '/' if they just visit /skiet
    }

    // Parse the CLEANED URL
    const url = new URL(cleanUrl, `http://${req.headers.host}`);
    
    logMe('loop',`Original: ${req.url} | Cleaned: ${url.pathname}`);

    // --------------------------------------
    // API ENDPOINTS
    // --------------------------------------
    
    // 0. test
    if (req.method === 'GET' && url.pathname === '/hello') {
        res.setHeader('Content-Type', 'text/plain');
        return res.end('Hello World');
    }

    // 1. Get list of MP3s
    if (req.method === 'GET' && url.pathname === '/api/sounds') {
        try {
            const mp3s = await getMp3Files();
            logMe('Snd', `mp3s = ${mp3s}`);
            res.writeHead(200, { 'Content-Type': 'application/json' });
            return res.end(JSON.stringify(mp3s));
        } catch (e) {
            logMe('Snd', `Error ${e}`);
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
    
    // Serve the file based on the cleaned path
    serveStaticFile(res, path.join(__dirname, requestPath));
});
/*
Handling the onRequest loop...
------------------------------
The Standard Way: Two Different Patterns

When building raw Node.js servers, developers generally use two different patterns depending on what the function is doing. You actually have perfect examples of both patterns already in your code!

Pattern 1: The "Data Return" Pattern (For APIs)
This is what we did with getMp3Files(). The function does not know anything about HTTP, req, or res. It just does a job (reads a folder) and returns an array. The main loop then takes that array and handles the res.writeHead and res.end().

    Best for: Database queries, math, simple JSON APIs.

    Why it's good: It keeps your business logic completely separated from your web server logic.

Pattern 2: The "Delegate Responsibility" Pattern (For Streams & Complex Headers)
This is what we did with serveStaticFile(req, res, path). We literally hand the function the keys to the car (the res object) and say, "You handle the whole response."

    Best for: File streaming, complex error handling, or when you need to read custom headers (like the MP3 Range requests).

    Why it's good: If we tried to use Pattern 1 here, we would have to load the entire 5MB MP3 file into the server's RAM just to return it to the main loop to use in res.end(fileData). By passing res into the function, we can stream the file efficiently without eating up RAM.

The Golden Rule

The only hard rule in Node.js is: Exactly one res.end() (or equivalent like .pipe()) must execute per request. As long as the code path guarantees the connection closes, it doesn't matter if it happens in the main loop or inside a helper function. The safety net we discussed earlier ensures that if a URL doesn't match an API route and somehow slips past your static file server, you still gracefully close the door.
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

function serveBasicStaticFile(res, filePath) {
    // Basic security to prevent directory traversal
    const safePath = path.normalize(filePath).replace(/^(\.\.[\/\\])+/, '');
    logMe('serveBasicStaticFile',safePath)
    if (!existsSync(safePath)) {
        logMe('serveBasicStaticFile','404')
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
    logMe('serveBasicStaticFile','SendFile')
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
    // Parse the URL
    // const url = new URL(req.url, `http://${req.headers.host}`);
	 // --- PASSENGER FIX ---
    // Strip the '/skiet' subfolder from the URL so our routes match perfectly
    let cleanUrl = req.url;
    if (cleanUrl.startsWith(urlFront)) {
        cleanUrl = cleanUrl.slice(urlFront.length);
        if (cleanUrl === '') cleanUrl = '/'; // Ensure root is '/' if they just visit /skiet
    }

    // Parse the CLEANED URL
    const url = new URL(cleanUrl, `http://${req.headers.host}`);
    logMe('----------------------------------------------');
    logMe('loop',`Original: ${req.url} | Cleaned: ${url.pathname}`);
	
    
	
	logMe('loop',`Request came in ${req.method} : ${req.url} , ${url}`);
    // --------------------------------------
    // API ENDPOINTS
    // --------------------------------------
    
    //favicon
    if (url.pathname === '/favicon.ico') {
        const favIcon = url.pathname === '/' ? '/index.html' : url.pathname;
        logMe('favIcon Req',favIcon)
        res.writeHead(204); // 204 means "No Content" (Browser is happy, log is empty)
        serveBasicStaticFile(res, path.join(__dirname, './favIcon.ico'));
        return res.end();
    }

	// 0. test
	if (req.method === 'GET' && url.pathname === '/hello') {
		res.setHeader('Content-Type', 'text/plain');
        return res.end('Hello World');
	}
    // 1. Get list of MP3s
    if (req.method === 'GET' && url.pathname === '/api/sounds') {
		
        try {
            const mp3s = await getMp3Files();
			logMe('Serve SndList', `mp3s = ${mp3s}`);
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
                logMe('/api/log',body)
                // Look for the proxy header first, fall back to socket
                const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress; 
                await writeLog(data, ip);
                
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: true }));
            } catch (e) {
                logMe('/api/log','500')
                res.writeHead(500);
                res.end(JSON.stringify({ error: 'Log write failed' }));
            }
        });
        return; 
    }

    // --------------------------------------
    // STATIC FILE ROUTING
    // --------------------------------------
    
    // Default to index.html if asking for root (we need to decode of there are spaces..)
    // const requestPath = url.pathname === '/' ? '/index.html' : url.pathname; - no %20(space) resolve
    const requestPath = url.pathname === '/' ? '/index.html' : decodeURIComponent(url.pathname)
    logMe('static Req',requestPath)
    logMe('serve Static',path.join(__dirname, requestPath))
    await serveStaticFile(req, res, path.join(__dirname, requestPath))


    logMe('404 Drop', `Unhandled request fell through: ${url.pathname}`);
    
    if (!res.headersSent) {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('404 - Not Found');
    }
    
});

server.listen(port, hostname, () => {
    console.log(`🎬 Digital Prop Server running at http://localhost:${port}`);
    console.log(`📜 View logs at http://localhost:${port}/api/logs`);
});

// Note: We changed this to an 'async' function and passed 'req' into it!
async function serveStaticFile(req, res, filePath) {
    const safePath = path.normalize(filePath).replace(/^(\.\.[\/\\])+/, '');
    
    if (!existsSync(safePath)) {
        res.writeHead(404);
        logMe(`serveStat: 404 - file not found`);
        return res.end('File not found');
    }

    const ext = path.extname(safePath).toLowerCase();
    const mimeTypes = {
        '.html': 'text/html',
        '.mp3': 'audio/mpeg',
        '.js': 'text/javascript',
        '.css': 'text/css',
        '.ico': 'image/x-icon'
    };
    
    try {
        // 1. Get the exact size of the file
        const stat = await fs.stat(safePath);
        const fileSize = stat.size;
        
        // 2. Check if the browser is asking for a specific "Range" of the audio
        const range = req.headers.range;

        if (range) {
            // --- PARTIAL STREAMING (For MP3s) ---
            logMe(`serveStat: Size - ${fileSize}, Range - ${range}`);
            const parts = range.replace(/bytes=/, "").split("-");
            const start = parseInt(parts[0], 10);
            const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
            const chunksize = (end - start) + 1;
            
            const fileStream = createReadStream(safePath, { start, end });
            
            res.writeHead(206, { // 206 means "Partial Content"
                'Content-Range': `bytes ${start}-${end}/${fileSize}`,
                'Accept-Ranges': 'bytes',
                'Content-Length': chunksize,
                'Content-Type': mimeTypes[ext] || 'application/octet-stream',
            });
            
            fileStream.pipe(res);
        } else {
            // --- FULL FILE DELIVERY (For HTML) ---
            logMe(`serveStat: Size - ${fileSize}`);
            res.writeHead(200, {
                'Content-Length': fileSize,
                'Content-Type': mimeTypes[ext] || 'application/octet-stream',
            });
            createReadStream(safePath).pipe(res);
        }
    } catch (err) {
        logMe('serveStat', `Error Stream failed: ${err.message}`);
        res.writeHead(500);
        res.end('Server Error');
    }
}

export function logMe(str, str2) {
    const timestamp = new Date().toISOString();
    let logMessage;
    if (str2) {
      logMessage = `[${timestamp}] ${str} ${str2}`;
    } else {
      logMessage = `[${timestamp}] ${str}`;
    }
    
    // Always log to console for immediate visibility during development/debugging
    console.log(logMessage); 
    
    // Get the dynamic file name for today
    const logFileName = getDailyLogFileName();
    
    //fs.appendFile('./test.log', `\n${logMessage}` , err => { if (err) {console.error(err)}} );
    // Append to today's log file
    fs.appendFile(logFileName, `\n${logMessage}` , err => {
        if (err) {
            // If file logging fails, at least log to console
            console.error(`Failed to write to log file "${logFileName}":`, err);
        }
    });
}
// --- Helper function to get today's log file name ---
function getDailyLogFileName() {
    const date = new Date();
    // Format date as YYYY-MM-DD
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, '0'); // Months are 0-indexed, so add 1
    const day = date.getDate().toString().padStart(2, '0');

    // Construct the filename, e.g., 'test-2025-07-05.log'
    return path.join(LOGS_DIR, `test-${year}-${month}-${day}.log`);
}

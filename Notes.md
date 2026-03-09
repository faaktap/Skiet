---
title: How an Episode of 'Bones' Inspired Me to Build a Motion-Activated Digital Prop (in Pure Node.js)
description: Asking Gemini to create code I saw in a series...
tags: node, javascript, sound, DeviceMotion API
cover_image: https://actlocal.co.za/skiet/skiet.jpg

# How an Episode of 'Bones' Inspired Me to Build a Motion-Activated Digital Prop (in Pure Node.js)

We've all seen it on TV - a character pulls out their smartphone, whips it through the air, and it perfectly emulates the sound of a shotgun cocking or a whip cracking. I was recently watching an episode of Bones where Angela did exactly this, and the developer side of my brain instantly kicked in.

I thought, how hard could it actually be to build that today?

It turns out, grabbing device motion data from a web browser is incredibly easy. Getting modern mobile browsers to actually play the audio, vibrating the phone with perfect millisecond timing, and fighting with shared hosting routing to serve the files? That’s where the real fun begins.

Instead of reaching for massive frameworks like Express or Axios, I decided to keep things raw. I built a dual-wielding, motion-activated soundboard using Vanilla JavaScript for the frontend and a zero-dependency, pure Node.js API for the backend.

Here is how I built it, and the massive "gotchas" I had to overcome to get it working perfectly on a live cPanel shared server.

Live Demo: actlocal.co.za/skiet (Open on your phone!)
GitHub Repo: faaktap/Skiet
# The Tech Stack: Keeping It Raw

The architecture is deliberately stripped down. The frontend is a single index.html file that leverages the browser's native DeviceMotion API and the navigator.vibrate API for haptic feedback.

The backend is a pure Node.js ES Module (app.mjs). No node_modules folder, no Express. Just the built-in http and fs modules to scan the directory for MP3 files and log usage data. To keep things lightning fast, I let the traditional web server (Apache/LiteSpeed) handle serving the static HTML and heavy MP3 files, leaving Node.js to act strictly as a JSON API.
Gotcha #1: The iOS Audio & Sensor Lockdown

If you try to play an audio file or read motion sensors the moment a webpage loads on a mobile device (especially Safari on iOS), the browser will silently block you.

Modern browsers require explicit user interaction to legally "unlock" the audio context and request sensor permissions. The solution was to build a massive, satisfying red "ACTIVATE" button right in the middle of the screen.

When clicked, it silently plays and pauses the audio object to unlock it, and requests the iOS 13+ sensor permissions:
```
JavaScript

if (typeof DeviceMotionEvent.requestPermission === 'function') {
    DeviceMotionEvent.requestPermission()
        .then(state => {
            if (state === 'granted') {
                window.addEventListener('devicemotion', handleMotion);
            }
        });
} else {
    // Standard Android/PC fallback
    window.addEventListener('devicemotion', handleMotion);
}
```
# Gotcha #2: The HTML5 Audio "Range" Trap

Initially, I wrote a Node.js function to stream the MP3 files to the browser. It worked locally, but the HTML5 <audio> player kept throwing a "no supported source was found" error.

The culprit? HTML5 audio players don't just ask for the file; they send an HTTP Range header (e.g., asking for bytes 0-5000). If your Node server just blasts the whole file with a 200 OK status instead of a 206 Partial Content status, the browser aborts the connection.

Instead of writing complex stream-chunking logic in Node, I opted for a much cleaner architectural split: I put the MP3s and the index.html in a standard public folder, letting Apache serve them natively (with perfect Range handling), and kept Node isolated to the /api endpoints.
Gotcha #3: Fighting cPanel, Passenger, and Subfolders

Deploying Node.js on a shared hosting environment using Phusion Passenger is a completely different beast than running it locally.

First, you can't hardcode ports. Passenger assigns them dynamically.
const port = process.env.PORT || 3000;

Second, because my app was hosted in a subfolder (/skiet), Passenger intercepted the traffic and handed my Node app the full path. My route if (url.pathname === '/api/sounds') was failing because the incoming request was actually /skiet/api/sounds.

Instead of rewriting all my routes, I wrote a quick interceptor at the top of the main server loop to clean the URL before routing:
```
JavaScript

const server = http.createServer(async (req, res) => {
    // Strip Passenger subfolder prefix
    const urlFront = '/skiet';
    let cleanUrl = req.url;
    
    if (cleanUrl.startsWith(urlFront)) {
        cleanUrl = cleanUrl.slice(urlFront.length);
        if (cleanUrl === '') cleanUrl = '/'; 
    }

    const url = new URL(cleanUrl, `http://${req.headers.host}`);
    
    // Now url.pathname === '/api/sounds' works perfectly!
    // ... routes go here ...
});
```

# The "Director's Cut" Easter Egg

Because the app was inspired by TV magic, I couldn't resist adding a cinematic Easter egg. If you click the collaboration text at the bottom of the About screen, the CSS triggers a pitch-black overlay and a 75-second, Star Wars-style credits scroll of the project's development history.

I even added a modern navigator.clipboard.writeText() button so users can copy the "script" directly to their clipboard.

# Conclusion

Sometimes the best way to sharpen your fundamental development skills is to build something completely ridiculous just for the fun of it. Stripping away the heavy frameworks and dealing directly with raw Node streams, HTTP headers, and mobile sensor APIs was a fantastic weekend exercise.

If you give it a try on your phone, let me know how it handles! 


# An Afterthought

While I was watching the end of that Bones episode, my AI code monkey generated the initial, fully functional version of this system in PHP. I copied it, pasted it onto my server, and ran it—and it worked flawlessly on the very first try!

We eventually migrated the backend to Node.js for architectural elegance and better stream handling, but seeing a working, hardware-interacting prototype spring to life before the TV credits even finished rolling was an absolutely wild reminder of how fast we can build things today.

---


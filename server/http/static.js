const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const crypto = require('crypto');
const { PUB, PROD } = require('../config');
const types = {
    '.html': 'text/html; charset=utf-8', '.json': 'application/json', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.ico': 'image/x-icon', '.txt': 'text/plain; charset=utf-8', '.xml': 'application/xml', '.webmanifest': 'application/manifest+json', '.woff2': 'font/woff2'
};
// Always revalidated, so a new service worker / manifest / page is picked up right after a deploy.
const NEVER_CACHE = new Set(['sw.js', 'manifest.webmanifest', 'phone-callback.html']);
const zip = new Set(['.html', '.json', '.css', '.js', '.svg', '.txt', '.xml', '.webmanifest']);

// ---- Server static cache -------------------------------------------------------------------------------------
// Every file is read (and gzipped) once, then served from memory. A file is re-read only when its mtime/size changes,
// so edits show up immediately in development and a deploy (new files) is picked up with no restart logic.
const files = new Map(); // absolute path -> { key, etag, raw, gz }
let build = { at: 0, id: 'dev', modules: [] };

// Build id = hash of every file's mtime+size. Used to version the service worker; also lists the JS modules for <link rel="modulepreload">.
function buildInfo() {
    const now = Date.now();
    if (now - build.at < 3000) {
        return build;
    }
    const h = crypto.createHash('sha1');
    const modules = [];
    const walk = dir => {
        for (const e of fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
            const p = path.join(dir, e.name);
            if (e.isDirectory()) {
                walk(p);
            } else {
                const st = fs.statSync(p);
                h.update(path.relative(PUB, p) + st.size + Math.floor(st.mtimeMs));
                if (e.name.endsWith('.js') && p.includes(path.sep + 'js' + path.sep)) {
                    modules.push('/' + path.relative(PUB, p).split(path.sep).join('/'));
                }
            }
        }
    };
    try {
        walk(PUB);
    } catch { }
    build = { at: now, id: h.digest('hex').slice(0, 10), modules };
    return build;
}

function load(f, st) {
    const key = st.size + ':' + Math.floor(st.mtimeMs);
    const hit = files.get(f);
    const base = path.basename(f);
    // sw.js and index.html depend on the build, so they are re-rendered whenever any file changed.
    const dyn = base === 'sw.js' || base === 'index.html';
    const stamp = dyn ? key + ':' + buildInfo().id : key;
    if (hit && hit.key === stamp) {
        return hit;
    }
    let raw = fs.readFileSync(f);
    if (base === 'sw.js') {
        raw = Buffer.from(raw.toString().replace(/__BUILD__/g, buildInfo().id));
    } else if (base === 'index.html') {
        // Fetch the whole module graph in parallel instead of discovering it one import at a time.
        const tags = buildInfo().modules.map(m => '<link rel="modulepreload" href="' + m.slice(1) + '">').join('');
        raw = Buffer.from(raw.toString().replace('<!--PRELOAD-->', tags + '<meta name="fyndr-build" content="' + buildInfo().id + '">'));
    }
    const ext = path.extname(f).toLowerCase();
    const entry = {
        key: stamp, raw, etag: 'W/"' + crypto.createHash('sha1').update(raw).digest('hex').slice(0, 16) + '"',
        gz: zip.has(ext) && raw.length > 1024 ? zlib.gzipSync(raw, { level: 9 }) : null
    };
    files.set(f, entry);
    return entry;
}

const cacheControl = (ext, base) => {
    if (!PROD || ext === '.html' || NEVER_CACHE.has(base)) {
        return 'no-cache';
    }
    if (ext === '.js' || ext === '.css' || ext === '.json') {
        return 'public, max-age=60, stale-while-revalidate=86400'; // fresh enough after a deploy, instant on repeat visits
    }
    return 'public, max-age=604800, stale-while-revalidate=86400'; // images, icons, fonts
};

// Serves public/ from the memory cache with gzip, ETag/304 and cache headers. Unknown paths without a file extension fall back to
// index.html (single-page app); a missing .js/.css/.png etc. is a real 404 instead of an HTML page pretending to be a script.
module.exports = function serveStatic(req, res, u) {
    if (req.method !== 'GET' && req.method !== 'HEAD') {
        res.writeHead(405, { Allow: 'GET, HEAD' });
        return res.end();
    }
    let rel;
    try {
        rel = decodeURIComponent(u.pathname);
    } catch {
        res.writeHead(400);
        return res.end();
    }
    let f = path.join(PUB, rel === '/' ? 'index.html' : rel);
    const stat = p => {
        try {
            const s = fs.statSync(p);
            return p.startsWith(PUB + path.sep) && s.isFile() ? s : null;
        } catch {
            return null;
        }
    };
    let st = stat(f);
    if (!st) {
        if (path.extname(f) && path.extname(f) !== '.html') {
            res.writeHead(404, { 'Content-Type': 'text/plain' });
            return res.end('Not found');
        }
        f = path.join(PUB, 'index.html');
        st = stat(f);
        if (!st) {
            res.writeHead(404);
            return res.end();
        }
    }
    const ext = path.extname(f).toLowerCase();
    const base = path.basename(f);
    const e = load(f, st);
    const h = {
        'Content-Type': types[ext] || 'application/octet-stream', ETag: e.etag, 'Cache-Control': cacheControl(ext, base), Vary: 'Accept-Encoding'
    };
    if (req.headers['if-none-match'] === e.etag) {
        res.writeHead(304, h);
        return res.end();
    }
    const gz = e.gz && /\bgzip\b/.test(req.headers['accept-encoding'] || '');
    const body = gz ? e.gz : e.raw;
    if (gz) {
        h['Content-Encoding'] = 'gzip';
    }
    h['Content-Length'] = body.length;
    res.writeHead(200, h);
    res.end(req.method === 'HEAD' ? undefined : body);
};

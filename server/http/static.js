const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const { PUB, PROD } = require('../config');
const types = {
    '.html': 'text/html; charset=utf-8', '.json': 'application/json', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.ico': 'image/x-icon', '.txt': 'text/plain; charset=utf-8', '.xml': 'application/xml', '.webmanifest': 'application/manifest+json', '.woff2': 'font/woff2'
};
// Always revalidated, so a new service worker / manifest is picked up right after a deploy.
const NEVER_CACHE = new Set(['sw.js', 'manifest.webmanifest']);
const zip = new Set(['.html', '.json', '.css', '.js', '.svg', '.txt', '.xml', '.webmanifest']);
// Serves public/ with gzip, ETag/304 and cache headers. Unknown paths without a file extension fall back to index.html (single-page app);
// a missing .js/.css/.png etc. is a real 404 instead of an HTML page pretending to be a script.
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
    const isFile = p => p.startsWith(PUB + path.sep) && fs.existsSync(p) && fs.statSync(p).isFile();
    if (!isFile(f)) {
        if (path.extname(f) && path.extname(f) !== '.html') {
            res.writeHead(404, { 'Content-Type': 'text/plain' });
            return res.end('Not found');
        }
        f = path.join(PUB, 'index.html');
    }
    const ext = path.extname(f).toLowerCase();
    const st = fs.statSync(f);
    const etag = 'W/"' + st.size.toString(16) + '-' + Math.floor(st.mtimeMs).toString(16) + '"';
    const h = {
        'Content-Type': types[ext] || 'application/octet-stream', ETag: etag, 'Cache-Control': ext === '.html' || !PROD || NEVER_CACHE.has(path.basename(f)) ? 'no-cache' : 'public, max-age=300', Vary: 'Accept-Encoding'
    };
    if (req.headers['if-none-match'] === etag) {
        res.writeHead(304, h);
        return res.end();
    }
    const gz = zip.has(ext) && st.size > 1024 && /\bgzip\b/.test(req.headers['accept-encoding'] || '');
    if (gz) {
        h['Content-Encoding'] = 'gzip';
    }
    res.writeHead(200, h);
    if (req.method === 'HEAD') {
        return res.end();
    }
    const s = fs.createReadStream(f);
    s.on('error', () => res.destroy());
    gz ? s.pipe(zlib.createGzip()).pipe(res) : s.pipe(res);
};

// Zero-dependency Node server: static files + JSON API + role-based auth (user / org / admin)
const http = require('http');
const { PORT, HOST, PROD } = require('./config');
require('./routes');
try {
    // One combined stylesheet = one request. Only rewrites public/css/app.css when a source file changed.
    require('../scripts/bundle-css')();
} catch (e) {
    console.warn('CSS bundle skipped:', e.message);
}
const handleApi = require('./http/api-handler');
const serveStatic = require('./http/static');
const { DATA_DIR } = require('./config');
const { db } = require('./db/store');
const { BRAND_URL, create: createBrands } = require('./jobs/brand');
// Read-only helper for the picture route below (it never fetches anything; the importer does that).
const brandFiles = createBrands({ db, save: () => { }, dir: require('path').join(DATA_DIR, 'brands') });
// Tiny in-memory rate limiter (per IP). Behind a proxy (production) the client IP is the last X-Forwarded-For entry.
const hits = new Map();
const limited = (key, max, ms) => {
    const now = Date.now();
    const h = hits.get(key);
    if (!h || now > h.t) {
        hits.set(key, { n: 1, t: now + ms });
        return false;
    }
    return ++h.n > max;
};
setInterval(() => {
    const n = Date.now();
    for (const [k, v] of hits) {
        if (n > v.t) {
            hits.delete(k);
        }
    }
}, 60000).unref();
const ipOf = req => (PROD && (req.headers['x-forwarded-for'] || '').split(',').pop().trim()) || req.socket.remoteAddress || '?';
const STRICT = { 'POST /api/phone/verify': [10, 10 * 60e3], 'POST /api/init': [20, 60 * 60e3] }; // [max requests, window]
const server = http.createServer(async (req, res) => {
    const u = new URL(req.url, 'http://x');
    if (u.pathname === '/healthz') {
        res.writeHead(200, { 'Content-Type': 'text/plain' });
        return res.end('ok');
    }
    if (PROD) {
        if (req.headers['x-forwarded-proto'] === 'http') {
            res.writeHead(301, { Location: 'https://' + req.headers.host + req.url });
            return res.end();
        }
        res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    }
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
    // Company logos and cover pictures found by the importer (server/jobs/brand.js). Public on purpose: an <img> tag cannot send a login token.
    const bm = req.method === 'GET' && u.pathname.match(BRAND_URL);
    if (bm) {
        if (limited('b:' + ipOf(req), 1200, 60e3)) {
            res.writeHead(429, { 'Retry-After': '60' });
            return res.end();
        }
        const a = brandFiles.asset(bm[1], bm[2]);
        if (!a) {
            res.writeHead(404, { 'Cache-Control': 'public, max-age=300' });
            return res.end();
        }
        res.writeHead(200, {
            'Content-Type': a.mime, 'Content-Length': a.body.length, 'Cache-Control': 'public, max-age=86400, stale-while-revalidate=604800',
            'Cross-Origin-Resource-Policy': 'cross-origin', 'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; sandbox"
        });
        return res.end(a.body);
    }
    if (u.pathname.startsWith('/api/')) {
        // CORS: lets the site on GitHub Pages (another address) call this server. Requests carry a Bearer token, not cookies,
        // so '*' is safe; set CORS_ORIGIN=https://you.github.io to allow only your site.
        const allow = process.env.CORS_ORIGIN || '*';
        const origin = req.headers.origin;
        if (origin && (allow === '*' || allow.split(',').map(s => s.trim()).includes(origin))) {
            res.setHeader('Access-Control-Allow-Origin', allow === '*' ? '*' : origin);
            res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
            res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
            res.setHeader('Access-Control-Max-Age', '86400');
            res.setHeader('Vary', 'Origin');
        }
        if (req.method === 'OPTIONS') {
            res.writeHead(204);
            return res.end();
        }
        const ip = ipOf(req);
        const sk = STRICT[req.method + ' ' + u.pathname];
        if (limited('a:' + ip, 300, 60e3) || (sk && limited(req.method + u.pathname + ':' + ip, sk[0], sk[1]))) {
            res.writeHead(429, { 'Content-Type': 'application/json', 'Retry-After': '60' });
            return res.end(JSON.stringify({ error: 'Too many requests. Please wait a bit and try again.' }));
        }
        return handleApi(req, res, u);
    }
    serveStatic(req, res, u);
});
server.keepAliveTimeout = 65e3;
server.listen(PORT, HOST, () => console.log('Fyndr running on http://localhost:' + PORT + (PROD ? ' (production)' : '')));
require('./jobs/auto-import').start();
const stop = () => {
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(0), 8000).unref();
};
process.on('SIGTERM', stop);
process.on('SIGINT', stop);
process.on('unhandledRejection', e => console.error('Unhandled rejection:', e));
process.on('uncaughtException', e => {
    console.error('Uncaught exception:', e);
    process.exit(1);
});

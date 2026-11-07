// Zero-dependency Node server: static files + JSON API + role-based auth (user / org / admin)
const http = require('http');
const fs = require('fs');
const observe = require('./lib/observe');
const pkg = require('../package.json');
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
// [max requests, window]. Students on one campus Wi-Fi share one IP, so the numbers are generous; tune them with env vars.
const num = (k, d) => +process.env[k] || d;
const API_PER_MIN = num('RATE_API_PER_MIN', 1200);
const STRICT = { 'POST /api/phone/verify': [num('RATE_PHONE_PER_10MIN', 40), 10 * 60e3], 'POST /api/init': [num('RATE_SIGNUP_PER_HOUR', 150), 60 * 60e3] };
// Load shedding: above this many requests in progress, new API calls get a quick 503 + Retry-After instead of making everyone slower (the app retries them).
const MAX_INFLIGHT = process.env.MAX_INFLIGHT !== undefined ? +process.env.MAX_INFLIGHT : 300;
// Fault injection for rehearsals ("game days"): CHAOS_ERROR_RATE=0.2 fails 20% of API calls with a 503, CHAOS_LATENCY_MS adds delay. Ignored in production unless CHAOS_ALLOW_PROD=1.
const CHAOS = !PROD || process.env.CHAOS_ALLOW_PROD === '1' ? { err: +process.env.CHAOS_ERROR_RATE || 0, ms: +process.env.CHAOS_LATENCY_MS || 0 } : { err: 0, ms: 0 };
// Incident kill switch: READ_ONLY=1 (set it in the host's environment, redeploy) refuses every change to the data with a clear message, while browsing keeps working.
// Use it while restoring a backup, running a risky migration, or when something is corrupting data and you need it to stop NOW.
const READ_ONLY = process.env.READ_ONLY === '1';
let draining = false; // set on SIGTERM: /readyz turns 503 so the host stops sending traffic while running requests finish
const json = (res, code, d) => {
    res.writeHead(code, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
    res.end(JSON.stringify(d));
};
const server = http.createServer(async (req, res) => {
    const u = new URL(req.url, 'http://x');
    if (u.pathname === '/healthz') { // liveness: "the process is up". Kept tiny and dependency-free; the host restarts the server if this fails.
        res.writeHead(200, { 'Content-Type': 'text/plain' });
        return res.end('ok');
    }
    if (u.pathname === '/readyz') { // readiness: "send me traffic". Fails while draining or when the data folder cannot be written.
        let writable = true;
        try {
            fs.accessSync(DATA_DIR, fs.constants.W_OK);
        } catch {
            writable = false;
        }
        const ready = !draining && writable;
        return json(res, ready ? 200 : 503, { status: draining ? 'draining' : writable ? 'ready' : 'degraded', version: pkg.version, uptime: Math.round(process.uptime()) });
    }
    if (u.pathname === '/metrics') { // Prometheus-style numbers. In production only with METRICS_TOKEN set and sent as a Bearer token.
        const token = process.env.METRICS_TOKEN;
        if (PROD && (!token || req.headers.authorization !== 'Bearer ' + token)) {
            res.writeHead(token ? 401 : 404);
            return res.end();
        }
        res.writeHead(200, { 'Content-Type': 'text/plain; version=0.0.4', 'Cache-Control': 'no-store' });
        return res.end(observe.metricsText());
    }
    observe.start(req, res, u);
    if (u.pathname.startsWith('/api/v1/')) { // versioned address: /api/v1/x is the same as /api/x. A future breaking change goes to /api/v2 while v1 keeps working for old app copies.
        u.pathname = '/api/' + u.pathname.slice('/api/v1/'.length);
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
    res.setHeader('Content-Security-Policy', "frame-ancestors 'none'"); // the page's own CSP is a <meta> tag, which cannot say this one; the two are combined by the browser
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
        res.setHeader('X-API-Version', '1');
        const ip = ipOf(req);
        const sk = STRICT[req.method + ' ' + u.pathname];
        if (limited('a:' + ip, API_PER_MIN, 60e3) || (sk && limited(req.method + u.pathname + ':' + ip, sk[0], sk[1]))) {
            observe.countLimited();
            res.writeHead(429, { 'Content-Type': 'application/json', 'Retry-After': '60' });
            return res.end(JSON.stringify({ error: 'Too many requests. Please wait a bit and try again.' }));
        }
        if (observe.inflight() > MAX_INFLIGHT) {
            observe.countShed();
            res.writeHead(503, { 'Content-Type': 'application/json', 'Retry-After': '2' });
            return res.end(JSON.stringify({ error: 'The server is busy. Please try again in a moment.' }));
        }
        if (READ_ONLY && !['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
            res.writeHead(503, { 'Content-Type': 'application/json', 'Retry-After': '30' });
            return res.end(JSON.stringify({ error: 'Fyndr is in read-only mode for maintenance. You can browse, but changes are paused. Please try again soon.', code: 'READ_ONLY' }));
        }
        if (CHAOS.ms) {
            await new Promise(r => setTimeout(r, CHAOS.ms));
        }
        if (CHAOS.err && Math.random() < CHAOS.err) {
            res.writeHead(503, { 'Content-Type': 'application/json', 'Retry-After': '1' });
            return res.end(JSON.stringify({ error: 'Injected failure (CHAOS_ERROR_RATE)' }));
        }
        return handleApi(req, res, u);
    }
    serveStatic(req, res, u);
});
server.keepAliveTimeout = 65e3; // longer than the host's load balancer (60 s), so it never reuses a connection we are about to close
server.headersTimeout = 20e3; // slow-loris protection: a client that dribbles its headers is dropped
server.requestTimeout = 60e3; // a whole request (an upload over a slow phone connection included) must finish within a minute
server.listen(PORT, HOST, () => console.log('Fyndr running on http://localhost:' + PORT + (PROD ? ' (production)' : '')));
require('./jobs/auto-import').start();
const stop = () => {
    draining = true;
    server.close(() => process.exit(0));
    server.closeIdleConnections?.();
    setTimeout(() => process.exit(0), 8000).unref();
};
process.on('SIGTERM', stop);
process.on('SIGINT', stop);
process.on('unhandledRejection', e => observe.log('error', { msg: 'Unhandled rejection', err: String((e && e.stack) || e) }));
process.on('uncaughtException', e => {
    observe.log('error', { msg: 'Uncaught exception', err: String((e && e.stack) || e) });
    process.exit(1);
});

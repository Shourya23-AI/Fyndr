// Zero-dependency Node server: static files + JSON API + role-based auth (user / org / admin)
const http = require('http');
const { PORT, HOST, PROD } = require('./config');
require('./routes');
const handleApi = require('./http/api-handler');
const serveStatic = require('./http/static');
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
    if (u.pathname.startsWith('/api/')) {
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

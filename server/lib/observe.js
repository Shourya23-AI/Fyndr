// Observability in one small file: a request id on every request, one JSON log line per API call, and counters + latency percentiles at /metrics.
// Nothing leaves the process: logs go to stdout (your host's log viewer), metrics are read by whoever you give METRICS_TOKEN to.
const crypto = require('crypto');
const { PROD } = require('../config');

const BUCKETS = [5, 10, 25, 50, 100, 250, 500, 1000, 2500, 5000]; // milliseconds
const stats = {}; // group -> { classes: {'2xx': n}, buckets: [n...], count, sum }
let inflight = 0;
let limited = 0;
let shed = 0;
const group = p => (p.startsWith('/api/') ? 'api' : p.startsWith('/brand') || p.startsWith('/img/') ? 'media' : 'static');
const bucketOf = ms => { const i = BUCKETS.findIndex(b => ms <= b); return i < 0 ? BUCKETS.length : i; };

// Plain text for people, JSON for log tools (production, or LOG_FORMAT=json).
const JSON_LOGS = PROD || process.env.LOG_FORMAT === 'json';
function log(level, o) {
    const line = JSON_LOGS ? JSON.stringify({ t: new Date().toISOString(), level, ...o }) : `[${level}] ${o.msg || ''} ${Object.entries(o).filter(([k]) => k !== 'msg').map(([k, v]) => k + '=' + v).join(' ')}`;
    (level === 'error' ? console.error : level === 'warn' ? console.warn : console.log)(line);
}

// Call once per request, before anything else. Gives the request an id (a safe incoming X-Request-Id is kept so one id can follow a call
// from the browser through the server), and records status + duration when the response ends.
function start(req, res, u) {
    const given = String(req.headers['x-request-id'] || '');
    req.id = /^[\w-]{8,64}$/.test(given) ? given : crypto.randomBytes(6).toString('hex');
    res.setHeader('X-Request-Id', req.id);
    const t0 = process.hrtime.bigint();
    inflight++;
    let done = false;
    const end = () => {
        if (done) {
            return;
        }
        done = true;
        inflight--;
        const ms = Number(process.hrtime.bigint() - t0) / 1e6;
        const g = group(u.pathname);
        const s = stats[g] = stats[g] || { classes: {}, buckets: Array(BUCKETS.length + 1).fill(0), count: 0, sum: 0 };
        const cls = Math.floor((res.statusCode || 0) / 100) + 'xx';
        s.classes[cls] = (s.classes[cls] || 0) + 1;
        s.buckets[bucketOf(ms)]++;
        s.count++;
        s.sum += ms;
        // Static files at 200/304 are not logged (noise). API calls, failures and slow requests are. The query string is never logged (it can hold search text).
        const slow = ms > 1500;
        if (g === 'api' || res.statusCode >= 400 || slow) {
            if (PROD || process.env.LOG_REQUESTS === '1' || res.statusCode >= 500 || slow) {
                log(res.statusCode >= 500 ? 'error' : slow ? 'warn' : 'info', { msg: 'request', id: req.id, method: req.method, path: u.pathname, status: res.statusCode, ms: Math.round(ms) });
            }
        }
    };
    res.on('finish', end);
    res.on('close', end);
}

// p-th percentile as the upper edge of the bucket that contains it (an estimate, never lower than the truth).
function percentile(s, q) {
    if (!s.count) {
        return 0;
    }
    let seen = 0;
    for (let i = 0; i < s.buckets.length; i++) {
        seen += s.buckets[i];
        if (seen >= q * s.count) {
            return i < BUCKETS.length ? BUCKETS[i] : BUCKETS[BUCKETS.length - 1] * 2;
        }
    }
    return 0;
}

function metricsText() {
    const out = [];
    const line = (name, labels, v) => out.push(`${name}${labels ? '{' + labels + '}' : ''} ${v}`);
    out.push('# TYPE fyndr_http_requests_total counter');
    for (const [g, s] of Object.entries(stats)) {
        for (const [c, n] of Object.entries(s.classes)) {
            line('fyndr_http_requests_total', `group="${g}",class="${c}"`, n);
        }
    }
    out.push('# TYPE fyndr_http_request_duration_ms histogram');
    for (const [g, s] of Object.entries(stats)) {
        let cum = 0;
        BUCKETS.forEach((b, i) => { cum += s.buckets[i]; line('fyndr_http_request_duration_ms_bucket', `group="${g}",le="${b}"`, cum); });
        line('fyndr_http_request_duration_ms_bucket', `group="${g}",le="+Inf"`, s.count);
        line('fyndr_http_request_duration_ms_sum', `group="${g}"`, Math.round(s.sum));
        line('fyndr_http_request_duration_ms_count', `group="${g}"`, s.count);
    }
    out.push('# TYPE fyndr_http_latency_ms gauge');
    for (const [g, s] of Object.entries(stats)) {
        for (const q of [0.5, 0.95, 0.99]) {
            line('fyndr_http_latency_ms', `group="${g}",quantile="${q}"`, percentile(s, q));
        }
    }
    const m = process.memoryUsage();
    out.push('# TYPE fyndr_inflight_requests gauge');
    line('fyndr_inflight_requests', '', inflight);
    line('fyndr_rate_limited_total', '', limited);
    line('fyndr_load_shed_total', '', shed);
    line('fyndr_process_uptime_seconds', '', Math.round(process.uptime()));
    line('fyndr_process_heap_used_bytes', '', m.heapUsed);
    line('fyndr_process_rss_bytes', '', m.rss);
    return out.join('\n') + '\n';
}

module.exports = {
    start, log, metricsText, percentile, stats,
    inflight: () => inflight,
    countLimited: () => limited++,
    countShed: () => shed++
};

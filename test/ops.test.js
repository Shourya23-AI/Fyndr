// Checks for operations features: schema migrations, daily backups, percentiles, and a REAL server started on a free port
// (health/readiness, request ids, API versioning, metrics access, load shedding, fault injection).  Run:  node test/ops.test.js
const fs = require('fs');
const os = require('os');
const net = require('net');
const path = require('path');
const { spawn } = require('child_process');
const migrate = require('../server/db/migrate');
const dailyBackup = require('../server/db/backup');
const observe = require('../server/lib/observe');
const pkg = require('../package.json');

let pass = 0, fail = 0;
const ok = (c, n) => { c ? pass++ : (fail++, console.log('  FAIL', n)); };
const ROOT = path.join(__dirname, '..');
const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'fyndr-ops-'));

const freePort = () => new Promise(res => { const s = net.createServer().listen(0, () => { const p = s.address().port; s.close(() => res(p)); }); });
async function boot(env = {}) {
    const port = await freePort();
    const child = spawn(process.execPath, ['server.js'], { cwd: ROOT, env: { ...process.env, PORT: String(port), HOST: '127.0.0.1', DATA_DIR: tmp(), NODE_ENV: 'development', ...env }, stdio: 'ignore' });
    const url = 'http://127.0.0.1:' + port;
    for (let i = 0; i < 60; i++) {
        try { if ((await fetch(url + '/healthz')).ok) { return { url, child }; } } catch { }
        await new Promise(r => setTimeout(r, 100));
    }
    child.kill();
    throw new Error('server did not start');
}
const stop = s => new Promise(res => { s.child.once('exit', code => res(code)); s.child.kill('SIGTERM'); });

(async () => {
    // ---- schema migrations
    const old = { users: [{ id: 'u' }], listings: [] }; // an old file: no schemaVersion, some lists missing
    const m1 = migrate(old);
    ok(m1.from === 0 && m1.to >= 1 && old.schemaVersion === m1.to, 'an old file is brought to the current schema version');
    ok(Array.isArray(old.applications) && Array.isArray(old.saved) && Array.isArray(old.adminLog) && old.users.length === 1, 'missing lists are added, existing data is kept');
    const m2 = migrate(old);
    ok(m2.from === m2.to, 'running it again changes nothing');
    let threw = false;
    try { migrate({ schemaVersion: 999 }); } catch { threw = true; }
    ok(threw, 'a file from a NEWER version is refused instead of being damaged');

    // ---- daily backups
    const dir = tmp();
    const file = path.join(dir, 'data.json');
    fs.writeFileSync(file, '{"v":1}');
    const day = n => Date.UTC(2026, 0, n, 12);
    ok(dailyBackup(file, day(1)) === true && dailyBackup(file, day(1)) === false, 'one backup per day');
    for (let d = 2; d <= 10; d++) { dailyBackup(file, day(d)); }
    const kept = fs.readdirSync(dir).filter(f => f.includes('.daily-')).sort();
    ok(kept.length === 7 && kept[0].endsWith('20260104') && kept[6].endsWith('20260110'), 'only the newest 7 daily backups are kept');

    // ---- latency percentiles
    const s = { count: 100, buckets: Array(11).fill(0) };
    s.buckets[0] = 90; // 90 requests under 5 ms
    s.buckets[6] = 9; // 9 under 500 ms
    s.buckets[10] = 1; // 1 over 5 s
    ok(observe.percentile(s, 0.5) === 5 && observe.percentile(s, 0.95) === 500 && observe.percentile(s, 0.99) === 500 && observe.percentile(s, 1) === 10000, 'p50 / p95 / p99 are read from the histogram');

    // ---- a real server
    const a = await boot();
    let r = await fetch(a.url + '/readyz');
    let j = await r.json();
    ok(r.status === 200 && j.status === 'ready' && j.version === pkg.version, '/readyz says ready and reports the version');
    r = await fetch(a.url + '/api/listings');
    ok(r.status === 401 && r.headers.get('x-api-version') === '1', 'API calls carry X-API-Version');
    const id = r.headers.get('x-request-id');
    ok(/^[\w-]{8,64}$/.test(id), 'every response has a request id');
    r = await fetch(a.url + '/api/v1/listings');
    ok(r.status === 401, '/api/v1/... is the same API as /api/...');
    r = await fetch(a.url + '/api/listings', { headers: { 'X-Request-Id': 'trace-abc12345' } });
    ok(r.headers.get('x-request-id') === 'trace-abc12345', 'a valid incoming request id is kept (one id from browser to log)');
    r = await fetch(a.url + '/api/listings', { headers: { 'X-Request-Id': 'bad id\twith spaces' } });
    ok(r.headers.get('x-request-id') !== 'bad id\twith spaces', 'an unsafe request id is replaced');
    const text = await (await fetch(a.url + '/metrics')).text();
    ok(/fyndr_http_requests_total\{group="api",class="4xx"\} [1-9]/.test(text) && text.includes('fyndr_http_latency_ms{group="api",quantile="0.99"}') && text.includes('fyndr_process_heap_used_bytes'), '/metrics shows request counts, p99 latency and memory');
    ok((await stop(a)) === 0, 'SIGTERM shuts the server down cleanly (exit code 0)');

    const shed = await boot({ MAX_INFLIGHT: '0' });
    r = await fetch(shed.url + '/api/listings');
    ok(r.status === 503 && r.headers.get('retry-after') === '2', 'above MAX_INFLIGHT the server sheds load with 503 + Retry-After');
    r = await fetch(shed.url + '/healthz');
    ok(r.status === 200, 'health checks still answer while shedding');
    await stop(shed);

    const chaos = await boot({ CHAOS_ERROR_RATE: '1' });
    r = await fetch(chaos.url + '/api/listings');
    ok(r.status === 503, 'CHAOS_ERROR_RATE injects failures (for rehearsals)');
    await stop(chaos);

    const ro = await boot({ READ_ONLY: '1' });
    r = await fetch(ro.url + '/api/listings');
    ok(r.status === 401, 'read-only mode: reading still reaches the API');
    r = await fetch(ro.url + '/api/apply/x', { method: 'POST' });
    j = await r.json();
    ok(r.status === 503 && j.code === 'READ_ONLY' && r.headers.get('retry-after') === '30', 'read-only mode: changes are refused with a clear message');
    await stop(ro);

    const { dropExpired } = await import('../public/js/features/listings/expiry.js');
    const NOW = Date.parse('2026-10-16T00:00:00Z');
    const L = (id, ageDays) => ({ id, status: 'approved', created: new Date(NOW - ageDays * 864e5).toISOString() });
    ok(dropExpired([L('a', 1), L('b', 5), L('c', 200)], NOW).map(x => x.id).join() === 'a,b', 'expired listings are hidden');
    const six = [L('a', 1), L('b', 2), L('c', 3), L('d', 4), L('e', 5), L('f', 6)];
    ok(dropExpired(six, NOW + 800 * 864e5).length === 6, 'a device clock far in the future does not empty the list');

    const prod = await boot({ NODE_ENV: 'production', CHAOS_ERROR_RATE: '1', METRICS_TOKEN: 'secret-token' });
    r = await fetch(prod.url + '/api/listings');
    ok(r.status === 401, 'in production the fault injection is ignored');
    ok((await fetch(prod.url + '/metrics')).status === 401, 'in production /metrics needs the token');
    ok((await fetch(prod.url + '/metrics', { headers: { Authorization: 'Bearer secret-token' } })).status === 200, '... and works with it');
    await stop(prod);
    const prod2 = await boot({ NODE_ENV: 'production' });
    ok((await fetch(prod2.url + '/metrics')).status === 404, 'in production without METRICS_TOKEN /metrics does not exist');
    await stop(prod2);

    console.log('\n' + pass + ' passed, ' + fail + ' failed');
    process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });

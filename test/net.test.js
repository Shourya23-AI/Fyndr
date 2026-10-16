// Checks for the resilient fetch (public/js/core/net.js): timeouts, retries, backoff, circuit breaker.  Run:  node test/net.test.js
import { fetchRetry, makeBreaker } from '../public/js/core/net.js';

let pass = 0, fail = 0;
const ok = (c, n) => { c ? pass++ : (fail++, console.log('  FAIL', n)); };
const res = (status, retryAfter) => ({ status, ok: status < 400, headers: { get: k => (k === 'Retry-After' ? retryAfter : null) }, json: async () => ({}) });
// a fake fetch that plays back a list of outcomes (a number = a response with that status, an Error = a network failure)
const script = list => { const f = async () => { f.calls++; const x = list[Math.min(f.calls - 1, list.length - 1)]; if (x instanceof Error) { throw x; } return res(x); }; f.calls = 0; return f; };
const base = (fetchFn, extra = {}) => ({ fetchFn, wait: async ms => { base.waits.push(ms); }, rand: () => 1, breaker: makeBreaker(), ...extra });
base.waits = [];
const err = async p => { try { await p; return null; } catch (e) { return e; } };
const reset = () => { base.waits = []; };

// ---- reads are retried
let f = script([503, 503, 200]);
let r = await fetchRetry('/x', { method: 'GET' }, base(f));
ok(r.status === 200 && f.calls === 3, 'GET: two 503s, then success');
ok(base.waits.length === 2 && base.waits[1] > base.waits[0], 'the wait grows each time (exponential backoff)');
reset();
f = script([new Error('offline'), 200]);
r = await fetchRetry('/x', {}, base(f));
ok(r.status === 200 && f.calls === 2, 'GET: a network error is retried');
f = script([503]);
r = await fetchRetry('/x', {}, base(f));
ok(r.status === 503 && f.calls === 3, 'GET: gives up after 3 tries and returns the last answer');
f = script([400]);
await fetchRetry('/x', {}, base(f));
ok(f.calls === 1, 'a 400 is never retried');
f = script([401]);
await fetchRetry('/x', {}, base(f));
ok(f.calls === 1, 'a 401 is never retried');

// ---- creating things is only repeated when nothing was done
f = script([502, 200]);
r = await fetchRetry('/x', { method: 'POST' }, base(f));
ok(r.status === 502 && f.calls === 1, 'POST: 502 is NOT retried (it may have been processed)');
f = script([new Error('offline'), 200]);
ok((await err(fetchRetry('/x', { method: 'POST' }, base(f)))).code === 'NETWORK' && f.calls === 1, 'POST: a network error is NOT retried');
f = script([503, 200]);
r = await fetchRetry('/x', { method: 'POST' }, base(f));
ok(r.status === 200 && f.calls === 2, 'POST: 503 means "not processed", so it is retried');
f = script([429, 200]);
r = await fetchRetry('/x', { method: 'POST' }, base(f));
ok(r.status === 200 && f.calls === 2, 'POST: 429 is retried');
f = script([502, 200]);
r = await fetchRetry('/x', { method: 'DELETE' }, base(f));
ok(r.status === 200 && f.calls === 2, 'DELETE is idempotent, so it is retried');

// ---- Retry-After
reset();
f = { calls: 0 };
const ra = async () => { f.calls++; return f.calls === 1 ? res(503, '3') : res(200); };
await fetchRetry('/x', {}, base(ra));
ok(base.waits[0] === 3000, 'Retry-After: 3 waits 3 seconds');
f = script([503, 200]);
f = async () => { f.calls++; return res(503, '30'); };
f.calls = 0;
r = await fetchRetry('/x', {}, base(f));
ok(r.status === 503 && f.calls === 1, 'a long Retry-After (maintenance) is not waited out: the message is shown at once');

// ---- timeout
const hang = (url, init) => new Promise((_, no) => init.signal.addEventListener('abort', () => no(Object.assign(new Error('aborted'), { name: 'AbortError' }))));
let e = await err(fetchRetry('/x', { method: 'POST' }, base(hang, { timeout: 20 })));
ok(e && e.code === 'TIMEOUT', 'a request that hangs is cancelled with a friendly TIMEOUT error');

// ---- circuit breaker
let t = 0;
const br = makeBreaker({ threshold: 3, cooldown: 1000, now: () => t });
const down = script([500]);
for (let i = 0; i < 3; i++) { await fetchRetry('/x', { method: 'POST' }, base(down, { breaker: br })); }
e = await err(fetchRetry('/x', {}, base(down, { breaker: br })));
ok(e && e.code === 'BREAKER_OPEN', 'after repeated failures the breaker opens and calls fail fast');
const callsBefore = down.calls;
await err(fetchRetry('/x', {}, base(down, { breaker: br })));
ok(down.calls === callsBefore, 'an open breaker sends nothing to the server');
t = 1500;
const up = script([200]);
r = await fetchRetry('/x', {}, base(up, { breaker: br }));
ok(r.status === 200, 'after the cooldown a request is let through');
r = await fetchRetry('/x', {}, base(up, { breaker: br }));
ok(r.status === 200, 'and a success closes the breaker again');
const rate = script([429]);
const br2 = makeBreaker({ threshold: 2, cooldown: 1000, now: () => 0 });
for (let i = 0; i < 4; i++) { await fetchRetry('/x', { method: 'POST' }, base(rate, { breaker: br2 })); }
ok(!(await err(fetchRetry('/x', {}, base(script([200]), { breaker: br2 })))), 'being rate limited (429) does not trip the breaker');

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);

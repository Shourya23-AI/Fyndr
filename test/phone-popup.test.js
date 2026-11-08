// The phone.email popup hand-over: opening, blocked popups, the result arriving, a window that closes without a result, cancelling,
// and the trail shown under "Technical details".  Run:  node test/phone-popup.test.js
let pass = 0, fail = 0;
const ok = (c, n) => { c ? pass++ : (fail++, console.log('  FAIL', n)); };
const wait = ms => new Promise(r => setTimeout(r, ms));
const mem = () => { const m = {}; return { getItem: k => m[k] ?? null, setItem: (k, v) => { m[k] = String(v); }, removeItem: k => { delete m[k]; } }; };

global.window = globalThis;
global.location = { href: 'https://fyndr.test/#/phone', origin: 'https://fyndr.test', hash: '#/phone', search: '', pathname: '/' };
global.screen = { width: 1200, height: 800 };
Object.defineProperty(globalThis, 'navigator', { value: { userAgent: 'node' }, configurable: true });
global.document = { querySelector: () => null };
global.addEventListener = () => {};
global.removeEventListener = () => {};
global.sessionStorage = mem();
global.localStorage = mem();
const { startLogin, phoneTrail, readPhoneTrail, clearPhoneTrail } = await import('../public/js/services/phone-email/phone-email.js');

let opened = [];
let popup;
const makePopup = () => (popup = { closed: false, close() { this.closed = true; } });
window.open = (...a) => { opened.push(a); return a.__blocked ? null : makePopup(); };
const sendResult = token => { const c = new BroadcastChannel('fyndr-phone'); c.postMessage({ type: 'fyndr-phone-token', token }); setTimeout(() => c.close(), 50); };

// 1. blocked popup: an error the person can read, never a same-tab fallback
window.open = () => null;
let err; try { startLogin('cid'); } catch (e) { err = e; }
ok(err && /Allow pop-ups/.test(err.message), 'blocked popup -> message asking to allow pop-ups');
ok(/blocked/.test(readPhoneTrail()), 'blocked popup is in the trail');

// 2. normal hand-over through the callback page's broadcast
window.open = (...a) => { opened.push(a); return makePopup(); };
let w = startLogin('cid', { pollMs: 10, stallMs: 80 });
ok(opened.length === 1 && /^https:\/\/www\.phone\.email\/auth\/log-in\?client_id=cid&redirect_url=/.test(opened[0][0]) && opened[0][1] === 'peLoginWindow', 'opens phone.email log-in in the named popup window');
ok(/phone-callback\.html/.test(decodeURIComponent(opened[0][0])), 'redirect_url is our callback page');
let acked = false;
const spy = new BroadcastChannel('fyndr-phone'); spy.onmessage = e => { if (e.data.type === 'fyndr-phone-ack') acked = true; };
sendResult('tok123');
ok(await w === 'tok123', 'result arrives');
await wait(30);
ok(acked, 'the callback page is told we have it');
ok(/result received/.test(readPhoneTrail()) && /opened/.test(readPhoneTrail()), 'trail shows opened + result received');

// 3. window closes and nothing comes back: reported once, nothing is cancelled, a late result still works
let stalls = 0;
w = startLogin('cid', { pollMs: 10, stallMs: 80, onStall: () => stalls++ });
let settled = false; w.then(() => { settled = true; }, () => { settled = true; });
popup.closed = true;
await wait(40);
ok(stalls === 0, 'not reported straight away');
await wait(150);
ok(stalls === 1, 'reported once after the window stayed closed: ' + stalls);
ok(!settled, 'the attempt is still waiting (a "closed" window is only reported, never acted on)');
ok(/closed.*no result reached this page/s.test(readPhoneTrail()), 'trail explains it');
sendResult('late');
ok(await w === 'late', 'a late result is still accepted');
await wait(150);
ok(stalls === 1, 'no more reports after the attempt ended');

// 4. open window never reports a stall
stalls = 0;
w = startLogin('cid', { pollMs: 10, stallMs: 50, onStall: () => stalls++ });
await wait(200);
ok(stalls === 0, 'open window: no stall report');

// 5. cancel closes the popup, rejects, stops the watcher and says so in the trail
let rejected;
w.catch(x => { rejected = x; });
w.cancel();
await wait(20);
ok(popup.closed && rejected && rejected.cancelled, 'cancel closes the window and rejects');
ok(/cancelled the attempt/.test(readPhoneTrail()), 'trail says this page cancelled it');
await wait(120);
ok(stalls === 0, 'watcher is stopped after cancel');

// 6. trail helpers: newest 30 lines only, long lines cut
clearPhoneTrail();
for (let i = 0; i < 40; i++) phoneTrail('line ' + i);
phoneTrail('x'.repeat(500));
const lines = readPhoneTrail().split('\n');
ok(lines.length === 30 && lines.at(-1).length <= 209 && /line 11/.test(lines[0]) === true, 'trail keeps the newest 30 lines: ' + lines.length);
spy.close();

// 7. the callback page writes into the same trail and sends the person back to Fyndr
clearPhoneTrail();
const el = () => ({ textContent: '', hidden: true, href: '' });
const els = { m: el(), b: el(), back: el() };
global.document = { getElementById: id => id === 'b' ? els.b : els.m };
let replaced = '';
global.location = { href: 'https://fyndr.test/phone-callback.html?access_token=abc', origin: 'https://fyndr.test', hash: '', search: '?access_token=abc', pathname: '/phone-callback.html', replace: u => { replaced = u; } };
global.history = { replaceState: () => {} };
await import('../public/phone-callback.js');
await wait(1100);
ok(replaced === 'index.html#/phone?token=abc', 'callback page returns to the app with the token: ' + replaced);
ok(/callback page opened: result received, no opener window/.test(readPhoneTrail()) && /going back to Fyndr/.test(readPhoneTrail()), 'callback page writes to the trail');

console.log(`${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);

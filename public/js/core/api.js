import { fb } from '../services/firebase/firebase-init.js';
import { localApi } from '../services/local-api/local-api.js';
// Every call to the backend goes through api(): the Node server normally, or the browser-only localApi in Live Server mode.
//
// Client data cache: GET requests for the lists below are kept in memory for a few seconds, so moving between pages and tabs
// does not hit the network each time. Identical requests made at the same moment share one network call.
// Any change (POST / PUT / PATCH / DELETE) or sign-out empties the cache, so you never see your own edits stale.
const FRESH = [[/^\/me$/, 30e3], [/^\/listings(\?|$)/, 45e3], [/^\/my$/, 15e3], [/^\/admin\/data$/, 10e3], [/^\/profile$/, 20e3], [/^\/org\/(listings|applications)$/, 10e3]];
const mem = new Map(); // key -> { t, d } | { p } (in flight)
const PERSIST = /^\/listings(\?|$)/; // listings are also kept on this device so a reload can draw them instantly
const ttl = p => (FRESH.find(([re]) => re.test(p)) || [])[1] || 0;
const uidKey = () => fb.user()?.uid || fb.user()?.email || 'anon';
const clone = d => JSON.parse(JSON.stringify(d));
export function clearApiCache() {
    mem.clear();
}
// Last listings seen on this device (or null). Shown straight away while fresh ones load.
export function peekCached(p) {
    try {
        const r = JSON.parse(localStorage.getItem('fyndr-c:' + uidKey() + p));
        return r && Date.now() - r.t < 6 * 3600e3 ? r.d : null;
    } catch {
        return null;
    }
}
export function forgetDeviceCache() {
    try {
        Object.keys(localStorage).filter(k => k.startsWith('fyndr-c:') || k === 'fyndr-me').forEach(k => localStorage.removeItem(k));
    } catch { }
    clearApiCache();
}
async function call(p, m, b) {
    const t = await fb.token();
    const r = await fetch('/api' + p, {
        method: m, headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + t }, body: b ? JSON.stringify(b) : undefined
    });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) {
        const e = new Error(d.error || 'Something went wrong');
        e.code = d.code;
        throw e;
    }
    return d;
}
export async function api(p, m = 'GET', b) {
    await fb.ready();
    if (fb.local) {
        const u = fb.user();
        return localApi(p, m, b, u && {
            uid: u.uid, email: u.email, displayName: u.displayName, phoneNumber: u.phoneNumber
        });
    }
    if (m !== 'GET') {
        try {
            return await call(p, m, b);
        } finally {
            clearApiCache();
        }
    }
    const life = ttl(p);
    if (!life) {
        return call(p, m, b);
    }
    const key = uidKey() + p;
    const hit = mem.get(key);
    if (hit?.p) {
        return clone(await hit.p);
    }
    if (hit && Date.now() - hit.t < life) {
        return clone(hit.d);
    }
    const pr = call(p, m, b);
    mem.set(key, { p: pr });
    try {
        const d = await pr;
        mem.set(key, { t: Date.now(), d });
        if (PERSIST.test(p)) {
            try {
                localStorage.setItem('fyndr-c:' + key.split('/')[0] + p, JSON.stringify({ t: Date.now(), d }));
            } catch { } // storage full or blocked: fine, it is only a speed-up
        }
        return clone(d);
    } catch (e) {
        mem.delete(key);
        throw e;
    }
}

import { fb } from '../services/firebase/firebase-init.js';
import { API_BASE } from './api-base.js';
import { fetchRetry } from './net.js';
import { fireApi } from '../services/firestore-api/fire-api.js';
import { loadCatalog, mergeCatalog, catSaved, toggleCatSaved } from '../features/catalog/catalog.js';
// Every call to the backend goes through api(): the Node server normally, or Firebase Firestore directly when there is no server (GitHub Pages).
//
// Client data cache: GET requests for the lists below are kept in memory for a few seconds, so moving between pages and tabs
// does not hit the network each time. Identical requests made at the same moment share one network call.
// Any change (POST / PUT / PATCH / DELETE) or sign-out empties the cache, so you never see your own edits stale.
const FRESH = [[/^\/me$/, 30e3], [/^\/listings(\?|$)/, 120e3], [/^\/my$/, 15e3], [/^\/admin\/data$/, 10e3], [/^\/profile$/, 20e3], [/^\/org\/(listings|applications)$/, 10e3]];
const mem = new Map(); // key -> { t, d } | { p } (in flight)
const PERSIST = /^\/listings(\?|$)/; // listings are also kept on this device so a reload can draw them instantly
const ttl = p => (FRESH.find(([re]) => re.test(p)) || [])[1] || 0;
const uidKey = () => fb.user()?.uid || fb.user()?.email || 'anon';
const clone = d => (typeof structuredClone === 'function' ? structuredClone(d) : JSON.parse(JSON.stringify(d)));
export function clearApiCache() {
    mem.clear();
}
export function forgetDeviceCache() {
    try {
        Object.keys(localStorage).filter(k => k.startsWith('fyndr-c:') || k === 'fyndr-me' || k === 'fyndr-catsaved').forEach(k => localStorage.removeItem(k));
    } catch { }
    clearApiCache();
}
async function call(p, m, b) {
    const t = await fb.token();
    const r = await fetchRetry(API_BASE + '/api' + p, {
        method: m, headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + t }, body: b ? JSON.stringify(b) : undefined
    });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) {
        // An unexpected server failure comes with a reference that finds the exact log line: shown so a user can quote it.
        const e = new Error((d.error || 'Something went wrong') + (d.requestId ? ' (ref ' + d.requestId + ')' : ''));
        e.code = d.code;
        throw e;
    }
    return d;
}
// Public entry. Adds the built-in catalog to listing requests and keeps catalog saves on this device; everything else goes straight through.
export async function api(p, m = 'GET', b) {
    if (m === 'GET' && /^\/listings(\?|$)/.test(p)) {
        const [rows, cat] = await Promise.all([apiCore(p, m, b), loadCatalog()]);
        return mergeCatalog(rows, cat, p);
    }
    if (m === 'POST' && /^\/save\/cat_/.test(p)) {
        return toggleCatSaved(p.slice('/save/'.length));
    }
    if (m === 'GET' && p === '/my') {
        const [d] = await Promise.all([apiCore(p, m, b), loadCatalog()]); // (the catalog being loaded also moves older saved items to their new ids)
        return d && Array.isArray(d.saved) ? { ...d, saved: d.saved.concat(catSaved()) } : d;
    }
    return apiCore(p, m, b);
}
async function apiCore(p, m = 'GET', b) {
    await fb.ready();
    const u = fb.user();
    const net = fb.local ? (p2, m2, b2) => fireApi(p2, m2, b2, u && {
        uid: u.uid, email: u.email, displayName: u.displayName, phoneNumber: u.phoneNumber
    }) : call;
    if (m !== 'GET') {
        try {
            return await net(p, m, b);
        } finally {
            clearApiCache();
        }
    }
    const life = ttl(p);
    if (!life) {
        return net(p, m, b);
    }
    const key = uidKey() + p;
    const hit = mem.get(key);
    if (hit?.p) {
        return clone(await hit.p);
    }
    if (hit && Date.now() - hit.t < life) {
        return clone(hit.d);
    }
    const pr = net(p, m, b);
    mem.set(key, { p: pr });
    try {
        const d = await pr;
        mem.set(key, { t: Date.now(), d });
        if (!fb.local && PERSIST.test(p)) { // (not in Firestore mode: listings carry pictures, too big for localStorage)
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

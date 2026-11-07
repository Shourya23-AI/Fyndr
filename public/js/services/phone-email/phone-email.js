// phone.email helpers: read the Client ID, open the login popup, wait for the token it returns.
import { API_BASE } from '../../core/api-base.js';
let cid;
export async function phoneClientId() {
    if (cid !== undefined) {
        return cid;
    }
    try {
        const r = await fetch(API_BASE ? API_BASE + '/api/phone-config' : 'api/phone-config');
        if (!r.ok) {
            throw 0;
        }
        cid = (await r.json()).clientId;
    } catch {
        try {
            cid = (await (await fetch('config/phone-email.json')).json()).clientId;
        } catch {
            cid = null;
        }
    } // Live Server mode has no /api
    if (!cid || /^YOUR/i.test(cid)) {
        cid = null;
    }
    return cid;
}
const CHANNEL = 'fyndr-phone';
const TOKEN_KEY = 'fyndr-phone-token';

function loginUrl(id) {
    const redirect = new URL('phone-callback.html', location.href).href;
    return 'https://www.phone.email/auth/log-in?client_id=' + encodeURIComponent(id) + '&redirect_url=' + encodeURIComponent(redirect);
}

// phone.email only works as a popup (or new tab) opened by this page: when the number is confirmed, phone.email's own page sets
// window.opener.location to our callback page and closes itself. Opened in this same tab there is no opener, so its script fails with
// "TypeError: window.opener is null" (reading .location) and the login never finishes. That is why there is no
// same-tab mode here (Firefox, Zen and phones included): always window.open() straight from the click.

// phone-callback.html returns to  #/phone?token=...  . Called by the router on every navigation: moves the token out of the
// address bar into storage (so a redirect to another page can't lose it) and cleans the URL.
export function capturePhoneToken() {
    const h = location.hash;
    const i = h.indexOf('?');
    if (!h.startsWith('#/phone') || i < 0) {
        return;
    }
    const t = new URLSearchParams(h.slice(i + 1)).get('token');
    history.replaceState(null, '', location.pathname + location.search + '#/phone');
    if (t) {
        for (const store of [sessionStorage, localStorage]) {
            try {
                store.setItem(TOKEN_KEY, t);
            } catch { } // storage can be blocked by privacy settings
        }
    }
}

// Token left behind by phone-callback.html when it could not hand it to an open tab. phone.email sends the opener tab itself to the
// callback page, so this is the normal way the token reaches the app.
export function takePendingToken() {
    let token = '';
    for (const store of [sessionStorage, localStorage]) {
        try {
            token = token || store.getItem(TOKEN_KEY) || '';
            store.removeItem(TOKEN_KEY);
        } catch {} // storage can be blocked by privacy settings
    }
    return token;
}

// Opens the popup and resolves with the access_token. Must be called straight from a click so popup blockers allow it.
// Throws { message } when the browser blocks the popup.
// `wait.cancel()` stops listening. (We do not poll popup.closed: some browsers report it as closed once the popup visits another site.)
export function startLogin(id) {
    const url = loginUrl(id);
    const left = (screen.width - 500) / 2;
    const top = (screen.height - 600) / 2;
    const popup = window.open(url, 'peLoginWindow', 'toolbar=0,scrollbars=0,location=0,statusbar=0,menubar=0,resizable=0,width=500,height=560,top=' + top + ',left=' + left);
    if (!popup) {
        // Blocked. Do NOT continue in this tab (see above): ask the person to allow the popup and press the button again.
        throw { message: 'Your browser blocked the phone.email window. Allow pop-ups for this site (look for the icon in the address bar), then press the button again.' };
    }
    let stop;
    let reject;
    const wait = new Promise((resolve, rej) => {
        reject = rej;
        const channel = 'BroadcastChannel' in window ? new BroadcastChannel(CHANNEL) : null;
        const onMessage = msg => {
            if (msg && msg.type === 'fyndr-phone-token' && msg.token) {
                channel && channel.postMessage({ type: 'fyndr-phone-ack' }); // tells the callback page we have it
                stop();
                resolve(msg.token);
            }
        };
        const onWindowMessage = e => {
            if (e.origin === location.origin) {
                onMessage(e.data);
            }
        };
        if (channel) {
            channel.onmessage = e => onMessage(e.data);
        }
        addEventListener('message', onWindowMessage);
        stop = () => {
            channel && channel.close();
            removeEventListener('message', onWindowMessage);
        };
    });
    // Attached after construction: referencing `wait` inside the executor throws (it is not initialised yet).
    wait.cancel = () => {
        stop();
        try {
            popup.close();
        } catch {}
        reject({ cancelled: true });
    };
    return wait;
}

// Reads a phone.email answer into "+<country><number>" or null. phone.email answers differ between setups, so the field names the Node server
// accepts are accepted here too, and only an explicit non-200 status is a refusal.
export function parsePhone(d) {
    if (!d || typeof d !== 'object') {
        return null;
    }
    const cc = String(d.country_code ?? d.user_country_code ?? '').replace(/\D/g, '');
    const no = String(d.phone_no ?? d.user_phone_number ?? d.phone_number ?? '').replace(/\D/g, '');
    const ok = d.status === undefined || Number(d.status) === 200;
    const ph = ok && no ? '+' + cc + no : '';
    return /^\+\d{8,15}$/.test(ph) ? ph : null;
}

// Browser-only (no server) mode: ask phone.email directly. The token is either an access_token (checked with their getuser API)
// or, in some setups, a user_json_url on a phone.email address. One retry, because their API is sometimes slow.
export async function lookupPhone(token, id) {
    token = String(token || '').trim();
    if (!token || token.length > 4000) {
        return null;
    }
    const viaUrl = /^https:\/\/[a-z0-9.-]+\.phone\.email\//i.test(token);
    let last;
    for (let i = 0; i < 2; i++) {
        try {
            let r;
            if (viaUrl) {
                r = await fetch(token);
            } else {
                const fd = new FormData();
                fd.append('access_token', token);
                fd.append('client_id', id);
                r = await fetch('https://eapi.phone.email/getuser', { method: 'POST', body: fd });
            }
            const d = await r.json();
            const ph = parsePhone(d);
            if (ph) {
                return ph;
            }
            console.warn('phone.email did not accept the token. status=' + (d && d.status) + ' message=' + ((d && d.message) || '') + ' keys=' + Object.keys(d || {}).join(','));
            return null; // an answer that says no is final; only a network failure is retried
        } catch (e) {
            last = e;
        }
    }
    throw last || new Error('phone.email unreachable');
}

// Optional: the address of the server-side check (functions/index.js, "verifyPhone"). When config/phone-email.json has a "verifyUrl",
// the number is verified and saved by that server and the browser can no longer claim a number by itself. Empty = the older browser-side check.
let verifyUrl;
export async function phoneVerifyUrl() {
    if (verifyUrl === undefined) {
        try {
            const u = String((await (await fetch('config/phone-email.json')).json()).verifyUrl || '');
            verifyUrl = /^https:\/\/[^\s"<>]+$/.test(u) ? u : '';
        } catch {
            verifyUrl = '';
        }
    }
    return verifyUrl;
}

import { fb } from '../services/firebase/firebase-init.js';
import { localApi } from '../services/local-api/local-api.js';
// Every call to the backend goes through api(): the Node server normally, or the browser-only localApi in Live Server mode.
export async function api(p, m = 'GET', b) {
    if (fb.local) {
        const u = fb.user();
        return localApi(p, m, b, u && {
            uid: u.uid, email: u.email, displayName: u.displayName, phoneNumber: u.phoneNumber
        });
    }
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

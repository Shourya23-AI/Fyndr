import { S } from '../../core/state.js';
import { api, forgetDeviceCache } from '../../core/api.js';
import { fb } from '../../services/firebase/firebase-init.js';
// Loads the signed-in user's profile into S.me and says which gate (if any) they are stuck behind.
export async function loadMe() {
    S.me = null;
    const u = fb.user();
    if (!u) {
        forgetDeviceCache();
        return 'login';
    }
    if (!u.emailVerified) {
        return 'verify';
    }
    try {
        S.me = await api('/me');
        rememberMe(S.me);
    } catch (e) {
        loadMe.err = e.message;
        return /profile/.test(e.message) ? 'setup' : 'login';
    }
    return '';
}

// A small copy of the profile is kept on this device so the next page load can draw the signed-in header immediately,
// before Firebase has finished starting. It is only a hint: the real profile always replaces it.
const KEY = 'fyndr-me';
function rememberMe(m) {
    try {
        const { photo, ...rest } = m;
        localStorage.setItem(KEY, JSON.stringify(photo && photo.length < 30000 ? m : rest));
    } catch { }
}
export function cachedMe() {
    try {
        return JSON.parse(localStorage.getItem(KEY));
    } catch {
        return null;
    }
}

import { S } from '../../core/state.js';
import { api } from '../../core/api.js';
import { fb } from '../../services/firebase/firebase-init.js';
// Loads the signed-in user's profile into S.me and says which gate (if any) they are stuck behind.
export async function loadMe() {
    S.me = null;
    const u = fb.user();
    if (!u) {
        return 'login';
    }
    if (!u.emailVerified) {
        return 'verify';
    }
    try {
        S.me = await api('/me');
    } catch (e) {
        loadMe.err = e.message;
        return /profile/.test(e.message) ? 'setup' : 'login';
    }
    return '';
}

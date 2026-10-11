// Shared cloud database (Firebase Firestore) for the browser-only / GitHub Pages mode.
// It holds only two small collections, protected by firestore.rules:
//   staff/{email}     { role: 'admin' | 'moderator' }   who is staff. Written only by admins. Works for people who have not signed up yet.
//   directory/{uid}   { name, email, kind, ... }          one public card per signed-in account, so admins on ANY device can see everyone.
// Everything is loaded lazily and fails soft: if Firestore is not set up, the rest of the site keeps working.
import { fb } from '../firebase/firebase-init.js';

let mod; // the Firestore SDK
let db;
async function fs() {
    await fb.ready();
    if (!fb.app()) {
        throw new Error('Firebase is not configured');
    }
    if (!mod) {
        mod = await import(fb.sdk + 'firebase-firestore.js');
        db = mod.getFirestore(fb.app());
    }
    return mod;
}
export const lc = e => String(e || '').trim().toLowerCase();

const memo = new Map();
const cached = (key, ms, fn) => {
    const h = memo.get(key);
    if (h && Date.now() - h.t < ms) {
        return h.v;
    }
    const v = fn();
    memo.set(key, { t: Date.now(), v });
    v.catch(() => memo.delete(key));
    return v;
};
export const forgetCloud = () => memo.clear();

// 'admin' | 'moderator' | null (not staff) | undefined (could not find out: keep whatever role is already stored)
export async function staffOf(email) {
    try {
        return await cached('staff:' + lc(email), 20e3, async () => {
            const m = await fs();
            const s = await m.getDoc(m.doc(db, 'staff', lc(email)));
            const r = s.exists() ? s.data().role : null;
            return r === 'admin' || r === 'moderator' ? r : null;
        });
    } catch (e) {
        console.warn('Could not read staff roles:', e.code || e.message);
        return undefined;
    }
}

// Publishes this account's public card (name, email, type). Best effort, at most every 10 minutes per device.
export async function publishCard(u) {
    try {
        const k = 'fyndr-dir:' + u.id;
        if (Date.now() - (+sessionStorage.getItem(k) || 0) < 10 * 60e3) {
            return;
        }
        const m = await fs();
        const card = {
            name: String(u.name || '').slice(0, 80), email: lc(u.email), kind: u.baseRole === 'org' || u.role === 'org' ? 'org' : 'user', created: u.created || new Date().toISOString(), phoneVerified: !!u.phone, completion: 0, updated: new Date().toISOString()
        };
        if (u.orgName) {
            card.orgName = String(u.orgName).slice(0, 80);
        }
        if (u.orgType) {
            card.orgType = u.orgType;
        }
        await m.setDoc(m.doc(db, 'directory', u.id), card);
        sessionStorage.setItem(k, String(Date.now()));
    } catch (e) {
        console.warn('Could not publish account card:', e.code || e.message);
    }
}

// Admin view: every account card + every staff entry. Throws a readable error when Firestore is not set up.
export async function teamData() {
    try {
        const m = await fs();
        const [d, s] = await Promise.all([m.getDocs(m.collection(db, 'directory')), m.getDocs(m.collection(db, 'staff'))]);
        const dir = d.docs.map(x => ({ uid: x.id, ...x.data() }));
        const staff = {};
        s.docs.forEach(x => {
            staff[x.id] = x.data().role;
        });
        return { dir, staff };
    } catch (e) {
        const denied = e.code === 'permission-denied';
        throw new Error(denied ? 'The cloud database refused access. Publish the rules from firestore.rules in Firebase Console > Firestore Database > Rules.' : e.code === 'failed-precondition' || e.code === 'unavailable' || /not.*(found|enabled)|NOT_FOUND/i.test(e.message) ? 'Firestore is not enabled yet. In Firebase Console open Build > Firestore Database > Create database.' : (e.message || 'Cloud database error'));
    }
}

// role: 'admin' | 'moderator' | 'none'
export async function setStaff(email, role, by) {
    const m = await fs();
    const ref = m.doc(db, 'staff', lc(email));
    try {
        if (role === 'none') {
            await m.deleteDoc(ref);
        } else {
            await m.setDoc(ref, { role, by: lc(by), at: new Date().toISOString() });
        }
    } catch (e) {
        throw new Error(e.code === 'permission-denied' ? 'Not allowed. Only admins can change roles (and the main admin cannot be changed).' : (e.message || 'Could not save'));
    }
    forgetCloud();
}

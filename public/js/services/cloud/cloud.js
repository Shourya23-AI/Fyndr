// Staff roles in Firestore:  staff/{email} = { role: 'admin' | 'moderator' }.
// Keyed by email so a role can be given before the person has signed up. Only admins can write it (see firestore.rules).
import { fs } from '../firestore-api/fire.js';
import { lc } from '../firestore-api/helpers.js';

export { lc };
const memo = new Map();
export const forgetCloud = () => memo.clear();

// 'admin' | 'moderator' | null (not staff) | undefined (could not find out)
export async function staffOf(email) {
    const key = lc(email);
    const h = memo.get(key);
    if (h && Date.now() - h.t < 20e3) {
        return h.v;
    }
    try {
        const { m, db } = await fs();
        const s = await m.getDoc(m.doc(db, 'staff', key));
        const r = s.exists() ? s.data().role : null;
        const v = r === 'admin' || r === 'moderator' ? r : null;
        memo.set(key, { t: Date.now(), v });
        return v;
    } catch (e) {
        console.warn('Could not read staff roles:', e.code || e.message);
        return undefined;
    }
}

// Every staff entry (admins only), as { email: role }.
export async function staffMap() {
    const { m, db } = await fs();
    const s = await m.getDocs(m.collection(db, 'staff'));
    const out = {};
    s.docs.forEach(x => {
        out[x.id] = x.data().role;
    });
    return out;
}

// role: 'admin' | 'moderator' | 'none'
export async function setStaff(email, role, by) {
    const { m, db } = await fs();
    const ref = m.doc(db, 'staff', lc(email));
    if (role === 'none') {
        await m.deleteDoc(ref);
    } else {
        await m.setDoc(ref, { role, by: lc(by), at: new Date().toISOString() });
    }
    forgetCloud();
}

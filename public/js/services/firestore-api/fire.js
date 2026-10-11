// Lazy access to the Firestore SDK (shared by the whole Firestore backend). Loaded only when first needed.
import { fb } from '../firebase/firebase-init.js';

let cache;
export async function fs() {
    if (cache) {
        return cache;
    }
    await fb.ready();
    if (!fb.app()) {
        throw new Error('Firebase is not configured');
    }
    const m = await import(fb.sdk + 'firebase-firestore.js');
    cache = { m, db: m.getFirestore(fb.app()) };
    return cache;
}
// Tests can swap in a fake Firestore.
export const useFs = x => {
    cache = x;
};

// Turns Firestore's technical errors into messages a person can act on.
export function friendly(e) {
    const c = e && e.code;
    if (c === 'permission-denied') {
        return Object.assign(new Error('Not allowed. If you are the site owner: publish the latest firestore.rules in Firebase Console > Firestore Database > Rules.'), { code: 'DENIED' });
    }
    if (c === 'failed-precondition' || c === 'unavailable' || c === 'not-found') {
        return Object.assign(new Error('The cloud database is not reachable or not enabled yet. Site owner: Firebase Console > Build > Firestore Database > Create database.'), { code: 'NO_DB' });
    }
    if (c === 'resource-exhausted') {
        return Object.assign(new Error('The free database quota for today is used up. Please try again tomorrow.'), { code: 'QUOTA' });
    }
    return e;
}

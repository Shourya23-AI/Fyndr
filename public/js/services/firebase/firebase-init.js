// Firebase is loaded LAZILY: the page draws first, the SDK downloads in the background.
// Nothing here blocks the first paint. `fb.ready()` resolves once we know who is signed in (the router waits on it).
const SDK = 'https://www.gstatic.com/firebasejs/10.12.2/';
const CFG_KEY = 'fyndr-fbcfg';
let local = false;
let auth = null;
let m = null; // Firebase auth functions, filled in by init
let configured = false;
const readCfg = () => {
    try {
        return JSON.parse(localStorage.getItem(CFG_KEY));
    } catch {
        return null;
    }
};
async function fetchCfg() {
    let r;
    try {
        const res = await fetch('api/firebase-config');
        if (!res.ok) {
            throw 0;
        }
        r = { cfg: await res.json(), local: false };
    } catch {
        // no Node server (e.g. Live Server): run in browser-only mode
        r = { cfg: await (await fetch('config/firebase-config.json')).json(), local: true };
    }
    try {
        localStorage.setItem(CFG_KEY, JSON.stringify(r));
    } catch { } // storage can be blocked by privacy settings
    return r;
}
const init = (async () => {
    // Cached config = no waiting for the server; it is refreshed quietly for next time.
    const cached = readCfg();
    const conf = cached || await fetchCfg();
    if (cached) {
        fetchCfg().catch(() => { });
    }
    local = conf.local;
    const cfg = conf.cfg;
    configured = !!cfg.apiKey && !cfg.apiKey.startsWith('YOUR');
    if (!configured) {
        return null;
    }
    const [{ initializeApp }, a] = await Promise.all([import(SDK + 'firebase-app.js'), import(SDK + 'firebase-auth.js')]);
    m = a;
    auth = a.getAuth(initializeApp(cfg));
    return new Promise(r => a.onAuthStateChanged(auth, r));
})();
// Wrap an action so it waits for Firebase to be ready first (a click can arrive before the SDK has finished downloading).
const W = fn => async (...a) => {
    await init;
    return fn(...a);
};
export const fb = {
    get local() { return local; },
    get configured() { return configured; },
    ready: () => init,
    user: () => auth?.currentUser || null,
    token: async () => {
        await init;
        return auth?.currentUser ? auth.currentUser.getIdToken() : '';
    },
    signUp: W(async (e, p, n) => {
        const c = await m.createUserWithEmailAndPassword(auth, e, p);
        await m.updateProfile(c.user, { displayName: n });
        return c.user;
    }),
    signIn: W((e, p) => m.signInWithEmailAndPassword(auth, e, p).then(c => c.user)),
    google: W(() => m.signInWithPopup(auth, new m.GoogleAuthProvider()).then(c => c.user)),
    reset: W(e => m.sendPasswordResetEmail(auth, e)),
    // Password-reset link landing page: check the emailed code, then save the new password.
    resetCheck: W(code => m.verifyPasswordResetCode(auth, code)),
    resetConfirm: W((code, pw) => m.confirmPasswordReset(auth, code, pw)),
    verify: W(() => m.sendEmailVerification(auth.currentUser)),
    reload: W(async () => {
        await auth.currentUser.reload();
        await auth.currentUser.getIdToken(true);
        return auth.currentUser;
    }),
    out: W(() => m.signOut(auth))
};

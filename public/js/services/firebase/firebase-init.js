import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js';
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, signInWithPopup, GoogleAuthProvider, sendPasswordResetEmail, verifyPasswordResetCode, confirmPasswordReset, sendEmailVerification, updateProfile, signOut, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
let cfg;
let local = false;
try {
    cfg = await (await fetch('api/firebase-config')).json();
} catch {
    local = true;
    cfg = await (await fetch('config/firebase-config.json')).json();
} // no Node server (e.g. Live Server): run in browser-only mode
const configured = !!cfg.apiKey && !cfg.apiKey.startsWith('YOUR');
const auth = configured ? getAuth(initializeApp(cfg)) : null;
const ready = new Promise(r => configured ? onAuthStateChanged(auth, r) : r(null));
export const fb = {
    local, configured, ready: () => ready, user: () => auth?.currentUser || null,
    token: async () => auth?.currentUser ? auth.currentUser.getIdToken() : '',
    signUp: async (e, p, n) => {
        const c = await createUserWithEmailAndPassword(auth, e, p);
        await updateProfile(c.user, { displayName: n });
        return c.user;
    },
    signIn: (e, p) => signInWithEmailAndPassword(auth, e, p).then(c => c.user),
    google: () => signInWithPopup(auth, new GoogleAuthProvider()).then(c => c.user),
    reset: e => sendPasswordResetEmail(auth, e),
    // Password-reset link landing page: check the emailed code, then save the new password.
    resetCheck: code => verifyPasswordResetCode(auth, code), resetConfirm: (code, pw) => confirmPasswordReset(auth, code, pw), verify: () => sendEmailVerification(auth.currentUser),
    reload: async () => {
        await auth.currentUser.reload();
        await auth.currentUser.getIdToken(true);
        return auth.currentUser;
    },
    out: () => signOut(auth)
};

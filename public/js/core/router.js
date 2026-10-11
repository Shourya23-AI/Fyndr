import { S, isStaff } from './state.js';
import { toast, $ } from './dom.js';
import { skeleton, skeletonFor } from './skeleton.js';
import { capturePhoneToken } from '../services/phone-email/phone-email.js';
import { fb } from '../services/firebase/firebase-init.js';
import { nav, markNav } from '../features/layout/nav.js';
import { loadMe } from '../features/auth/load-me.js';
import { openAuth, closeAuth } from '../features/auth/auth-modal.js';
import { authView } from '../features/auth/auth-views.js';
import { home } from '../features/home/home.js';
import { browse } from '../features/browse/browse.js';
import { orgPage } from '../features/organizations/org-page.js';
import { proofView } from '../features/proof/proof.view.js';
import { profileView } from '../features/profile/profile.view.js';
import { phoneView } from '../features/phone/phone.page.js';
import { dashboard } from '../features/dashboard/dashboard.js';
import { resetView } from '../features/password-reset/reset.view.js';
import { termsView, privacyView, contactView } from '../features/legal/legal.view.js';
import { cachedMe } from '../features/auth/load-me.js';
import { consentView } from '../features/privacy/consent.view.js';
import { applyView } from '../features/apply/apply.view.js';
import { askAnalytics } from '../features/privacy/analytics.actions.js';
// Hash router: '#/organizations', '#/dashboard', ... Decides which page to draw and redirects people who are signed out or not set up yet.
export async function route() {
    const rid = route.n = (route.n || 0) + 1;
    // Returning from phone.email: grab the token from the address bar right away (before any redirect below can lose it).
    capturePhoneToken();
    // Signed-out visitors (nothing remembered on this device) see public pages at once, without waiting for Firebase to start.
    const raw = (location.hash.slice(2) || '').split('?')[0];
    const PUBLIC = { '': home, organizations: orgPage, terms: termsView, privacy: privacyView, contact: contactView };
    const early = !S.me && !cachedMe() && PUBLIC[raw] && !new URLSearchParams(location.search).get('oobCode');
    if (early) {
        nav();
        markNav(raw);
        PUBLIC[raw]();
    }
    // If the user check takes more than a blink, show a placeholder shaped like the page instead of a blank screen.
    const wait = setTimeout(() => {
        if (rid === route.n && !early) {
            $('#app').innerHTML = skeleton(skeletonFor(location.hash.slice(2), !!S.me));
        }
    }, 120);
    let gate;
    try {
        await fb.ready();
        gate = await loadMe();
    } finally {
        clearTimeout(wait);
    }
    if (rid !== route.n) {
        return;
    }
    nav();
    if (early && !S.me && gate === 'login') {
        return; // already showing the right public page
    }
    if (S.me || gate === 'verify') {
        closeAuth();
    }
    let r = (location.hash.slice(2) || '').split('?')[0];
    const q = new URLSearchParams(location.search);
    if (q.get('mode') === 'resetPassword' && q.get('oobCode')) {
        r = 'reset';
    }
    const seg = r.split('/'); // '#/apply/<listing id>' -> page 'apply', argument S.arg
    r = seg[0];
    S.arg = seg[1] || '';
    if (!S.me && r === 'apply') {
        sessionStorage.next = location.hash;
    }
    if (gate === 'verify' || gate === 'setup') {
        r = gate;
    } else if (!S.me && !['', 'login', 'register', 'forgot', 'verify', 'setup', 'organizations', 'terms', 'privacy', 'contact', 'reset'].includes(r)) {
        r = 'login';
    } else if (S.me && ['login', 'register', 'forgot'].includes(r)) {
        const n = sessionStorage.next;
        sessionStorage.removeItem('next');
        if (n && n !== location.hash) {
            location.hash = n;
            return;
        }
        r = '';
    }
    if (r === 'apply' && S.me && S.me.role !== 'user') {
        r = 'dashboard';
    }
    if (S.me?.role === 'user' && !S.me.onboarded && r !== 'phone') {
        r = 'profile';
    } else if (S.me && S.me.role !== 'user' && r === 'profile') {
        r = 'dashboard';
    }
    if (!S.me && r === 'phone') {
        r = 'login';
    }
    if (S.me?.role === 'org' && !S.me.proofStatus && ['', 'dashboard'].includes(r)) {
        r = 'proof';
    }
    if (S.me && r === '') {
        r = isStaff(S.me) ? 'dashboard' : 'jobs';
    }
    // Accounts that have not accepted the current Terms and Privacy Policy accept once before continuing (they can still read the policy pages).
    if (S.me?.needsConsent && !['terms', 'privacy', 'contact'].includes(r)) {
        r = 'consent';
    }
    markNav(r);
    document.title = 'Fyndr: internships and jobs, checked before you see them';
    try {
        if (!['login', 'register'].includes(r)) {
            closeAuth();
        }
        ({
            '': home, login: () => {
                home();
                openAuth('signin');
            }, register: () => {
                home();
                openAuth('signup');
            }, jobs: () => browse('jobs'), courses: () => browse('courses'), organizations: orgPage, proof: proofView, forgot: () => authView('forgot'), verify: () => authView('verify'), setup: () => authView('setup'), dashboard, profile: profileView, phone: phoneView, terms: termsView, privacy: privacyView, contact: contactView, reset: resetView, consent: consentView, apply: applyView
        }[r] || home)();
        askAnalytics();
    } catch (e) {
        toast(e.message);
    }
}

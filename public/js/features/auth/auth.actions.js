import { S } from '../../core/state.js';
import { $, toast } from '../../core/dom.js';
import { fb } from '../../services/firebase/firebase-init.js';
import { api } from '../../core/api.js';
import { route } from '../../core/router.js';
import { openAuth, closeAuth, setRole, slide } from './auth-modal.js';
import { loadMe } from './load-me.js';
import { FREE } from './constants.js';
import { cleanStudy, rememberStudy, fillStudy } from '../suggestions/study.js';
export const bind = () => {
    addEventListener('keydown', e => {
        if (e.key === 'Escape') {
            closeAuth();
        }
    });
    document.addEventListener('change', e => {
        if (e.target.dataset && e.target.dataset.study) {
            fillStudy(e.target.closest('form'));
        }
        // Sign-up: show the organization-only fields when "I'm an organization hiring" is picked (was an inline onchange="").
        if (e.target.dataset && 'roleToggle' in e.target.dataset) {
            document.querySelectorAll('.on-only').forEach(el => {
                el.hidden = e.target.value !== 'org';
            });
        }
    });
};
// data-act handlers
export const actions = {
    async logout() {
        await fb.out();
        S.me = null;
        location.hash = '#/';
        route();
    },
    auth(b) {
        const r = b.getBoundingClientRect();
        openAuth(b.dataset.mode || 'signin', b.dataset.role, { x: r.left + r.width / 2, y: r.top + r.height / 2 });
    },
    closeauth() {
        closeAuth();
        if (/^#\/(login|register)$/.test(location.hash)) {
            history.replaceState(null, '', '#/');
        }
    },
    role(b) {
        setRole(b.dataset.role);
    },
    slide(b) {
        slide(b.dataset.to);
    },
    async google() {
        await fb.google();
        closeAuth();
        location.hash = '#/';
        route();
    },
    async verified() {
        await fb.reload();
        if (!fb.user().emailVerified) {
            toast('Not verified yet — check your inbox');
        }
        route();
    },
    async resend() {
        await fb.verify();
        toast('Verification email sent');
    },
    showpw(b) {
        const i = b.closest('.pw').querySelector('input');
        const hid = i.type === 'password';
        i.type = hid ? 'text' : 'password';
        b.textContent = hid ? 'Hide' : 'Show';
        b.setAttribute('aria-label', hid ? 'Hide password' : 'Show password');
    }
};
// data-form handlers
export const forms = {
    async login(d) {
        const want = $('#authBox')?.dataset.role || 'candidate';
        await fb.signIn(d.email, d.password);
        const g = await loadMe();
        if (g === 'login') {
            await fb.out();
            throw { message: 'Signed in, but we could not load your account (' + (loadMe.err || 'no response') + '). Check that the server is running and try again.' };
        }
        if (S.me && S.me.role !== 'admin' && S.me.role !== 'moderator' && (S.me.role === 'org') !== (want === 'org')) {
            const wasOrg = S.me.role === 'org';
            await fb.out();
            S.me = null;
            throw { message: wasOrg ? 'This is an organization account. Switch to Organization.' : 'This is a candidate account. Switch to Candidate.' };
        }
        closeAuth();
        location.hash = '#/';
        route();
    },
    async register(d) {
        const org = $('#authBox')?.dataset.role === 'org';
        d.role = org ? 'org' : 'user';
        if (org && !d.orgType) {
            throw { message: 'Choose your organization type' };
        }
        if (org && d.orgType === 'enterprise' && FREE.test(d.email)) {
            throw { message: 'Enterprise organizations must use a work email. Small businesses can use Gmail.' };
        }
        // Year of study is not part of the account itself: it is kept on this device now and saved into the profile when the person fills it in.
        const study = org ? null : cleanStudy(d);
        if (!org && !study) {
            throw { message: 'Choose UG or PG, then your year and semester' };
        }
        delete d.programme;
        delete d.studyYear;
        delete d.semester;
        await fb.signUp(d.email, d.password, d.name);
        rememberStudy(study);
        await api('/init', 'POST', d);
        await fb.verify();
        closeAuth();
        route();
    },
    async forgot(d) {
        await fb.reset(d.email);
        toast('Reset link sent. Check your inbox.');
        location.hash = '#/login';
    },
    async setup(d) {
        await api('/init', 'POST', d);
        location.hash = '#/dashboard';
        route();
    }
};

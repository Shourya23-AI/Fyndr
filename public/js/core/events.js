import { $, toast } from './dom.js';
import { ferr } from './errors.js';
import * as auth from '../features/auth/auth.actions.js';
import * as browse from '../features/browse/browse.actions.js';
import * as dashboard from '../features/dashboard/dashboard.actions.js';
import * as layout from '../features/layout/layout.actions.js';
import * as accountMenu from '../features/account-menu/account-menu.actions.js';
import * as legal from '../features/legal/legal.actions.js';
import * as reset from '../features/password-reset/reset.actions.js';
import * as phone from '../features/phone/phone.actions.js';
import * as profile from '../features/profile/profile.actions.js';
import * as proof from '../features/proof/proof.actions.js';
// One delegated listener per event type. Each feature owns its handlers:
//   data-act="name"  -> features/<feature>/<feature>.actions.js  `actions.name`
//   data-form="name" -> features/<feature>/<feature>.actions.js  `forms.name`
const features = [auth, accountMenu, browse, dashboard, layout, legal, reset, phone, profile, proof];
const ACTIONS = Object.assign(Object.create(null), ...features.map(f => f.actions || {}));
const FORMS = Object.assign(Object.create(null), ...features.map(f => f.forms || {}));
export function bindEvents() {
    features.forEach(f => f.bind && f.bind());
    document.addEventListener('click', async (e) => {
        const b = e.target.closest('[data-act]');
        if (!b) {
            return;
        }
        const { act, id, s } = b.dataset;
        try {
            const h = ACTIONS[act];
            if (h) {
                await h(b, id, s);
            }
        } catch (x) {
            if (x.code === 'NOT_VERIFIED') {
                toast(x.message);
            } else if (x.code === 'PHONE_REQUIRED') {
                toast(x.message);
                location.hash = '#/phone';
            } else {
                toast(ferr(x));
            }
        }
    });
    document.addEventListener('change', dashboard.onChange);
    document.addEventListener('submit', async (e) => {
        const fm = e.target.dataset.form;
        if (!fm) {
            return;
        }
        e.preventDefault();
        const d = Object.fromEntries(new FormData(e.target));
        const sb = e.target.querySelector('button:not([type=button])');
        if (sb) {
            sb.disabled = true;
            sb.classList.add('is-loading');
        }
        const er = e.target.querySelector('.err') || $('#err');
        if (er) {
            er.textContent = '';
        }
        try {
            const h = FORMS[fm];
            if (h) {
                await h(d, e);
            }
        } catch (x) {
            er ? er.textContent = ferr(x) : toast(ferr(x));
        } finally {
            if (sb) {
                sb.disabled = false;
                sb.classList.remove('is-loading');
            }
        }
    });
}

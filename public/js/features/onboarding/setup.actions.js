import { S } from '../../core/state.js';
import { $, toast } from '../../core/dom.js';
import { api } from '../../core/api.js';
import { route } from '../../core/router.js';
import { nav } from '../layout/nav.js';
import { rememberMe } from '../auth/load-me.js';
import { addSkill } from '../profile/profile.view.js';
import { STEPS, stepErrors, firstBadStep, toProfileBody, clearDraft, saveDraft } from './setup.rules.js';
import { draw, keep } from './setup.page.js';
// Clicks and the form of the guided first-run setup (see setup.page.js and setup.rules.js).
const who = () => S.me?.id || S.me?.email || 'anon';
const GOTO = { resume: '#resumein', photo: '#photoin', intro: 'form[data-form=basics] [name=headline]' };
const go = (step, d, errs) => {
    S.setup.step = step;
    S.setup.d = { ...d, step };
    saveDraft(localStorage, who(), S.setup.d);
    draw(errs);
};
export const actions = {
    'su-back'() {
        if (!S.setup) {
            return route();
        }
        const d = keep($('form[data-form=sustep]'));
        go(Math.max(S.setup.step - 1, 0), d);
    },
    'su-skill'(b, id) {
        addSkill(id);
        b.remove();
    },
    // "Do it" buttons on the profile page: scroll to the right box and put the cursor in it.
    'pf-goto'(b, id) {
        const el = document.querySelector(GOTO[id] || '');
        if (el) {
            el.scrollIntoView({ behavior: 'smooth', block: 'center' });
            el.focus({ preventScroll: true });
        }
    }
};
export const forms = {
    async sustep(d, e) {
        if (!S.setup) {
            return route();
        }
        const typed = $('#skillin');
        if (typed && typed.value.trim()) {
            addSkill(typed.value); // a skill typed but not confirmed with Enter still counts
            typed.value = '';
        }
        const draft = keep(e.target);
        const step = S.setup.step;
        const errs = stepErrors(STEPS[step].id, draft);
        if (Object.keys(errs).length) {
            return draw(errs);
        }
        if (step < STEPS.length - 1) {
            return go(step + 1, draft);
        }
        // Last step: check every step once more, then save through the same call the full profile form uses.
        const bad = firstBadStep(draft);
        if (bad >= 0) {
            return go(bad, draft, stepErrors(STEPS[bad].id, draft));
        }
        const r = await api('/profile', 'PUT', toProfileBody(draft));
        clearDraft(localStorage, who());
        S.setup = null;
        S.me.onboarded = true;
        S.me.completion = r.completion;
        rememberMe(S.me);
        nav();
        const h = '#/profile?welcome=1';
        location.hash === h ? route() : (location.hash = h);
    }
};

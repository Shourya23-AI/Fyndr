import { S } from '../../core/state.js';
import { $ } from '../../core/dom.js';
import { api } from '../../core/api.js';
import { skeleton } from '../../core/skeleton.js';
import { fillStudy, recalledStudy } from '../suggestions/study.js';
import { chips, photoUI } from '../profile/profile.view.js';
import { cleanDraft, draftFrom, loadDraft, saveDraft } from './setup.rules.js';
import { setupHtml } from './setup.view.js';
// #/profile for someone who has not finished setup yet: the guided steps. State lives in S.setup = { d: draft, step, data: GET /profile, errs }.
const who = () => S.me?.id || S.me?.email || 'anon';
export function draw(errs = {}) {
    const { d, step, data } = S.setup;
    S.skills = [...d.skills];
    S.skillLv = { ...d.skillLevels };
    $('#app').innerHTML = setupHtml(d, step, errs);
    chips();
    photoUI(data.photo);
    const form = $('form[data-form=sustep]');
    fillStudy(form);
    scrollTo({ top: 0 });
    // Keyboard and screen-reader users land on the question of the new step; the first wrong field gets the focus when a step is refused.
    const bad = Object.keys(errs)[0];
    const target = bad && form.elements.namedItem(bad) || (bad === 'skills' ? $('#skillin') : $('#su-t'));
    target && target.focus({ preventScroll: true });
}
export async function setupView() {
    $('#app').innerHTML = skeleton('center');
    const data = await api('/profile');
    const saved = loadDraft(localStorage, who());
    const d = saved || draftFrom(data.profile, recalledStudy());
    S.setup = { d, step: d.step, data };
    draw();
}
// Keeps what was typed on the current step (S.skills / S.skillLv hold the skill chips).
export function keep(form) {
    const f = new FormData(form);
    const cur = S.setup.d;
    const next = cleanDraft({
        ...cur, ...Object.fromEntries(f), jobTypes: form.querySelector('[name=jobTypes]') ? f.getAll('jobTypes') : cur.jobTypes,
        skills: form.querySelector('#skillin') ? S.skills : cur.skills, skillLevels: form.querySelector('#skillin') ? S.skillLv : cur.skillLevels, step: S.setup.step
    });
    S.setup.d = next;
    saveDraft(localStorage, who(), next);
    return next;
}

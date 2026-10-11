import { S } from '../../core/state.js';
import { esc, fmt, TICK } from '../../core/dom.js';
import { coverOf, logoOf, heart, canApply } from './card.js';
// "View Details" popup: big cover, logo, every detail, and the Apply / Save buttons.
let el;
let onKey;
export function closeDetail() {
    if (el) {
        el.remove();
        el = null;
        removeEventListener('keydown', onKey);
    }
}
export function openDetail(id) {
    const l = S.lmap[id];
    if (!l) {
        return;
    }
    closeDetail();
    const ap = S.mine.applications.some(a => a.listingId === l.id);
    const sv = S.mine.saved.includes(l.id);
    const course = l.type === 'Course';
    const row = (k, v) => v ? `<div class="info-row"><span>${k}</span><b>${esc(v)}</b></div>` : '';
    el = document.createElement('div');
    el.className = 'ap-back';
    el.innerHTML = `<div class="ap-box dt-box" role="dialog" aria-label="${esc(l.title)}"><button class="dt-x" data-dt-close aria-label="Close">×</button>
<div class="lc-media dt-media">${coverOf(l)}<span class="lc-logo">${logoOf(l)}</span></div>
<div class="tags" style="margin-top:34px"><span class="tag">${esc(l.type)}</span>${l.orgVerified ? `<span class="tag tag-verified">${TICK}Verified</span>` : ''}</div>
<h3 class="dt-title">${esc(l.title)}</h3><p class="lc-org" style="margin:0 0 14px">${course ? '<span>Provider</span> ' : ''}${esc(l.orgName)}</p>
<div class="dt-rows">${row(course ? 'Duration' : 'Duration / term', l.duration)}${row('Location', l.location)}${row(course ? 'Price' : 'Pay', l.pay)}${row('Posted', l.created ? fmt(l.created) : '')}</div>
${l.description ? `<h4 class="dt-h">About this ${course ? 'course' : 'role'}</h4><p class="dt-desc">${esc(l.description)}</p>` : ''}
<div class="ap-acts">${S.me?.role === 'user' ? heart(l, sv) : ''}<button class="button button-small" data-dt-close>Close</button>${canApply() ? `<button class="button button-dark button-small" data-act="apply" data-id="${l.id}" ${ap ? 'disabled' : ''}>${ap ? 'Applied' : course ? 'Enrol / Apply' : 'Apply'}</button>` : ''}</div></div>`;
    el.addEventListener('click', e => {
        if (e.target === el || e.target.closest('[data-dt-close]')) {
            closeDetail();
        }
    });
    onKey = e => {
        if (e.key === 'Escape') {
            closeDetail();
        }
    };
    addEventListener('keydown', onKey);
    document.body.append(el);
}

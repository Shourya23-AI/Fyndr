import { S } from '../../core/state.js';
import { esc, fmt, TICK, safeUrl } from '../../core/dom.js';
import { coverOf, logoOf, heart, canApply, whyBlock, trustChip } from './card.js';
import { summarize, hostOf, sourceOf } from '../listings/summary.js';
import { track } from '../../services/analytics/analytics.js';
// "View Details" popup. On a phone it slides up as a sheet with the Apply button pinned at the bottom.
// Order: what it is -> quick facts -> who it is best for -> what it gives you -> about -> how to apply -> the official link.
// Everything comes from the listing's own text (see listings/summary.js); nothing is sent anywhere.
let el;
let onKey;
let before;
const I = {
    pin: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0c0 5.4-6.5 11-6.5 11z"/><circle cx="12" cy="10" r="2.3"/></svg>',
    pay: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="6" width="18" height="12" rx="2.5"/><circle cx="12" cy="12" r="2.4"/></svg>',
    clock: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/></svg>',
    cap: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 9.5 12 5l9 4.5-9 4.5z"/><path d="M7 12v4.2c0 1 2.2 2.3 5 2.3s5-1.3 5-2.3V12"/></svg>',
    cal: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="5.5" width="16" height="14" rx="2.5"/><path d="M4 10h16M9 3.5v4M15 3.5v4"/></svg>',
    out: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14 5h5v5M19 5l-8 8M18 14v4a1.5 1.5 0 0 1-1.5 1.5h-9A1.5 1.5 0 0 1 6 18V9.5A1.5 1.5 0 0 1 7.5 8H10"/></svg>'
};
const real = v => v && !/^see listing$/i.test(v);
// First part of the long text (up to a sentence end near 460 characters); the rest sits behind "Read more".
const splitAbout = t => {
    if (t.length <= 520) {
        return [t, ''];
    }
    const cut = t.slice(0, 520).search(/[.!?](?=[^.!?]*$)/);
    const at = cut > 240 ? cut + 1 : t.slice(0, 460).replace(/\s+\S*$/, '').length;
    return [t.slice(0, at).trim(), t.slice(at).trim()];
};
export function closeDetail() {
    if (el) {
        el.remove();
        el = null;
        document.body.classList.remove('dt-lock');
        removeEventListener('keydown', onKey);
        if (before && before.isConnected) {
            before.focus({ preventScroll: true });
        }
    }
}
export function openDetail(id) {
    const l = S.lmap[id];
    if (!l) {
        return;
    }
    closeDetail();
    before = document.activeElement;
    const ap = S.mine.applications.some(a => a.listingId === l.id);
    const sv = S.mine.saved.includes(l.id);
    const course = l.type === 'Course';
    const noun = course ? 'course' : l.type === 'Internship' ? 'internship' : 'job';
    const ext = l.source === 'import' && safeUrl(l.applyUrl); // only ever an https address
    const sm = summarize(l);
    const via = sourceOf(l);
    track('view', { skills: sm.skills });
    const fact = (icon, k, v) => real(v) ? `<div class="dt-fact"><i>${icon}</i><span>${k}</span><b>${esc(v)}</b></div>` : '';
    const list = (a, empty) => a.length ? `<ul class="dt-list">${a.map(x => `<li>${esc(x)}</li>`).join('')}</ul>` : `<p class="dt-none">${empty}</p>`;
    const [lead, more] = splitAbout(sm.about || '');
    const host = ext ? hostOf(ext) : '';
    const cta = ext && canApply() ? `<a class="button button-dark dt-cta" href="${esc(ext)}" data-act="extclick" target="_blank" rel="noopener noreferrer nofollow">${course ? 'Go to course page' : 'Apply on ' + esc(host)}<span class="dt-ico">${I.out}</span></a>`
        : !ext && canApply() ? `<button class="button button-dark dt-cta" data-act="apply" data-id="${l.id}" ${ap ? 'disabled' : ''}>${ap ? 'Applied' : course ? 'Enrol / Apply' : 'Apply now'}</button>` : '';
    el = document.createElement('div');
    el.className = 'ap-back dt-back';
    el.innerHTML = `<div class="ap-box dt-box" role="dialog" aria-modal="true" aria-labelledby="dt-title" tabindex="-1"><button class="dt-x" data-dt-close aria-label="Close">×</button>
<div class="lc-media dt-media">${coverOf(l)}<span class="lc-logo">${logoOf(l)}</span></div>
<div class="dt-body">
<div class="tags"><span class="tag">${esc(l.type)}</span>${l.orgVerified ? `<span class="tag tag-verified">${TICK}Verified</span>` : ''}${via ? `<span class="tag">From ${esc(via)}</span>` : ''}</div>
<h3 class="dt-title" id="dt-title">${esc(l.title)}</h3><p class="lc-org dt-org">${course ? '<span>Provider</span> ' : ''}${esc(l.orgName)}</p>
<div class="dt-facts">${fact(I.pin, 'Location', l.location)}${fact(I.pay, course ? 'Price' : 'Pay', l.pay)}${fact(I.clock, 'Duration', l.duration)}${fact(I.cap, 'Experience', sm.experience)}${fact(I.cal, 'Posted', l.created ? fmt(l.created) : '')}</div>
<p class="dt-rate">${trustChip(l)}</p>
${whyBlock(S.match?.[l.id])}
<section class="dt-sec dt-best"><h4 class="dt-h">Who it is best for</h4>${list(sm.bestFor, `This ${noun} does not say who it suits. Read the requirements in the description and on the official page.`)}</section>
<section class="dt-sec dt-get"><h4 class="dt-h">What it gives you</h4>${list(sm.provides, 'No perks or benefits are mentioned. Check the official page for the details.')}</section>
<section class="dt-sec"><h4 class="dt-h">About this ${noun}</h4><p class="dt-desc">${esc(lead || sm.overview)}</p>${more ? `<details class="dt-more"><summary>Read more</summary><p class="dt-desc">${esc(more)}</p></details>` : ''}${sm.skills.length ? `<p class="why-row dt-skills"><span>Key skills</span>${sm.skills.map(x => `<span class="why-tag on">${esc(x)}</span>`).join('')}</p>` : ''}</section>
<section class="dt-sec"><h4 class="dt-h">How to apply</h4><ol class="dt-desc dt-steps">${sm.steps.map(x => `<li>${x}</li>`).join('')}</ol></section>
${ext ? `<div class="dt-link"><span>Official page</span><a href="${esc(ext)}" target="_blank" rel="noopener noreferrer nofollow" ${canApply() ? 'data-act="extclick"' : ''}>${esc(ext)}</a><small>Opens in a new tab on ${esc(host)}. Never pay a fee or share an OTP to apply.</small></div>` : ''}
</div>
<div class="dt-foot">${S.me?.role === 'user' ? heart(l, sv) : ''}${S.me && !l.virtual ? `<button type="button" class="button dt-share" data-act="shareopen" data-id="${esc(l.id)}" data-s="listing" aria-label="Share to a group or community">Share</button>` : ''}${cta || '<button class="button dt-cta" data-dt-close>Close</button>'}</div></div>`;
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
    document.body.classList.add('dt-lock');
    el.querySelector('.dt-box').focus({ preventScroll: true });
}

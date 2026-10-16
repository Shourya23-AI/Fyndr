import { S } from '../../core/state.js';
import { esc, fmt, TICK, safeUrl } from '../../core/dom.js';
import { coverOf, logoOf, heart, canApply, whyBlock, trustChip, placeNow, shortName } from './card.js';
import { summarize, hostOf } from '../listings/summary.js';
import { originOf, isSearch, seenAgo } from '../listings/origin.js';
import { linksFor, tierText } from '../catalog/group.js';
import { NATION } from '../catalog/meta.js';
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
// The buttons of a course topic or job role: every learning site / job board that has its own search for it. Job boards can look in one city
// (the select), and the buttons follow it. Free sites come first for courses.
function boardsBlock(l) {
    const jobs = l.type !== 'Course';
    const place = placeNow();
    const opts = jobs ? [[NATION, 'All India'], ...(l.cities || []).map(c => [c, c]), ['', 'Remote only']] : [];
    if (jobs && place !== NATION && !opts.some(o => o[0] === place)) {
        opts.splice(1, 0, [place, place]);
    }
    const rows = linksFor(l, place).map(k => `<li><a class="dt-board" href="${esc(safeUrl(k.u))}" target="_blank" rel="noopener noreferrer nofollow" data-act="extclick" data-bi="${k.bi ?? ''}"><b>${esc(shortName(k.n))}</b><span>${jobs ? 'live search' : esc([tierText(k.tier), k.cert ? 'certificate' : ''].filter(Boolean).join(' · '))}</span></a></li>`).join('');
    return `<section class="dt-sec dt-boards"><h4 class="dt-h">${jobs ? 'Look for this role on' : 'Find this course on'}</h4>${jobs ? `<label class="dt-place">Where<select data-place-for="${esc(l.id)}" aria-label="Place to search">${opts.map(([v, t]) => `<option value="${esc(v)}" ${v === place ? 'selected' : ''}>${esc(t)}</option>`).join('')}</select></label>` : ''}<ul class="dt-boardlist">${rows}</ul><p class="dt-none">${jobs ? 'Each button opens that board\'s own live search, so you see what is open today.' : 'Each button opens that site\'s own search. Compare level, price and certificate there.'} Never pay a fee or share an OTP to get a job or internship.</p></section>`;
}
// Changing the place in the popup rewrites every board link to look in that place.
export function setPlace(sel) {
    const l = S.lmap[sel.dataset.placeFor];
    if (!l || !el) {
        return;
    }
    const by = new Map(linksFor(l, sel.value).map(k => [String(k.bi), k.u]));
    el.querySelectorAll('.dt-board').forEach(a => {
        const u = safeUrl(by.get(a.dataset.bi));
        if (u) {
            a.href = u;
        }
    });
}
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
    const og = originOf(l);
    const search = isSearch(l);
    const seen = og.k === 'direct' ? seenAgo(l) : '';
    track('view', { skills: sm.skills });
    const fact = (icon, k, v) => real(v) ? `<div class="dt-fact"><i>${icon}</i><span>${k}</span><b>${esc(v)}</b></div>` : '';
    const list = (a, empty) => a.length ? `<ul class="dt-list">${a.map(x => `<li>${esc(x)}</li>`).join('')}</ul>` : `<p class="dt-none">${empty}</p>`;
    const [lead, more] = splitAbout(sm.about || '');
    const host = ext ? hostOf(ext) : '';
    const first = search ? safeUrl(l.links[0].u) : '';
    const cta = search && first ? `<a class="button button-dark dt-cta" href="${esc(first)}" data-act="extclick" target="_blank" rel="noopener noreferrer nofollow">Open on ${esc(shortName(l.links[0].n))}<span class="dt-ico">${I.out}</span></a>`
        : ext && canApply() ? `<a class="button button-dark dt-cta" href="${esc(ext)}" data-act="extclick" target="_blank" rel="noopener noreferrer nofollow">${course ? 'Go to course page' : 'Apply on ' + esc(host)}<span class="dt-ico">${I.out}</span></a>`
        : !ext && canApply() ? `<button class="button button-dark dt-cta" data-act="apply" data-id="${l.id}" ${ap ? 'disabled' : ''}>${ap ? 'Applied' : course ? 'Enrol / Apply' : 'Apply now'}</button>` : '';
    el = document.createElement('div');
    el.className = 'ap-back dt-back';
    el.innerHTML = `<div class="ap-box dt-box" role="dialog" aria-modal="true" aria-labelledby="dt-title" tabindex="-1"><button class="dt-x" data-dt-close aria-label="Close">×</button>
<div class="lc-media dt-media">${coverOf(l)}<span class="lc-logo">${logoOf(l)}</span></div>
<div class="dt-body">
<div class="tags"><span class="tag">${esc(l.type)}</span><span class="tag ${og.k === 'direct' || og.k === 'posted' ? 'tag-verified' : ''}" title="${esc(og.note)}">${og.k === 'direct' || og.k === 'posted' ? TICK : ''}${esc(og.label)}</span>${l.orgVerified && !search ? `<span class="tag tag-verified">${TICK}Verified organization</span>` : ''}</div>
<h3 class="dt-title" id="dt-title">${esc(l.title)}</h3><p class="lc-org dt-org">${search ? `<span>${course ? 'On' : 'Search on'}</span> ` : course ? '<span>Provider</span> ' : ''}${esc(l.orgName)}</p>
<div class="dt-facts">${fact(I.pin, 'Location', l.location)}${fact(I.pay, course ? 'Price' : 'Pay', l.pay)}${fact(I.clock, 'Duration', l.duration)}${fact(I.cap, 'Experience', sm.experience)}${search ? '' : fact(I.cal, 'Posted', l.created ? fmt(l.created) : '')}${seen ? fact(I.cal, 'Seen open on their page', seen) : ''}</div>
<p class="dt-rate">${search ? `<span class="dt-origin-note">${esc(og.note)}</span>` : trustChip(l)}<button type="button" class="dt-report" data-act="reportopen" data-id="${esc(l.id)}" title="Tell us if this looks like a scam, is misleading or is closed">&#9873; ${search ? 'Report a problem' : 'Report this listing'}</button></p>
${search ? boardsBlock(l) : ''}
${whyBlock(S.match?.[l.id])}
<section class="dt-sec dt-best"><h4 class="dt-h">Who it is best for</h4>${list(sm.bestFor, `This ${noun} does not say who it suits. Read the requirements in the description and on the official page.`)}</section>
<section class="dt-sec dt-get"><h4 class="dt-h">What it gives you</h4>${list(sm.provides, 'No perks or benefits are mentioned. Check the official page for the details.')}</section>
<section class="dt-sec"><h4 class="dt-h">About this ${noun}</h4><p class="dt-desc">${esc(lead || sm.overview)}</p>${more ? `<details class="dt-more"><summary>Read more</summary><p class="dt-desc">${esc(more)}</p></details>` : ''}${sm.skills.length ? `<p class="why-row dt-skills"><span>Key skills</span>${sm.skills.map(x => `<span class="why-tag on">${esc(x)}</span>`).join('')}</p>` : ''}</section>
<section class="dt-sec"><h4 class="dt-h">How to apply</h4><ol class="dt-desc dt-steps">${sm.steps.map(x => `<li>${x}</li>`).join('')}</ol></section>
${ext && !search ? `<div class="dt-link"><span>Official page</span><a href="${esc(ext)}" target="_blank" rel="noopener noreferrer nofollow" ${canApply() ? 'data-act="extclick"' : ''}>${esc(ext)}</a><small>Opens in a new tab on ${esc(host)}. Never pay a fee or share an OTP to apply.</small></div>` : ''}
</div>
<div class="dt-foot">${S.me?.role === 'user' ? heart(l, sv) : ''}${S.me?.role === 'user' ? `<button type="button" class="button dt-track" data-act="trkadd" data-id="${esc(l.id)}" data-s="applied" title="Add to your tracker as Applied">I applied</button>` : ''}${S.me ? `<button type="button" class="button dt-share" data-act="shareopen" data-id="${esc(l.id)}" data-s="listing" aria-label="Share to a group or community">Share</button>` : ''}${cta || '<button class="button dt-cta" data-dt-close>Close</button>'}</div></div>`;
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

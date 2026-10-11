import { S } from '../../core/state.js';
import { esc, TICK } from '../../core/dom.js';
import { isStaff } from '../../core/state.js';
import { safeImg } from '../../core/image.js';
import { bestLine } from '../listings/summary.js';
import { rating } from '../trust/trust.js';
// Legitimacy rating chip (0-100) with the reasons as a tooltip. Every listing was also checked by a person before it appeared.
export const trustChip = l => { const r = rating(l); return `<span class="lc-trust" data-band="${r.band}" title="${esc(r.reasons.length ? 'Why: ' + r.reasons.join('; ') : 'No warning signs found in the text')}">${r.label} · ${r.score}/100</span>`; };
// One listing card: cover picture, organization logo on it, title, provider, duration, then "View Details" and a save heart.
// Used by browse, suggestions and the saved list on the dashboard. The full listing is kept in S.lmap for the details popup.
const CLOCK = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/></svg>';
const PIN = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0c0 5.4-6.5 11-6.5 11z"/><circle cx="12" cy="10" r="2.3"/></svg>';
const HEART = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20.5S3.5 15 3.5 9.3A4.8 4.8 0 0 1 12 6.6a4.8 4.8 0 0 1 8.5 2.7C20.5 15 12 20.5 12 20.5z"/></svg>';
export const heart = (l, sv) => `<button class="save-button ${sv ? 'saved' : ''}" data-act="save" data-id="${l.id}" aria-pressed="${sv}" aria-label="${sv ? 'Remove from saved' : 'Save'}">${HEART}</button>`;
// Logo tile: the organization's logo, or its first letter when it did not add one.
export const logoOf = l => safeImg(l.logo) ? `<img src="${safeImg(l.logo)}" alt="">` : `<b>${esc((l.orgName || '?')[0].toUpperCase())}</b>`;
// Cover, best first: the picture the organization uploaded, or the company's own picture found by the server (brand.js);
// else the company's brand colour with its logo in the middle; else a soft gradient with the type written on it.
export const coverOf = l => {
    const src = safeImg(l.image);
    if (src) {
        return `<img class="lc-img" src="${src}" alt="" loading="lazy" decoding="async">`;
    }
    const color = /^#[0-9a-f]{6}$/i.test(l.brandColor || '') ? l.brandColor : '';
    const logo = safeImg(l.logo);
    return `<span class="lc-img lc-none${color ? ' lc-brand' : ''}" data-t="${esc(l.type)}"${color ? ` style="--bc:${color}"` : ''}>${logo ? `<span class="lc-big"><img src="${logo}" alt="" loading="lazy" decoding="async"></span>` : esc(l.type)}</span>`;
};
// Optional match info from the suggestions engine (features/suggestions/engine.js): a score badge on the cover and the top reasons.
const flags = m => {
    if (!m) {
        return '';
    }
    const main = m.kind === 'course' ? (m.fills?.length ? '<span class="lc-match" data-band="strong">Fills a skill gap</span>' : `<span class="lc-match" data-band="${m.band}">${m.score}% fit</span>`) : `<span class="lc-match" data-band="${m.band}">${m.score}% match</span>`;
    return `<span class="lc-flags">${main}${m.isNew ? '<span class="lc-new">New</span>' : ''}</span>`;
};
// "Why this was picked for you": reasons, skills they have, skills to add, and cautions. Used in the details popup.
export const whyBlock = m => {
    if (!m) {
        return '';
    }
    const tags = (a, cls) => (a && a.length ? a.slice(0, 8).map(x => `<span class="why-tag ${cls}">${esc(x)}</span>`).join('') : '');
    const have = tags(m.matched, 'on');
    const add = m.kind === 'course' ? tags(m.teaches, 'add') : tags(m.missing, 'add');
    return `<div class="dt-why"><h4 class="dt-h">Why this was picked for you</h4>${m.reasons.length ? `<ul class="lc-why">${m.reasons.map(r => `<li>${esc(r)}</li>`).join('')}</ul>` : ''}${have ? `<p class="why-row"><span>You have</span>${have}</p>` : ''}${add ? `<p class="why-row"><span>${m.kind === 'course' ? 'You would learn' : 'Skills to add'}</span>${add}</p>` : ''}${m.cautions.length ? `<ul class="why-warn">${m.cautions.map(r => `<li>${esc(r)}</li>`).join('')}</ul>` : ''}</div>`;
};
export const card = (l, match) => {
    const m = match && typeof match === 'object' ? match : null; // (never a number: Array.map passes the index as 2nd argument)
    S.lmap[l.id] = l;
    const sv = S.mine.saved.includes(l.id);
    const course = l.type === 'Course';
    return `<article class="lcard"><div class="lc-media">${coverOf(l)}${flags(m)}<span class="lc-type">${esc(l.type)}</span><span class="lc-logo">${logoOf(l)}</span></div>
<div class="lc-body"><h3>${esc(l.title)}</h3><p class="lc-org">${course ? '<span>Provider</span> ' : ''}${esc(l.orgName)}${l.orgVerified ? `<i class="lc-ok" title="Verified organization">${TICK}</i>` : ''}</p>
<p class="lc-meta">${l.duration ? `<span>${CLOCK}${esc(l.duration)}</span>` : ''}<span>${PIN}${esc(l.location)}</span></p><p class="lc-pay">${esc(l.pay)}</p><p class="lc-rate">${trustChip(l)}</p>${bestLine(l) ? `<p class="lc-best"><b>Best for</b> ${esc(bestLine(l))}</p>` : ''}${m && m.reasons.length ? `<ul class="lc-why">${m.reasons.slice(0, 2).map(r => `<li>${esc(r)}</li>`).join('')}</ul>` : ''}
<div class="lc-acts"><button class="button button-dark button-small" data-act="view" data-id="${l.id}">View Details</button>${S.me?.role === 'user' ? heart(l, sv) : ''}</div></div></article>`;
};
export const canApply = () => !(S.me?.role === 'org' || isStaff(S.me));

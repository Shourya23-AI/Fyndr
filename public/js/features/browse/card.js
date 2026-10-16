import { S } from '../../core/state.js';
import { esc, TICK } from '../../core/dom.js';
import { isStaff } from '../../core/state.js';
import { safeImg } from '../../core/image.js';
import { rating } from '../trust/trust.js';
import { posterOf, webLogo } from './poster.js';
import { originOf, isSearch, seenAgo, staleDays } from '../listings/origin.js';
import { linksFor } from '../catalog/group.js';
import { NATION as NATION_PLACE } from '../catalog/meta.js';
import { cityIn } from './place.js';
// Legitimacy rating chip (0-100) with the reasons as a tooltip. It is worked out from the listing's own text by simple rules (trust.js).
// A search link (a course topic or job role that opens a provider's own search) is not a posting, so it is never rated: it gets no chip.
export const trustChip = l => { if (isSearch(l)) { return ''; } const r = rating(l); return `<span class="lc-trust" data-band="${r.band}" title="${esc(r.reasons.length ? 'Why: ' + r.reasons.join('; ') : 'No warning signs found in the text')}">${r.label} · ${r.score}/100</span>`; };
// Small badge saying where the listing comes from: Direct from company, Posted on Fyndr, Search links ... (listings/origin.js).
export const originTag = l => { const o = originOf(l); const seen = o.k === 'direct' ? seenAgo(l) : ''; return `<p class="lc-origin" data-k="${o.k}" title="${esc(o.note)}">${o.k === 'direct' || o.k === 'posted' ? TICK : ''}${esc(o.label)}${seen ? ` · seen open ${esc(seen)}` : ''}${o.k === 'direct' && staleDays(l) >= 3 ? ' · may have closed, check on their page' : ''}</p>`; };
// Where the job-board links should look: the city typed in the Location box, else the city "Near me" found, else all of India.
export const placeNow = () => { if (S.pf && S.pf.place === 'remote') { return ''; } const c = cityIn(S.f && S.f.loc); return c ? c[0] : (S.pf && S.pf.city) || NATION_PLACE; };
// "LinkedIn Jobs" -> "LinkedIn", "Indeed India" -> "Indeed", "Hirist (tech)" -> "Hirist"
export const shortName = n => String(n).replace(/ (Jobs|India)$/, '').replace(/ \((Monster|tech|startups)\)$/, '');
// The first few provider / job board buttons on a card of a course topic or job role.
export const linkChips = (l, n = 3) => !l.links ? '' : `<div class="lc-links" role="group" aria-label="${l.type === 'Course' ? 'Open on a learning site' : 'Open on a job board'}">${linksFor(l, placeNow()).slice(0, n).map(k => `<a class="lc-link" href="${esc(k.u)}" target="_blank" rel="noopener noreferrer nofollow" data-act="extclick">${esc(shortName(k.n))}${k.tier === 'free' ? '<i>Free</i>' : ''}</a>`).join('')}${l.links.length > n ? `<button type="button" class="lc-link lc-more" data-act="view" data-id="${esc(l.id)}">+${l.links.length - n} more</button>` : ''}</div>`;
// Where a role is, short enough for a card: "Bengaluru, Delhi +5 · Remote"
const locLabel = l => (l.cities && l.cities.length ? l.cities.slice(0, 2).join(', ') + (l.cities.length > 2 ? ` +${l.cities.length - 2}` : '') + ' · Remote' : l.location);
// One listing card: cover picture, organization logo on it, title, provider, duration, then "View Details" and a save heart.
// Used by browse, suggestions and the saved list on the dashboard. The full listing is kept in S.lmap for the details popup.
const CLOCK = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/></svg>';
const PIN = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0c0 5.4-6.5 11-6.5 11z"/><circle cx="12" cy="10" r="2.3"/></svg>';
const HEART = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20.5S3.5 15 3.5 9.3A4.8 4.8 0 0 1 12 6.6a4.8 4.8 0 0 1 8.5 2.7C20.5 15 12 20.5 12 20.5z"/></svg>';
export const heart = (l, sv) => `<button class="save-button ${sv ? 'saved' : ''}" data-act="save" data-id="${l.id}" aria-pressed="${sv}" aria-label="${sv ? 'Remove from saved' : 'Save'}">${HEART}</button>`;
// Logo tile: the organization's logo, or its first letter when it did not add one.
export const logoOf = l => safeImg(l.logo) ? `<img src="${safeImg(l.logo)}" alt="">` : l.links && l.links[0] ? webLogo({ orgName: l.links[0].n }) : webLogo(l);
// Cover, best first: the picture/poster the organization uploaded; otherwise a poster drawn for the listing (poster.js):
// the company's brand colour, its real logo, the role as the headline and a layout/pattern picked per listing.
export const coverOf = l => {
    const src = safeImg(l.image);
    if (src) {
        return `<img class="lc-img" src="${src}" alt="" loading="lazy" decoding="async">`;
    }
    return posterOf(l);
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
    const org = l.search ? `<span>${course ? 'On' : 'Search on'}</span> ${esc(l.orgName)}` : `${course ? '<span>Provider</span> ' : ''}${esc(l.orgName)}${l.orgVerified ? `<i class="lc-ok" title="Verified organization">${TICK}</i>` : ''}`;
    return `<article class="lcard${l.search ? ' lcard-group' : ''}"><div class="lc-media">${coverOf(l)}${flags(m)}<span class="lc-type">${esc(l.type)}</span><span class="lc-logo">${logoOf(l)}</span></div>
<div class="lc-body"><h3>${esc(l.title)}</h3><p class="lc-org">${org}</p>${originTag(l)}
<p class="lc-meta">${l.duration ? `<span>${CLOCK}${esc(l.duration)}</span>` : ''}<span>${PIN}${esc(locLabel(l))}</span></p><p class="lc-pay">${esc(l.pay)}</p>${m && m.reasons.length ? `<ul class="lc-why">${m.reasons.slice(0, 1).map(r => `<li>${esc(r)}</li>`).join('')}</ul>` : ''}${linkChips(l)}
<div class="lc-acts"><button class="button button-dark button-small" data-act="view" data-id="${l.id}">View Details</button>${S.me?.role === 'user' ? heart(l, sv) : ''}</div></div></article>`;
};
export const canApply = () => !(S.me?.role === 'org' || isStaff(S.me));

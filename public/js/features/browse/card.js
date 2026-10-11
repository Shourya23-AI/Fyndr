import { S } from '../../core/state.js';
import { esc, TICK } from '../../core/dom.js';
import { isStaff } from '../../core/state.js';
import { safeImg } from '../../core/image.js';
// One listing card: cover picture, organization logo on it, title, provider, duration, then "View Details" and a save heart.
// Used by browse, suggestions and the saved list on the dashboard. The full listing is kept in S.lmap for the details popup.
const CLOCK = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/></svg>';
const PIN = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0c0 5.4-6.5 11-6.5 11z"/><circle cx="12" cy="10" r="2.3"/></svg>';
const HEART = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20.5S3.5 15 3.5 9.3A4.8 4.8 0 0 1 12 6.6a4.8 4.8 0 0 1 8.5 2.7C20.5 15 12 20.5 12 20.5z"/></svg>';
export const heart = (l, sv) => `<button class="save-button ${sv ? 'saved' : ''}" data-act="save" data-id="${l.id}" aria-pressed="${sv}" aria-label="${sv ? 'Remove from saved' : 'Save'}">${HEART}</button>`;
// Logo tile: the organization's logo, or its first letter when it did not add one.
export const logoOf = l => safeImg(l.logo) ? `<img src="${safeImg(l.logo)}" alt="">` : `<b>${esc((l.orgName || '?')[0].toUpperCase())}</b>`;
// Cover: the uploaded picture, or a soft gradient with the type written on it (older listings have no picture).
export const coverOf = l => safeImg(l.image) ? `<img class="lc-img" src="${safeImg(l.image)}" alt="" loading="lazy" decoding="async">` : `<span class="lc-img lc-none" data-t="${esc(l.type)}">${esc(l.type)}</span>`;
export const card = l => {
    S.lmap[l.id] = l;
    const sv = S.mine.saved.includes(l.id);
    const course = l.type === 'Course';
    return `<article class="lcard"><div class="lc-media">${coverOf(l)}<span class="lc-type">${esc(l.type)}</span><span class="lc-logo">${logoOf(l)}</span></div>
<div class="lc-body"><h3>${esc(l.title)}</h3><p class="lc-org">${course ? '<span>Provider</span> ' : ''}${esc(l.orgName)}${l.orgVerified ? `<i class="lc-ok" title="Verified organization">${TICK}</i>` : ''}</p>
<p class="lc-meta">${l.duration ? `<span>${CLOCK}${esc(l.duration)}</span>` : ''}<span>${PIN}${esc(l.location)}</span></p><p class="lc-pay">${esc(l.pay)}</p>
<div class="lc-acts"><button class="button button-dark button-small" data-act="view" data-id="${l.id}">View Details</button>${S.me?.role === 'user' ? heart(l, sv) : ''}</div></div></article>`;
};
export const canApply = () => !(S.me?.role === 'org' || isStaff(S.me));

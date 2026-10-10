import {S} from '../../core/state.js';
import {esc,fmt,TICK} from '../../core/dom.js';
// One listing row (used by browse, suggestions and the saved list on the dashboard).
export const card=l=>{const sv=S.mine.saved.includes(l.id),ap=S.mine.applications.some(a=>a.listingId===l.id),canApply=!(S.me?.role==='org'||S.me?.role==='admin');
return `<article class="card"><span class="company-logo">${esc(l.orgName[0])}</span>
<div><div class="tags"><span class="tag">${l.type}</span>${l.orgVerified?`<span class="tag tag-verified">${TICK}Verified</span>`:''}</div><h3>${esc(l.title)}</h3><p class="company">${esc(l.orgName)}</p><p class="loc">${esc(l.location)}</p><p class="desc">${esc(l.description)}</p></div>
<div class="card-side"><strong class="pay">${esc(l.pay)}</strong><span class="when">${fmt(l.created)}</span><div class="acts">${S.me?.role==='user'?`<button class="save-button ${sv?'saved':''}" data-act="save" data-id="${l.id}" aria-pressed="${sv}" aria-label="${sv?'Remove from saved':'Save'}"><svg viewBox="0 0 24 24"><path d="M6 4h12v17l-6-4-6 4z"/></svg></button>`:''}${canApply?`<button class="button button-dark button-small" data-act="apply" data-id="${l.id}" ${ap?'disabled':''}>${ap?'Applied':'Apply'}</button>`:''}</div></div></article>`};

import { S } from '../../core/state.js';
import { esc } from '../../core/dom.js';
import { STAGES, load, due, counts, fromFyndr, stageName } from './tracker.js';
export const uidOf = () => (S.me && (S.me.id || S.me.email)) || 'me';
// Everything on the board: the person's own items, plus applications made on Fyndr, plus listings saved with the heart.
export function items(savedListings = []) {
    const own = load(uidOf());
    const have = new Set(own.map(x => x.id));
    const fy = fromFyndr(S.mine && S.mine.applications);
    const hearts = savedListings.filter(l => !have.has(l.id)).map(l => ({ id: l.id, title: l.title, org: l.orgName, type: l.type, url: '', stage: 'saved', note: '', remind: '', added: '', history: [], heart: true }));
    return [...own, ...fy, ...hearts];
}
export const dueCount = () => due(load(uidOf())).length;
const mv = (x, k) => {
    const i = STAGES.findIndex(s => s[0] === x.stage);
    return STAGES.map(([v, t]) => `<option value="${v}" ${v === x.stage ? 'selected' : ''}>${t}</option>`).join('');
};
const itemCard = (x, d) => {
    const own = !x.fyndr && !x.heart;
    const late = x.remind && x.remind <= d && !['offer', 'closed'].includes(x.stage);
    return `<article class="tk-card${late ? ' late' : ''}"><h4>${esc(x.title)}</h4><p class="tk-org">${esc(x.org)}${x.type ? ' · ' + esc(x.type) : ''}${x.fyndr ? ' · <i>Applied on Fyndr</i>' : x.heart ? ' · <i>Saved</i>' : ''}</p>
${x.url ? `<a class="tk-link" href="${esc(x.url)}" target="_blank" rel="noopener noreferrer nofollow">Open page ↗</a>` : ''}
${own ? `<label class="tk-f">Stage<select data-trk="stage" data-id="${esc(x.id)}">${mv(x)}</select></label>
<label class="tk-f">Follow up on<input type="date" data-trk="remind" data-id="${esc(x.id)}" value="${esc(x.remind)}"></label>
<label class="tk-f">Note<textarea data-trk="note" data-id="${esc(x.id)}" maxlength="600" rows="2" placeholder="Contact, deadline, what to prepare">${esc(x.note)}</textarea></label>
<button type="button" class="mini no" data-act="trkdel" data-id="${esc(x.id)}">Remove</button>` : x.heart ? `<button type="button" class="button button-small" data-act="trkadopt" data-id="${esc(x.id)}">Track it</button>` : '<p class="desc">Its status is set by the organization.</p>'}</article>`;
};
export function trackerTab(savedListings) {
    const all = items(savedListings);
    const d = new Date().toISOString().slice(0, 10);
    const dueNow = due(all.filter(x => !x.fyndr && !x.heart));
    const c = counts(all);
    return `<div class="dash-head"><h2>Tracker</h2><p class="desc">Follow every opening from saved to offer. Kept on this device only; clearing browser data clears it.</p></div>
${dueNow.length ? `<div class="panel tk-due" role="status"><h3>${dueNow.length} follow-up${dueNow.length === 1 ? '' : 's'} due</h3><ul>${dueNow.map(x => `<li><b>${esc(x.title)}</b> at ${esc(x.org)}: ${esc(stageName(x.stage))}, follow up was set for ${esc(x.remind)}</li>`).join('')}</ul></div>` : ''}
<form class="panel tk-add" data-form="trkadd"><h3>Add an opening you found elsewhere</h3><div class="tk-row"><input name="title" required maxlength="120" placeholder="Role, e.g. Data Analyst Intern" aria-label="Role"><input name="org" maxlength="80" placeholder="Company" aria-label="Company"><input name="url" type="url" maxlength="500" placeholder="Link (optional, https)" aria-label="Link"><select name="stage" aria-label="Stage">${STAGES.map(([v, t]) => `<option value="${v}" ${v === 'applied' ? 'selected' : ''}>${t}</option>`).join('')}</select><button class="button button-dark button-small">Add</button></div></form>
<div class="tk-board">${STAGES.map(([k, t]) => `<section class="tk-col" aria-label="${t}"><h3>${t} <b>${c[k]}</b></h3>${all.filter(x => x.stage === k).map(x => itemCard(x, d)).join('') || '<p class="desc tk-empty">Nothing here yet</p>'}</section>`).join('')}</div>`;
}

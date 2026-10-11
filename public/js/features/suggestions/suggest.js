import { S } from '../../core/state.js';
import { $, esc } from '../../core/dom.js';
import { api } from '../../core/api.js';
import { card } from '../browse/card.js';
import { suggestFor, extractSkills } from './engine.js';
// "Suggested for you": ranks approved listings by the candidate's qualifications, skills and preferences (engine.js).
// Everything is worked out in the browser from the profile the person typed. No resume is read and no AI is involved.

// true = only candidates whose qualification document was verified see suggestions (the original rule).
// false = everyone who has finished their profile sees them.
export const NEEDS_VERIFIED_DOCUMENT = false; // (was true: only document-verified candidates saw suggestions, so most people saw none)
const FIRST = 6; // picks shown at first
const STEP = 6; // more per click

const nudge = (title, text, href, label) => `<div class="nudge"><div><h3>${title}</h3><p class="desc">${text}</p></div><a class="button button-dark button-small" href="${href}">${label}</a></div>`;

// "New since your last visit": the time of the previous visit is kept on this device. It is read once per page load,
// so a re-draw after a save or apply does not make the NEW tags vanish.
let visit = { uid: null, at: 0 };
export function lastVisit(uid) {
    if (visit.uid !== uid) {
        let at = 0;
        try {
            at = +localStorage.getItem('fyndr-seen:' + uid) || 0;
        } catch { }
        visit = { uid, at };
        try {
            localStorage.setItem('fyndr-seen:' + uid, String(Date.now()));
        } catch { }
    }
    return visit.at;
}

const view = { r: null, scope: 'jobs', n: FIRST };

function cards(rows) {
    return rows.map(({ l, m }) => {
        S.match[l.id] = m;
        return card(l, m);
    }).join('');
}
const chips = u => u.map(x => `<span class="chip-s">${esc(x.label)} <b>${x.count} ${x.count === 1 ? 'job' : 'jobs'}</b></span>`).join('');

function gapPanel(r) {
    if (!r.unlock.length) {
        return '';
    }
    const cs = [];
    for (const u of r.unlock) {
        for (const x of u.courses) {
            if (!cs.some(y => y.l.id === x.l.id)) {
                cs.push(x);
            }
        }
    }
    return `<div class="panel sg-gap"><h3>Skills that would unlock more matches</h3><p class="desc">The jobs closest to your profile keep asking for these.</p><div class="chips">${chips(r.unlock)}</div>${cs.length ? `<h4 class="sg-sub">Courses that teach them</h4><div class="opportunity-grid">${cards(cs.slice(0, 3))}</div>` : '<p class="desc">No course for these has been listed yet.</p>'}</div>`;
}

function paint() {
    const el = $('#sugg');
    const { r, scope, n } = view;
    if (!el || !r) {
        return;
    }
    const note = '<p class="sg-note">Matched on your device from the details you typed. No resume is read and no AI is involved.</p>';
    if (scope === 'courses') {
        el.innerHTML = r.courses.length ? `<div class="sg-head"><div><h2>Courses picked for you</h2><p class="desc">Chosen for the skills your best-matching jobs ask for and your field.</p></div><a class="sg-edit" href="#/profile">Fine-tune</a></div><div class="opportunity-grid">${cards(r.courses)}</div>${note}` : '';
        return;
    }
    const shown = r.picks.slice(0, n);
    const newTag = r.newCount ? `<span class="sg-new">${r.newCount} new ${r.newCount === 1 ? 'match' : 'matches'} since your last visit</span>` : '';
    const body = shown.length ? `<div class="opportunity-grid">${cards(shown)}</div>${r.picks.length > n ? `<div class="more"><button class="button" data-act="suggmore">Show more picks (${r.picks.length - n})</button></div>` : ''}` : '<div class="empty"><b>No strong matches yet</b><p>Add more skills, or the cities you would work in, and we will look again.</p><a class="button button-dark button-small" href="#/profile">Update profile</a></div>';
    el.innerHTML = `<div class="sg-head"><div><h2>Suggested for you</h2><p class="desc">Matched to your qualifications, skills and preferences. ${newTag}</p></div><span class="sg-links"><a class="sg-edit" data-act="fyopen" href="#/dashboard">See your full plan</a><a class="sg-edit" href="#/profile">Fine-tune</a></span></div>${body}${gapPanel(r)}${note}`;
}

// The built-in catalog is thousands of rows; scoring all of them is slow. Keep real listings as they are and, from the catalog,
// only the rows that mention something from the person's profile (skills, field, study), at most CAP of them.
const CAP = 350; // per kind (jobs, courses)
const isCat = l => typeof l.id === 'string' && l.id.startsWith('cat_');
export function shortlist(ls, p) {
    const cat = ls.filter(isCat);
    if (cat.length <= CAP * 2) {
        return ls;
    }
    const names = (Array.isArray(p.skills) ? p.skills : []).map(x => (typeof x === 'string' ? x : x?.name || ''));
    const info = [p.field, p.course, p.degree, p.headline, ...names].filter(Boolean).join(' ');
    const words = [...new Set(info.toLowerCase().split(/[^a-z0-9+#.]+/).filter(w => w.length > 2))];
    const keys = [...new Set(extractSkills(info))];
    const score = l => {
        const t = (l.title + ' ' + (l.skills || []).join(' ')).toLowerCase();
        let n = 0;
        for (const w of words) {
            if (t.includes(w)) {
                n += 2;
            }
        }
        for (const k of keys) {
            if (t.includes(k)) {
                n += 1;
            }
        }
        return n;
    };
    const top = type => cat.filter(l => (type === 'Course') === (l.type === 'Course')).map(l => [score(l), l]).filter(x => x[0] > 0).sort((a, b) => b[0] - a[0]).slice(0, CAP).map(x => x[1]);
    return ls.filter(l => !isCat(l)).concat(top('Course'), top('Job'));
}
export function moreSuggestions() {
    view.n += STEP;
    paint();
}

export async function suggest(scope = 'jobs') {
    const el = $('#sugg');
    if (!el) {
        return;
    }
    if (!S.me.onboarded) {
        el.innerHTML = nudge('Finish your profile to get suggestions', 'Add your qualification, skills and the places you would work in. Browsing and applying never need this.', '#/profile', 'Complete profile');
        return;
    }
    if (NEEDS_VERIFIED_DOCUMENT && S.me.proofStatus !== 'verified') {
        el.innerHTML = scope === 'courses' ? '' : nudge('Get suggestions picked for you', 'Verify a qualification document and we will rank listings by your qualifications and skills. Browsing and applying never need this.', '#/proof', S.me.proofStatus === 'pending' ? 'Under review' : 'Add documents');
        return;
    }
    const [pr, ls] = await Promise.all([api('/profile'), api('/listings')]);
    S.match = {};
    view.r = suggestFor(pr.profile, shortlist(ls, pr.profile), {
        saved: S.mine.saved, applied: S.mine.applications.map(a => a.listingId), lastSeen: lastVisit(S.me.id || S.me.email), limit: 24
    });
    view.scope = scope;
    view.n = FIRST;
    paint();
}

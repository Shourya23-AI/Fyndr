// "Suggested for you" row at the very top of the Jobs and Courses pages: one line of cards that slides sideways (swipe, scroll or the arrows).
// Signed-in people with a finished profile get picks ranked from their own details (engine.js, on their device).
// Everyone else gets a fresh "Popular right now" mix, so the row is never empty.
import { S } from '../../core/state.js';
import { $, esc } from '../../core/dom.js';
import { api } from '../../core/api.js';
import { card } from '../browse/card.js';
import { suggestFor } from './engine.js';
import { shortlist, lastVisit } from './suggest.js';
const EACH = 10; // jobs and courses taken from the ranking
const ARROW = d => `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${d}"/></svg>`;
export const railHTML = () => `<section class="container rail" id="rail" aria-label="Suggested for you"><div class="rail-head"><div><h2>Suggested for you</h2><p class="desc" id="rail-sub">Finding good matches…</p></div><div class="rail-ctl"><a class="sg-edit" id="rail-link" href="#/profile" hidden></a><button class="rail-btn" data-act="railprev" aria-label="Slide left">${ARROW('m15 6-6 6 6 6')}</button><button class="rail-btn" data-act="railnext" aria-label="Slide right">${ARROW('m9 6 6 6-6 6')}</button></div></div><div class="rail-track" id="rail-track" tabindex="0">${'<div class="sk"></div>'.repeat(4)}</div></section>`;
export function slide(dir) {
    const t = $('#rail-track');
    if (t) {
        t.scrollBy({ left: dir * Math.max(240, t.clientWidth * .85), behavior: 'smooth' });
    }
}
// Jobs and courses taken turn by turn, so both show up near the start.
const weave = (a, b) => {
    const out = [];
    for (let i = 0; i < Math.max(a.length, b.length); i++) {
        if (a[i]) {
            out.push(a[i]);
        }
        if (b[i]) {
            out.push(b[i]);
        }
    }
    return out;
};
// The catalog has the same role on several job boards and the same topic on several course sites: show each only once.
const uniq = (rows, key) => {
    const seen = new Set();
    return rows.filter(x => {
        const k = key(x.l);
        return seen.has(k) ? false : (seen.add(k), true);
    });
};
const DAY = 864e5;
// A mix that changes every day: newest real listings first, then a rotating slice of the catalog.
export function popular(ls) {
    const day = Math.floor(Date.now() / DAY);
    const real = ls.filter(l => !String(l.id).startsWith('cat_')).slice(0, 6);
    const pick = (type, n) => {
        const pool = ls.filter(l => String(l.id).startsWith('cat_') && l.type === type);
        const out = [];
        const seen = new Set();
        for (let i = 0; out.length < n && i < pool.length && i < n * 8; i++) {
            const l = pool[(day * 37 + i * 211) % pool.length];
            const k = l.title.split(':')[0].replace(/ \((Fresher)\)$/, '');
            if (!seen.has(k)) {
                seen.add(k);
                out.push(l);
            }
        }
        return out;
    };
    return real.concat(weave(weave(pick('Internship', 5), pick('Job', 3)), pick('Course', 8)));
}
const paint = (items, sub, link) => {
    const t = $('#rail-track');
    if (!t) {
        return;
    }
    $('#rail-sub').textContent = sub;
    const a = $('#rail-link');
    if (link) {
        a.textContent = link[0];
        a.href = link[1];
        a.hidden = false;
        if (link[2]) {
            a.dataset.act = link[2];
        }
    }
    t.scrollLeft = 0;
    t.innerHTML = items.map(x => `<div class="rail-item">${card(x.l || x, x.m)}</div>`).join('') || '<p class="desc">Nothing to suggest yet. Try again in a moment.</p>';
};
export async function rail() {
    if (!$('#rail')) {
        return;
    }
    const ls = await api('/listings');
    const ready = S.me?.role === 'user' && S.me.onboarded;
    if (!ready) {
        paint(popular(ls), S.me?.role === 'user' ? 'Popular right now. Finish your profile to get picks made for you.' : 'Popular right now.', S.me?.role === 'user' ? ['Complete profile', '#/profile'] : null);
        return;
    }
    const pr = await api('/profile');
    S.match = {};
    const r = suggestFor(pr.profile, shortlist(ls, pr.profile), {
        saved: S.mine.saved, applied: S.mine.applications.map(a => a.listingId), lastSeen: lastVisit(S.me.id || S.me.email), limit: 90, perOrg: 60, courseLimit: 90
    });
    const jobs = uniq(r.picks, l => (String(l.id).startsWith('cat_') ? l.title : l.id)).slice(0, EACH);
    const courses = uniq(r.courses, l => (String(l.id).startsWith('cat_') ? l.title.split(':')[0] : l.id)).slice(0, EACH);
    const rows = weave(jobs, courses);
    rows.forEach(({ l, m }) => {
        S.match[l.id] = m;
    });
    if (!rows.length) {
        paint(popular(ls), 'Popular right now. Add skills to your profile for picks made for you.', ['Update profile', '#/profile']);
        return;
    }
    paint(rows, `${jobs.length} jobs and ${courses.length} courses matched to your skills and goals.`, ['See your full plan', '#/dashboard', 'fyopen']);
}

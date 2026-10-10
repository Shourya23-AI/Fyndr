import { S } from '../../core/state.js';
import { $ } from '../../core/dom.js';
import { api } from '../../core/api.js';
import { card } from '../browse/card.js';
// "Suggested for you": ranks listings by the skills on the candidate's profile.
export async function suggest() {
    const el = $('#sugg');
    if (!el) {
        return;
    }
    if (S.me.proofStatus !== 'verified') {
        el.innerHTML = `<div class="nudge"><div><h3>Get suggestions picked for you</h3><p class="desc">Verify a qualification document and we will rank listings by the skills on your profile. Browsing and applying never need this.</p></div><a class="button button-dark button-small" href="#/proof">${S.me.proofStatus === 'pending' ? 'Under review' : 'Add documents'}</a></div>`;
        return;
    }
    const [pr, ls] = await Promise.all([api('/profile'), api('/listings')]);
    const sk = (pr.profile.skills || []).map(x => x.toLowerCase());
    const top = ls.map(l => {
        const tx = (l.title + ' ' + l.description).toLowerCase();
        const m = sk.filter(x => tx.includes(x));
        return {
            l, m, n: Math.round(Math.min(1, m.length / Math.min(sk.length || 1, 3)) * 100)
        };
    }).filter(x => x.m.length).sort((a, b) => b.n - a.n).slice(0, 3);
    el.innerHTML = `<h2>Suggested for you</h2><p class="desc">Ranked by the skills on your profile.</p><div class="opportunity-grid">${top.map(x => card({ ...x.l, description: `${x.n}% skill match (${x.m.join(', ')}). ${x.l.description}` })).join('') || '<p class="desc" style="padding:16px 0">Add more skills to your profile to see suggestions.</p>'}</div>`;
}

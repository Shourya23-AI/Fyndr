import { S } from '../../core/state.js';
import { api } from '../../core/api.js';
import { toast } from '../../core/dom.js';
import { openAuth } from '../auth/auth-modal.js';
import { loadListings, drawListings } from './listings.js';
import { browse } from './browse.js';
import { dashboard } from '../dashboard/dashboard.js';
import { openDetail, closeDetail } from './detail.js';
import { moreSuggestions } from '../suggestions/suggest.js';
import { track } from '../../services/analytics/analytics.js';
// data-act handlers
export const actions = {
    tab(b, id) {
        S.f.type = id;
        document.querySelectorAll('.tabs button').forEach(t => t.classList.toggle('active', t.dataset.id === id));
        loadListings();
    },
    clear() {
        S.f = {
            type: '', q: '', loc: ''
        };
        browse(S.scope);
    },
    more() {
        drawListings((S.lshown || 24) + 24);
    },
    suggmore() {
        moreSuggestions();
    },
    view(b, id) {
        openDetail(id);
    },
    extclick() {
        track('apply');
    },
    save: saveOrApply,
    apply: saveOrApply
};
async function saveOrApply(b, id) {
    const act = b.dataset.act;
    if (!S.me) {
        closeDetail();
        sessionStorage.next = location.hash || '#/';
        return openAuth('signin');
    }
    let body;
    if (act === 'apply') {
        if (S.me.role === 'user' && !S.me.onboarded) {
            location.hash = '#/profile';
            return;
        }
        if (S.me.role === 'user' && !S.me.phoneVerified) {
            toast('Verify your phone number before applying');
            location.hash = '#/phone';
            return;
        }
        track('apply');
        closeDetail();
        location.hash = '#/apply/' + id;
        return;
    }
    const r = await api(`/${act}/${id}`, 'POST', body);
    if (act === 'save' && r?.saved) {
        track('save');
    }
    closeDetail();
    if (act === 'apply') {
        toast('Application sent!');
    }
    location.hash.includes('dashboard') ? dashboard() : browse(S.scope);
}
// data-form handlers
export const forms = {
    search(d) {
        S.f.q = d.q;
        S.f.loc = d.loc;
        loadListings().then(() => d.q && track('search', { term: d.q, empty: !(S.lall || []).length })).catch(() => { });
    }
};

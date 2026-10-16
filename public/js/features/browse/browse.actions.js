import { likedView } from '../liked/liked.view.js';
import { redrawPosts } from '../chat/chat.screen.js';
import { S } from '../../core/state.js';
import { api } from '../../core/api.js';
import { toast } from '../../core/dom.js';
import { openAuth } from '../auth/auth-modal.js';
import { loadListings, drawListings, drawMore } from './listings.js';
import { paintFilters } from './filters.js';
import { browse } from './browse.js';
import { dashboard } from '../dashboard/dashboard.js';
import { openDetail, closeDetail } from './detail.js';
import { moreSuggestions } from '../suggestions/suggest.js';
import { slide } from '../suggestions/rail.js';
import { track } from '../../services/analytics/analytics.js';
// data-act handlers
export const actions = {
    tab(b, id) {
        S.f.type = id;
        document.querySelectorAll('.tabs button').forEach(t => t.classList.toggle('active', t.dataset.id === id));
        loadListings();
    },
    place(b, id) {
        S.pf.place = ['near', 'remote'].includes(id) ? id : 'any';
        paintFilters();
        loadListings().catch(() => { });
    },
    fit() {
        if (!S.me) {
            sessionStorage.next = location.hash || '#/';
            toast('Sign in to see jobs that suit you');
            return openAuth('signin');
        }
        if (S.me.role !== 'user' || !S.me.onboarded) {
            toast(S.me.role === 'user' ? 'Finish your profile to see jobs that suit you' : 'This filter is for candidates');
            if (S.me.role === 'user') {
                location.hash = '#/profile';
            }
            return;
        }
        S.pf.fit = !S.pf.fit;
        paintFilters();
        loadListings().catch(() => { });
    },
    cat(b, id) {
        S.cat = id;
        document.querySelectorAll('.chip-c').forEach(t => t.classList.toggle('on', t.dataset.id === id));
        drawListings();
    },
    trysearch(b, id) {
        S.f.q = String(id || '');
        const box = document.querySelector('.search-box input[name=q]');
        if (box) {
            box.value = S.f.q;
        }
        loadListings().then(() => track('search', { term: S.f.q, empty: !(S.lall || []).length })).catch(() => { });
    },
    clear() {
        S.cat = '';
        S.pf = { place: 'any', fit: false };
        S.f = {
            type: '', q: '', loc: ''
        };
        browse(S.scope);
    },
    more() {
        drawMore();
    },
    railnext() {
        slide(1);
    },
    railprev() {
        slide(-1);
    },
    suggmore() {
        moreSuggestions();
    },
    fyopen() {
        S.dtab = 'foryou'; // the link then goes to the dashboard
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
    const h = location.hash;
    if (h.includes('dashboard')) {
        dashboard();
    } else if (h.startsWith('#/liked')) {
        likedView(true);
    } else if (/^#\/(community|groups)\//.test(h)) {
        S.gp && (S.gp.last = undefined);
        redrawPosts().catch(() => {});
    } else {
        browse(S.scope);
    }
}
// data-form handlers
export const forms = {
    search(d) {
        S.f.q = d.q;
        S.f.loc = d.loc;
        loadListings().then(() => d.q && track('search', { term: d.q, empty: !(S.lall || []).length })).catch(() => { });
    }
};

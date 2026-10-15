import { $, toast } from '../../core/dom.js';
import { S } from '../../core/state.js';
import { api } from '../../core/api.js';
import { openAuth } from '../auth/auth-modal.js';
import { fromListing, fromBook, bookFromShare } from './share.js';
import { pickerHtml, itemsHtml, targetsHtml } from './share.view.js';
import { addPost } from '../chat/chat.data.js';
import { kindOf, redrawPosts } from '../chat/chat.screen.js';
import { listGroups } from '../groups/groups.data.js';
import { listCommunities } from '../community/community.data.js';
import { toggleBook, likedBooksNow, loadLikedBooks, loadLikedState } from '../liked/liked.data.js';
import { searchCatalogs, openDetails } from '../library/library.js';
import { openDetail } from '../browse/detail.js';
// data-act handlers for sharing (names start with "sh").
//   shpick   the "Job, course or book" item in a chat's + menu       shtab / shsend / shclose   the picker
//   shareopen  the Share button on a job, course or book             shto   pick the group or community to send it to
//   shview / shlike   the buttons on a shared card inside a chat
const sh = () => (S.sh ||= { tab: 'job', q: '', items: [], n: 0 });
const draw = html => {
    $('#sh-modal') && $('#sh-modal').remove();
    document.body.insertAdjacentHTML('beforeend', html);
};
const close = () => {
    $('#sh-modal') && $('#sh-modal').remove();
};
const refreshChat = () => {
    if (S.gp && S.gp.cur) {
        S.gp.last = undefined;
        return redrawPosts().catch(() => {});
    }
};

// ---------- the picker inside a chat ----------
const words = q => q.toLowerCase().split(/\s+/).filter(Boolean);
export async function pickerItems(tab, q) {
    if (tab === 'book') {
        const liked = likedBooksNow();
        const w = words(q);
        const mine = liked.filter(b => !w.length || w.every(x => (b.title + ' ' + b.authors.join(' ')).toLowerCase().includes(x)));
        let found = [];
        let note = '';
        if (q.length >= 2) {
            try {
                found = (await searchCatalogs({ q, free: false })).books.slice(0, 24);
            } catch {
                note = 'Could not reach the book catalogs. Check your connection and try again.';
            }
        }
        const have = new Set(mine.map(b => b.id));
        const list = [...mine.map(b => [b, true]), ...found.filter(b => !have.has(b.id)).map(b => [b, false])];
        return { items: list.map(([b, liked]) => ({ ...fromBook(b), liked })), note };
    }
    sh().all ||= await api('/listings');
    const saved = new Set((S.mine && S.mine.saved) || []);
    const w = words(q);
    const rows = sh().all.filter(l => (tab === 'course') === (l.type === 'Course') && (!w.length || w.every(x => (l.title + ' ' + l.orgName + ' ' + (l.location || '')).toLowerCase().includes(x))));
    rows.sort((a, b) => saved.has(b.id) - saved.has(a.id));
    const items = [];
    for (const l of rows) {
        try {
            items.push({ ...fromListing(l), liked: saved.has(l.id) });
        } catch {
            // a listing without a title or id cannot be shared
        }
        if (items.length >= 30) {
            break;
        }
    }
    return { items, note: '' };
}
export async function fillPicker() {
    const s = sh();
    const list = $('#sh-list');
    const n = ++s.n;
    if (!list) {
        return;
    }
    let r;
    try {
        r = await pickerItems(s.tab, s.q);
    } catch (e) {
        r = { items: [], note: e.message || 'Could not load the list.' };
    }
    if (n !== s.n || !$('#sh-list')) {
        return; // a newer search replaced this one
    }
    s.items = r.items;
    $('#sh-list').innerHTML = itemsHtml(r.items, s.tab, s.q, r.note);
}

export const actions = {
    async shpick() {
        const m = $('#gp-attach');
        m && (m.hidden = true);
        const s = sh();
        s.q = '';
        draw(pickerHtml(s.tab, ''));
        await Promise.all([loadLikedState().catch(() => {}), loadLikedBooks().catch(() => {})]);
        await fillPicker();
    },
    async shtab(b, id) {
        const s = sh();
        s.tab = id;
        s.q = '';
        draw(pickerHtml(s.tab, ''));
        await fillPicker();
    },
    shclose: close,
    async shsend(b, i) {
        const item = sh().items[Number(i)];
        if (!item || !S.gp || !S.gp.cur) {
            return;
        }
        b.disabled = true;
        try {
            const dr = S.gp.draft || {};
            await addPost(kindOf(), S.gp.cur.id, { share: item, reply: dr.reply });
        } catch (e) {
            b.disabled = false;
            throw e;
        }
        close();
        S.gp.draft = {};
        const d = $('#gp-draft');
        d && (d.innerHTML = '');
        toast('Shared');
        await refreshChat();
    },

    // ---------- Share button on a job, a course or a book ----------
    async shareopen(b, id, kind) {
        if (!S.me) {
            return openAuth('signin');
        }
        let item;
        try {
            item = kind === 'book' ? fromBook(S.books[id]) : fromListing(S.lmap[id]);
        } catch (e) {
            toast(e.message);
            return;
        }
        S.sh = { ...sh(), pending: item };
        draw(targetsHtml(item, [], true));
        const [g, c] = await Promise.all([listGroups().catch(() => []), listCommunities().catch(() => [])]);
        if (!$('#sh-modal')) {
            return;
        }
        const targets = [...g.map(x => ({ root: 'groups', id: x.id, name: x.name })), ...c.filter(x => x.joined).map(x => ({ root: 'communities', id: x.id, name: x.name }))];
        S.sh.targets = targets;
        draw(targetsHtml(item, targets, false));
    },
    async shto(b, key) {
        const at = String(key).indexOf(':');
        const root = String(key).slice(0, at);
        const id = String(key).slice(at + 1);
        const t = ((S.sh && S.sh.targets) || []).find(x => x.root === root && x.id === id);
        if (!t || !S.sh.pending) {
            return;
        }
        b.disabled = true;
        try {
            await addPost(root, id, { share: S.sh.pending });
        } catch (e) {
            b.disabled = false;
            throw e;
        }
        close();
        toast('Shared to ' + t.name);
        if (S.gp && S.gp.cur && S.gp.cur.id === id) {
            await refreshChat();
        }
    },

    // ---------- the buttons on a shared card inside a chat ----------
    async shview(b, id) {
        const p = ((S.gp && S.gp.posts) || []).find(x => x.id === id);
        const s = p && p.share;
        if (!s) {
            return;
        }
        if (s.kind === 'book') {
            S.books ||= {};
            S.books[s.id] ||= bookFromShare(s);
            return openDetails(s.id);
        }
        if (!S.lmap[s.id]) {
            const all = await api('/listings');
            const l = all.find(x => x.id === s.id);
            if (l) {
                S.lmap[l.id] = l;
            }
        }
        if (!S.lmap[s.id]) {
            toast('This ' + s.kind + ' is no longer listed.');
            return;
        }
        openDetail(s.id);
    },
    async shlike(b, id) {
        const p = ((S.gp && S.gp.posts) || []).find(x => x.id === id);
        const s = p && p.share;
        if (!s) {
            return;
        }
        let liked;
        if (s.kind === 'book') {
            liked = (await toggleBook(bookFromShare(s))).liked;
        } else {
            if (S.me.role !== 'user') {
                throw new Error('Saving jobs and courses is for candidate accounts.');
            }
            const r = await api('/save/' + s.id, 'POST');
            const have = new Set(S.mine.saved);
            r.saved ? have.add(s.id) : have.delete(s.id);
            S.mine.saved = [...have];
            liked = !!r.saved;
        }
        toast(liked ? 'Added to Liked' : 'Removed from Liked');
        await refreshChat();
    }
};
export function bind() {
    // The picker's search box (jobs, courses and books follow the typing after a short pause).
    let t;
    document.addEventListener('input', e => {
        if (e.target && e.target.id === 'sh-q') {
            const q = e.target.value.trim().slice(0, 80);
            clearTimeout(t);
            t = setTimeout(() => {
                sh().q = q;
                fillPicker();
            }, sh().tab === 'book' ? 350 : 150);
        }
    });
    addEventListener('keydown', e => {
        if (e.key === 'Escape' && $('#sh-modal')) {
            close();
        }
    });
    addEventListener('hashchange', close);
}

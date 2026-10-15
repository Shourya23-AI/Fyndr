import { $, toast } from '../../core/dom.js';
import { S } from '../../core/state.js';
import { shrinkChat } from '../../core/image.js';
import { createGroup, addMembers, removeMember, leaveGroup, deleteGroup } from './groups.data.js';
import { addPost, deletePost, votePoll, reactPost, listPosts } from '../chat/chat.data.js';
import { groupsView, redrawPeople } from './groups.view.js';
import { redrawPosts, paintMsgs, kindOf } from '../chat/chat.screen.js';
import { draftHtml, pollFormHtml } from './chat.view.js';
import { snippet } from './chat.helpers.js';
// data-act / data-form handlers for the Groups pages and the chat window (names start with "gp").
const draft = () => ((S.gp ||= {}).draft ||= {});
const drawDraft = () => {
    const b = $('#gp-draft');
    b && (b.innerHTML = draftHtml(draft()));
};
const closePops = () => document.querySelectorAll('.ch-pop').forEach(p => (p.hidden = true));
const refresh = () => redrawPosts().catch(() => {});
export const actions = {
    gpnew() {
        const f = $('#gp-new');
        if (f) {
            f.hidden = !f.hidden;
            const i = !f.hidden && f.querySelector('input');
            i && i.focus();
        }
    },
    async gprm(b, email) {
        if (!confirm('Remove ' + email + ' from this group?')) {
            return;
        }
        await removeMember(S.gp.cur.id, email);
        await redrawPeople();
    },
    async gpleave(b, id) {
        if (!confirm('Leave this group? Only the leader can add you back.')) {
            return;
        }
        await leaveGroup(id);
        toast('You left the group');
        location.hash = '#/groups';
    },
    async gpdelete(b, id) {
        if (!confirm('Delete this group for everyone? This cannot be undone.')) {
            return;
        }
        await deleteGroup(id);
        toast('Group deleted');
        location.hash = '#/groups';
    },
    async gpdelpost(b, id) {
        if (!confirm('Delete this message?')) {
            return;
        }
        await deletePost(kindOf(), S.gp.cur.id, id);
        await refresh();
    },
    gpretry() {
        return groupsView();
    },
    gpinfo() {
        const i = $('#gp-info');
        i && (i.hidden = !i.hidden);
    },
    gpmenu(b, id) {
        const pop = b.closest('.ch-bub').querySelector('.ch-pop');
        const open = pop.hidden;
        closePops();
        pop.hidden = !open;
    },
    async gpreact(b, id, emoji) {
        closePops();
        await reactPost(kindOf(), S.gp.cur.id, id, emoji);
        await refresh();
    },
    async gpvote(b, id, i) {
        await votePoll(kindOf(), S.gp.cur.id, id, Number(i));
        await refresh();
    },
    gpreply(b, id) {
        closePops();
        const p = (S.gp.posts || []).find(x => x.id === id);
        if (p) {
            draft().reply = { id: p.id, name: p.authorName, text: snippet(p) };
            drawDraft();
            const t = document.querySelector('.ch-comp textarea');
            t && t.focus();
        }
    },
    gpnoreply() {
        delete draft().reply;
        drawDraft();
    },
    gpnoimg() {
        delete draft().img;
        drawDraft();
    },
    gpattach() {
        const m = $('#gp-attach');
        const e = $('#gp-emoji');
        e && (e.hidden = true);
        m && (m.hidden = !m.hidden);
    },
    gpemoji() {
        const e = $('#gp-emoji');
        const m = $('#gp-attach');
        m && (m.hidden = true);
        e && (e.hidden = !e.hidden);
    },
    gpemo(b, id, emoji) {
        const t = document.querySelector('.ch-comp textarea');
        if (t) {
            t.value += emoji;
            t.focus();
        }
    },
    gpimgview(b, id) {
        const p = (S.gp.posts || []).find(x => x.id === id);
        if (p && p.img) {
            const d = document.createElement('div');
            d.className = 'ch-lb';
            d.setAttribute('data-act', 'gpclosebox');
            const im = document.createElement('img');
            im.src = p.img;
            im.alt = 'Photo';
            d.append(im);
            document.body.append(d);
        }
    },
    gpclosebox() {
        document.querySelectorAll('.ch-lb').forEach(x => x.remove());
    },
    gppollnew() {
        const m = $('#gp-attach');
        m && (m.hidden = true);
        document.body.insertAdjacentHTML('beforeend', pollFormHtml());
    },
    gppolladd() {
        const box = $('#gp-opts');
        const n = box.querySelectorAll('input').length;
        if (n < 6) {
            box.insertAdjacentHTML('beforeend', `<label class="fld"><span class="desc">Option ${n + 1}</span><input name="o${n + 1}" maxlength="80"></label>`);
        }
    },
    gpclosepoll() {
        document.querySelectorAll('.ch-modal').forEach(x => x.remove());
    },
    async gpolder() {
        S.gp.limit = (S.gp.limit || 100) + 100;
        S.gp.last = undefined;
        paintMsgs(await listPosts(kindOf(), S.gp.cur.id, S.gp.limit));
    }
};
export const forms = {
    async gpcreate(d) {
        const id = await createGroup(d);
        toast('Group created');
        location.hash = '#/groups/' + id;
    },
    async gpadd(d, e) {
        const r = await addMembers(S.gp.cur.id, d.emails);
        if (r.bad.length) {
            throw new Error('Not an email address: ' + r.bad.slice(0, 3).join(', ') + (r.added.length ? ` (the other ${r.added.length} were added)` : ''));
        }
        e.target.reset();
        toast(r.added.length ? `Added ${r.added.length} ${r.added.length === 1 ? 'person' : 'people'}` : 'Everyone was already in the group');
        await redrawPeople();
    },
    async gppost(d, e) {
        const dr = draft();
        await addPost(kindOf(), S.gp.cur.id, { text: d.text, img: dr.img, reply: dr.reply });
        e.target.reset();
        S.gp.draft = {};
        drawDraft();
        const t = e.target.querySelector('textarea');
        t && (t.style.height = '');
        $('#gp-emoji') && ($('#gp-emoji').hidden = true);
        S.gp.last = undefined; // a message you send always scrolls you to the bottom
        await refresh();
    },
    async gppoll(d, e) {
        const opts = Object.entries(d).filter(([k]) => /^o\d$/.test(k)).map(([, v]) => v);
        await addPost(kindOf(), S.gp.cur.id, { poll: { q: d.q, opts, multi: d.multi === 'on' } });
        actions.gpclosepoll();
        S.gp.last = undefined;
        await refresh();
    }
};
export function bind() {
    // A picture chosen with the + menu is shrunk here in the browser, then waits above the box for a caption.
    document.addEventListener('change', async e => {
        const t = e.target;
        if (t && t.id === 'gp-file' && t.files && t.files[0]) {
            try {
                draft().img = await shrinkChat(t.files[0]);
                drawDraft();
                const m = $('#gp-attach');
                m && (m.hidden = true);
            } catch (x) {
                toast(x.message);
            }
            t.value = '';
        }
    });
    // Enter sends on a computer (Shift+Enter = new line); on a phone Enter is a new line. The box grows with what you type.
    document.addEventListener('keydown', e => {
        const t = e.target;
        if (t && t.matches && t.matches('.ch-comp textarea') && e.key === 'Enter' && !e.shiftKey && matchMedia('(pointer:fine)').matches) {
            e.preventDefault();
            t.form.requestSubmit();
        }
        if (e.key === 'Escape') {
            closePops();
            actions.gpclosebox();
        }
    });
    document.addEventListener('input', e => {
        const t = e.target;
        if (t && t.matches && t.matches('.ch-comp textarea')) {
            t.style.height = 'auto';
            t.style.height = Math.min(t.scrollHeight, 130) + 'px';
        }
    });
    document.addEventListener('click', e => {
        if (!e.target.closest('.ch-pop, .ch-more')) {
            closePops();
        }
    });
}

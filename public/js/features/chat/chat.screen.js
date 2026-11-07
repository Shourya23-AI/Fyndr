// The message pane shared by a group and a community: draws the messages, keeps the view at the bottom, and listens for new ones.
// S.gp = { kind: 'groups' | 'communities', cur: the group or community, posts, limit, last, draft, stop }
import { S } from '../../core/state.js';
import { $ } from '../../core/dom.js';
import { listPosts, subscribe, who } from './chat.data.js';
import { messagesHtml } from '../groups/chat.view.js';
import { loadLikedState } from '../liked/liked.data.js';

export const kindOf = () => (S.gp && S.gp.kind) || 'groups';
const noun = () => (kindOf() === 'communities' ? 'community' : 'group');
export const postsHtml = (posts, uid, leader) => messagesHtml(posts, uid, leader, 'group');

// Draws the messages; keeps the view at the bottom when you were already there (like WhatsApp), and skips the redraw when nothing changed.
export function paintMsgs(posts) {
    const box = $('#gp-msgs');
    const cur = S.gp && S.gp.cur;
    if (!box || !cur) {
        return;
    }
    S.gp.posts = posts;
    const html = messagesHtml(posts, who().uid, cur.leader, noun());
    if (html === S.gp.last) {
        return;
    }
    const stick = S.gp.last === undefined || box.scrollHeight - box.scrollTop - box.clientHeight < 120;
    S.gp.last = html;
    box.innerHTML = (posts.length >= (S.gp.limit || 100) ? '<button class="ch-older" data-act="gpolder">Load earlier messages</button>' : '') + html;
    if (stick) {
        box.scrollTop = box.scrollHeight;
    }
}
export async function redrawPosts() {
    const cur = S.gp && S.gp.cur;
    cur && paintMsgs(await listPosts(kindOf(), cur.id, S.gp.limit || 100));
}
// Starts listening; the previous listener (if any) is stopped. Stops itself when you leave the page.
export async function goLive(kind, id) {
    S.gp.stop && S.gp.stop();
    S.gp.stop = await subscribe(kind, id, S.gp.limit, list => {
        if (S.arg !== id || !$('#gp-msgs')) {
            S.gp.stop && S.gp.stop();
            return;
        }
        paintMsgs(list);
    });
    // shared cards show a filled heart for what you already liked: load that once, then redraw
    loadLikedState().then(() => {
        if (S.gp && S.gp.cur && S.gp.cur.id === id) {
            S.gp.last = undefined;
            return redrawPosts();
        }
    }).catch(() => {});
}

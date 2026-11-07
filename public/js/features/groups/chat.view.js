import { esc, safeUrl } from '../../core/dom.js';
import { safeImg } from '../../core/image.js';
import { LIMITS } from '../community/community.helpers.js';
import { QUICK, EMOJI, hue, clock, dayKey, dayLabel, tally, reactionCounts, snippet, initial } from './chat.helpers.js';
import { KIND_LABEL } from '../share/share.js';
import { HEART, KIND_ICON } from '../share/share.view.js';
import { isLiked } from '../liked/liked.data.js';
// The WhatsApp-style pieces: message bubbles (name on top, reply quote, photo, poll, reactions), the composer and the emoji tray.
const pollHtml = (p, uid) => {
    const { counts, voters, mine } = tally(p.poll, p.votes, uid);
    const total = Math.max(1, voters);
    return `<div class="ch-poll"><b>📊 ${esc(p.poll.q)}</b><small>${p.poll.multi ? 'Select one or more' : 'Select one'}</small>${p.poll.opts.map((o, i) => `<button type="button" class="ch-opt${mine.includes(i) ? ' on' : ''}" data-act="gpvote" data-id="${esc(p.id)}" data-s="${i}"><span class="ch-fill" style="width:${Math.round(counts[i] / total * 100)}%"></span><span class="ch-ot"><i>${mine.includes(i) ? '✓' : ''}</i>${esc(o)}</span><em>${counts[i]}</em></button>`).join('')}<small>${voters} ${voters === 1 ? 'vote' : 'votes'}</small></div>`;
};
// A job, course or book shared from Fyndr: a small card with View, Like and the official link.
const shareHtml = p => {
    const s = p.share;
    const k = KIND_ICON[s.kind] ? s.kind : 'job';
    const img = safeImg(s.img) || safeUrl(s.img);
    const liked = isLiked(s);
    const link = safeUrl(s.url);
    return `<div class="ch-share" data-k="${k}"><div class="sh-top"><span class="sh-pic">${img ? `<img src="${esc(img)}" alt="" loading="lazy" referrerpolicy="no-referrer">` : ''}<i>${KIND_ICON[k]}</i></span><span class="sh-txt"><span class="sh-kind">${esc(KIND_LABEL[k])}${s.tag ? ' · ' + esc(s.tag) : ''}</span><b>${esc(s.title)}</b>${s.sub ? `<small>${esc(s.sub)}</small>` : ''}</span></div>
<div class="sh-acts"><button type="button" class="sh-btn" data-act="shview" data-id="${esc(p.id)}">View</button><button type="button" class="sh-btn sh-like${liked ? ' on' : ''}" data-act="shlike" data-id="${esc(p.id)}" aria-pressed="${liked}">${HEART}<span>${liked ? 'Liked' : 'Like'}</span></button>${link ? `<a class="sh-btn" href="${esc(link)}" target="_blank" rel="noopener noreferrer nofollow">Open ↗</a>` : ''}</div></div>`;
};
const bubble = (p, uid, leader, first) => {
    const me = p.authorId === uid;
    const img = safeImg(p.img);
    const rc = reactionCounts(p.reactions, uid);
    const canDel = me || leader;
    const reply = p.reply && p.reply.name ? `<div class="ch-quote" style="--h:${hue(p.reply.name)}"><b>${esc(p.reply.name)}</b><span>${esc(p.reply.text || '')}</span></div>` : '';
    return `<div class="ch-row ${me ? 'me' : 'them'}${first ? ' first' : ''}" data-mid="${esc(p.id)}"><div class="ch-bub">
${!me && first ? `<b class="ch-name" style="--h:${hue(p.authorId || p.authorName)}">${esc(p.authorName)}</b>` : ''}${reply}
${img ? `<img class="ch-img" src="${esc(img)}" alt="Photo from ${esc(p.authorName)}" data-act="gpimgview" data-id="${esc(p.id)}">` : ''}${p.poll ? pollHtml(p, uid) : ''}${p.share ? shareHtml(p) : ''}${p.text ? `<p class="ch-text">${esc(p.text)}</p>` : ''}
<span class="ch-meta">${clock(p.t)}${me ? '<span class="ch-tick">✓✓</span>' : ''}</span>
<button type="button" class="ch-more" data-act="gpmenu" data-id="${esc(p.id)}" aria-label="Message options">⌄</button>
${Object.keys(rc).length ? `<div class="ch-reacts">${Object.entries(rc).map(([e, r]) => `<button type="button" class="ch-react${r.mine ? ' mine' : ''}" data-act="gpreact" data-id="${esc(p.id)}" data-s="${e}">${e}${r.n > 1 ? ' ' + r.n : ''}</button>`).join('')}</div>` : ''}
<div class="ch-pop" hidden><div class="ch-emo">${QUICK.map(e => `<button type="button" data-act="gpreact" data-id="${esc(p.id)}" data-s="${e}">${e}</button>`).join('')}</div><button type="button" data-act="gpreply" data-id="${esc(p.id)}">↩ Reply</button>${canDel ? `<button type="button" class="ch-del" data-act="gpdelpost" data-id="${esc(p.id)}">🗑 Delete</button>` : ''}</div>
</div></div>`;
};
export function messagesHtml(posts, uid, leader, noun = 'group') {
    if (!posts.length) {
        return `<div class="ch-empty"><b>No messages yet</b><p>Say hello to the ${noun} 👋</p></div>`;
    }
    let out = '';
    let day = '';
    let prev = null;
    for (const p of posts) {
        const k = dayKey(p.t);
        if (k !== day) {
            out += `<div class="ch-day"><span>${dayLabel(p.t)}</span></div>`;
            day = k;
            prev = null;
        }
        out += bubble(p, uid, leader, !prev || prev.authorId !== p.authorId);
        prev = p;
    }
    return out;
}
export const composerHtml = () => `<form class="ch-comp" data-form="gppost" autocomplete="off"><div id="gp-draft"></div>
<div class="ch-bar"><button type="button" class="ch-ic" data-act="gpemoji" aria-label="Emoji">😊</button>
<span class="ch-attach"><button type="button" class="ch-ic" data-act="gpattach" aria-label="Attach">＋</button><span id="gp-attach" class="ch-menu" hidden><label class="ch-it">🖼️ Photo<input type="file" id="gp-file" accept="image/jpeg,image/png,image/webp,image/gif" hidden></label><button type="button" class="ch-it" data-act="gppollnew">📊 Poll</button><button type="button" class="ch-it" data-act="shpick">🔖 Job, course or book</button></span></span>
<textarea name="text" rows="1" maxlength="${LIMITS.post}" placeholder="Type a message" aria-label="Message"></textarea>
<button class="ch-send" aria-label="Send"><svg viewBox="0 0 24 24"><path d="M3 20.5 21 12 3 3.5l2 7.5 9 1-9 1z"/></svg></button></div>
<div id="gp-emoji" class="ch-tray" hidden>${EMOJI.map(e => `<button type="button" data-act="gpemo" data-s="${e}">${e}</button>`).join('')}</div><p class="err"></p></form>`;
export const draftHtml = d => `${d.reply ? `<div class="ch-dr" style="--h:${hue(d.reply.name)}"><span><b>${esc(d.reply.name)}</b>${esc(d.reply.text)}</span><button type="button" data-act="gpnoreply" aria-label="Cancel reply">×</button></div>` : ''}${d.img ? `<div class="ch-dr img"><img src="${esc(safeImg(d.img))}" alt="Photo to send"><span>Add a caption below, then send.</span><button type="button" data-act="gpnoimg" aria-label="Remove photo">×</button></div>` : ''}`;
export const pollFormHtml = () => `<div class="ch-modal"><div class="ch-modal-back" data-act="gpclosepoll"></div><form class="ch-card" data-form="gppoll" role="dialog" aria-modal="true" aria-label="Create a poll"><h3>Create a poll</h3>
<label class="fld"><span class="desc">Question</span><input name="q" required maxlength="200" placeholder="Ask something…"></label>
<div id="gp-opts">${[1, 2, 3].map(i => `<label class="fld"><span class="desc">Option ${i}</span><input name="o${i}" maxlength="80" ${i < 3 ? 'required' : ''}></label>`).join('')}</div>
<button type="button" class="button button-small" data-act="gppolladd">+ Add option</button>
<label class="ch-chk"><input type="checkbox" name="multi"> Allow more than one answer</label><p class="err"></p>
<div class="cm-acts"><button type="button" class="button button-small" data-act="gpclosepoll">Cancel</button><button class="button button-dark button-small">Send poll</button></div></form></div>`;
export { initial };

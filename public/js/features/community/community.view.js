import { S } from '../../core/state.js';
import { $, esc } from '../../core/dom.js';
import { listCommunities, getCommunity, listPosts, listMembers, who } from './community.data.js';
import { when, plural, LIMITS } from './community.helpers.js';
import { composerHtml } from '../groups/chat.view.js';
import { initial } from '../groups/chat.helpers.js';
import { paintMsgs, redrawPosts, postsHtml, goLive } from '../chat/chat.screen.js';
// Community pages. #/community = every community (join any of them); #/community/<id> = one community's chat.
// A community is a chat room just like a group (messages, photos, polls, reactions, replies, shared jobs / courses / books),
// except that it is open: anyone can join, and the creator leads it (removes members, deletes any message).
const ID = /^[A-Za-z0-9_-]{1,40}$/;
export { initial, postsHtml, redrawPosts, paintMsgs };
const note = (b, p, a = '') => `<div class="container page cm-page"><div class="empty"><b>${b}</b><p>${p}</p>${a}</div></div>`;
const listSkeleton = '<div class="container page cm-page"><div class="cm-grid">' + '<div class="sk cm-sk"></div>'.repeat(6) + '</div></div>';

const card = c => `<article class="cm-card"><a class="cm-name" href="#/community/${esc(c.id)}"><span class="cm-av">${initial(c.name)}</span><span><h3>${esc(c.name)}</h3><small>${plural(c.memberCount || 0, 'member', 'members')}</small></span></a>
<p class="cm-desc">${esc(c.desc || 'No description yet.')}</p>
<div class="cm-acts"><a class="button button-small" href="#/community/${esc(c.id)}">Open</a>${c.joined ? '<span class="tag tag-verified">Joined</span>' : `<button class="button button-dark button-small" data-act="cmjoin" data-id="${esc(c.id)}">Join</button>`}</div></article>`;

// ---------- all communities ----------
export function drawList() {
    const { list = [], q = '' } = S.cm || {};
    const words = q.toLowerCase().split(/\s+/).filter(Boolean);
    const shown = words.length ? list.filter(c => words.every(w => (c.name + ' ' + (c.desc || '')).toLowerCase().includes(w))) : list;
    const mine = shown.filter(c => c.joined);
    const rest = shown.filter(c => !c.joined);
    $('#app').innerHTML = `<section class="hero hero-compact container"><div><h1>Communities</h1><p class="lead">Talk with people who share your interests. Anyone can join any community, or start a new one.</p>
<form class="search-box" data-form="cmsearch" role="search"><label class="search-field"><input name="q" type="search" aria-label="Search communities" placeholder="Search communities" value="${esc(q)}" maxlength="80" autocomplete="off"></label><button class="search-button">Search</button></form></div></section>
<section class="container page cm-page"><div class="cm-bar"><button class="button button-dark button-small" data-act="cmnew">+ Create a community</button></div>
<form class="form panel cm-new" data-form="cmcreate" id="cm-new" hidden><h3>Start a community</h3>
<label class="fld"><span class="desc">Name *</span><input name="name" required minlength="3" maxlength="${LIMITS.name}" placeholder="e.g. Bengaluru freshers, Python beginners"></label>
<label class="fld"><span class="desc">What is it about?</span><textarea name="desc" maxlength="${LIMITS.desc}" rows="3" placeholder="A line or two so people know what to talk about here"></textarea></label>
<p class="err"></p><div class="cm-acts"><button type="button" class="button button-small" data-act="cmnew">Cancel</button><button class="button button-dark button-small">Create community</button></div></form>
${mine.length ? `<h2 class="lib-h">Your communities</h2><div class="cm-grid">${mine.map(card).join('')}</div>` : ''}
<h2 class="lib-h">${mine.length ? 'More communities' : 'All communities'}</h2>
${rest.length ? `<div class="cm-grid">${rest.map(card).join('')}</div>` : `<div class="empty"><b>${shown.length ? 'You have joined every community here' : q ? 'No community matches that' : 'No communities yet'}</b><p>${q ? 'Try fewer words, or start it yourself.' : 'Be the first: create one and others can join.'}</p></div>`}
</section>`;
}
async function listView() {
    $('#app').innerHTML = listSkeleton;
    let list;
    try {
        list = await listCommunities();
    } catch (e) {
        $('#app').innerHTML = note('Could not load communities', esc(e.message), '<button class="button button-dark button-small" data-act="cmretry">Try again</button>');
        return;
    }
    if (location.hash.split('?')[0].replace(/\/$/, '') !== '#/community') {
        return; // moved to another page while loading
    }
    S.cm = { q: S.cm?.q || '', list };
    drawList();
}

// ---------- one community ----------
export const peopleHtml = (list, c, uid) => `<ul class="gp-list">${list.map(p => `<li><span>${esc(p.name)}${p.uid === c.creatorId ? ' <span class="gp-leader">Creator</span>' : ''}${p.uid === uid ? ' <small class="cm-meta">(you)</small>' : ''}</span>${c.leader && p.uid !== c.creatorId ? `<button class="gp-rm" data-act="cmrm" data-id="${esc(p.uid)}">Remove</button>` : ''}</li>`).join('')}</ul>`;
export async function redrawPeople() {
    const cur = S.gp && S.gp.cur;
    const box = $('#cm-people');
    if (!cur || !box) {
        return;
    }
    const list = await listMembers(cur.id);
    box.innerHTML = peopleHtml(list, cur, who().uid);
    const n = plural(list.length, 'member', 'members');
    ['#gp-count', '#gp-count2'].forEach(q => {
        const e = $(q);
        e && (e.textContent = n);
    });
}
async function detail(id) {
    $('#app').innerHTML = listSkeleton;
    if (!ID.test(id)) {
        $('#app').innerHTML = note('Community not found', 'Check the address, or pick one from the list.', '<a class="button button-dark button-small" href="#/community">All communities</a>');
        return;
    }
    let c;
    let posts = [];
    try {
        c = await getCommunity(id);
        if (c) {
            posts = await listPosts(id);
        }
    } catch (e) {
        $('#app').innerHTML = note('Could not open this community', esc(e.message), '<a class="button button-dark button-small" href="#/community">All communities</a>');
        return;
    }
    if (!c) {
        $('#app').innerHTML = note('Community not found', 'It may have been removed.', '<a class="button button-dark button-small" href="#/community">All communities</a>');
        return;
    }
    if (S.arg !== id) {
        return;
    }
    S.gp && S.gp.stop && S.gp.stop();
    S.gp = { ...(S.gp || {}), kind: 'communities', cur: c, limit: 100, last: undefined, draft: {}, posts };
    S.cm = { ...(S.cm || {}), cur: c };
    const count = plural(c.memberCount || 0, 'member', 'members');
    const joinBar = `<div class="ch-join"><span><b>Join to take part</b><small>You can read everything here. Join to write messages, vote and react.</small></span><button class="button button-dark button-small" data-act="cmjoin" data-id="${esc(c.id)}">Join community</button></div>`;
    $('#app').innerHTML = `<section class="ch-wrap"><div class="ch">
<header class="ch-head"><a class="ch-back" href="#/community" aria-label="Back to all communities">←</a><span class="cm-av">${initial(c.name)}</span><button class="ch-title" data-act="gpinfo"><b>${esc(c.name)}</b><small><span id="gp-count">${count}</span> · open to everyone</small></button>${c.joined ? '' : `<button class="button button-dark button-small ch-joinbtn" data-act="cmjoin" data-id="${esc(c.id)}">Join</button>`}<button class="ch-ic" data-act="gpinfo" aria-label="Community info">ⓘ</button></header>
<div id="gp-msgs" class="ch-msgs" aria-live="polite"></div>
${c.joined ? composerHtml() : joinBar}
<aside id="gp-info" class="ch-info" hidden><div class="ch-ihead"><b>Community info</b><button class="ch-ic" data-act="gpinfo" aria-label="Close">×</button></div>
<div class="ch-ibody"><span class="cm-av big">${initial(c.name)}</span><h2>${esc(c.name)}</h2><p class="desc">${esc(c.desc || 'No description yet.')}</p><p class="cm-meta"><span id="gp-count2">${count}</span> · started by ${esc(c.creatorName || 'a member')} · ${when(c.t)}</p>
<div class="cm-acts"><button class="button button-small" data-act="cminvite" data-id="${esc(c.id)}">Copy invite link</button></div>
<h3>People</h3><div id="cm-people"><p class="desc">Loading…</p></div>
<div class="cm-acts">${c.leader ? `<button class="button button-small" data-act="cmdelete" data-id="${esc(c.id)}">Delete community</button>` : c.joined ? `<button class="button button-small" data-act="cmleave" data-id="${esc(c.id)}">Leave community</button>` : ''}</div></div></aside></div></section>`;
    paintMsgs(posts);
    redrawPeople().catch(() => {
        const b = $('#cm-people');
        b && (b.innerHTML = '<p class="desc">Could not load the list of people.</p>');
    });
    await goLive('communities', id);
}

export async function communityView() {
    return S.arg ? detail(S.arg) : listView();
}

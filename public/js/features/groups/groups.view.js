import { S } from '../../core/state.js';
import { $, esc } from '../../core/dom.js';
import { listGroups, getGroup, listPosts, who } from './groups.data.js';
import { composerHtml } from './chat.view.js';
import { initial } from './chat.helpers.js';
import { paintMsgs, redrawPosts, postsHtml, goLive } from '../chat/chat.screen.js';
import { when, plural, LIMITS } from '../community/community.helpers.js';
// Group pages. #/groups = the groups you are in; #/groups/<id> = one group. Only the leader sees the "add people" box.
const ID = /^[A-Za-z0-9_-]{1,40}$/;
const back = '<a class="button button-dark button-small" href="#/groups">My groups</a>';
const note = (b, p, a = '') => `<div class="container page cm-page"><div class="empty"><b>${b}</b><p>${p}</p>${a}</div></div>`;
const skeleton = '<div class="container page cm-page"><div class="cm-grid">' + '<div class="sk cm-sk"></div>'.repeat(4) + '</div></div>';

const card = g => `<article class="cm-card"><a class="cm-name" href="#/groups/${esc(g.id)}"><span class="cm-av">${initial(g.name)}</span><span><h3>${esc(g.name)}</h3><small>${plural(g.members.length, 'person', 'people')}</small></span></a>
<p class="cm-desc">${esc(g.desc || 'No description yet.')}</p>
<div class="cm-acts"><a class="button button-small" href="#/groups/${esc(g.id)}">Open</a>${g.leader ? '<span class="gp-leader">You lead this</span>' : `<small class="cm-meta">Leader: ${esc(g.leaderName || '')}</small>`}</div></article>`;

export function drawList() {
    const list = (S.gp && S.gp.list) || [];
    $('#app').innerHTML = `<section class="hero hero-compact container"><div><h1>Groups</h1><p class="lead">Private spaces for a team, a class or friends. The person who creates a group is its leader, and only the leader can add people.</p></div></section>
<section class="container page cm-page"><div class="cm-bar"><button class="button button-dark button-small" data-act="gpnew">+ Create a group</button></div>
<form class="form panel cm-new" data-form="gpcreate" id="gp-new" hidden><h3>Start a group</h3>
<label class="fld"><span class="desc">Name *</span><input name="name" required minlength="3" maxlength="${LIMITS.name}" placeholder="e.g. Final year project team"></label>
<label class="fld"><span class="desc">What is it for?</span><textarea name="desc" maxlength="${LIMITS.desc}" rows="2" placeholder="A line so everyone knows"></textarea></label>
<label class="fld"><span class="desc">Add people now (optional): their email addresses</span><textarea name="emails" rows="2" placeholder="asha@example.com, ravi@example.com"></textarea></label>
<p class="err"></p><div class="cm-acts"><button type="button" class="button button-small" data-act="gpnew">Cancel</button><button class="button button-dark button-small">Create group</button></div></form>
<h2 class="lib-h">Your groups</h2>
${list.length ? `<div class="cm-grid">${list.map(card).join('')}</div>` : '<div class="empty"><b>You are not in any group yet</b><p>Create one, or ask a group leader to add your email address.</p></div>'}</section>`;
}
async function listView() {
    $('#app').innerHTML = skeleton;
    let list;
    try {
        list = await listGroups();
    } catch (e) {
        $('#app').innerHTML = note('Could not load groups', esc(e.message), '<button class="button button-dark button-small" data-act="gpretry">Try again</button>');
        return;
    }
    if (location.hash.split('?')[0].replace(/\/$/, '') !== '#/groups') {
        return;
    }
    S.gp = { list };
    drawList();
}

export { postsHtml, paintMsgs, redrawPosts };
export const peopleHtml = g => `<ul class="gp-list">${g.members.map(e => `<li><span>${esc(e)}${e === g.leaderEmail ? ' <span class="gp-leader">Leader</span>' : ''}</span>${g.leader && e !== g.leaderEmail ? `<button class="gp-rm" data-act="gprm" data-id="${esc(e)}">Remove</button>` : ''}</li>`).join('')}</ul>`;
export async function redrawPeople() {
    const cur = S.gp && S.gp.cur;
    const g = cur && await getGroup(cur.id);
    if (g) {
        S.gp.cur = g;
        $('#gp-people').innerHTML = peopleHtml(g);
        $('#gp-count').textContent = plural(g.members.length, 'person', 'people');
        const c2 = $('#gp-count2');
        c2 && (c2.textContent = plural(g.members.length, 'person', 'people'));
    }
}
async function detail(id) {
    $('#app').innerHTML = skeleton;
    if (!ID.test(id)) {
        $('#app').innerHTML = note('Group not found', 'Check the address.', back);
        return;
    }
    let g;
    let posts = [];
    try {
        g = await getGroup(id);
        if (g) {
            posts = await listPosts(id);
        }
    } catch (e) {
        // A group you are not on the list of is simply not visible to you.
        $('#app').innerHTML = note('This group is private', 'You can only open a group if its leader added your email address.', back);
        return;
    }
    if (!g || S.arg !== id) {
        if (!g) {
            $('#app').innerHTML = note('Group not found', 'It may have been deleted.', back);
        }
        return;
    }
    const u = who();
    S.gp && S.gp.stop && S.gp.stop();
    S.gp = { ...(S.gp || {}), kind: 'groups', cur: g, limit: 100, last: undefined, draft: {}, posts };
    const names = g.members.slice(0, 4).map(e => e.split('@')[0]).join(', ') + (g.members.length > 4 ? '…' : '');
    $('#app').innerHTML = `<section class="ch-wrap"><div class="ch">
<header class="ch-head"><a class="ch-back" href="#/groups" aria-label="Back to my groups">←</a><span class="cm-av">${initial(g.name)}</span><button class="ch-title" data-act="gpinfo"><b>${esc(g.name)}</b><small><span id="gp-count">${plural(g.members.length, 'person', 'people')}</span> · ${esc(names)}</small></button><button class="ch-ic" data-act="gpinfo" aria-label="Group info">ⓘ</button></header>
<div id="gp-msgs" class="ch-msgs" aria-live="polite"></div>
${composerHtml()}
<aside id="gp-info" class="ch-info" hidden><div class="ch-ihead"><b>Group info</b><button class="ch-ic" data-act="gpinfo" aria-label="Close">×</button></div>
<div class="ch-ibody"><span class="cm-av big">${initial(g.name)}</span><h2>${esc(g.name)}</h2><p class="desc">${esc(g.desc || 'No description yet.')}</p><p class="cm-meta"><span id="gp-count2">${plural(g.members.length, 'person', 'people')}</span> · led by ${esc(g.leaderName || 'the leader')} · ${when(g.t)}</p>
${g.leader ? `<form class="form gp-add" data-form="gpadd"><h3>Add people</h3><p class="desc">Type their email addresses, separated by commas. They see the group when they sign in with that email.</p><textarea name="emails" required rows="2" placeholder="asha@example.com, ravi@example.com"></textarea><p class="err"></p><div class="cm-acts"><button class="button button-dark button-small">Add to group</button></div></form>` : ''}
<h3>People</h3><div id="gp-people">${peopleHtml(g)}</div>
<div class="cm-acts">${g.leader ? `<button class="button button-small" data-act="gpdelete" data-id="${esc(g.id)}">Delete group</button>` : `<button class="button button-small" data-act="gpleave" data-id="${esc(g.id)}">Leave group</button>`}</div></div></aside></div></section>`;
    paintMsgs(posts);
    await goLive('groups', id);
}
export async function groupsView() {
    return S.arg ? detail(S.arg) : listView();
}

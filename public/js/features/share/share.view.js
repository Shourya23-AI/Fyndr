// HTML for sharing: the picker inside a chat ("Job, course or book") and the "Share to a group or community" dialog.
// Pure string builders (no network). The handlers are in share.actions.js.
import { esc, safeUrl } from '../../core/dom.js';
import { safeImg } from '../../core/image.js';
import { KIND_LABEL } from './share.js';

export const HEART = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20.5S3.5 15 3.5 9.3A4.8 4.8 0 0 1 12 6.6a4.8 4.8 0 0 1 8.5 2.7C20.5 15 12 20.5 12 20.5z"/></svg>';
export const SHARE_ICON = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12v7a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-7M16 6l-4-4-4 4M12 2v13"/></svg>';
export const KIND_ICON = {
    job: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 8h18v11a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1zM9 8V5.5A1.5 1.5 0 0 1 10.5 4h3A1.5 1.5 0 0 1 15 5.5V8M3 13h18"/></svg>',
    course: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 9.5 12 5l9 4.5-9 4.5zM7 12v4.2c0 1 2.2 2.3 5 2.3s5-1.3 5-2.3V12"/></svg>',
    book: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 4.5A1.5 1.5 0 0 1 5.5 3H11v17H5.5A1.5 1.5 0 0 0 4 21.5zM20 4.5A1.5 1.5 0 0 0 18.5 3H13v17h5.5a1.5 1.5 0 0 1 1.5 1.5z"/></svg>'
};
export const TABS = [['job', 'Jobs'], ['course', 'Courses'], ['book', 'Books']];

const pic = s => {
    const img = safeImg(s.img) || safeUrl(s.img);
    return `<span class="sh-pic">${img ? `<img src="${esc(img)}" alt="" loading="lazy" referrerpolicy="no-referrer">` : ''}<i>${KIND_ICON[s.kind] || ''}</i></span>`;
};
const line = s => [s.sub, s.tag].filter(Boolean).join(' · ');

// One row of the picker. i = its place in S.sh.items.
export const itemHtml = (s, i) => `<button type="button" class="sh-item" data-act="shsend" data-id="${i}">${pic(s)}<span class="sh-txt"><b>${esc(s.title)}</b>${line(s) ? `<small>${esc(line(s))}</small>` : ''}</span>${s.liked ? `<span class="sh-lk" title="You liked this">${HEART}</span>` : ''}</button>`;

export function itemsHtml(items, tab, q, note = '') {
    if (!items.length) {
        const what = KIND_LABEL[tab].toLowerCase() + 's';
        const msg = tab === 'book' && !q ? 'Type a title or an author above to find a book. Books you liked show up here first.' : q ? `No ${what} match “${esc(q)}”.` : `Nothing to show yet. Browse ${what} and tap the heart to keep them here.`;
        return `<p class="sh-none">${msg}${note ? '<br>' + esc(note) : ''}</p>`;
    }
    return items.map(itemHtml).join('') + (note ? `<p class="sh-none">${esc(note)}</p>` : '');
}

export const pickerHtml = (tab, q) => `<div class="ch-modal sh-modal" id="sh-modal"><div class="ch-modal-back" data-act="shclose"></div>
<div class="ch-card sh-card" role="dialog" aria-modal="true" aria-label="Share a job, course or book"><div class="sh-head"><h3>Share from Fyndr</h3><button type="button" class="ch-ic" data-act="shclose" aria-label="Close">×</button></div>
<div class="sh-tabs" role="tablist">${TABS.map(([k, t]) => `<button type="button" role="tab" class="${k === tab ? 'on' : ''}" aria-selected="${k === tab}" data-act="shtab" data-id="${k}">${t}</button>`).join('')}</div>
<label class="sh-search"><input type="search" id="sh-q" placeholder="Search ${KIND_LABEL[tab].toLowerCase()}s" value="${esc(q)}" maxlength="80" autocomplete="off" aria-label="Search"></label>
<div class="sh-list" id="sh-list" aria-live="polite"><p class="sh-none">Loading…</p></div></div></div>`;

// "Share to…": the person's groups and the communities they joined. t = { root: 'groups' | 'communities', id, name }
export function targetsHtml(item, targets, loading) {
    const rows = targets.map(t => `<button type="button" class="sh-item sh-to" data-act="shto" data-id="${esc(t.root + ':' + t.id)}"><span class="sh-pic sh-av"><b>${esc((String(t.name || '?').trim()[0] || '?').toUpperCase())}</b></span><span class="sh-txt"><b>${esc(t.name)}</b><small>${t.root === 'groups' ? 'Group' : 'Community'}</small></span></button>`).join('');
    const empty = loading ? '<p class="sh-none">Loading your groups and communities…</p>' : '<p class="sh-none">You are not in any group or community yet.<br><a href="#/groups" data-act="shclose">Start a group</a> or <a href="#/community" data-act="shclose">join a community</a>, then share from here.</p>';
    return `<div class="ch-modal sh-modal" id="sh-modal"><div class="ch-modal-back" data-act="shclose"></div>
<div class="ch-card sh-card" role="dialog" aria-modal="true" aria-label="Share to a group or community"><div class="sh-head"><h3>Share to…</h3><button type="button" class="ch-ic" data-act="shclose" aria-label="Close">×</button></div>
<div class="sh-pending">${pic(item)}<span class="sh-txt"><span class="sh-kind">${esc(KIND_LABEL[item.kind])}</span><b>${esc(item.title)}</b></span></div>
<div class="sh-list">${rows || empty}</div></div></div>`;
}

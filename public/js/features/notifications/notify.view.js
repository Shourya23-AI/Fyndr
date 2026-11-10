import { S } from '../../core/state.js';
import { $, esc } from '../../core/dom.js';
import { skeleton } from '../../core/skeleton.js';
import { loadBox, saveBox, markAllRead, unread, ago } from './notify.rules.js';
import { checkNow } from './notify.service.js';
import { refreshBell } from './notify.bell.js';
// #/notifications: status changes on your applications and new listings that fit you. Candidates only.
const uid = () => (S.me && (S.me.id || S.me.email)) || 'me';
const ICON = { status: 'M5 12l4.5 4.5L19 7', match: 'M12 3l2.6 5.6 6.1.7-4.5 4.2 1.2 6L12 16.5 6.6 19.5l1.2-6L3.3 9.3l6.1-.7z' };
export const itemHtml = (x, now = Date.now()) => `<li class="nt-item${x.read ? '' : ' new'}"><span class="nt-ic ${x.kind}" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="${ICON[x.kind]}"/></svg></span><div class="nt-body"><b>${esc(x.title)}</b>${x.read ? '' : '<span class="nt-new">New</span>'}<p>${esc(x.text)}</p><small>${esc(ago(x.at, now))}</small></div><button type="button" class="button button-small" data-act="nt-open" data-id="${esc(x.id)}">${x.kind === 'match' ? 'See matches' : 'View application'}</button></li>`;
export function emptyHtml(completion) {
    const todo = completion < 100 ? '<a class="button button-dark button-small" href="#/profile">Finish your profile</a>' : '';
    return `<div class="empty nt-empty"><b>Nothing new yet</b><p>This is where you will hear about two things: when an organization moves one of your applications forward, and when a new listing that fits your skills is posted.</p><p>${completion < 100 ? 'Match alerts get better the more skills you list.' : 'You are all set. Check back soon.'}</p><div class="nt-cta">${todo}<a class="button button-small" href="#/jobs">Browse jobs and internships</a></div></div>`;
}
export function pageHtml(box, completion = 100, now = Date.now()) {
    const on = box.prefs.match;
    const list = box.items.length ? `<ul class="nt-list" aria-label="Notifications">${box.items.map(x => itemHtml(x, now)).join('')}</ul>` : emptyHtml(completion);
    return `<div class="container page"><div class="nt-page"><div class="pf-top"><div><h2>Notifications</h2><p class="desc">Application updates and new listings that fit you. Kept on this device.</p></div><div class="nt-tools"><button type="button" class="button button-small" data-act="nt-check">Check now</button>${box.items.length ? '<button type="button" class="button button-small" data-act="nt-clear">Clear all</button>' : ''}</div></div>
<div class="panel nt-pref"><div><b>Alerts for new matches</b><p class="desc">${on ? 'On: you are told when a new listing fits your profile.' : 'Off: you will still hear about changes to your applications.'}</p></div><button type="button" class="button button-small" data-act="nt-match" role="switch" aria-checked="${on}">${on ? 'Turn off' : 'Turn on'}</button></div>${list}</div></div>`;
}
export async function notifyView() {
    if (!S.me || S.me.role !== 'user') {
        return (location.hash = '#/dashboard');
    }
    if (!loadBox(localStorage, uid())) {
        $('#app').innerHTML = skeleton('center');
        await checkNow({ force: true });
    }
    draw(true);
}
// Draws the inbox. The unread highlights stay on screen this once; they are saved as read right after.
export function draw(markRead = false) {
    const box = loadBox(localStorage, uid()) || { items: [], prefs: { match: true } };
    $('#app').innerHTML = pageHtml(box, S.me?.completion ?? 100);
    if (markRead && unread(box)) {
        saveBox(localStorage, uid(), markAllRead(box));
        refreshBell();
    }
}

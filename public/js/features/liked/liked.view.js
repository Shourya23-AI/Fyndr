// The Liked page (#/liked, #/liked/jobs, #/liked/books): everything the person kept, in three tabs.
//   Courses and Jobs are the saved listings the site already had (the heart on a card). Books are the liked books (liked.data.js).
import { S } from '../../core/state.js';
import { $, esc } from '../../core/dom.js';
import { api } from '../../core/api.js';
import { skeleton } from '../../core/skeleton.js';
import { card } from '../browse/card.js';
import { bookCard } from '../library/library.js';
import { loadLikedBooks, likedBooksNow } from './liked.data.js';

export const TABS = [['courses', 'Courses'], ['jobs', 'Jobs & internships'], ['books', 'Books']];
const EMPTY = {
    courses: ['No liked courses yet', 'Tap the heart on a course and it waits for you here.', '#/courses', 'Browse courses'],
    jobs: ['No liked jobs yet', 'Tap the heart on a job or internship to keep it here.', '#/jobs', 'Browse jobs'],
    books: ['No liked books yet', 'Tap the heart on any book in the Library to keep it here.', '#/library', 'Open the Library']
};
const empty = k => `<div class="empty"><b>${EMPTY[k][0]}</b><p>${EMPTY[k][1]}</p><a class="button button-dark button-small" href="${EMPTY[k][2]}">${EMPTY[k][3]}</a></div>`;

export function drawLiked() {
    const lk = S.lk || (S.lk = { tab: 'courses', courses: [], jobs: [] });
    const books = likedBooksNow();
    const n = { courses: lk.courses.length, jobs: lk.jobs.length, books: books.length };
    const user = S.me && S.me.role === 'user';
    let body;
    if (lk.tab === 'books') {
        body = books.length ? `<div class="bk-grid">${books.map(bookCard).join('')}</div>` : empty('books');
    } else if (!user) {
        body = '<div class="empty"><b>Saving is for candidate accounts</b><p>Jobs and courses can be saved from a candidate account. Books can be liked from any account.</p></div>';
    } else {
        const list = lk[lk.tab];
        body = list.length ? `<div class="opportunity-grid">${list.map(l => card(l)).join('')}</div>` : empty(lk.tab);
    }
    $('#app').innerHTML = `<section class="hero hero-compact container lk-hero"><div><h1>Liked</h1><p class="lead">Your courses, jobs and books, all in one quick place.</p></div></section>
<section class="container page lk-page"><div class="lk-tabs" role="tablist" aria-label="Liked items">${TABS.map(([k, t]) => `<button type="button" role="tab" class="${lk.tab === k ? 'on' : ''}" aria-selected="${lk.tab === k}" data-act="likedtab" data-id="${k}">${t}<em>${n[k]}</em></button>`).join('')}</div>
<div id="lk-body">${body}</div></section>`;
}

// quiet = redraw without the loading placeholder (after un-liking something)
export async function likedView(quiet) {
    if (!S.me) {
        location.hash = '#/login';
        return;
    }
    const lk = (S.lk ||= { tab: 'courses', courses: [], jobs: [] });
    if (TABS.some(t => t[0] === S.arg)) {
        lk.tab = S.arg;
    }
    if (!quiet) {
        $('#app').innerHTML = skeleton('list');
    }
    try {
        const user = S.me.role === 'user';
        const [mine, all] = await Promise.all([user ? api('/my') : null, user ? api('/listings') : [], loadLikedBooks(true)]);
        if (location.hash.split('?')[0].split('/')[1] !== 'liked') {
            return; // moved to another page while loading
        }
        if (mine) {
            S.mine = mine;
        }
        const saved = new Set((mine && mine.saved) || []);
        const mineList = all.filter(l => saved.has(l.id));
        lk.courses = mineList.filter(l => l.type === 'Course');
        lk.jobs = mineList.filter(l => l.type !== 'Course');
    } catch (e) {
        $('#app').innerHTML = `<div class="container page"><div class="empty"><b>Could not load your liked items</b><p>${esc(e.message)}</p><button class="button button-dark button-small" data-act="likedretry">Try again</button></div></div>`;
        return;
    }
    drawLiked();
}

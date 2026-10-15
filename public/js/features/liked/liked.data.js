// Liked books. (Liked jobs and courses are the "saved" listings the site already had: S.mine.saved.)
//   users/{uid}/likedBooks/{key}   one book each: id, title, authors[], year, cover, access, read, info, epub, src, at
// The whole book is kept so "Read now" and "Details" still work from the Liked page. firestore.rules lets only the owner read or write them.
import { fb } from '../../services/firebase/firebase-init.js';
import { S } from '../../core/state.js';
import { safeUrl } from '../../core/dom.js';
import { oneLine } from '../community/community.helpers.js';
import { api } from '../../core/api.js';
import { run, rows } from '../chat/chat.data.js';
import { safeCover, readUrl } from '../library/books.js';

const ACCESS = ['free', 'preview', 'borrow', 'info'];
// What may be stored for a book. Anything that is not plain text or a safe https link is dropped.
export function cleanBook(b) {
    const id = oneLine(b && b.id, 120);
    const title = oneLine(b && b.title, 160);
    if (!id || !title) {
        throw new Error('That book cannot be liked.');
    }
    const link = u => (typeof u === 'string' && u.length <= 500 ? safeUrl(u) : '');
    const cover = safeCover(b.cover);
    return {
        id, title,
        authors: (Array.isArray(b.authors) ? b.authors : []).slice(0, 3).map(a => oneLine(a, 80)).filter(Boolean),
        year: Number.isInteger(b.year) && b.year > 0 && b.year < 3000 ? b.year : null,
        cover: cover.length <= 400 ? cover : '',
        access: ACCESS.includes(b.access) ? b.access : 'info',
        read: b.read && readUrl(b.read) ? { kind: String(b.read.kind).slice(0, 12), id: String(b.read.id).slice(0, 100) } : null,
        info: link(b.info), epub: link(b.epub), src: oneLine(b.src, 40) || 'Fyndr'
    };
}
// Firestore document ids cannot contain "/", and book ids do ("ol/works/OL123W").
export const bookKey = id => String(id).replace(/[^A-Za-z0-9_-]/g, '_').slice(0, 100);

let cache = null; // { uid, map: id -> book }
export const forgetLiked = () => {
    cache = null;
};
export const likedBooksNow = () => (cache ? [...cache.map.values()] : []);
export const isBookLiked = id => !!(cache && cache.map.has(id));

export async function loadLikedBooks(force) {
    const u = fb.user();
    if (!u) {
        return [];
    }
    if (!force && cache && cache.uid === u.uid) {
        return likedBooksNow();
    }
    const list = await run(async (m, db) => rows(await m.getDocs(m.query(m.collection(db, 'users', u.uid, 'likedBooks'), m.limit(500)))), 'loading your liked books');
    cache = { uid: u.uid, map: new Map(list.sort((a, b) => (b.at || 0) - (a.at || 0)).map(x => [x.id, x])) };
    return likedBooksNow();
}

// Like a book, or take the like back. -> { liked }
export async function toggleBook(book) {
    const u = fb.user();
    if (!u) {
        throw new Error('Please sign in first.');
    }
    await loadLikedBooks();
    const b = cleanBook(book);
    const had = cache.map.has(b.id);
    await run(async (m, db) => {
        const ref = m.doc(db, 'users', u.uid, 'likedBooks', bookKey(b.id));
        if (had) {
            await m.deleteDoc(ref);
        } else {
            await m.setDoc(ref, { ...b, at: Date.now() });
        }
    }, had ? 'removing the like' : 'liking the book');
    if (had) {
        cache.map.delete(b.id);
    } else {
        cache.map = new Map([[b.id, { ...b, at: Date.now() }], ...cache.map]);
    }
    return { liked: !had };
}

// Is this shared item (see features/share/share.js) liked right now? Jobs and courses are the saved listings.
export const isLiked = s => (s.kind === 'book' ? isBookLiked(s.id) : !!(S.mine && S.mine.saved && S.mine.saved.includes(s.id)));

// Loads everything the hearts need: the saved jobs and courses (S.mine) and the liked books. Safe to call often (books are cached).
export async function loadLikedState() {
    if (!fb.user() || !S.me) {
        return;
    }
    await Promise.all([S.me.role === 'user' ? api('/my').then(m => { S.mine = m; }) : null, loadLikedBooks()]);
}
// Fills in the hearts of the books drawn on the page (the Library draws them before the liked list has arrived).
export function syncBookHearts() {
    if (typeof document === 'undefined' || typeof document.querySelectorAll !== 'function') {
        return;
    }
    document.querySelectorAll('[data-act=booklike]').forEach(btn => {
        const on = isBookLiked(btn.dataset.id);
        btn.classList.toggle('on', on);
        btn.setAttribute('aria-pressed', String(on));
        const t = btn.querySelector('span');
        t && (t.textContent = on ? 'Liked' : 'Like');
        btn.setAttribute('aria-label', on ? 'Remove from Liked' : 'Add to Liked');
    });
}

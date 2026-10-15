import { S } from '../../core/state.js';
import { $, esc, safeUrl } from '../../core/dom.js';
import { isBookLiked, loadLikedBooks, syncBookHearts } from '../liked/liked.data.js';
import { HEART, SHARE_ICON } from '../share/share.view.js';
import { urls, FIND, mapOpenLibrary, mapGutendex, mapGoogle, mapArchive, mapWikibooks, merge, dedupe, didYouMean, readUrl, safeCover, STARTER, localMatches } from './books.js';
// Library page (#/library). Open to everyone, signed in or not. Searches Open Library, Project Gutenberg and Google Books from the browser
// (see books.js for what each one gives) and opens free books in an animated reader. Nothing is stored on Fyndr.
const PAGE = 24;
// [key, label, subject searched at Open Library / Google, topic searched at Project Gutenberg]
export const CATS = [
    ['fiction', 'Fiction', 'fiction', 'fiction'], ['science', 'Science', 'science', 'science'], ['cs', 'Computers & coding', 'computer science', 'computers'],
    ['math', 'Mathematics', 'mathematics', 'mathematics'], ['history', 'History', 'history', 'history'], ['philosophy', 'Philosophy', 'philosophy', 'philosophy'],
    ['poetry', 'Poetry', 'poetry', 'poetry'], ['biography', 'Biography', 'biography', 'biography'], ['business', 'Business & money', 'business', 'economics'],
    ['selfhelp', 'Self-help', 'self-help', 'conduct of life'], ['kids', 'Children', 'juvenile fiction', 'children'], ['india', 'India', 'india', 'india'],
    ['engineering', 'Engineering', 'engineering', 'engineering'], ['medicine', 'Medicine', 'medicine', 'medicine'], ['law', 'Law & politics', 'political science', 'politics'],
    ['textbooks', 'Textbooks', 'textbooks', 'science'], ['programming', 'Programming', 'programming', 'computers'], ['physics', 'Physics', 'physics', 'physics'],
    ['chemistry', 'Chemistry', 'chemistry', 'chemistry'], ['biology', 'Biology', 'biology', 'biology'], ['economics', 'Economics', 'economics', 'economics'],
    ['management', 'Management', 'management', 'economics'], ['psychology', 'Psychology', 'psychology', 'psychology'], ['exams', 'Exam preparation', 'study guides', 'education'],
    ['ai', 'AI & data', 'artificial intelligence', 'computers'], ['electronics', 'Electronics', 'electronics', 'engineering'], ['languages', 'Languages', 'language', 'language']
];
const catOf = k => CATS.find(c => c[0] === k);

// ---------- talking to the catalogs ----------
const memo = new Map(); // search -> { t, v }
// One catalog request. Gives up after `ms`; tries once more only when the failure was a network blip or a server error (not a slow answer), and can be cancelled.
async function getJson(url, ms = 7000, signal) {
    let last;
    for (let i = 0; i < 2; i++) {
        const ctl = new AbortController();
        const stop = () => ctl.abort();
        signal && signal.addEventListener('abort', stop, { once: true });
        const timer = setTimeout(stop, ms);
        try {
            const r = await fetch(url, { signal: ctl.signal });
            if (!r.ok) {
                throw Object.assign(new Error('HTTP ' + r.status), { retry: r.status >= 500 });
            }
            return await r.json();
        } catch (e) {
            if (signal && signal.aborted) {
                throw Object.assign(new Error('cancelled'), { cancelled: true });
            }
            const slow = e.name === 'AbortError';
            last = slow ? new Error('took too long') : e;
            if (slow || e.retry === false || i === 1) {
                break;
            }
            await new Promise(ok => setTimeout(ok, 300));
        } finally {
            clearTimeout(timer);
            signal && signal.removeEventListener('abort', stop);
        }
    }
    throw last;
}
// All three catalogs are asked AT THE SAME TIME, and `onPartial` is called as each one answers, so the first books appear in a
// fraction of a second instead of after the slowest catalog. Extra pages (more Gutenberg and Google results) arrive after, and are merged in
// quietly: if one of them fails nobody is told, because the first page already answered.
// -> { books (merged, best first), failed (how many of the 3 catalogs did not answer), asked, errors (why) }
export async function searchCatalogs({ q = '', cat = '', free = true, onPartial, signal }) {
    const c = catOf(cat);
    const key = [q, c ? c[0] : '', free].join('|');
    const hit = memo.get(key);
    if (hit && Date.now() - hit.t < 15 * 60e3) {
        return hit.v;
    }
    const subject = c ? `subject:"${c[2]}"` : '';
    // With no search and no topic, ALL three catalogs are asked for fiction (Gutendex's own "popular" list leads), so one catalog being down never empties the page.
    const term = q || subject || 'subject:"fiction"';
    const topic = c ? c[3] : '';
    const jobs = [
        ['Open Library', () => getJson(urls.openLibrary(term, 60, free), 7000, signal).then(mapOpenLibrary)],
        ['Project Gutenberg', () => getJson(urls.gutendex(q, { topic }), 7000, signal).then(mapGutendex)],
        ['Google Books', () => getJson(urls.google(term, free), 7000, signal).then(mapGoogle)],
        ['Internet Archive', () => getJson(urls.archive(term, free), 7000, signal).then(mapArchive)]
    ];
    if (q) {
        // free textbooks from Wikibooks only appear for a typed search (they are details-only, so they never fill the free shelf)
        jobs.push(['Wikibooks', () => getJson(urls.wikibooks(q), 7000, signal).then(mapWikibooks)]);
    }
    const extra = [];
    if (q || c) {
        extra.push(() => getJson(urls.gutendex(q, { topic, page: 2 }), 7000, signal).then(mapGutendex));
        extra.push(() => getJson(urls.google(term, free, 40), 7000, signal).then(mapGoogle));
        extra.push(() => getJson(urls.openLibrary(term, 60, free).replace('limit=60', 'limit=60&offset=60'), 7000, signal).then(mapOpenLibrary));
    }
    const lists = [];
    const more = [];
    const errors = [];
    const asked = jobs.length;
    const order = n => (!q && !c && n === 'Project Gutenberg' ? -1 : 0); // no search: the "most popular" order comes from Gutendex
    const build = () => {
        const flat = [...lists].sort((a, b) => order(a.name) - order(b.name)).map(x => x.list).concat(more);
        return q || c ? merge(flat, q || c[2]) : dedupe(flat.flat());
    };
    const state = () => ({ books: build(), failed: errors.length, asked, errors: [...errors] });
    const tell = () => {
        if (onPartial && !(signal && signal.aborted)) {
            onPartial(state());
        }
    };
    const run1 = ([name, f]) => f().then(list => {
        lists.push({ name, list });
        tell();
    }, e => {
        if (e.cancelled) {
            throw e;
        }
        errors.push(`${name} (${e.message || 'no answer'})`);
        console.warn('[Fyndr library]', name, 'failed:', e);
        tell();
    });
    const runExtra = f => f().then(list => {
        more.push(list);
        tell();
    }, () => {});
    try {
        await Promise.all([...jobs.map(run1), ...extra.map(runExtra)]);
    } catch (e) {
        if (e.cancelled) {
            return { books: [], failed: 0, asked, errors: [], cancelled: true };
        }
        throw e;
    }
    const v = state();
    if (lists.length) {
        memo.set(key, { t: Date.now(), v });
    }
    return v;
}
// Starts the popular shelf loading early (called when the pointer reaches the Library link), so the page opens already filled.
export const warm = () => searchCatalogs({ free: true }).catch(() => {});

// ---------- drawing ----------
const BADGE = { free: ['Free · read online', 'free'], preview: ['Preview', 'preview'], borrow: ['Borrow', 'borrow'], info: ['Details only', 'info'] };
const hue = s => [...String(s)].reduce((h, ch) => (h * 31 + ch.charCodeAt(0)) >>> 0, 7) % 360;
const coverHtml = b => {
    const src = safeCover(b.cover);
    const fallback = `<span class="bk-fallback" style="--h:${hue(b.title)}"><b>${esc(b.title.slice(0, 48))}</b><i>${esc(b.authors[0] || '')}</i></span>`;
    return src ? `<img src="${esc(src)}" alt="" loading="lazy" decoding="async" referrerpolicy="no-referrer">${fallback}` : fallback; // a cover that fails to load is removed by library.actions.js, which uncovers the title tile
};
const ext = 'target="_blank" rel="noopener noreferrer nofollow"';
const authorOf = b => (b.authors[0] && b.authors[0] !== 'Wikibooks community' ? ' ' + b.authors[0] : '');
// The card only shows the book. Where it is, the direct link and the Read button all live inside its Details (see detailsHtml).
// The heart that keeps a book on the Liked page. Fyndr stores only the few facts needed to show the book again (title, author, cover, links).
const likeBtn = (b, cls = 'bk-like') => {
    const on = isBookLiked(b.id);
    return `<button type="button" class="${cls}${on ? ' on' : ''}" data-act="booklike" data-id="${esc(b.id)}" aria-pressed="${on}" aria-label="${on ? 'Remove from Liked' : 'Add to Liked'}">${HEART}<span>${on ? 'Liked' : 'Like'}</span></button>`;
};
export const bookCard = b => {
    (S.books ||= {})[b.id] = b;
    const [label, kind] = BADGE[b.access];
    return `<article class="bk-card"><div class="bk-cover">${coverHtml(b)}<span class="bk-badge" data-k="${kind}">${label}</span></div>
<div class="bk-body"><h3>${esc(b.title)}</h3><p class="bk-by">${esc(b.authors.join(', ') || 'Unknown author')}${b.year ? ` · ${b.year}` : ''}</p><div class="bk-acts"><button class="button button-dark button-small" data-act="bookinfo" data-id="${esc(b.id)}">Details</button>${likeBtn(b, 'bk-like icon')}</div></div></article>`;
};
const card = bookCard;
// Everything about one book: how to read it, its direct link, and every place it can be found.
const detailsHtml = b => {
    const [label, kind] = BADGE[b.access];
    const readable = b.read && readUrl(b.read);
    const info = safeUrl(b.info);
    const q = b.title + authorOf(b);
    const enc = encodeURIComponent(q);
    const read = readable ? `<button class="button button-dark" data-act="readbook" data-id="${esc(b.id)}">${b.access === 'free' ? 'Read now' : 'Preview'}</button>` : '';
    const direct = info ? `<a class="button" href="${esc(info)}" ${ext}>${b.access === 'borrow' ? `Borrow on ${esc(b.src === 'Internet Archive' ? 'Internet Archive' : 'Open Library')}` : `Open on ${esc(b.src)}`}</a>` : '';
    const buy = b.access === 'free' && readable ? '' : `<a class="button" href="https://www.amazon.in/s?k=${enc}&i=stripbooks" ${ext}>Buy</a><a class="button" href="https://search.worldcat.org/search?q=${enc}" ${ext}>Find in a library</a>`;
    const places = FIND.slice(0, 12).map(([n, what, fn]) => `<a href="${esc(fn(q))}" ${ext}><b>${esc(n)}</b><span>${esc(what)}</span></a>`).join('');
    return `<div class="bk-sheet-back" data-act="closesheet"></div>
<div class="bk-sheet" role="dialog" aria-modal="true" aria-label="Details of ${esc(b.title)}">
<button class="bk-sheet-x" data-act="closesheet" id="bk-sheet-close" aria-label="Close">×</button>
<div class="bk-sheet-top"><div class="bk-cover">${coverHtml(b)}<span class="bk-badge" data-k="${kind}">${label}</span></div>
<div class="bk-sheet-head"><h3>${esc(b.title)}</h3><p class="bk-by">${esc(b.authors.join(', ') || 'Unknown author')}${b.year ? ` · ${b.year}` : ''}</p><p class="bk-src">From ${esc(b.src)}</p>
<div class="bk-sheet-acts">${read}${direct}${buy}</div>
<div class="bk-sheet-acts bk-sheet-soft">${likeBtn(b, 'button bk-like')}${S.me ? `<button type="button" class="button bk-share" data-act="shareopen" data-id="${esc(b.id)}" data-s="book">${SHARE_ICON}<span>Share to a group</span></button>` : ''}</div></div></div>
<h4>Where to find it</h4><div class="bk-where">${places}</div></div>`;
};
let sheet = null;
export function closeSheet() {
    if (sheet) {
        sheet.remove();
        sheet = null;
        document.body.classList.remove('rd-lock');
    }
}
export const sheetOpen = () => !!sheet;
export function openDetails(id) {
    const b = S.books[id];
    if (!b) {
        return;
    }
    closeSheet();
    sheet = document.createElement('div');
    sheet.className = 'bk-sheet-wrap';
    sheet.innerHTML = detailsHtml(b);
    document.body.append(sheet);
    document.body.classList.add('rd-lock');
    sheet.querySelector('#bk-sheet-close').focus({ preventScroll: true });
}
// A card for whatever was searched, with a link to every place it may be found. It never says "not available": it says where to look.
const findCard = q => `<article class="bk-card bk-find"><div class="bk-body"><h3>Looking for “${esc(q)}”?</h3><p class="bk-by">Open it, borrow it or buy it at any of these ${FIND.length} places, whether or not it is on Fyndr’s shelf.</p>
<div class="bk-where">${FIND.map(([n, what, fn]) => `<a href="${esc(fn(q))}" target="_blank" rel="noopener noreferrer nofollow"><b>${esc(n)}</b><span>${esc(what)}</span></a>`).join('')}</div></div></article>`;
const grid = (books, n, q = '') => `<div class="bk-grid">${q ? findCard(q) : ''}${books.slice(0, n).map(card).join('')}</div>${books.length > n ? `<div class="more"><button class="button" data-act="libmore">Show more (${books.length - n})</button></div>` : ''}`
const skeleton = '<div class="bk-grid">' + '<div class="sk bk-sk"></div>'.repeat(8) + '</div>';

function params() {
    const p = new URLSearchParams((location.hash.split('?')[1] || ''));
    return { q: (p.get('q') || '').trim().slice(0, 120), cat: catOf(p.get('c')) ? p.get('c') : '', free: p.get('free') === '1' };
}
export function libraryView() {
    const { q, cat, free } = params();
    S.books = {};
    $('#app').innerHTML = `<section class="hero hero-compact container lib-hero"><div><h1>Library</h1><p class="lead">Search any book, author or topic. We search Open Library, Internet Archive, Project Gutenberg and Google Books, and every search also gives you links to borrow or buy it.</p>
<form class="search-box" data-form="libsearch" role="search"><label class="search-field"><input name="q" type="search" aria-label="Search books" placeholder="Title, author or topic" value="${esc(q)}" maxlength="120" autocomplete="off"></label><button class="search-button">Search</button></form>
<label class="lib-free"><input type="checkbox" data-act="libfree" ${free ? 'checked' : ''}> Only books I can read free online</label></div></section>
<section class="container page" id="library"><div class="chips-row" role="group" aria-label="Topic">${CATS.map(c => `<button class="chip-c ${cat === c[0] ? 'on' : ''}" data-act="libcat" data-id="${c[0]}">${esc(c[1])}</button>`).join('')}</div><div id="lib-out">${skeleton}</div></section>`;
    // signed in: fetch the liked books, then fill in the hearts (the cards are drawn before the list arrives)
    S.me && loadLikedBooks().then(syncBookHearts).catch(() => {});
    return run({ q, cat, free });
}

let runId = 0;
let ctl = null;
async function run({ q, cat, free }) {
    const id = ++runId;
    const out = $('#lib-out');
    if (!out) {
        return;
    }
    ctl && ctl.abort(); // a newer search cancels the old one's requests
    ctl = new AbortController();
    const keep = list => (free ? list.filter(b => b.access === 'free') : list);
    const head0 = q ? `Results for “${esc(q)}”` : cat ? esc(catOf(cat)[1]) : 'Popular books';
    // Books on the built-in shelf that match are shown at once; each catalog's books are added the moment it answers.
    const paint = (list, busy) => {
        const bs = keep(list);
        if (id !== runId || !$('#lib-out') || !bs.length) {
            return;
        }
        S.lib = { books: bs, n: PAGE };
        $('#lib-out').innerHTML = `<h2 class="lib-h">${head0}</h2><p class="desc">${bs.length.toLocaleString()} ${bs.length === 1 ? 'book' : 'books'}${busy ? ' · still searching…' : ''}</p>${grid(bs, PAGE, q)}`;
    };
    const local = q ? localMatches(q) : [];
    local.length ? paint(local, true) : (out.innerHTML = skeleton);
    const first = await searchCatalogs({ q, cat, free, signal: ctl.signal, onPartial: r => paint(local.length ? merge([local, r.books], q) : r.books, true) });
    if (id !== runId || !$('#lib-out') || first.cancelled) {
        return; // a newer search started
    }
    let pool = first.books; // everything the catalogs returned, before the "free only" filter
    let books = keep(pool);
    const title = q ? `Results for “${esc(q)}”` : cat ? esc(catOf(cat)[1]) : 'Popular books';
    let head = '';
    let body = '';
    if (!first.books.length && first.failed === first.asked) {
        const why = esc(first.errors.join(' · '));
        const retry = `<button class="lib-dym-btn" data-act="libretry">Try again</button>`;
        if (!q && !cat) {
            // Nothing answered: still show books. These classics open straight on Project Gutenberg, with no catalog search needed.
            S.lib = { books: STARTER, n: PAGE };
            out.innerHTML = `<h2 class="lib-h">Classics to start with</h2><p class="desc">The live book catalogs did not answer, so here are free classics that always open.</p>${grid(STARTER, PAGE)}<p class="lib-note">Could not reach: ${why}. ${retry}</p>`;
            return;
        }
        const manual = urls.searchOn(q || (catOf(cat) || [])[1] || 'books').map(([n, u]) => `<a href="${esc(u)}" target="_blank" rel="noopener noreferrer nofollow">${esc(n)}</a>`).join(' · ');
        out.innerHTML = `${q ? `<div class="bk-grid">${findCard(q)}</div>` : ''}<div class="empty"><b>Could not reach the book catalogs</b><p>Check your internet connection and try again.</p><p class="lib-note">${why}</p><button class="button button-dark button-small" data-act="libretry">Try again</button><p class="lib-manual">Or search directly: ${manual}</p></div>`;
        return;
    }
    // "Did you mean ...?": the closest known title, author or found book, when the words typed do not match what was found.
    const dym = q ? didYouMean(q, first.books) : null;
    if (dym) {
        const link = `<button class="lib-dym-btn" data-act="libdym" data-id="${esc(dym.text)}">${esc(dym.text)}</button>`;
        if (!books.length) {
            const alt = await searchCatalogs({ q: dym.text, free });
            if (id !== runId || !$('#lib-out')) {
                return;
            }
            pool = alt.books;
            books = keep(pool);
            head = `<div class="lib-dym"><b>No exact match for “${esc(q)}”.</b> Did you mean ${link}?${books.length ? ' Showing the closest books.' : ''}</div>`;
        } else {
            head = `<div class="lib-dym">Did you mean ${link}?</div>`;
        }
    }
    if (!books.length) {
        const hidden = pool.length;
        body = `<div class="empty"><b>No ${free ? 'free-to-read ' : ''}books found${q ? ` for “${esc(q)}”` : ''}</b>
<p>${hidden && free ? `${hidden} other ${hidden === 1 ? 'book was' : 'books were'} found that cannot be read free online. Untick “Only books I can read free online” to see ${hidden === 1 ? 'it' : 'them'}.` : 'Try fewer words, the author’s name, or another spelling.'}</p></div>${q ? `<div class="bk-grid">${findCard(q)}</div>` : ''}`;
    } else {
        S.lib = { books, n: PAGE };
        body = grid(books, PAGE, q);
    }
    const note = first.failed ? `<p class="lib-note">${first.failed} of ${first.asked} catalogs did not answer (${esc((first.errors || []).join(', '))}), so some books may be missing. <button class="lib-dym-btn" data-act="libretry">Try again</button></p>` : '';
    out.innerHTML = `${head}<h2 class="lib-h">${title}</h2>${books.length ? `<p class="desc">${books.length.toLocaleString()} ${books.length === 1 ? 'book' : 'books'}</p>` : ''}${body}${note}<p class="lib-legal">Books open on the website of the catalog that owns them. Only free and public-domain books can be read in full; others show a preview or a link to borrow them.</p>`;
}
export const rerun = () => run(params());
// Search-as-you-type: only the results area is redrawn (the search box keeps focus), and the address bar is updated without adding a history entry per letter.
export function live(q) {
    const { free } = current();
    const t = String(q || '').trim().slice(0, 120);
    history.replaceState(null, '', '#/library' + (t ? '?' + new URLSearchParams({ q: t, ...(free ? { free: '1' } : {}) }) : free ? '?free=1' : ''));
    document.querySelectorAll('.chip-c.on').forEach(c => c.classList.remove('on'));
    return run({ q: t, cat: '', free });
}
export function more() {
    if (!S.lib) {
        return;
    }
    S.lib.n += PAGE;
    const out = $('#lib-out .bk-grid');
    if (out) {
        out.parentElement.querySelector('.more')?.remove();
        out.insertAdjacentHTML('beforeend', S.lib.books.slice(S.lib.n - PAGE, S.lib.n).map(card).join(''));
        if (S.lib.books.length > S.lib.n) {
            out.insertAdjacentHTML('afterend', `<div class="more"><button class="button" data-act="libmore">Show more (${S.lib.books.length - S.lib.n})</button></div>`);
        }
    }
}
// Address bar and search state change together without reloading the page; Back / Forward still work (the router redraws on hashchange).
export function go({ q = '', cat = '', free = true }) {
    const p = new URLSearchParams();
    if (q) {
        p.set('q', q);
    }
    if (cat) {
        p.set('c', cat);
    }
    if (free) {
        p.set('free', '1');
    }
    history.pushState(null, '', '#/library' + (p.toString() ? '?' + p : ''));
    libraryView();
}
export const current = params;

// ---------- the reader ----------
let reader = null;
export function closeReader() {
    if (reader) {
        reader.remove();
        reader = null;
        document.body.classList.remove('rd-lock');
    }
}
export const readerOpen = () => !!reader;
export function openReader(id) {
    const b = S.books[id];
    const src = b && b.read && readUrl(b.read);
    if (!src) {
        return;
    }
    closeReader();
    closeSheet();
    const info = safeUrl(b.info);
    const epub = safeUrl(b.epub);
    const cover = safeCover(b.cover);
    reader = document.createElement('div');
    reader.className = 'rd-wrap';
    reader.innerHTML = `<div class="rd-back" data-act="closereader"></div>
<div class="rd" role="dialog" aria-modal="true" aria-label="Reading ${esc(b.title)}">
<header class="rd-bar"><div class="rd-title"><b>${esc(b.title)}</b><span>${esc(b.authors.join(', '))}</span></div>
<div class="rd-tools">${epub ? `<a class="button button-small" href="${esc(epub)}" rel="noopener noreferrer nofollow">Download EPUB</a>` : ''}<a class="button button-small" href="${esc(src)}" target="_blank" rel="noopener noreferrer nofollow">Open in new tab</a><button class="button button-dark button-small" data-act="closereader" id="rd-close">Close</button></div></header>
<div class="rd-stage"><div class="rd-book">
<div class="rd-pages"><iframe title="${esc(b.title)}" src="${esc(src)}" sandbox="allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox allow-forms" allowfullscreen></iframe></div>
<div class="rd-cover" aria-hidden="true">${cover ? `<img src="${esc(cover)}" alt="" referrerpolicy="no-referrer">` : ''}<span class="rd-cover-t" style="--h:${hue(b.title)}"><b>${esc(b.title.slice(0, 60))}</b><i>${esc(b.authors[0] || '')}</i></span></div>
</div></div>
<p class="rd-foot">Reading on ${esc(b.src === 'Open Library' ? 'the Internet Archive' : b.src)}. If the page stays empty, use <b>Open in new tab</b>.${info ? ` <a href="${esc(info)}" target="_blank" rel="noopener noreferrer nofollow">About this book</a>` : ''}</p></div>`;
    document.body.append(reader);
    document.body.classList.add('rd-lock');
    reader.querySelector('#rd-close').focus({ preventScroll: true });
}

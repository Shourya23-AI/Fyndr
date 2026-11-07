// Runs the Library page against a fake page and fake catalogs (no network, no browser).  Run:  node test/library-ui.test.js
let pass = 0, fail = 0;
const ok = (c, n) => { c ? pass++ : (fail++, console.log('  FAIL', n)); };

// ---- a tiny fake browser
const els = {};
const el = () => ({ innerHTML: '', parentElement: null, querySelector: () => null, insertAdjacentHTML() {}, remove() {}, setAttribute() {}, removeAttribute() {}, classList: { add() {}, remove() {}, toggle() {}, contains: () => false } });
globalThis.document = { querySelector: s => (els[s] ??= el()), querySelectorAll: () => [], body: { append() {}, classList: { add() {}, remove() {} } }, createElement: () => el(), addEventListener() {} };
globalThis.location = { hash: '#/library' };
globalThis.history = { pushState(_, __, h) { location.hash = h; } };
globalThis.addEventListener = () => {};
globalThis.sessionStorage = { getItem: () => null, setItem() {}, removeItem() {} };
// (the Library now imports the liked-books store, which loads Firebase's settings; this makes it start in the offline test mode)
globalThis.localStorage = { getItem: k => (k.startsWith('fyndr-fbcfg') ? JSON.stringify({ cfg: { apiKey: 'YOUR_KEY' }, local: true }) : null), setItem() {}, removeItem() {} };

// ---- fake catalogs
let calls = [];
let mode = 'normal';
const json = d => ({ ok: true, json: async () => d });
const OL = { docs: [{ key: '/works/OL82563W', title: "Harry Potter and the Philosopher's Stone", author_name: ['J. K. Rowling'], first_publish_year: 1997, cover_i: 10521270, ebook_access: 'borrowable', ia: ['harrypotter00rowl'] }] };
const PRIDE = { docs: [{ key: '/works/OL66554W', title: 'Pride and Prejudice', author_name: ['Jane Austen'], first_publish_year: 1813, cover_i: 8739161, ia: ['prideprejudice00aust'], ebook_access: 'public' }] };
globalThis.fetch = async (url) => {
    calls.push(String(url));
    const u = new URL(url);
    if (mode === 'down') { throw new Error('offline'); }
    const q = (u.searchParams.get('q') || u.searchParams.get('search') || '').toLowerCase();
    if (u.hostname === 'openlibrary.org') { return json(/harry/.test(q) ? OL : /pride/.test(q) ? PRIDE : { docs: [] }); }
    if (u.hostname === 'gutendex.com') { return json(/pride/.test(q) ? { results: [{ id: 1342, title: 'Pride and Prejudice', authors: [{ name: 'Austen, Jane' }], formats: { 'image/jpeg': 'https://www.gutenberg.org/cache/epub/1342/pg1342.cover.medium.jpg' } }] } : !q ? { results: [{ id: 84, title: 'Frankenstein; Or, The Modern Prometheus', authors: [{ name: 'Shelley, Mary Wollstonecraft' }], formats: {} }] } : { results: [] }); }
    if (u.hostname === 'en.wikibooks.org') { return json({ query: { search: [] } }); }
    if (u.hostname === 'archive.org') { return json({ response: { docs: [] } }); }
    if (u.hostname === 'www.googleapis.com') { return json(/harry/.test(q) ? { items: [{ id: 'abcDEF1234', volumeInfo: { title: "Harry Potter and the Philosopher's Stone", authors: ['J. K. Rowling'] }, accessInfo: { viewability: 'PARTIAL', embeddable: true } }] } : {}); }
    throw new Error('unexpected host ' + u.hostname);
};

const { libraryView, searchCatalogs, openReader, openDetails, closeSheet } = await import('../public/js/features/library/library.js');
const { S } = await import('../public/js/core/state.js');
const out = () => els['#lib-out'].innerHTML;
const wait = () => new Promise(r => setTimeout(r, 20));

// popular shelf (no search)
location.hash = '#/library';
await libraryView(); await wait();
ok(/Popular books/.test(out()) && /Frankenstein/.test(out()) && /data-act="bookinfo"/.test(out()) && !/Read now/.test(out()), 'popular books show a Details button; the Read button lives inside the details');
ok(calls.some(c => c.startsWith('https://gutendex.com/')) && calls.some(c => c.startsWith('https://openlibrary.org/')) && calls.some(c => c.startsWith('https://www.googleapis.com/')), 'popular shelf asks all three catalogs, so one being down never empties the page');
ok(/Library/.test(els['#app'].innerHTML) && /Only books I can read free online/.test(els['#app'].innerHTML) && !/ checked/.test(els['#app'].innerHTML), 'page has search, free filter (off by default, so every book shows) and topics');

// a correct search
calls = [];
location.hash = '#/library?q=pride%20and%20prejudice';
await libraryView(); await wait();
ok(/Results for “pride and prejudice”/.test(out()) && !/Did you mean/.test(out()), 'correct spelling: no "did you mean"');
ok((out().match(/<article class="bk-card">/g) || []).length === 1, 'same book from 3 catalogs is one card');
ok(/data-act="bookinfo"/.test(out()) && /Free · read online/.test(out()) && !/Amazon India/.test(out().replace(/<article class="bk-card bk-find">[\s\S]*?<\/article>/, '')), 'free book card is clean: just a Details button, no places on the card');
{
    // the Details view holds the Read button, the direct link and the places
    let made;
    const realCreate = document.createElement;
    document.createElement = () => (made = { ...el(), querySelector: () => ({ focus() {} }) });
    const id = Object.keys(S.books)[0];
    openDetails(id);
    document.createElement = realCreate;
    const d = made.innerHTML;
    ok(/data-act="readbook"/.test(d) && /Read now/.test(d), 'details: has the Read now button');
    ok(/Where to find it/.test(d) && /Open Library/.test(d) && /Internet Archive/.test(d), 'details: lists the places to find the book, each a direct link');
    ok(/From /.test(d) && /data-act="closesheet"/.test(d), 'details: says where the book is from and can be closed');
    closeSheet();
}
ok(calls.length === 8 && calls.some(c => c.startsWith('https://archive.org/')) && calls.filter(c => c.includes('page=2') || c.includes('startIndex=40') || c.includes('offset=60')).length === 3, 'four catalogs asked at once (incl. Internet Archive), plus one extra page each from Gutenberg, Google and Open Library');
ok(/bk-find/.test(out()) && /Amazon India/.test(out()) && /WorldCat/.test(out()), 'every search shows a where-to-find card with buy / borrow links');

// a misspelt search whose catalogs found nothing readable
calls = [];
location.hash = '#/library?q=harry%20poter&free=1';
await libraryView(); await wait();
ok(/Did you mean/.test(out()) && /Harry Potter and the Philosopher/.test(out()), 'misspelt: "did you mean" the right title');
ok(/data-act="libdym"/.test(out()), 'suggestion is clickable');
ok(/No exact match for “harry poter”/.test(out()), 'says there was no exact match');
ok(/No free-to-read books found/.test(out()) && /cannot be read free online/.test(out()), 'it is not a free book: says so, and says how to see it');
ok(!/Showing the closest books/.test(out()), 'does not claim to show books when none are free');

// free-only off shows borrow-only books
location.hash = '#/library?q=harry%20potter';
await libraryView(); await wait();
ok(/Preview/.test(out()) && !/No free-to-read/.test(out()), 'non-free books appear when the filter is off (one card: the preview copy beats the borrow copy)');
ok(!/Did you mean/.test(out()), 'correctly spelt search: no suggestion');

// nothing at all, nothing close
location.hash = '#/library?q=qzxwv%20kjhgf&free=1';
await libraryView(); await wait();
ok(/No free-to-read books found/.test(out()) && /Looking for/.test(out()) && /archive\.org/.test(out()), 'nothing found: says so and shows the where-to-find card');
ok(!/Did you mean/.test(out()), 'no wild guess for nonsense');

// internet down
mode = 'down';
location.hash = '#/library?q=something%20else';
await libraryView(); await wait();
ok(/Could not reach the book catalogs/.test(out()) && /libretry/.test(out()), 'offline: clear message and a retry button');
mode = 'normal';

// internet down on the default page: a starter shelf of classics still shows
mode = 'down';
location.hash = '#/library?free=1'; // (a search not remembered from the earlier popular-shelf run)
await libraryView(); await wait();
ok(/Classics to start with/.test(out()) && /Pride and Prejudice/.test(out()) && /bookinfo/.test(out()) && /libretry/.test(out()), 'all catalogs down: starter shelf of free classics is shown with a retry button');
mode = 'normal';

// topic
calls = [];
location.hash = '#/library?c=science';
await libraryView(); await wait();
ok(calls.some(c => c.includes('topic=science')) && calls.some(c => c.includes('subject%3A%22science%22')), 'topic searches subject at each catalog');

// reader: only opens for a book that has a safe reading address
let appended = [];
globalThis.document.body.append = n => appended.push(n);
globalThis.document.createElement = () => { const e = el(); e.querySelector = () => ({ focus() {} }); return e; };
S.books = { ok1: { id: 'ok1', title: 'T "q" <b>', authors: ['A'], src: 'Open Library', info: 'https://openlibrary.org/works/OL1W', epub: '', cover: '', read: { kind: 'archive', id: 'abc123' } }, bad: { id: 'bad', title: 'B', authors: [], read: { kind: 'archive', id: '../x' } }, nread: { id: 'nread', title: 'N', authors: [], read: null } };
openReader('bad'); openReader('nread'); openReader('missing');
ok(appended.length === 0, 'no reader for a bad id, a book without a reader, or an unknown book');
openReader('ok1');
ok(appended.length === 1, 'reader opens for a good book');
const rd = appended[0].innerHTML;
ok(rd.includes('src="https://archive.org/embed/abc123"') && rd.includes('sandbox='), 'reader frame is the archive.org page, sandboxed');
ok(rd.includes('T &quot;q&quot; &lt;b&gt;') && !rd.includes('T "q" <b>'), 'title is escaped in the reader');


// ---- speed: books appear as each catalog answers, not after the slowest one
{
    const real = globalThis.fetch;
    let release;
    const gate = new Promise(r => { release = r; });
    globalThis.fetch = async (url) => {
        const u = new URL(url);
        if (u.hostname === 'openlibrary.org') { await gate; } // Open Library is slow
        return real(url);
    };
    location.hash = '#/library?q=pride';
    const p = libraryView();
    await wait();
    ok(/Pride and Prejudice/.test(out()) && /still searching/.test(out()), 'speed: first books are shown while a slow catalog is still loading');
    release(); await p; await wait();
    ok(/Pride and Prejudice/.test(out()) && !/still searching/.test(out()), 'speed: page settles when the slow catalog answers');
    globalThis.fetch = real;
}
// ---- instant: a built-in classic shows with no network at all
{
    const { localMatches } = await import('../public/js/features/library/books.js');
    ok(localMatches('pri').some(b => /Pride/.test(b.title)) && localMatches('dracula').length === 1 && localMatches('zzzqq').length === 0, 'instant: built-in shelf matches word starts, nothing for nonsense');
}
// ---- search-as-you-type redraws only the results and keeps one history entry
{
    const { live } = await import('../public/js/features/library/library.js');
    location.hash = '#/library';
    let pushed = 0; const rs = history.replaceState; history.replaceState = (_, __, h) => { location.hash = h; };
    const ps = history.pushState; history.pushState = () => { pushed++; };
    await live('pride and prej'); await wait();
    ok(pushed === 0 && /q=pride/.test(location.hash) && /Pride and Prejudice/.test(out()), 'live typing: results update, no new history entry');
    history.pushState = ps;
}

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);

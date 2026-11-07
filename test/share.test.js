// Sharing jobs, courses and books into chats, liked books, the Liked page.   Run:  node test/share.test.js
let pass = 0, fail = 0;
const ok = (c, n) => { c ? pass++ : (fail++, console.log('  FAIL', n)); };

// ---- a tiny fake browser
const els = {};
const el = () => ({ innerHTML: '', hidden: false, querySelector: () => null });
globalThis.document = { querySelector: s => (els[s] ??= el()) };
globalThis.location = { hash: '#/community' };
globalThis.localStorage = { getItem: k => (k.startsWith('fyndr-fbcfg') ? JSON.stringify({ cfg: { apiKey: 'YOUR_KEY' }, local: true }) : null), setItem() {}, removeItem() {} };
globalThis.confirm = () => true;

// ---- a tiny in-memory Firestore (no security rules; it only checks that our reads and writes do what the pages expect)
class Ts { toMillis() { return 1700000000000; } }
const clone = x => (Array.isArray(x) ? x.map(clone) : x instanceof Ts ? x : x && typeof x === 'object' ? Object.fromEntries(Object.entries(x).map(([k, v]) => [k, clone(v)])) : x);
const store = new Map();
let auto = 0;
const snap = p => ({ id: p.split('/').pop(), exists: () => store.has(p), data: () => clone(store.get(p)) });
const inCol = (p, col) => p.startsWith(col + '/') && !p.slice(col.length + 1).includes('/');
const patch = (o, d) => { for (const [k, v] of Object.entries(d)) { o[k] = v && v.__inc !== undefined ? (o[k] || 0) + v.__inc : v && v.__union ? [...new Set([...(o[k] || []), ...v.__union])] : v && v.__remove ? (o[k] || []).filter(x => !v.__remove.includes(x)) : v; } };
const apply = w => { if (w.t === 'set') { store.set(w.p, clone(w.d)); } else if (w.t === 'update') { if (!store.has(w.p)) { throw new Error('no doc'); } patch(store.get(w.p), w.d); } else { store.delete(w.p); } };
const m = {
    collection: (db, ...seg) => ({ path: seg.join('/'), col: true }),
    doc: (a, ...seg) => (a.col ? { path: a.path + '/auto' + (++auto), id: 'auto' + auto } : { path: seg.join('/'), id: seg.at(-1) }),
    serverTimestamp: () => new Ts(), increment: n => ({ __inc: n }), arrayUnion: (...v) => ({ __union: v }), arrayRemove: (...v) => ({ __remove: v }),
    where: (f, op, v) => ({ k: 'where', f, op, v }), orderBy: (f, d) => ({ k: 'order', f, d }), limit: n => ({ k: 'limit', n }), query: (c, ...cs) => ({ ...c, cs }),
    getDoc: async r => snap(r.path),
    getDocs: async q => {
        let ps = [...store.keys()].filter(p => inCol(p, q.path));
        for (const c of q.cs || []) {
            if (c.k === 'where') { ps = ps.filter(p => { const v = store.get(p)[c.f]; return c.op === '==' ? v === c.v : Array.isArray(v) && v.includes(c.v); }); }
            if (c.k === 'order') { ps.sort((a, b) => { const x = store.get(a)[c.f], y = store.get(b)[c.f]; return (c.d === 'desc' ? -1 : 1) * ((x instanceof Ts ? 0 : x) - (y instanceof Ts ? 0 : y)); }); }
        }
        return { docs: ps.map(snap) };
    },
    setDoc: async (r, d) => apply({ t: 'set', p: r.path, d }),
    addDoc: async (c, d) => { const p = c.path + '/auto' + (++auto); store.set(p, clone(d)); return { id: 'auto' + auto }; },
    updateDoc: async (r, d) => apply({ t: 'update', p: r.path, d }), deleteDoc: async r => apply({ t: 'delete', p: r.path }),
    writeBatch: () => { const ws = []; return { set: (r, d) => ws.push({ t: 'set', p: r.path, d }), update: (r, d) => ws.push({ t: 'update', p: r.path, d }), delete: r => ws.push({ t: 'delete', p: r.path }), commit: async () => ws.forEach(apply) }; }
};
const { useFs } = await import('../public/js/services/firestore-api/fire.js');
useFs({ m, db: {} });
const { fb } = await import('../public/js/services/firebase/firebase-init.js');
const { S } = await import('../public/js/core/state.js');
let user = { uid: 'u1', email: 'Asha@Example.com', displayName: 'Asha' };
fb.user = () => user;
S.me = { name: 'Asha K', role: 'user' };

globalThis.document.querySelectorAll = () => [];
globalThis.document.addEventListener = () => {};
globalThis.addEventListener = () => {};
globalThis.sessionStorage = globalThis.localStorage;
globalThis.document.body = { insertAdjacentHTML() {}, append() {}, classList: { add() {}, remove() {} } };
const SH = await import('../public/js/features/share/share.js');
const CD = await import('../public/js/features/community/community.data.js');
const GD = await import('../public/js/features/groups/groups.data.js');
const LD = await import('../public/js/features/liked/liked.data.js');
const SV = await import('../public/js/features/share/share.view.js');
const CV = await import('../public/js/features/groups/chat.view.js');
const LV = await import('../public/js/features/liked/liked.view.js');
const SA = await import('../public/js/features/share/share.actions.js');
const rej = async (f, re, n) => { try { await f(); ok(false, n + ' (no error)'); } catch (e) { ok(re.test(e.message), n + ' -> ' + e.message); } };

// ---- cleaning what is shared
const job = { id: 'imp_1', type: 'Job', title: ' Data  Analyst ', orgName: 'Acme', location: 'Bengaluru', applyUrl: 'https://acme.com/apply', image: 'javascript:alert(1)' };
const sj = SH.fromListing(job);
ok(sj.kind === 'job' && sj.title === 'Data Analyst' && sj.sub === 'Acme · Bengaluru' && sj.url === 'https://acme.com/apply' && !('img' in sj), 'fromListing: job card, unsafe picture dropped');
ok(SH.fromListing({ ...job, type: 'Course' }).kind === 'course' && SH.fromListing({ ...job, type: 'Internship' }).kind === 'job', 'fromListing: course vs job');
ok(!('url' in SH.cleanShare({ kind: 'job', id: 'a', title: 'x', url: 'http://plain.com' })), 'cleanShare: only https links');
await rej(async () => SH.cleanShare({ kind: 'movie', id: 'a', title: 'x' }), /Pick a job/, 'cleanShare: unknown kind refused');
await rej(async () => SH.cleanShare({ kind: 'job', id: '', title: 'x' }), /cannot be shared/, 'cleanShare: needs an id');
const book = { id: 'ol/works/OL1W', title: 'Pride and Prejudice', authors: ['Jane Austen', 'B'], year: 1813, cover: 'https://covers.openlibrary.org/b/id/1-M.jpg', access: 'free', read: null, info: 'https://openlibrary.org/works/OL1W', epub: '', src: 'Open Library' };
const sb = SH.fromBook(book);
ok(sb.kind === 'book' && sb.sub === 'Jane Austen, B' && sb.tag === 'Free to read' && sb.img === book.cover, 'fromBook: author line, access tag, cover');
const back = SH.bookFromShare(sb);
ok(back.id === book.id && back.authors[0] === 'Jane Austen' && back.info === book.info && back.src === 'openlibrary.org', 'bookFromShare: a shared book turns back into a book');

// ---- chat messages carry the shared card (groups AND communities)
user = { uid: 'u1', email: 'asha@example.com', displayName: 'Asha' };
S.me = { name: 'Asha K', role: 'user' };
const cid = await CD.createCommunity({ name: 'Freshers', desc: '' });
await CD.addPost(cid, { share: { ...sj, junk: 'x' } });
let posts = await CD.listPosts(cid);
ok(posts.length === 1 && posts[0].share.title === 'Data Analyst' && !('junk' in posts[0].share) && posts[0].text === '', 'community: a shared job is saved as a card, extra fields dropped');
const gid = await GD.createGroup({ name: 'Study buddies', desc: '', emails: '' });
await GD.addPost(gid, { share: sb, text: 'read this!' });
posts = await GD.listPosts(gid);
ok(posts[0].share.kind === 'book' && posts[0].text === 'read this!', 'group: a shared book with a note');
await rej(() => CD.addPost(cid, {}), /Write something/, 'chat: empty message still refused');

// ---- the card inside the chat
const card = CV.messagesHtml([{ id: 'p1', authorId: 'u1', authorName: 'Asha', t: 1700000000000, share: { ...sj, title: '<img onerror=x>' } }], 'u2', false);
ok(card.includes('ch-share') && card.includes('data-act="shview"') && card.includes('data-act="shlike"') && card.includes('Open ↗') && !card.includes('<img onerror'), 'card: View, Like and Open buttons; title escaped');
ok(card.includes('rel="noopener noreferrer nofollow"') && card.includes('href="https://acme.com/apply"'), 'card: link is https and opens safely');
ok(/Job: Data Analyst/.test((await import('../public/js/features/groups/chat.helpers.js')).snippet({ share: sj })), 'reply preview names the shared item');

// ---- a community creator can clear any message; members can delete their own
const rows = await CD.listPosts(cid);
ok(CV.messagesHtml(rows, 'u9', true).includes('data-act="gpdelpost"') && !CV.messagesHtml(rows, 'u9', false).includes('data-act="gpdelpost"'), 'delete button: author or creator only');

// ---- liked books
const cb = LD.cleanBook({ ...book, cover: 'javascript:x', info: 'ftp://x', year: 99999, authors: ['a', 'b', 'c', 'd'] });
ok(cb.cover === '' && cb.info === '' && cb.year === null && cb.authors.length === 3, 'cleanBook: unsafe links and odd values dropped');
ok(LD.bookKey('ol/works/OL1W') === 'ol_works_OL1W', 'bookKey: no slashes in document ids');
await rej(async () => LD.cleanBook({ id: '', title: 'x' }), /cannot be liked/, 'cleanBook: needs id and title');
ok((await LD.loadLikedBooks(true)).length === 0 && !LD.isBookLiked(book.id), 'liked books: none at first');
ok((await LD.toggleBook(book)).liked === true && LD.isBookLiked(book.id) && store.has('users/u1/likedBooks/ol_works_OL1W'), 'like: stored under the person');
ok(LD.likedBooksNow()[0].title === 'Pride and Prejudice', 'like: appears in the list');
ok((await LD.loadLikedBooks(true)).length === 1, 'like: survives a reload from the database');
ok((await LD.toggleBook(book)).liked === false && !LD.isBookLiked(book.id) && !store.has('users/u1/likedBooks/ol_works_OL1W'), 'unlike: removed');
user = { uid: 'u2', email: 'ravi@example.com', displayName: 'Ravi' };
await LD.toggleBook(book);
LD.forgetLiked();
user = { uid: 'u1', email: 'asha@example.com', displayName: 'Asha' };
ok((await LD.loadLikedBooks(true)).length === 0, "liked books are private: another person's likes are not shown");
ok(LD.isLiked({ kind: 'job', id: 'imp_1' }) === false && (S.mine.saved.push('imp_1'), LD.isLiked({ kind: 'job', id: 'imp_1' })), 'isLiked: jobs and courses are the saved listings');

// ---- the picker and the share dialog
const ph = SV.itemsHtml([{ ...sj, liked: true }], 'job', '');
ok(ph.includes('data-act="shsend"') && ph.includes('sh-lk') && SV.itemsHtml([], 'book', '').includes('Type a title'), 'picker: rows, liked mark, hint for books');
ok(SV.pickerHtml('course', 'py"x').includes('value="py&quot;x"') && SV.pickerHtml('job', '').includes('data-id="book"'), 'picker: tabs, search value escaped');
const to = SV.targetsHtml(sj, [{ root: 'groups', id: 'g1', name: '<b>G</b>' }, { root: 'communities', id: 'c1', name: 'C' }], false);
ok(to.includes('data-id="groups:g1"') && to.includes('data-id="communities:c1"') && !to.includes('<b>G</b>'), 'share-to: groups and communities, names escaped');
ok(SV.targetsHtml(sj, [], false).includes('not in any group'), 'share-to: friendly message when there is nowhere to share');
S.sh = { all: [job, { ...job, id: 'imp_2', type: 'Course', title: 'Python 101' }, { ...job, id: 'imp_3', title: 'Chef' }] };
let r = await SA.pickerItems('course', '');
ok(r.items.length === 1 && r.items[0].kind === 'course', 'picker: courses only');
r = await SA.pickerItems('job', 'analyst');
ok(r.items.length === 1 && r.items[0].id === 'imp_1' && r.items[0].liked === true, 'picker: search narrows, liked ones are marked and first');
r = await SA.pickerItems('book', '');
ok(r.items.length === 0, 'picker: books wait for a search (nothing liked)');

// ---- the Liked page
S.lk = { tab: 'courses', courses: [{ ...job, id: 'imp_2', type: 'Course', title: 'Python 101', orgName: 'Acme', location: 'Online', pay: 'Free', duration: '' }], jobs: [] };
await LD.toggleBook(book);
LV.drawLiked();
let html = els['#app'].innerHTML;
ok(/Liked/.test(html) && /data-act="likedtab" data-id="courses"/.test(html) && /data-id="jobs"/.test(html) && /data-id="books"/.test(html), 'liked page: three tabs');
ok(html.includes('Python 101') && /<em>1<\/em>/.test(html), 'liked page: courses tab lists the saved course with counts');
S.lk.tab = 'jobs';
LV.drawLiked();
ok(/No liked jobs yet/.test(els['#app'].innerHTML) && /href="#\/jobs"/.test(els['#app'].innerHTML), 'liked page: empty jobs tab points to Jobs');
S.lk.tab = 'books';
LV.drawLiked();
html = els['#app'].innerHTML;
ok(html.includes('Pride and Prejudice') && html.includes('data-act="booklike"') && html.includes('aria-pressed="true"'), 'liked page: books tab shows the liked book with its heart on');

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);

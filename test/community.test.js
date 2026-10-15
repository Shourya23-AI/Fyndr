// Communities: helpers, Firestore reads/writes (against a tiny in-memory fake) and the pages.   Run:  node test/community.test.js
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

const H = await import('../public/js/features/community/community.helpers.js');
const D = await import('../public/js/features/community/community.data.js');
const V = await import('../public/js/features/community/community.view.js');

// ---- helpers
const pe = H.parseEmails('A@x.com, b@Y.org; nonsense  a@x.com\nc@z.in');
ok(JSON.stringify(pe.good) === '["a@x.com","b@y.org","c@z.in"]' && JSON.stringify(pe.bad) === '["nonsense"]', 'parseEmails: lower case, no repeats, bad ones reported');
ok(H.parseEmails('x@y').good.length === 0 && H.parseEmails('').good.length === 0, 'parseEmails: needs a real address');
ok(H.oneLine('  a \n  b\t c ', 10) === 'a b c' && H.oneLine('abcdef', 3) === 'abc', 'oneLine trims and cuts');
ok(H.cleanPost('hi \r\n\r\n\r\n\r\nthere  ') === 'hi\n\nthere' && H.cleanPost('x'.repeat(2000)).length === H.LIMITS.post, 'cleanPost keeps line breaks, limits length');
const now = 1e12;
ok(H.when(0) === 'just now' && H.when(now - 5 * 60e3, now) === '5 min ago' && H.when(now - 3 * 3600e3, now) === '3 h ago' && H.when(now - 86400e3, now) === '1 day ago', 'when() reads naturally');

// ---- create, join, leave
const cid = await D.createCommunity({ name: '  Bengaluru   freshers ', desc: 'Jobs & tips' });
let c = store.get('communities/' + cid);
ok(c.name === 'Bengaluru freshers' && c.memberCount === 1 && c.creatorId === 'u1' && c.creatorName === 'Asha K', 'create: community saved with the creator as first member');
ok(store.has(`memberships/${cid}_u1`) && store.get(`memberships/${cid}_u1`).cid === cid, 'create: creator membership written with it');
let threw = false;
try { await D.createCommunity({ name: 'ab' }); } catch (e) { threw = /name/.test(e.message); }
ok(threw, 'create: too-short name refused');

user = { uid: 'u2', email: 'ravi@example.com', displayName: 'Ravi' };
S.me = { name: 'Ravi', role: 'user' };
let list = await D.listCommunities();
ok(list.length === 1 && list[0].joined === false && list[0].mine === false, 'list: not joined yet');
await D.joinCommunity(cid);
c = store.get('communities/' + cid);
ok(c.memberCount === 2 && store.has(`memberships/${cid}_u2`), 'join: member count up by one and membership written');
list = await D.listCommunities();
ok(list[0].joined === true, 'list: shows joined');
const one = await D.getCommunity(cid);
ok(one.joined && !one.mine && one.name === 'Bengaluru freshers' && (await D.getCommunity('nope')) === null, 'getCommunity: joined flag, and null when it does not exist');

// ---- posts
await D.addPost(cid, '  Hello <b>everyone</b>\n\n\n\nnice to meet you ');
let posts = await D.listPosts(cid);
ok(posts.length === 1 && posts[0].text === 'Hello <b>everyone</b>\n\nnice to meet you' && posts[0].authorId === 'u2' && posts[0].authorName === 'Ravi', 'post: saved with author and cleaned text');
threw = false;
try { await D.addPost(cid, '   '); } catch (e) { threw = true; }
ok(threw, 'post: empty message refused');

// ---- pages
globalThis.location.hash = '#/community/' + cid;
S.arg = cid;
await V.communityView();
let html = els['#app'].innerHTML;
ok(/Bengaluru freshers/.test(html) && /data-act="cmleave"/.test(html) && /data-form="gppost"/.test(html), 'detail: joined member sees Leave and the chat box');
const chat = els['#gp-msgs'].innerHTML;
ok(chat.includes('Hello &lt;b&gt;everyone&lt;/b&gt;') && !chat.includes('<b>everyone</b>'), 'detail: message text is escaped');
ok(/data-act="gpdelpost"/.test(chat), 'detail: author can delete own message');
S.cm.cur = { id: cid };
await D.deletePost(cid, posts[0].id);
ok((await D.listPosts(cid)).length === 0, 'delete post works');

await D.leaveCommunity(cid);
c = store.get('communities/' + cid);
ok(c.memberCount === 1 && !store.has(`memberships/${cid}_u2`), 'leave: count down by one, membership removed');
await V.communityView();
html = els['#app'].innerHTML;
ok(/data-act="cmjoin"/.test(html) && !/data-form="cmpost"/.test(html) && /Join to take part/.test(html), 'detail: non-member sees Join, no post box');

globalThis.location.hash = '#/community';
S.arg = '';
await V.communityView();
html = els['#app'].innerHTML;
ok(/Communities/.test(html) && /Bengaluru freshers/.test(html) && /data-act="cmjoin"/.test(html) && /data-form="cmcreate"/.test(html), 'list: communities shown with Join and a create form');
S.cm.q = 'zzz';
V.drawList();
ok(/No community matches that/.test(els['#app'].innerHTML), 'list: search with no match says so');

S.arg = '../x';
await V.communityView();
ok(/Community not found/.test(els['#app'].innerHTML), 'detail: a strange id is "not found", not an error');

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);

// Groups: leader-only adding, private lists, messages and the pages (against a tiny in-memory fake).   Run:  node test/groups.test.js
let pass = 0, fail = 0;
const ok = (c, n) => { c ? pass++ : (fail++, console.log('  FAIL', n)); };

// ---- a tiny fake browser
const els = {};
const el = () => ({ innerHTML: '', hidden: false, querySelector: () => null });
globalThis.document = { querySelector: s => (els[s] ??= el()) };
globalThis.location = { hash: '#/groups' };
globalThis.localStorage = { getItem: k => (k.startsWith('fyndr-fbcfg') ? JSON.stringify({ cfg: { apiKey: 'YOUR_KEY' }, local: true }) : null), setItem() {}, removeItem() {} };
globalThis.confirm = () => true;

// ---- a tiny in-memory Firestore (no security rules; it only checks that our reads and writes do what the pages expect)
class Ts { toMillis() { return 1700000000000; } }
const clone = x => (Array.isArray(x) ? x.map(clone) : x instanceof Ts ? x : x && typeof x === 'object' ? Object.fromEntries(Object.entries(x).map(([k, v]) => [k, clone(v)])) : x);
const store = new Map();
let auto = 0;
const snap = p => ({ id: p.split('/').pop(), exists: () => store.has(p), data: () => clone(store.get(p)) });
const inCol = (p, col) => p.startsWith(col + '/') && !p.slice(col.length + 1).includes('/');
const patch = (o, d) => { for (const [k0, v] of Object.entries(d)) { let tgt = o, k = k0; if (k0.includes('.')) { const [a, b] = k0.split('.'); tgt = o[a] = o[a] || {}; k = b; } tgt[k] = v && v.__inc !== undefined ? (tgt[k] || 0) + v.__inc : v && v.__union ? [...new Set([...(tgt[k] || []), ...v.__union])] : v && v.__remove ? (tgt[k] || []).filter(x => !v.__remove.includes(x)) : v; } };
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


const D = await import('../public/js/features/groups/groups.data.js');
const V = await import('../public/js/features/groups/groups.view.js');

// ---- create (Asha becomes the leader)
const gid = await D.createGroup({ name: '  Project   team ', desc: 'Final year', emails: 'Ravi@Example.com, asha@example.com, bad-one' .replace(', bad-one', '') });
let g = store.get('groups/' + gid);
ok(g.name === 'Project team' && g.leaderId === 'u1' && g.leaderEmail === 'asha@example.com', 'create: leader saved');
ok(JSON.stringify(g.members) === '["asha@example.com","ravi@example.com"]', 'create: leader first, emails lower-cased, no repeats');
let threw = false;
try { await D.createGroup({ name: 'ab' }); } catch (e) { threw = /name/.test(e.message); }
ok(threw, 'create: short name refused');
threw = false;
try { await D.createGroup({ name: 'Good name', emails: 'nonsense' }); } catch (e) { threw = /not email/.test(e.message); }
ok(threw, 'create: bad email refused');

// ---- leader adds people
let r = await D.addMembers(gid, 'new@x.com, ravi@example.com, oops');
ok(JSON.stringify(r.added) === '["new@x.com"]' && r.already.length === 1 && r.bad[0] === 'oops', 'leader add: new, already-in and bad addresses told apart');
ok(store.get('groups/' + gid).members.includes('new@x.com'), 'leader add: saved');
threw = false;
try { await D.addMembers(gid, '   '); } catch (e) { threw = true; }
ok(threw, 'leader add: empty input refused');
const many = Array.from({ length: 60 }, (_, i) => `p${i}@x.com`).join(',');
threw = false;
try { await D.addMembers(gid, many); } catch (e) { threw = /at most/.test(e.message); }
ok(threw, 'leader add: size limit');

// ---- a member is NOT the leader
user = { uid: 'u2', email: 'ravi@example.com', displayName: 'Ravi' };
S.me = { name: 'Ravi', role: 'user' };
threw = false;
try { await D.addMembers(gid, 'sneaky@x.com'); } catch (e) { threw = /Only the group leader/.test(e.message); }
ok(threw && !store.get('groups/' + gid).members.includes('sneaky@x.com'), 'member cannot add people');
let list = await D.listGroups();
ok(list.length === 1 && list[0].leader === false, 'member sees the group they were added to');
user = { uid: 'u9', email: 'outsider@x.com', displayName: 'O' };
ok((await D.listGroups()).length === 0, 'someone not on the list sees nothing');
user = { uid: 'u2', email: 'ravi@example.com', displayName: 'Ravi' };

// ---- messages
await D.addPost(gid, ' Hi <i>team</i> ');
let posts = await D.listPosts(gid);
ok(posts.length === 1 && posts[0].text === 'Hi <i>team</i>' && posts[0].authorName === 'Ravi', 'message saved with author');

// ---- pages: member
globalThis.location.hash = '#/groups/' + gid;
S.arg = gid;
await V.groupsView();
let html = els['#app'].innerHTML;
ok(/Project team/.test(html) && !/data-form="gpadd"/.test(html) && /data-act="gpleave"/.test(html), 'member page: no add box, has Leave');
ok(els['#gp-msgs'].innerHTML.includes('Hi &lt;i&gt;team&lt;/i&gt;'), 'message text escaped');
ok(!/data-act="gprm"/.test(html), 'member page: no Remove buttons');

// ---- pages: leader
user = { uid: 'u1', email: 'asha@example.com', displayName: 'Asha' };
S.me = { name: 'Asha K', role: 'user' };
await V.groupsView();
html = els['#app'].innerHTML;
ok(/data-form="gpadd"/.test(html) && /data-act="gpdelete"/.test(html) && /data-act="gprm"/.test(html), 'leader page: add box, Delete group, Remove buttons');
ok(/gp-leader">Leader/.test(html), 'leader badge shown');
ok(/data-act="gpdelpost"/.test(els['#gp-msgs'].innerHTML), 'leader can delete any message');

// ---- chat: names on top, photo, reply, poll, vote, reaction
user = { uid: 'u2', email: 'ravi@example.com', displayName: 'Ravi' };
S.me = { name: 'Ravi', role: 'user' };
const first = (await D.listPosts(gid))[0];
await D.addPost(gid, { text: 'look', img: 'data:image/webp;base64,AAAA', reply: { id: first.id, name: 'Ravi', text: 'Hi team' } });
await D.addPost(gid, { poll: { q: 'Lunch?', opts: ['Pizza', 'Dosa', 'Pizza', ' '], multi: false } });
threw = false;
try { await D.addPost(gid, { poll: { q: 'x?', opts: ['only one'] } }); } catch (e) { threw = /at least 2/.test(e.message); }
ok(threw, 'poll: needs 2 different options');
threw = false;
try { await D.addPost(gid, { text: '   ' }); } catch (e) { threw = true; }
ok(threw, 'empty message refused');
posts = await D.listPosts(gid);
const pollPost = posts.find(p => p.poll);
ok(posts.length === 3 && JSON.stringify(pollPost.poll.opts) === '["Pizza","Dosa"]', 'poll saved with cleaned options');
await D.votePoll(gid, pollPost.id, 1);
user = { uid: 'u1', email: 'asha@example.com', displayName: 'Asha' };
S.me = { name: 'Asha K', role: 'user' };
await D.votePoll(gid, pollPost.id, 1);
await D.votePoll(gid, pollPost.id, 0);
let pv = store.get(`groups/${gid}/posts/${pollPost.id}`).votes;
ok(JSON.stringify(pv.u2) === '[1]' && JSON.stringify(pv.u1) === '[0]', 'votes: one per person, single choice moves; nobody overwrites another');
await D.votePoll(gid, pollPost.id, 0);
ok(JSON.stringify(store.get(`groups/${gid}/posts/${pollPost.id}`).votes.u1) === '[]', 'votes: same option again takes the vote back');
await D.reactPost(gid, first.id, '👍');
ok(store.get(`groups/${gid}/posts/${first.id}`).reactions.u1 === '👍', 'reaction saved');
await D.reactPost(gid, first.id, '👍');
ok(store.get(`groups/${gid}/posts/${first.id}`).reactions.u1 === '', 'same reaction again removes it');
await D.reactPost(gid, first.id, '❤️');
await D.addPost(gid, 'my own message');
await V.groupsView();
html = els['#app'].innerHTML;
const chat = els['#gp-msgs'].innerHTML;
ok(/class="ch"/.test(html) && /id="gp-msgs"/.test(html) && /data-form="gppost"/.test(html) && /data-act="gppollnew"/.test(html) && /type="file"/.test(html), 'chat window: header, message area, composer with photo + poll');
ok(/class="ch-name"[^>]*>Ravi</.test(chat) && !/class="ch-name"[^>]*>Asha/.test(chat), "other people's names show on top of their bubbles; yours does not");
ok(/ch-row me/.test(chat) && /ch-row them/.test(chat) && /ch-day/.test(chat) && /ch-img/.test(chat) && /ch-quote/.test(chat), 'bubbles left/right, day separator, photo, reply quote');
ok(/ch-poll/.test(chat) && /Lunch\?/.test(chat) && /data-act="gpvote"/.test(chat) && /1 vote/.test(chat), 'poll shown with options and vote count');
ok(/ch-react mine/.test(chat) && /❤️/.test(chat), 'my reaction is highlighted');
ok(/data-act="gpdelpost"/.test(chat), 'leader can delete any message');

// ---- remove, leave, delete
await D.removeMember(gid, 'NEW@x.com');
ok(!store.get('groups/' + gid).members.includes('new@x.com'), 'leader removes a person');
threw = false;
try { await D.removeMember(gid, 'asha@example.com'); } catch (e) { threw = /cannot be removed/.test(e.message); }
ok(threw, 'leader cannot remove themself');
user = { uid: 'u2', email: 'ravi@example.com', displayName: 'Ravi' };
await D.leaveGroup(gid);
ok(!store.get('groups/' + gid).members.includes('ravi@example.com'), 'member leaves');
user = { uid: 'u1', email: 'asha@example.com', displayName: 'Asha' };
globalThis.location.hash = '#/groups';
S.arg = '';
await V.groupsView();
html = els['#app'].innerHTML;
ok(/Groups/.test(html) && /Project team/.test(html) && /You lead this/.test(html) && /data-form="gpcreate"/.test(html), 'list page: groups, leader badge, create form');
await D.deleteGroup(gid);
ok(!store.has('groups/' + gid), 'leader deletes the group');
S.arg = '../x';
await V.groupsView();
ok(/Group not found/.test(els['#app'].innerHTML), 'strange id is "not found"');

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);

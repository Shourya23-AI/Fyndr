// The messages of a "space" (a private group OR an open community). Both are chat rooms with the same abilities:
// text, photos, polls, reactions, quoted replies and things shared from Fyndr (a job, a course or a book).
//   root = 'groups' | 'communities'      id = the group / community id        messages live in  <root>/<id>/posts/<postId>
// firestore.rules decides who may read and write them. These functions only do the reads and writes.
import { fs, friendly } from '../../services/firestore-api/fire.js';
import { fb } from '../../services/firebase/firebase-init.js';
import { S } from '../../core/state.js';
import { oneLine, cleanPost } from '../community/community.helpers.js';
import { cleanPoll } from '../groups/chat.helpers.js';
import { cleanShare } from '../share/share.js';

export const ROOTS = ['groups', 'communities'];
const root = r => {
    if (!ROOTS.includes(r)) {
        throw new Error('Unknown space.');
    }
    return r;
};
export const who = () => {
    const u = fb.user();
    if (!u) {
        throw new Error('Please sign in first.');
    }
    return { uid: u.uid, email: String(u.email || '').toLowerCase(), name: oneLine(S.me?.orgName || S.me?.name || u.displayName || 'Member', 80) };
};
export async function run(fn, where) {
    try {
        const { m, db } = await fs();
        return await fn(m, db);
    } catch (e) {
        throw friendly(e, where);
    }
}
export const rows = s => s.docs.map(d => ({ id: d.id, ...d.data() }));
export const ms = t => (t && typeof t.toMillis === 'function' ? t.toMillis() : 0);

const asPosts = s => rows(s).map(p => ({ ...p, t: ms(p.createdAt) })).reverse(); // oldest first, like a chat
export const listPosts = (r, id, n = 100) => run(async (m, db) => asPosts(await m.getDocs(m.query(m.collection(db, root(r), id, 'posts'), m.orderBy('createdAt', 'desc'), m.limit(n)))), 'loading messages');

// Live messages: Firestore pushes every change. Where the SDK cannot (tests), the list is re-read every 4 seconds. Returns a stop function.
export const subscribe = (r, id, n, cb) => run(async (m, db) => {
    const q = m.query(m.collection(db, root(r), id, 'posts'), m.orderBy('createdAt', 'desc'), m.limit(n));
    if (typeof m.onSnapshot === 'function') {
        return m.onSnapshot(q, s => cb(asPosts(s)), () => {});
    }
    const t = setInterval(() => m.getDocs(q).then(s => cb(asPosts(s)), () => {}), 4000);
    t.unref && t.unref();
    return () => clearInterval(t);
}, 'listening for new messages');

// msg = { text, img (data URL), reply: {id,name,text}, poll: {q,opts,multi}, share: {kind,id,title,...} }. A plain string still works.
export const addPost = (r, id, msg) => run(async (m, db) => {
    const u = who();
    const x = typeof msg === 'string' ? { text: msg } : msg || {};
    const t = cleanPost(x.text);
    const poll = x.poll ? cleanPoll(x.poll) : null;
    const share = x.share ? cleanShare(x.share) : null;
    if (!t && !x.img && !poll && !share) {
        throw new Error('Write something first.');
    }
    const doc = { authorId: u.uid, authorName: u.name, text: t, createdAt: m.serverTimestamp() };
    if (x.img) {
        doc.img = String(x.img);
    }
    if (x.reply && x.reply.id) {
        doc.reply = { id: String(x.reply.id).slice(0, 40), name: oneLine(x.reply.name, 80), text: oneLine(x.reply.text, 80) };
    }
    if (poll) {
        doc.poll = poll;
        doc.votes = {};
    }
    if (share) {
        doc.share = share;
    }
    await m.addDoc(m.collection(db, root(r), id, 'posts'), doc);
}, 'sending a message');

// One vote per person, stored under their own id so two people voting at once never overwrite each other.
export const votePoll = (r, id, pid, i) => run(async (m, db) => {
    const u = who();
    const ref = m.doc(db, root(r), id, 'posts', pid);
    const d = await m.getDoc(ref);
    const p = d.exists() && d.data();
    if (!p || !p.poll || !(i >= 0 && i < p.poll.opts.length)) {
        throw new Error('This poll is gone.');
    }
    const had = Array.isArray((p.votes || {})[u.uid]) ? p.votes[u.uid] : [];
    const next = p.poll.multi ? (had.includes(i) ? had.filter(x => x !== i) : [...had, i].sort()) : (had.length === 1 && had[0] === i ? [] : [i]);
    await m.updateDoc(ref, { ['votes.' + u.uid]: next });
}, 'voting');

// One reaction per person; the same emoji again takes it back.
export const reactPost = (r, id, pid, emoji) => run(async (m, db) => {
    const u = who();
    const ref = m.doc(db, root(r), id, 'posts', pid);
    const d = await m.getDoc(ref);
    if (!d.exists()) {
        throw new Error('That message is gone.');
    }
    const cur = (d.data().reactions || {})[u.uid];
    await m.updateDoc(ref, { ['reactions.' + u.uid]: cur === emoji ? '' : String(emoji).slice(0, 8) });
}, 'reacting');

export const deletePost = (r, id, pid) => run(async (m, db) => {
    await m.deleteDoc(m.doc(db, root(r), id, 'posts', pid));
}, 'deleting a message');

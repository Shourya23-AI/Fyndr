// Groups: Firestore reads and writes (no server). firestore.rules is what keeps this safe.
//   groups/{id}                  name, desc, leaderId, leaderName, leaderEmail, members[] (lower-case emails), createdAt
//   groups/{id}/posts/{postId}   authorId, authorName, text, createdAt
// Groups are private: only people on the list can see a group or its messages. ONLY the leader adds or removes people (by email).
import { LIMITS, oneLine, parseEmails } from '../community/community.helpers.js';
import * as chat from '../chat/chat.data.js';
import { who, run, rows, ms } from '../chat/chat.data.js';

export { who, run };
const shape = (g, u) => ({ ...g, members: Array.isArray(g.members) ? g.members : [], t: ms(g.createdAt), leader: g.leaderId === u.uid });

export const listGroups = () => run(async (m, db) => {
    const u = who();
    const s = await m.getDocs(m.query(m.collection(db, 'groups'), m.where('members', 'array-contains', u.email), m.limit(100)));
    return rows(s).map(g => shape(g, u)).sort((a, b) => b.t - a.t);
}, 'loading your groups');

export const getGroup = gid => run(async (m, db) => {
    const u = who();
    const d = await m.getDoc(m.doc(db, 'groups', gid));
    return d.exists() ? shape({ id: d.id, ...d.data() }, u) : null;
}, 'opening the group');

export const createGroup = ({ name, desc, emails }) => run(async (m, db) => {
    const u = who();
    const n = oneLine(name, LIMITS.name);
    if (n.length < 3) {
        throw new Error('Give the group a name (at least 3 letters).');
    }
    const { good, bad } = parseEmails(emails);
    if (bad.length) {
        throw new Error('These are not email addresses: ' + bad.slice(0, 3).join(', '));
    }
    const members = [u.email, ...good.filter(e => e !== u.email)];
    if (members.length > LIMITS.groupMax) {
        throw new Error(`A group can have at most ${LIMITS.groupMax} people.`);
    }
    const ref = await m.addDoc(m.collection(db, 'groups'), { name: n, desc: oneLine(desc, LIMITS.desc), leaderId: u.uid, leaderName: u.name, leaderEmail: u.email, members, createdAt: m.serverTimestamp() });
    return ref.id;
}, 'creating the group');

// Leader only (the rules enforce it too). Returns { added, already, bad }.
export const addMembers = (gid, text) => run(async (m, db) => {
    const u = who();
    const g = await m.getDoc(m.doc(db, 'groups', gid));
    if (!g.exists()) {
        throw new Error('This group no longer exists.');
    }
    const d = g.data();
    if (d.leaderId !== u.uid) {
        throw new Error('Only the group leader can add people.');
    }
    const { good, bad } = parseEmails(text);
    const have = new Set(d.members || []);
    const added = good.filter(e => !have.has(e));
    if (!good.length && !bad.length) {
        throw new Error('Type at least one email address.');
    }
    if (have.size + added.length > LIMITS.groupMax) {
        throw new Error(`A group can have at most ${LIMITS.groupMax} people.`);
    }
    if (added.length) {
        await m.updateDoc(m.doc(db, 'groups', gid), { members: m.arrayUnion(...added) });
    }
    return { added, already: good.filter(e => have.has(e)), bad };
}, 'adding people');

export const removeMember = (gid, email) => run(async (m, db) => {
    const u = who();
    if (String(email).toLowerCase() === u.email) {
        throw new Error('The leader cannot be removed. Delete the group instead.');
    }
    await m.updateDoc(m.doc(db, 'groups', gid), { members: m.arrayRemove(String(email).toLowerCase()) });
}, 'removing a person');

// A member (not the leader) leaves by removing their own email.
export const leaveGroup = gid => run(async (m, db) => {
    const u = who();
    await m.updateDoc(m.doc(db, 'groups', gid), { members: m.arrayRemove(u.email) });
}, 'leaving the group');

export const deleteGroup = gid => run(async (m, db) => {
    await m.deleteDoc(m.doc(db, 'groups', gid));
}, 'deleting the group');

// Messages: shared with communities (see features/chat/chat.data.js).
export const listPosts = (gid, n = 100) => chat.listPosts('groups', gid, n);
export const subscribe = (gid, n, cb) => chat.subscribe('groups', gid, n, cb);
// msg = { text, img (data URL), reply: {id,name,text}, poll: {q,opts,multi}, share }. A plain string still works.
export const addPost = (gid, msg) => chat.addPost('groups', gid, msg);
export const votePoll = (gid, pid, i) => chat.votePoll('groups', gid, pid, i);
export const reactPost = (gid, pid, emoji) => chat.reactPost('groups', gid, pid, emoji);
export const deletePost = (gid, pid) => chat.deletePost('groups', gid, pid);

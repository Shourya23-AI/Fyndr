// Communities: Firestore reads and writes (no server). firestore.rules is what keeps this safe.
//   communities/{id}                 name, desc, creatorId, creatorName, createdAt, memberCount
//   memberships/{communityId}_{uid}  cid, uid, name, joinedAt          (one per person per community)
//   communities/{id}/posts/{postId}  a chat message (text / photo / poll / reply / shared item), see features/chat/chat.data.js
// Anyone signed in can see communities and join any of them. Only members can post. The creator leads the community like a group
// leader does: they can remove members and delete anyone's message. Everyone can delete their own messages.
import * as chat from '../chat/chat.data.js';
import { who, run, rows, ms } from '../chat/chat.data.js';
import { LIMITS, oneLine } from './community.helpers.js';

export { who, run, rows, ms };
const shape = (c, u, joined) => ({ ...c, t: ms(c.createdAt), joined, mine: c.creatorId === u.uid, leader: c.creatorId === u.uid });

export const listCommunities = () => run(async (m, db) => {
    const u = who();
    const [all, mine] = await Promise.all([
        m.getDocs(m.query(m.collection(db, 'communities'), m.orderBy('memberCount', 'desc'), m.limit(60))),
        m.getDocs(m.query(m.collection(db, 'memberships'), m.where('uid', '==', u.uid)))
    ]);
    const joined = new Set(mine.docs.map(d => d.data().cid));
    return rows(all).map(c => shape(c, u, joined.has(c.id)));
}, 'loading communities');

export const getCommunity = cid => run(async (m, db) => {
    const u = who();
    const [c, mem] = await Promise.all([m.getDoc(m.doc(db, 'communities', cid)), m.getDoc(m.doc(db, 'memberships', cid + '_' + u.uid))]);
    return c.exists() ? shape({ id: c.id, ...c.data() }, u, mem.exists()) : null;
}, 'opening the community');

export const createCommunity = ({ name, desc }) => run(async (m, db) => {
    const u = who();
    const n = oneLine(name, LIMITS.name);
    if (n.length < 3) {
        throw new Error('Give the community a name (at least 3 letters).');
    }
    const ref = m.doc(m.collection(db, 'communities'));
    const b = m.writeBatch(db);
    b.set(ref, { name: n, desc: oneLine(desc, LIMITS.desc), creatorId: u.uid, creatorName: u.name, createdAt: m.serverTimestamp(), memberCount: 1 });
    b.set(m.doc(db, 'memberships', ref.id + '_' + u.uid), { cid: ref.id, uid: u.uid, name: u.name, joinedAt: m.serverTimestamp() });
    await b.commit();
    return ref.id;
}, 'creating the community');

export const joinCommunity = cid => run(async (m, db) => {
    const u = who();
    const b = m.writeBatch(db);
    b.set(m.doc(db, 'memberships', cid + '_' + u.uid), { cid, uid: u.uid, name: u.name, joinedAt: m.serverTimestamp() });
    b.update(m.doc(db, 'communities', cid), { memberCount: m.increment(1) });
    await b.commit();
}, 'joining');

export const leaveCommunity = cid => run(async (m, db) => {
    const u = who();
    const b = m.writeBatch(db);
    b.delete(m.doc(db, 'memberships', cid + '_' + u.uid));
    b.update(m.doc(db, 'communities', cid), { memberCount: m.increment(-1) });
    await b.commit();
}, 'leaving');

// Everyone in a community, oldest member first (the creator is first).
export const listMembers = cid => run(async (m, db) => {
    const s = await m.getDocs(m.query(m.collection(db, 'memberships'), m.where('cid', '==', cid), m.limit(300)));
    return rows(s).map(x => ({ uid: x.uid, name: x.name || 'Member', t: ms(x.joinedAt) })).sort((a, b) => a.t - b.t);
}, 'loading members');

// Creator only (the rules enforce it too).
export const removeMember = (cid, uid) => run(async (m, db) => {
    const u = who();
    if (uid === u.uid) {
        throw new Error('The creator cannot be removed. Delete the community instead.');
    }
    const b = m.writeBatch(db);
    b.delete(m.doc(db, 'memberships', cid + '_' + uid));
    b.update(m.doc(db, 'communities', cid), { memberCount: m.increment(-1) });
    await b.commit();
}, 'removing a member');

// Creator only. Clears the messages and memberships first (best effort, in batches), then the community itself.
export const deleteCommunity = cid => run(async (m, db) => {
    const wipe = async refs => {
        for (let i = 0; i < refs.length; i += 400) {
            const b = m.writeBatch(db);
            refs.slice(i, i + 400).forEach(r => b.delete(r));
            await b.commit();
        }
    };
    try {
        const [p, mem] = await Promise.all([
            m.getDocs(m.query(m.collection(db, 'communities', cid, 'posts'), m.limit(2000))),
            m.getDocs(m.query(m.collection(db, 'memberships'), m.where('cid', '==', cid), m.limit(2000)))
        ]);
        await wipe(p.docs.map(d => m.doc(db, 'communities', cid, 'posts', d.id)));
        await wipe(mem.docs.map(d => m.doc(db, 'memberships', d.id)));
    } catch {
        // leftovers are harmless: nothing lists them once the community is gone
    }
    await m.deleteDoc(m.doc(db, 'communities', cid));
}, 'deleting the community');

// Messages: the same chat as groups (features/chat/chat.data.js).
export const listPosts = (cid, n = 100) => chat.listPosts('communities', cid, n);
export const subscribe = (cid, n, cb) => chat.subscribe('communities', cid, n, cb);
export const addPost = (cid, msg) => chat.addPost('communities', cid, msg);
export const votePoll = (cid, pid, i) => chat.votePoll('communities', cid, pid, i);
export const reactPost = (cid, pid, emoji) => chat.reactPost('communities', cid, pid, emoji);
export const deletePost = (cid, pid) => chat.deletePost('communities', cid, pid);

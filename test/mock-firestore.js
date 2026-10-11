// A tiny in-memory stand-in for the Firestore SDK (only what Fyndr uses). It does NOT check security rules.
const DEL = { __del: 1 };
export function createMock() {
    const store = new Map(); // 'users/abc' -> data
    let auto = 0;
    const clone = x => JSON.parse(JSON.stringify(x));
    const path = (...p) => p.flat().join('/');
    const snap = (p) => ({ id: p.split('/').pop(), ref: { path: p }, exists: () => store.has(p), data: () => clone(store.get(p)) });
    const setIn = (o, k, v) => {
        const ks = k.split('.');
        let c = o;
        ks.slice(0, -1).forEach(x => c = c[x] = c[x] || {});
        if (v === DEL) {
            delete c[ks.at(-1)];
        } else if (v && v.__union) {
            c[ks.at(-1)] = [...new Set([...(c[ks.at(-1)] || []), ...v.__union])];
        } else if (v && v.__remove) {
            c[ks.at(-1)] = (c[ks.at(-1)] || []).filter(x => !v.__remove.includes(x));
        } else {
            c[ks.at(-1)] = v;
        }
    };
    const write = {
        set: (p, d) => store.set(p, clone(d)),
        update: (p, d) => {
            if (!store.has(p)) {
                throw Object.assign(new Error('no doc'), { code: 'not-found' });
            }
            const o = store.get(p);
            Object.entries(d).forEach(([k, v]) => setIn(o, k, v));
        },
        delete: p => store.delete(p)
    };
    const m = {
        getFirestore: () => ({}),
        doc: (db, ...seg) => (db && db.path !== undefined && !seg.length) ? { path: db.path + '/auto' + (++auto) } : { path: path(...seg) },
        collection: (db, ...seg) => ({ path: path(...seg), col: true }),
        where: (f, op, v) => ({ f, op, v }),
        query: (c, ...w) => ({ ...c, w }),
        getDoc: async r => snap(r.path),
        getDocs: async q => {
            const pre = q.path + '/';
            const out = [];
            for (const [p, d] of store) {
                if (p.startsWith(pre) && !p.slice(pre.length).includes('/') && (q.w || []).every(c => d[c.f] === c.v)) {
                    out.push(snap(p));
                }
            }
            return { docs: out };
        },
        setDoc: async (r, d) => write.set(r.path, d),
        updateDoc: async (r, d) => write.update(r.path, d),
        deleteDoc: async r => write.delete(r.path),
        writeBatch: () => {
            const ops = [];
            const b = {
                set: (r, d) => ops.push(() => write.set(r.path, d)),
                update: (r, d) => ops.push(() => write.update(r.path, d)),
                delete: r => ops.push(() => write.delete(r.path)),
                commit: async () => ops.forEach(f => f())
            };
            return b;
        },
        arrayUnion: (...v) => ({ __union: v }),
        arrayRemove: (...v) => ({ __remove: v }),
        deleteField: () => DEL
    };
    return { m, db: {}, store };
}

// Files (resume PDFs, proof documents) live in Firestore as base64 text, split into ~700 KB chunks because one document may hold < 1 MB.
// Chunk i of a file is the document  blobs/{ownerUid}_{kind}_{i}.  The owner's user document remembers how many chunks there are.
import { fs } from './fire.js';

export const CHUNK = 700000;
export const blobId = (owner, kind, i) => `${owner}_${kind}_${i}`;

// Adds the writes for a file to a batch. oldN = how many chunks the previous file had (extra ones are removed). Returns the chunk count.
export async function putBlob(batch, owner, kind, b64, oldN = 0) {
    const { m, db } = await fs();
    const n = Math.max(1, Math.ceil(b64.length / CHUNK));
    for (let i = 0; i < n; i++) {
        batch.set(m.doc(db, 'blobs', blobId(owner, kind, i)), { owner, kind, i, data: b64.slice(i * CHUNK, (i + 1) * CHUNK) });
    }
    for (let i = n; i < oldN; i++) {
        batch.delete(m.doc(db, 'blobs', blobId(owner, kind, i)));
    }
    return n;
}
export async function dropBlob(batch, owner, kind, n = 0) {
    const { m, db } = await fs();
    for (let i = 0; i < n; i++) {
        batch.delete(m.doc(db, 'blobs', blobId(owner, kind, i)));
    }
}
export async function getBlob(owner, kind, n = 1) {
    const { m, db } = await fs();
    const parts = await Promise.all(Array.from({ length: n }, (_, i) => m.getDoc(m.doc(db, 'blobs', blobId(owner, kind, i)))));
    if (parts.some(p => !p.exists())) {
        throw new Error('File not found');
    }
    return parts.map(p => p.data().data).join('');
}

// ---- Application copies --------------------------------------------------------------------------------------------
// When a candidate applies, the resume they chose is COPIED into the application: blobs/ar_{appId}_{i}  (appId = {uid}_{listingId}).
// The organization reads only that copy, so it sees exactly what the candidate chose to share, and deleting the application
// (withdraw, close, retention cleanup, account deletion) removes the organization's access with it.
export const appBlobId = (appId, i) => `ar_${appId}_${i}`;
export async function putAppBlob(batch, owner, orgId, appId, text) {
    const { m, db } = await fs();
    const n = Math.max(1, Math.ceil(text.length / CHUNK));
    for (let i = 0; i < n; i++) {
        batch.set(m.doc(db, 'blobs', appBlobId(appId, i)), { owner, kind: 'appresume', i, appId, orgId, data: text.slice(i * CHUNK, (i + 1) * CHUNK) });
    }
    return n;
}
export async function dropAppBlob(batch, appId, n = 0) {
    const { m, db } = await fs();
    for (let i = 0; i < n; i++) {
        batch.delete(m.doc(db, 'blobs', appBlobId(appId, i)));
    }
}
export async function getAppBlob(appId, n = 1) {
    const { m, db } = await fs();
    const parts = await Promise.all(Array.from({ length: n }, (_, i) => m.getDoc(m.doc(db, 'blobs', appBlobId(appId, i)))));
    if (parts.some(p => !p.exists())) {
        throw new Error('File not found');
    }
    return parts.map(p => p.data().data).join('');
}

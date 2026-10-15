// Sharing things from Fyndr (a job, a course or a book) into a group or a community. Pure helpers: no DOM, no network.
//   A shared item travels inside a chat message as   share: { kind, id, title, sub, tag, url?, img? }
//   kind  'job' | 'course' | 'book'      id  the listing id or the book id      sub  "Company · City" or the author
//   url   an https link (the official page / where to read the book)             img  an https cover picture
import { safeUrl } from '../../core/dom.js';
import { oneLine } from '../community/community.helpers.js';

export const KINDS = ['job', 'course', 'book'];
export const KIND_LABEL = { job: 'Job', course: 'Course', book: 'Book' };
const ACCESS = { free: 'Free to read', preview: 'Preview', borrow: 'Borrow', info: 'Details' };
const httpsImg = u => (typeof u === 'string' && u.length <= 500 ? safeUrl(u) : '');

// What goes into the message. Anything that is not plain text or a safe https link is dropped.
export function cleanShare(s) {
    if (!s || !KINDS.includes(s.kind)) {
        throw new Error('Pick a job, a course or a book to share.');
    }
    const title = oneLine(s.title, 160);
    const id = oneLine(s.id, 120);
    if (!title || !id) {
        throw new Error('That item cannot be shared.');
    }
    const out = { kind: s.kind, id, title, sub: oneLine(s.sub, 160), tag: oneLine(s.tag, 40) };
    const url = typeof s.url === 'string' && s.url.length <= 500 ? safeUrl(s.url) : '';
    const img = httpsImg(s.img);
    if (url) {
        out.url = url;
    }
    if (img) {
        out.img = img;
    }
    return out;
}
// A job, internship or course listing (the same objects the cards and the details popup use).
export const fromListing = l => cleanShare({
    kind: l.type === 'Course' ? 'course' : 'job',
    id: l.id,
    title: l.title,
    sub: [l.orgName, l.location].filter(Boolean).join(' · '),
    tag: l.type,
    url: l.applyUrl,
    img: l.image
});
// A book from the Library (see features/library/books.js for its shape).
export const fromBook = b => cleanShare({
    kind: 'book',
    id: b.id,
    title: b.title,
    sub: (b.authors || []).join(', '),
    tag: ACCESS[b.access] || 'Book',
    url: b.info,
    img: b.cover
});
// A shared book turned back into a book object, so it can be saved to Liked from the chat.
export const bookFromShare = s => ({
    id: s.id, title: s.title, authors: s.sub ? s.sub.split(/,\s*/).slice(0, 3) : [], year: null, cover: s.img || '',
    access: 'info', read: null, info: s.url || '', epub: '', src: s.url ? new URL(s.url).hostname.replace(/^www\./, '') : 'Fyndr'
});
// Short text for "reply" quotes and previews.
export const shareLine = s => (KIND_LABEL[s.kind] || 'Item') + ': ' + oneLine(s.title, 70);

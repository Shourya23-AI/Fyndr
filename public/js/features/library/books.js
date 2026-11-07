// Library logic (no DOM, no network): builds the catalog requests, turns each catalog's answer into ONE book shape, merges the three
// lists, and works out "Did you mean ...?" when a title is spelled a little wrong.
//
// Fyndr does not store or copy any book. It searches three open catalogs from the browser and opens the book on its owner's reader:
//   Open Library   (openlibrary.org)       millions of titles; books with a free Internet Archive copy open in the archive.org page-flip reader
//   Project Gutenberg (via gutendex.com)   ~75,000 free classics (public domain)
//   Google Books   (googleapis.com)        millions of titles; free ones open in Google's embedded viewer, the rest give a preview or a link
// A book that is still under copyright and not free cannot be read here; it shows as "Borrow" or "Details" with a link to where it is lawfully available.
const enc = encodeURIComponent;
// Every place a book can be found, read, borrowed or bought. [name, what you get there, link builder]. Shown on a card for ANY search, so a
// book that no catalog could open still gets a link to where it can be had.
export const FIND = [
    ['Open Library', 'borrow / read', q => 'https://openlibrary.org/search?q=' + enc(q)],
    ['Internet Archive', 'read / borrow', q => 'https://archive.org/search?query=' + enc(q) + '&sin=TXT'],
    ['Project Gutenberg', 'free classics', q => 'https://www.gutenberg.org/ebooks/search/?query=' + enc(q)],
    ['Google Books', 'preview / buy', q => 'https://www.google.com/search?tbm=bks&q=' + enc(q)],
    ['Amazon India', 'buy', q => 'https://www.amazon.in/s?k=' + enc(q) + '&i=stripbooks'],
    ['Flipkart', 'buy', q => 'https://www.flipkart.com/search?q=' + enc(q)],
    ['Goodreads', 'reviews', q => 'https://www.goodreads.com/search?q=' + enc(q)],
    ['WorldCat', 'nearest library', q => 'https://search.worldcat.org/search?q=' + enc(q)],
    ['HathiTrust', 'library scans', q => 'https://babel.hathitrust.org/cgi/ls?q1=' + enc(q) + '&anyall1=all&lmt=all'],
    ['Standard Ebooks', 'free ebooks', q => 'https://standardebooks.org/ebooks?query=' + enc(q)],
    ['LibriVox', 'free audiobooks', q => 'https://librivox.org/search?q=' + enc(q) + '&search_form=advanced'],
    ['DOAB', 'open-access academic', q => 'https://directory.doabooks.org/discover?query=' + enc(q)],
    ['Google Scholar', 'papers', q => 'https://scholar.google.com/scholar?q=' + enc(q)],
    ['OpenStax', 'free college textbooks', q => 'https://openstax.org/search?query=' + enc(q)],
    ['Open Textbook Library', 'free textbooks', q => 'https://open.umn.edu/opentextbooks/search?q=' + enc(q)],
    ['NCERT', 'school textbooks (India)', q => 'https://ncert.nic.in/textbook.php?search=' + enc(q)],
    ['NPTEL', 'Indian university notes', q => 'https://nptel.ac.in/course.html?q=' + enc(q)],
    ['National Digital Library of India', 'free study material', q => 'https://ndl.iitkgp.ac.in/search?query=' + enc(q)],
    ['Wikibooks', 'free textbooks', q => 'https://en.wikibooks.org/w/index.php?search=' + enc(q)],
    ['Wikisource', 'free texts', q => 'https://en.wikisource.org/w/index.php?search=' + enc(q)],
    ['Kindle Store', 'buy / ebook', q => 'https://www.amazon.in/s?k=' + enc(q) + '&i=digital-text'],
    ['Kobo', 'buy / ebook', q => 'https://www.kobo.com/in/en/search?query=' + enc(q)],
    ['Google Play Books', 'buy / ebook', q => 'https://play.google.com/store/search?q=' + enc(q) + '&c=books'],
    ['Bookswagon', 'buy (India)', q => 'https://www.bookswagon.com/search-books/' + enc(q)],
    ['Sapna Online', 'buy (India)', q => 'https://www.sapnaonline.com/searchproducts?keyword=' + enc(q)],
    ['Google (.edu and .ac.in files)', 'notes and PDFs', q => 'https://www.google.com/search?q=' + enc(q + ' pdf site:.edu OR site:.ac.in')],
    ['arXiv', 'free research papers', q => 'https://arxiv.org/search/?query=' + enc(q) + '&searchtype=all'],
    ['Semantic Scholar', 'papers', q => 'https://www.semanticscholar.org/search?q=' + enc(q)],
    ['YouTube', 'free video lectures', q => 'https://www.youtube.com/results?search_query=' + enc(q + ' lecture')]
];

// ---------- the catalog requests ----------
export const urls = {
    openLibrary: (q, limit = 60, free = false) => `https://openlibrary.org/search.json?q=${enc(q)}&limit=${limit}${free ? '&has_fulltext=true' : ''}&fields=key,title,author_name,first_publish_year,cover_i,ia,ebook_access`,
    gutendex: (q, { topic = '', lang = 'en', page = 1 } = {}) => 'https://gutendex.com/books/?' + [q ? 'search=' + enc(q) : '', topic ? 'topic=' + enc(topic) : '', lang ? 'languages=' + enc(lang) : '', page > 1 ? 'page=' + page : ''].filter(Boolean).join('&'),
    google: (q, free = true, start = 0) => `https://www.googleapis.com/books/v1/volumes?q=${enc(q)}&maxResults=40&printType=books${free ? '&filter=free-ebooks' : ''}${start ? '&startIndex=' + start : ''}`,
    archive: (q, free = false) => 'https://archive.org/advancedsearch.php?q=' + enc(`(${q}) AND mediatype:texts${free ? ' AND NOT access-restricted-item:true' : ''}`) + ['identifier', 'title', 'creator', 'year', 'access-restricted-item'].map(f => '&fl%5B%5D=' + f).join('') + '&sort%5B%5D=downloads+desc&rows=40&output=json',
    // Wikibooks (free community textbooks). The MediaWiki API allows browser requests with origin=*.
    wikibooks: q => 'https://en.wikibooks.org/w/api.php?action=query&list=search&srsearch=' + enc(q) + '&srlimit=20&srnamespace=0&format=json&origin=*',
    // where to look by hand when nothing is found
    searchOn: q => FIND.map(([name, , fn]) => [name, fn(q)])
};

// ---------- text helpers ----------
export const norm = s => String(s ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, ' ').trim().replace(/\s+/g, ' ');
const LEAD = /^(the|a|an) /;
const core = s => norm(s).replace(LEAD, '');
const words = s => core(s).split(' ').filter(Boolean);
const grams = s => {
    const t = ' ' + s + ' ';
    const out = new Map();
    for (let i = 0; i < t.length - 1; i++) {
        const g = t.slice(i, i + 2);
        out.set(g, (out.get(g) || 0) + 1);
    }
    return out;
};
const dice = (a, b) => {
    if (!a || !b) {
        return 0;
    }
    const x = grams(a), y = grams(b);
    let hit = 0, nx = 0, ny = 0;
    for (const [g, n] of x) {
        nx += n;
        hit += Math.min(n, y.get(g) || 0);
    }
    for (const n of y.values()) {
        ny += n;
    }
    return (2 * hit) / (nx + ny);
};
export function lev(a, b) {
    if (a === b) {
        return 0;
    }
    if (!a.length || !b.length) {
        return Math.max(a.length, b.length);
    }
    let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
    for (let i = 1; i <= a.length; i++) {
        const cur = [i];
        for (let j = 1; j <= b.length; j++) {
            cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
        }
        prev = cur;
    }
    return prev[b.length];
}
// 0..1 : how alike two short texts are (typos, missing letters, swapped letters)
export const alike = (a, b) => {
    const x = core(a), y = core(b);
    if (!x || !y) {
        return 0;
    }
    return Math.max(dice(x, y), 1 - lev(x, y) / Math.max(x.length, y.length));
};
// How close a typed search is to a book title: the title, its main part ("Dracula: a novel" -> "Dracula"), and its first few words
// (people type "harry poter", not the whole long title).
export function titleSim(query, title) {
    const qw = words(query).length || 1;
    const t = String(title ?? '');
    const main = t.split(/[:(\[]/)[0];
    const start = words(t).slice(0, qw + 1).join(' ');
    const start2 = words(t).slice(0, qw).join(' ');
    return Math.max(alike(query, t), alike(query, main), alike(query, start), alike(query, start2));
}
export const clean = (s, n = 160) => String(s ?? '').replace(/\s+/g, ' ').trim().slice(0, n);

// ---------- one book shape ----------
// { id, title, authors[], year, cover, access: 'free'|'preview'|'borrow'|'info', read: {kind, id}|null, info (https link), epub (https link)|'', src }
const OL_KEY = /^\/works\/OL\d{1,12}W$/;
const IA_ID = /^[A-Za-z0-9][A-Za-z0-9._-]{0,99}$/;
const GB_ID = /^[A-Za-z0-9_-]{5,20}$/;
const PG_ID = /^\d{1,7}$/;
const COVER_HOSTS = new Set(['covers.openlibrary.org', 'books.google.com', 'www.gutenberg.org', 'archive.org']);
// A cover is shown only when it is an https picture from one of the catalogs themselves.
export function safeCover(u) {
    try {
        const x = new URL(String(u).replace(/^http:\/\//i, 'https://'));
        return x.protocol === 'https:' && COVER_HOSTS.has(x.hostname) && !/["'<>\s]/.test(x.href) ? x.href : '';
    } catch {
        return '';
    }
}
export const readUrl = r => {
    if (!r) {
        return '';
    }
    if (r.kind === 'archive' && IA_ID.test(r.id)) {
        return 'https://archive.org/embed/' + enc(r.id);
    }
    if (r.kind === 'gutenberg' && PG_ID.test(String(r.id))) {
        return `https://www.gutenberg.org/cache/epub/${r.id}/pg${r.id}-images.html`;
    }
    if (r.kind === 'google' && GB_ID.test(r.id)) {
        return `https://books.google.com/books?id=${enc(r.id)}&printsec=frontcover&output=embed`;
    }
    return '';
};
const ACCESS_RANK = { free: 4, preview: 3, borrow: 2, info: 1 };

export function fromOpenLibrary(d) {
    if (!d || !OL_KEY.test(d.key || '') || !clean(d.title)) {
        return null;
    }
    const ia = (Array.isArray(d.ia) ? d.ia : []).find(x => IA_ID.test(x));
    const access = d.ebook_access === 'public' && ia ? 'free' : d.ebook_access === 'borrowable' ? 'borrow' : 'info';
    return {
        id: 'ol' + d.key, title: clean(d.title), authors: (Array.isArray(d.author_name) ? d.author_name : []).slice(0, 3).map(a => clean(a, 80)),
        year: Number.isInteger(d.first_publish_year) ? d.first_publish_year : null,
        cover: Number.isInteger(d.cover_i) && d.cover_i > 0 ? `https://covers.openlibrary.org/b/id/${d.cover_i}-M.jpg` : '',
        access, read: access === 'free' ? { kind: 'archive', id: ia } : null, info: 'https://openlibrary.org' + d.key, epub: '', src: 'Open Library'
    };
}
// Gutenberg writes "Austen, Jane": shown as "Jane Austen".
const flip = n => {
    const m = /^([^,]+),\s*(.+)$/.exec(clean(n, 80));
    return m ? `${m[2]} ${m[1]}` : clean(n, 80);
};
export function fromGutendex(b) {
    if (!b || !PG_ID.test(String(b.id)) || !clean(b.title)) {
        return null;
    }
    const f = b.formats && typeof b.formats === 'object' ? b.formats : {};
    const epub = Object.keys(f).find(k => k.startsWith('application/epub+zip'));
    const au = Array.isArray(b.authors) ? b.authors : [];
    return {
        id: 'pg' + b.id, title: clean(b.title), authors: au.slice(0, 3).map(a => flip(a.name)), year: null, // (Gutendex gives the author's life years, not the book's year)
        cover: safeCover(f['image/jpeg']), access: 'free', read: { kind: 'gutenberg', id: String(b.id) }, info: 'https://www.gutenberg.org/ebooks/' + b.id,
        epub: epub ? safeEpub(f[epub]) : '', src: 'Project Gutenberg'
    };
}
const safeEpub = u => {
    try {
        const x = new URL(u);
        return x.protocol === 'https:' && x.hostname.endsWith('gutenberg.org') ? x.href : '';
    } catch {
        return '';
    }
};
export function fromGoogle(it) {
    const vi = it && it.volumeInfo;
    if (!it || !GB_ID.test(it.id || '') || !vi || !clean(vi.title)) {
        return null;
    }
    const ai = it.accessInfo || {};
    const v = ai.viewability;
    const embeddable = ai.embeddable === true;
    const access = v === 'ALL_PAGES' && embeddable ? 'free' : v === 'PARTIAL' && embeddable ? 'preview' : 'info';
    const yr = parseInt(String(vi.publishedDate || '').slice(0, 4), 10);
    return {
        id: 'gb' + it.id, title: clean([vi.title, vi.subtitle].filter(Boolean).join(': ')), authors: (Array.isArray(vi.authors) ? vi.authors : []).slice(0, 3).map(a => clean(a, 80)),
        year: yr > 0 ? yr : null, cover: safeCover(vi.imageLinks && (vi.imageLinks.thumbnail || vi.imageLinks.smallThumbnail)),
        access, read: access === 'info' ? null : { kind: 'google', id: it.id }, info: 'https://books.google.com/books?id=' + it.id, epub: '', src: 'Google Books'
    };
}
const first1 = v => (Array.isArray(v) ? v[0] : v);
export function fromArchive(d) {
    const id = d && d.identifier;
    const title = clean(first1(d && d.title));
    if (!id || !IA_ID.test(id) || !title) {
        return null;
    }
    const by = d.creator ? (Array.isArray(d.creator) ? d.creator : [d.creator]) : [];
    const lent = String(first1(d['access-restricted-item'])).toLowerCase() === 'true';
    const yr = parseInt(String(first1(d.year) || '').slice(0, 4), 10);
    return {
        id: 'ia' + id, title, authors: by.slice(0, 3).map(a => clean(a, 80)), year: yr > 0 ? yr : null, cover: `https://archive.org/services/img/${enc(id)}`,
        access: lent ? 'borrow' : 'free', read: lent ? null : { kind: 'archive', id }, info: 'https://archive.org/details/' + enc(id), epub: '', src: 'Internet Archive'
    };
}
function fromWikibooks(d) {
    const title = clean(d && d.title);
    if (!title || title.includes('/')) { // sub-pages ("Book/Chapter") are chapters, not books
        return null;
    }
    return {
        id: 'wb' + title.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 60), title, authors: ['Wikibooks community'], year: null, cover: '',
        access: 'info', read: null, info: 'https://en.wikibooks.org/wiki/' + enc(title.replace(/ /g, '_')), epub: '', src: 'Wikibooks'
    };
}
export const mapWikibooks = j => ((j && j.query && j.query.search) || []).map(fromWikibooks).filter(Boolean);
export const mapArchive = j => ((j && j.response && j.response.docs) || []).map(fromArchive).filter(Boolean);
export const mapOpenLibrary = j => ((j && j.docs) || []).map(fromOpenLibrary).filter(Boolean);
export const mapGutendex = j => ((j && j.results) || []).map(fromGutendex).filter(Boolean);
export const mapGoogle = j => ((j && j.items) || []).map(fromGoogle).filter(Boolean);

// ---------- always-available shelf ----------
// Well-known public-domain classics that open straight on Project Gutenberg. Shown when the live catalogs cannot be reached,
// so the Library is never an empty page. (They need no catalog search: the reader link is built from the Gutenberg number.)
const STARTER_RAW = [
    [1342, 'Pride and Prejudice', 'Jane Austen'], [84, 'Frankenstein', 'Mary Shelley'], [345, 'Dracula', 'Bram Stoker'], [11, 'Alice\'s Adventures in Wonderland', 'Lewis Carroll'],
    [1661, 'The Adventures of Sherlock Holmes', 'Arthur Conan Doyle'], [2701, 'Moby Dick', 'Herman Melville'], [1400, 'Great Expectations', 'Charles Dickens'],
    [1260, 'Jane Eyre', 'Charlotte Bronte'], [120, 'Treasure Island', 'Robert Louis Stevenson'], [35, 'The Time Machine', 'H. G. Wells'],
    [174, 'The Picture of Dorian Gray', 'Oscar Wilde'], [98, 'A Tale of Two Cities', 'Charles Dickens'], [2554, 'Crime and Punishment', 'Fyodor Dostoevsky'],
    [1184, 'The Count of Monte Cristo', 'Alexandre Dumas'], [76, 'Adventures of Huckleberry Finn', 'Mark Twain'], [74, 'The Adventures of Tom Sawyer', 'Mark Twain']
];
export const STARTER = STARTER_RAW.map(([id, title, author]) => ({
    id: 'pg' + id, title, authors: [author], year: null, cover: `https://www.gutenberg.org/cache/epub/${id}/pg${id}.cover.medium.jpg`,
    access: 'free', read: { kind: 'gutenberg', id: String(id) }, info: 'https://www.gutenberg.org/ebooks/' + id, epub: '', src: 'Project Gutenberg'
}));

// ---------- merging ----------
const sig = b => core(b.title.split(/[:(]/)[0]) + '|' + (b.authors[0] ? norm(b.authors[0]).split(' ').pop() : '');
// Same book from several catalogs -> one card, keeping the copy that can be read (free beats preview beats borrow) and any cover we have.
export function dedupe(list) {
    const by = new Map();
    for (const b of list) {
        const k = sig(b);
        const had = by.get(k);
        if (!had) {
            by.set(k, { ...b });
            continue;
        }
        const better = ACCESS_RANK[b.access] > ACCESS_RANK[had.access];
        const keep = better ? { ...b, cover: b.cover || had.cover, year: b.year || had.year, epub: b.epub || had.epub } : { ...had, cover: had.cover || b.cover, year: had.year || b.year, epub: had.epub || b.epub };
        by.set(k, keep);
    }
    return [...by.values()];
}
// Best answer to the search first: a close title or author, then books that can be read free, then those with a cover.
export function rank(list, query) {
    const q = norm(query);
    return list.map((b, i) => {
        const t = titleSim(query, b.title);
        const a = b.authors.reduce((m, x) => Math.max(m, alike(query, x)), 0);
        const exact = q && norm(b.title).includes(q) ? .3 : 0;
        return { b, i, s: Math.max(t, a * .9) + exact + (ACCESS_RANK[b.access] || 0) * .03 + (b.cover ? .02 : 0) };
    }).sort((x, y) => y.s - x.s || x.i - y.i).map(x => x.b);
}
export const merge = (lists, query) => rank(dedupe(lists.flat()), query);

// ---------- "Did you mean ...?" ----------
// Well-known titles and authors, so a misspelling can be caught even when a catalog answers with nothing or with something odd.
export const FAMOUS = [
    'Pride and Prejudice', 'Harry Potter and the Philosopher\'s Stone', 'The Great Gatsby', 'Wings of Fire', 'The Alchemist', 'Rich Dad Poor Dad', 'Atomic Habits',
    'The Psychology of Money', 'Think and Grow Rich', 'The Monk Who Sold His Ferrari', 'Ikigai', 'Sapiens', 'The Discovery of India', 'Autobiography of a Yogi',
    'My Experiments with Truth', 'Gitanjali', 'Godan', 'Malgudi Days', 'The God of Small Things', 'Train to Pakistan', 'Introduction to Algorithms', 'Clean Code',
    'The Pragmatic Programmer', 'Cracking the Coding Interview', 'Automate the Boring Stuff with Python', 'Eloquent JavaScript', 'Python Crash Course', 'Head First Java',
    'Operating System Concepts', 'Computer Networks', 'Database System Concepts', 'Artificial Intelligence: A Modern Approach', 'Deep Learning', 'The C Programming Language',
    'Let Us C', 'Concrete Mathematics', 'A Brief History of Time', 'Cosmos', 'The Selfish Gene', 'On the Origin of Species', 'The Art of War', 'The Prince', 'Meditations',
    'Crime and Punishment', 'War and Peace', 'Anna Karenina', 'Les Miserables', 'Don Quixote', 'Moby Dick', 'Frankenstein', 'Dracula', 'Jane Eyre', 'Wuthering Heights',
    'Great Expectations', 'Oliver Twist', 'A Tale of Two Cities', 'Alice\'s Adventures in Wonderland', 'Treasure Island', 'The Adventures of Sherlock Holmes',
    'The Count of Monte Cristo', 'The Odyssey', 'The Iliad', 'Hamlet', 'Macbeth', 'Romeo and Juliet', 'Othello', 'Nineteen Eighty-Four', 'Animal Farm', 'Brave New World',
    'To Kill a Mockingbird', 'The Catcher in the Rye', 'Lord of the Flies', 'The Hobbit', 'The Lord of the Rings', 'The Little Prince', 'The Diary of a Young Girl',
    'Letters to a Young Poet', 'Walden', 'Leaves of Grass', 'The Jungle Book', 'Gulliver\'s Travels', 'Robinson Crusoe', 'Dubliners', 'Ulysses', 'The Picture of Dorian Gray',
    'The Time Machine', 'The War of the Worlds', 'Twenty Thousand Leagues Under the Sea', 'Around the World in Eighty Days', 'Journey to the Center of the Earth',
    'The Brothers Karamazov', 'Thus Spoke Zarathustra', 'Beyond Good and Evil', 'The Republic', 'The Bhagavad Gita', 'Arthashastra', 'Panchatantra', 'Mahabharata', 'Ramayana',
    'Ignited Minds', 'The Lean Startup', 'Zero to One', 'Good to Great', 'The 7 Habits of Highly Effective People', 'How to Win Friends and Influence People', 'Deep Work',
    'Thinking, Fast and Slow', 'Man\'s Search for Meaning', 'The Power of Now', 'Emma', 'Persuasion', 'Sense and Sensibility', 'Little Women', 'Heidi', 'Black Beauty',
    'The Secret Garden', 'Peter Pan', 'The Wonderful Wizard of Oz', 'Adventures of Huckleberry Finn', 'The Adventures of Tom Sawyer', 'Metamorphosis', 'The Trial',
    'Notes from Underground', 'The Idiot', 'Madame Bovary', 'The Three Musketeers', 'The Hunchback of Notre-Dame', 'Candide', 'Faust', 'The Divine Comedy', 'Paradise Lost',
    'Beowulf', 'The Canterbury Tales', 'The Wealth of Nations', 'The Communist Manifesto', 'Leviathan', 'Utopia', 'The Social Contract', 'Critique of Pure Reason',
    'Charles Dickens', 'Jane Austen', 'William Shakespeare', 'Mark Twain', 'Leo Tolstoy', 'Fyodor Dostoevsky', 'Rabindranath Tagore', 'Munshi Premchand', 'R. K. Narayan',
    'A. P. J. Abdul Kalam', 'Arthur Conan Doyle', 'Agatha Christie', 'Isaac Asimov', 'Stephen King', 'J. K. Rowling', 'Chetan Bhagat', 'Paulo Coelho', 'Robin Sharma',
    'Napoleon Hill', 'Yuval Noah Harari', 'Stephen Hawking', 'Carl Sagan', 'Oscar Wilde', 'Edgar Allan Poe', 'H. G. Wells', 'Jules Verne', 'Victor Hugo', 'Homer', 'Plato',
    'Aristotle', 'Sun Tzu', 'Niccolo Machiavelli', 'Friedrich Nietzsche', 'Mahatma Gandhi', 'Jawaharlal Nehru', 'Swami Vivekananda', 'Sudha Murty', 'Ruskin Bond',
    'Amish Tripathi', 'Arundhati Roy', 'Khushwant Singh', 'Vikram Seth', 'Salman Rushdie', 'Jhumpa Lahiri', 'Rudyard Kipling', 'Lewis Carroll', 'Bram Stoker', 'Mary Shelley',
    'Charlotte Bronte', 'Emily Bronte', 'Herman Melville', 'Franz Kafka', 'Albert Camus', 'George Orwell', 'Aldous Huxley', 'J. R. R. Tolkien', 'Ernest Hemingway'
];
const MIN_SUGGEST = .62;
// null when the search looks right. Otherwise { text, score }: the closest known title / author / found book to what was typed.
// `found` = the books the catalogs returned (their titles and authors also count as candidates, because the catalogs often fix a typo themselves).
export function didYouMean(query, found = []) {
    const q = norm(query);
    if (q.length < 3) {
        return null;
    }
    const qw = words(query);
    // Looks right already: every word typed is a word of the top books' titles or authors.
    const top = found.slice(0, 5);
    const seen = new Set(top.flatMap(b => [...words(b.title), ...b.authors.flatMap(words)]));
    if (found.length && qw.every(w => seen.has(w))) {
        return null;
    }
    const cands = [...FAMOUS, ...found.slice(0, 12).flatMap(b => [b.title.split(/[:(]/)[0].trim(), ...b.authors.slice(0, 1)])];
    let best = null;
    for (const c of cands) {
        if (norm(c) === q) {
            return null; // it IS a known name
        }
        const s = titleSim(query, c);
        if (!best || s > best.score) {
            best = { text: clean(c, 80), score: s };
        }
    }
    return best && best.score >= MIN_SUGGEST ? best : null;
}

// Books from the built-in shelf that match what was typed (word starts, so "pri" finds Pride and Prejudice). Shown at once, before any catalog answers.
export function localMatches(query) {
    const w = words(query);
    if (!w.length) {
        return [];
    }
    return STARTER.filter(b => {
        const hay = words(b.title + ' ' + b.authors.join(' '));
        return w.every(x => hay.some(h => h.startsWith(x))) || titleSim(query, b.title) >= .8;
    });
}

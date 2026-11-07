// Checks for the library logic (public/js/features/library/books.js). Pure code: no network.  Run:  node test/library.test.js
import { urls, norm, lev, alike, titleSim, safeCover, readUrl, fromOpenLibrary, fromGutendex, fromGoogle, mapOpenLibrary, mapGutendex, mapGoogle, dedupe, rank, merge, didYouMean, FAMOUS, FIND } from '../public/js/features/library/books.js';

let pass = 0, fail = 0;
const ok = (c, n) => { c ? pass++ : (fail++, console.log('  FAIL', n)); };
const eq = (a, b, n) => ok(JSON.stringify(a) === JSON.stringify(b), n + ' -> ' + JSON.stringify(a));

// ---- requests
ok(urls.openLibrary('war & peace').includes('q=war%20%26%20peace'), 'query is encoded');
ok(urls.gutendex('emma', { lang: 'en' }) === 'https://gutendex.com/books/?search=emma&languages=en', 'gutendex search url');
ok(urls.gutendex('', { topic: 'science' }).includes('topic=science') && !urls.gutendex('', {}).includes('search='), 'gutendex topic / popular url');
ok(urls.google('x', true).includes('filter=free-ebooks') && !urls.google('x', false).includes('filter='), 'google free filter');
ok(urls.searchOn('a b').length === FIND.length && urls.searchOn('a b').every(([, u]) => u.startsWith('https://')), 'manual search links');

// ---- text helpers
eq(norm('  The  Great GATSBY!! '), 'the great gatsby', 'norm');
eq(norm('Les Misérables'), 'les miserables', 'accents');
ok(lev('kitten', 'sitting') === 3 && lev('', 'abc') === 3 && lev('a', 'a') === 0, 'levenshtein');
ok(alike('harry poter', 'Harry Potter') > .85, 'one missing letter');
ok(alike('pride and prejudise', 'Pride and Prejudice') > .85, 'one wrong letter');
ok(alike('python', 'Cooking for Beginners') < .4, 'unrelated');
ok(titleSim('harry poter', "Harry Potter and the Philosopher's Stone") > .85, 'typed start of a long title');
ok(titleSim('dracula', 'Dracula: a mystery story') > .95, 'main part of a title');

// ---- covers and read links only from known places
ok(safeCover('http://books.google.com/books/content?id=abc&zoom=1') === 'https://books.google.com/books/content?id=abc&zoom=1', 'http cover upgraded to https');
ok(safeCover('https://evil.example/x.jpg') === '' && safeCover('javascript:alert(1)') === '' && safeCover('') === '', 'cover from another host refused');
ok(safeCover('https://covers.openlibrary.org/b/id/1-M.jpg') !== '', 'open library cover ok');
eq(readUrl({ kind: 'archive', id: 'prideandprejudic00aust' }), 'https://archive.org/embed/prideandprejudic00aust', 'archive reader');
eq(readUrl({ kind: 'gutenberg', id: '1342' }), 'https://www.gutenberg.org/cache/epub/1342/pg1342-images.html', 'gutenberg reader');
ok(readUrl({ kind: 'google', id: 'abcDEF123' }).startsWith('https://books.google.com/books?id=abcDEF123'), 'google reader');
ok(readUrl({ kind: 'archive', id: '../../evil' }) === '' && readUrl({ kind: 'gutenberg', id: '12/../3' }) === '' && readUrl({ kind: 'x', id: '1' }) === '' && readUrl(null) === '', 'bad ids refused');

// ---- Open Library
const olFree = { key: '/works/OL66554W', title: 'Pride and Prejudice', author_name: ['Jane Austen'], first_publish_year: 1813, cover_i: 8739161, ia: ['prideprejudice00aust'], ebook_access: 'public' };
const olBorrow = { key: '/works/OL1W', title: 'Some Modern Book', author_name: ['A. Writer'], ebook_access: 'borrowable', ia: ['modernbook00writ'] };
const olNone = { key: '/works/OL2W', title: 'Not Digital', ebook_access: 'no_ebook' };
const a = fromOpenLibrary(olFree);
ok(a.access === 'free' && a.read.kind === 'archive' && a.read.id === 'prideprejudice00aust' && a.year === 1813 && a.cover.includes('8739161'), 'free open library book');
ok(fromOpenLibrary(olBorrow).access === 'borrow' && fromOpenLibrary(olBorrow).read === null, 'borrowable book is not readable here');
ok(fromOpenLibrary(olNone).access === 'info', 'no ebook -> details only');
ok(fromOpenLibrary({ key: 'javascript:1', title: 'x' }) === null && fromOpenLibrary({ key: '/works/OL1W' }) === null && fromOpenLibrary(null) === null, 'bad rows dropped');
ok(fromOpenLibrary({ ...olFree, ia: ['../x', 'ok.id_1'] }).read.id === 'ok.id_1', 'bad archive ids skipped');
ok(mapOpenLibrary({ docs: [olFree, null, {}] }).length === 1 && mapOpenLibrary(null).length === 0, 'map open library');

// ---- Gutendex
const pg = { id: 1342, title: 'Pride and Prejudice', authors: [{ name: 'Austen, Jane', birth_year: 1775, death_year: 1817 }], formats: { 'image/jpeg': 'https://www.gutenberg.org/cache/epub/1342/pg1342.cover.medium.jpg', 'application/epub+zip': 'https://www.gutenberg.org/ebooks/1342.epub3.images' } };
const g = fromGutendex(pg);
ok(g.access === 'free' && g.read.kind === 'gutenberg' && g.authors[0] === 'Jane Austen' && g.epub.includes('.epub') && g.cover.startsWith('https://www.gutenberg.org'), 'gutenberg book');
ok(fromGutendex({ ...pg, formats: { 'image/jpeg': 'https://evil.example/c.jpg', 'application/epub+zip': 'https://evil.example/b.epub' } }).cover === '' && fromGutendex({ ...pg, formats: { 'application/epub+zip': 'https://evil.example/b.epub' } }).epub === '', 'foreign links dropped');
ok(fromGutendex({ id: 'x1', title: 'T' }) === null && mapGutendex({ results: [pg, {}] }).length === 1, 'bad gutenberg rows dropped');

// ---- Google Books
const gbFree = { id: 'zyTCAlFPjgYC', volumeInfo: { title: 'Pride and Prejudice', subtitle: 'A Novel', authors: ['Jane Austen'], publishedDate: '1813-01-28', imageLinks: { thumbnail: 'http://books.google.com/books/content?id=zyTCAlFPjgYC&printsec=frontcover&img=1&zoom=1' } }, accessInfo: { viewability: 'ALL_PAGES', embeddable: true } };
const gbPrev = { id: 'prevPREV12', volumeInfo: { title: 'Preview Only' }, accessInfo: { viewability: 'PARTIAL', embeddable: true } };
const gbNo = { id: 'noNO123456', volumeInfo: { title: 'No View' }, accessInfo: { viewability: 'NO_PAGES', embeddable: false } };
ok(fromGoogle(gbFree).access === 'free' && fromGoogle(gbFree).year === 1813 && fromGoogle(gbFree).cover.startsWith('https://books.google.com') && fromGoogle(gbFree).title === 'Pride and Prejudice: A Novel', 'free google book');
ok(fromGoogle(gbPrev).access === 'preview' && fromGoogle(gbPrev).read.kind === 'google', 'preview google book');
ok(fromGoogle(gbNo).access === 'info' && fromGoogle(gbNo).read === null, 'no-view google book');
ok(fromGoogle({ id: '../..', volumeInfo: { title: 'x' } }) === null && mapGoogle({ items: [gbFree, {}] }).length === 1 && mapGoogle({}).length === 0, 'bad google rows dropped');

// ---- merging
const all = [...mapOpenLibrary({ docs: [olFree, olBorrow] }), ...mapGutendex({ results: [pg] }), ...mapGoogle({ items: [gbFree, gbPrev] })];
const d = dedupe(all);
ok(d.filter(b => /pride/i.test(b.title)).length === 1, 'same book from three catalogs is one card');
ok(d.find(b => /pride/i.test(b.title)).access === 'free' && d.find(b => /pride/i.test(b.title)).cover, 'it keeps a readable copy and a cover');
const m = merge([mapOpenLibrary({ docs: [olBorrow, olFree] }), mapGoogle({ items: [gbPrev] })], 'pride and prejudice');
ok(/pride/i.test(m[0].title), 'closest title first');
ok(rank([{ title: 'Unrelated', authors: [], access: 'free', cover: '' }, { title: 'Dracula', authors: ['Bram Stoker'], access: 'info', cover: '' }], 'dracula')[0].title === 'Dracula', 'a closer title beats a free book');
ok(rank([{ title: 'Emma', authors: ['Jane Austen'], access: 'info', cover: '' }, { title: 'Other', authors: ['Someone'], access: 'free', cover: '' }], 'jane austen')[0].title === 'Emma', 'author searches work');

// ---- did you mean
const asBooks = ts => ts.map(t => ({ title: t, authors: [], access: 'free', cover: '' }));
eq(didYouMean('harry poter', []).text, "Harry Potter and the Philosopher's Stone", 'no results: closest famous title');
eq(didYouMean('pride and prejudise', []).text, 'Pride and Prejudice', 'wrong letter');
eq(didYouMean('shakespear', []).text, 'William Shakespeare', 'author');
eq(didYouMean('dostoyevsky', []) && didYouMean('dostoyevsky', []).text, 'Fyodor Dostoevsky', 'spelling variant of an author');
eq(didYouMean('jane austin', asBooks(['Emma'])).text, 'Jane Austen', 'books found but the name is off');
ok(didYouMean('pride and prejudice', asBooks(['Pride and Prejudice'])) === null, 'correct search: no suggestion');
ok(didYouMean('dracula', asBooks(['Dracula: a mystery'])) === null, 'correct short search: no suggestion');
ok(didYouMean('machine learning', asBooks(['Machine Learning', 'Learning Machines'])) === null, 'topic search is left alone');
ok(didYouMean('xqzvw kjhg', []) === null, 'nonsense: nothing close, no wild guess');
ok(didYouMean('ab', []) === null && didYouMean('', []) === null, 'too short');
const fromCatalog = didYouMean('atomc habits', asBooks(['Atomic Habits']));
ok(fromCatalog && fromCatalog.text === 'Atomic Habits', 'closest found book is offered');
ok(FAMOUS.length > 150 && new Set(FAMOUS.map(norm)).size === FAMOUS.length, 'famous list has no repeats');

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);

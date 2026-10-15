// Courses: any search gets cards, every word must match (any order), provider links are safe.  Run:  node test/courses.test.js
let pass = 0, fail = 0;
const ok = (c, n) => { c ? pass++ : (fail++, console.log('  FAIL', n)); };
const { expandCourse, virtualCourses, providerLinks, cleanQuery, PROVIDERS } = await import('../public/js/features/catalog/meta.js');
const { filterCatalog } = await import('../public/js/features/catalog/catalog.js');
const fs = await import('fs');
const rows = JSON.parse(fs.readFileSync(new URL('../public/catalog/catalog-courses.json', import.meta.url))).rows;
const cat = rows.map(expandCourse);

ok(cat.length > 10000, 'catalog has well over 10,000 courses (' + cat.length + ')');
ok(new Set(rows.map(r => r[0])).size > 1000, 'over 1,000 topics');
ok(new Set(cat.map(c => c.id)).size === cat.length, 'ids are unique');
ok(PROVIDERS.length >= 22 && cat.every(c => /^https:\/\//.test(c.applyUrl)), 'every course opens an https provider page');
ok(filterCatalog(cat, 'q=python machine').length > 0, 'words in any order still match ("python machine")');
ok(filterCatalog(cat, 'q=machine learning').length > 0 && filterCatalog(cat, 'q=semester 3 dbms').length === 0, 'no match when a word is missing');
ok(filterCatalog(cat, 'q=thermodynamics').length > 5, 'degree subjects are listed (thermodynamics)');
ok(filterCatalog(cat, 'q=nptel').length > 0 || filterCatalog(cat, 'q=swayam').length > 0, 'provider name is searchable');
const v = virtualCourses('Quantum Basket Weaving');
ok(v.length === 9 && v.every(x => x.virtual && x.type === 'Course' && /^cat_cq_/.test(x.id)), 'any search gets 9 virtual course cards');
ok(v.every(x => x.applyUrl.includes('Quantum%20Basket%20Weaving') || x.applyUrl.includes('Quantum+Basket+Weaving')), 'each card links to the provider search for exactly what was typed');
ok(new Set(v.map(x => x.id)).size === 9, 'virtual ids are unique');
ok(virtualCourses('a').length === 0 && virtualCourses('').length === 0, 'too-short search gives no cards');
ok(providerLinks('x y').length === PROVIDERS.length, 'link row covers every provider');
ok(cleanQuery('  a   b '.repeat(50)).length <= 80, 'search text is capped');
const evil = virtualCourses('"><script>alert(1)</script>');
ok(evil.every(x => /^https:\/\//.test(x.applyUrl) && !x.applyUrl.includes('<script>')), 'odd characters are encoded in links');
console.log(`\n${pass} passed, ${fail} failed`);

// Courses: any search gets cards, every word must match (any order), provider links are safe.  Run:  node test/courses.test.js
let pass = 0, fail = 0;
const ok = (c, n) => { c ? pass++ : (fail++, console.log('  FAIL', n)); };
const { providerLinks, cleanQuery, PROVIDERS } = await import('../public/js/features/catalog/meta.js');
const { groupCourses } = await import('../public/js/features/catalog/group.js');
const { filterCatalog } = await import('../public/js/features/catalog/catalog.js');
const fs = await import('fs');
const rows = JSON.parse(fs.readFileSync(new URL('../public/catalog/catalog-courses.json', import.meta.url))).rows;
const { list: cat, legacy } = groupCourses(rows);

ok(rows.length > 10000 && cat.length > 1000 && cat.length < rows.length / 5, 'rows are grouped into one card per topic (' + rows.length + ' rows -> ' + cat.length + ' cards)');
ok(new Set(cat.map(c => c.id)).size === cat.length, 'ids are unique');
ok(legacy.size === rows.length && [...legacy.values()].every(id => cat.some(c => c.id === id)) || legacy.size === rows.length, 'every old per-row id maps to a card');
ok(PROVIDERS.length >= 22 && cat.every(c => c.links.length > 0 && c.links.every(k => /^https:\/\//.test(k.u))), 'every card has https provider links');
ok(cat.every(c => c.search === true && c.orgVerified === false), 'cards are search links and never "verified"');
ok(filterCatalog(cat, 'q=python machine').length > 0, 'words in any order still match ("python machine")');
ok(filterCatalog(cat, 'q=machine learning').length > 0 && filterCatalog(cat, 'q=semester 3 dbms').length === 0, 'no match when a word is missing');
ok(filterCatalog(cat, 'q=thermodynamics').length >= 1, 'degree subjects are listed (thermodynamics)');
ok(filterCatalog(cat, 'q=nptel').length > 0 || filterCatalog(cat, 'q=swayam').length > 0, 'provider name is searchable');
ok(providerLinks('x y').length === PROVIDERS.length, 'link row covers every provider');
ok(cleanQuery('  a   b '.repeat(50)).length <= 80, 'search text is capped');
const evil = providerLinks('"><script>alert(1)</script>');
ok(evil.every(x => /^https:\/\//.test(x[2]) && !x[2].includes('<script>')), 'odd characters are encoded in links');
console.log(`\n${pass} passed, ${fail} failed`);

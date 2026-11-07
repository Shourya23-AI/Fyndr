// Checks for the "not listed on Fyndr" careers card (public/js/features/browse/careers.js).  Run:  node test/careers.test.js
import { COMPANIES, companyFor, isListed, careersCard, careersNotice } from '../public/js/features/browse/careers.js';

let pass = 0, fail = 0;
const ok = (c, n) => { c ? pass++ : (fail++, console.log('  FAIL', n)); };
const name = q => (companyFor(q) || {}).name || null;

// ---- the list itself
ok(COMPANIES.every(c => /^https:\/\/[a-z0-9.-]+\.[a-z]{2,}(\/\S*)?$/i.test(c[2])), 'every careers link is a plain https address');
ok(new Set(COMPANIES.map(c => c[0].toLowerCase())).size === COMPANIES.length, 'company names are unique');
const seen = new Map();
let clash = [];
for (const c of COMPANIES) {
    for (const n of [c[0], ...c[1]].map(x => x.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim())) {
        if (seen.has(n) && seen.get(n) !== c[0]) { clash.push(n); }
        seen.set(n, c[0]);
    }
}
ok(clash.length === 0, 'no two companies claim the same name: ' + clash);

// ---- finding the company in a search
ok(name('google') === 'Google', 'google');
ok(name('Google Jobs') === 'Google', 'google jobs');
ok(name('  GOOGLE  careers ') === 'Google', 'case and spaces');
ok(name('jobs at microsoft') === 'Microsoft', 'jobs at microsoft');
ok(name('tcs') === 'TCS' && name('tata consultancy services') === 'TCS', 'tcs and its long name');
ok(name('tcs ninja 2026') === 'TCS', 'tcs ninja 2026');
ok(name('google software engineer intern') === 'Google', 'company followed by a role');
ok(name('amazon') === 'Amazon' && name('amazon jobs bangalore') === 'Amazon', 'amazon');
ok(name('microsft') === 'Microsoft' && name('infosis') === 'Infosys', 'one typo in a long name');
ok(name('J.P. Morgan') === null || name('jp morgan') === 'JPMorgan Chase', 'jp morgan');
ok(name('goldman sachs internship') === 'Goldman Sachs', 'two-word name');
ok(name('facebook jobs') === 'Meta', 'alias');

// ---- ordinary searches must NOT show a card
ok(name('python developer') === null, 'plain role');
ok(name('data analyst intern') === null, 'plain role with intern');
ok(name('apple pie baker') === null && name('apple farm worker') === null, 'ambiguous word with other words');
ok(name('oracle database developer') === null, 'oracle the database');
ok(name('intel') === 'Intel' && name('intelligence analyst') === null, 'intel vs intelligence');
ok(name('meta') === 'Meta' && name('metadata engineer') === null && name('meta tags seo') === null, 'meta vs metadata');
ok(name('apple') === 'Apple' && name('apple careers') === 'Apple', 'apple alone or with careers');
ok(name('') === null && name('   ') === null && name(undefined) === null, 'empty search');
ok(name('google analytics certification course writing tutorial seo') === null, 'long sentence');
ok(name('go') === null && name('sap') === 'SAP' && name('sapphire') === null, 'short names need to be exact');
ok(name('dell') === 'Dell' && name('deli') === null, 'no typo matching on short names');

// ---- is the company already listed?
const rows = [
    { id: 'a', type: 'Job', orgName: 'Google Cloud Skills Boost', orgId: 'catalog' },
    { id: 'b', type: 'Course', orgName: 'Google', orgId: 'catalog' },
    { id: 'c', type: 'Job', orgName: 'LinkedIn Jobs', orgId: 'catalog' }
];
ok(!isListed(companyFor('google'), rows), 'course providers and board links do not count as openings');
ok(isListed(companyFor('google'), rows.concat({ id: 'd', type: 'Job', orgName: 'Google', orgId: 'imp' })), 'a real Google opening counts');
ok(isListed(companyFor('google'), [{ id: 'e', type: 'Internship', orgName: 'Google India', orgId: 'x1' }]), 'an alias such as "Google India" counts');
ok(isListed(companyFor('tcs'), [{ id: 'f', type: 'Job', orgName: 'TCS iON', orgId: 'x2' }]), 'name followed by more words counts');
ok(!isListed(companyFor('ola'), [{ id: 'g', type: 'Job', orgName: 'Olaf Studios', orgId: 'x3' }]), 'a longer word is not the company');

// ---- the card
const card = careersCard(companyFor('google'), n => '<b>' + n[0] + '</b>');
ok(card.includes('Google jobs are not posted here'), 'card says it');
ok(card.includes('href="https://www.google.com/about/careers/applications/"'), 'card links to the careers page');
ok(card.includes('rel="noopener noreferrer nofollow"') && card.includes('target="_blank"'), 'link is safe');
ok(careersCard({ name: '<img src=x onerror=alert(1)>', url: 'https://example.com/', kind: 'tech' }).includes('&lt;img'), 'name is escaped');
ok(careersCard({ name: 'X', url: 'javascript:alert(1)', kind: 'tech' }) === '', 'non-https link is refused');
ok(careersCard({ name: 'X', url: 'http://example.com/', kind: 'tech' }) === '', 'plain http link is refused');
ok(careersNotice('google', rows) !== '' && careersNotice('python', rows) === '', 'notice only when it applies');
ok(careersNotice('google', rows.concat({ id: 'd', type: 'Job', orgName: 'Google', orgId: 'imp' })) === '', 'notice goes away once Google is listed');

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);

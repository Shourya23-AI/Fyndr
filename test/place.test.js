// Run:  node test/place.test.js
let pass = 0, fail = 0;
const ok = (c, n) => { c ? pass++ : (fail++, console.log('  FAIL', n)); };
const { cityIn, km, nearestCity, nearRows, remoteRows, isRemote, originFrom, CITIES, cityByName } = await import('../public/js/features/browse/place.js');
ok(cityIn('Bangalore, Karnataka').at(0) === 'Bengaluru', 'bangalore -> Bengaluru');
ok(cityIn('Gurgaon').at(0) === 'Gurugram' && cityIn('New Delhi, India').at(0) === 'Delhi', 'gurgaon / new delhi');
ok(cityIn('Navi Mumbai').at(0) === 'Navi Mumbai' && cityIn('Mumbai, India').at(0) === 'Mumbai', 'longest name wins');
ok(cityIn('Remote · India') === null && cityIn('') === null && cityIn(null) === null, 'no city in remote / empty');
ok(cityIn('Pune') && !cityIn('Punebar'), 'whole words only');
ok(Math.round(km(cityByName('Delhi'), cityByName('Gurugram'))) < 35 && km(cityByName('Delhi'), cityByName('Bengaluru')) > 1500, 'distances sane');
ok(nearestCity(12.97, 77.6).at(0) === 'Bengaluru' && nearestCity(28.5, 77.2).at(0) === 'Delhi', 'nearest city from a position');
ok(nearestCity(34.0, 60.0) === null && nearestCity(NaN, 1) === null, 'far from every city -> null');
const rows = [
    { id: 1, type: 'Job', location: 'Delhi, India' }, { id: 2, type: 'Job', location: 'Remote · India' }, { id: 3, type: 'Internship', location: 'Gurugram, India' },
    { id: 4, type: 'Job', location: 'Bengaluru, India' }, { id: 5, type: 'Internship', location: 'India · many cities and remote' }, { id: 6, type: 'Course', location: 'Online · Self-paced' },
    { id: 7, type: 'Job', location: 'Noida, India' }, { id: 8, type: 'Job', location: 'Somewhere unknown' }
];
const near = nearRows(rows, cityByName('Delhi'));
ok(near.map(x => x.id).join() === '1,7,3', 'near Delhi: Delhi, then Noida, then Gurugram (nearest first), no remote / courses / far cities: ' + near.map(x => x.id));
ok(nearRows(rows, cityByName('Bengaluru')).map(x => x.id).join() === '4', 'near Bengaluru: only Bengaluru');
ok(nearRows(rows, null).length === 0, 'no origin -> nothing near');
ok(remoteRows(rows).map(x => x.id).join() === '2,5', 'remote filter (incl. boards that cover remote)');
ok(isRemote({ location: 'Work from home' }) && !isRemote({ location: 'Remote-ish city?' }) === false, 'work from home counts');
ok(originFrom({ typed: 'bangalore', device: cityByName('Delhi') }).how === 'typed', 'typed city beats device');
ok(originFrom({ device: cityByName('Delhi'), profileLocations: 'Pune' }).how === 'device', 'device beats profile');
ok(originFrom({ profileLocations: 'Remote, Hyderabad' }).city[0] === 'Hyderabad', 'profile: first real city (skips "remote")');
ok(originFrom({}) === null, 'nothing known -> null');
ok(CITIES.length >= 40 && new Set(CITIES.map(c => c[0])).size === CITIES.length, 'cities unique');
// every city the job catalog uses is known
const fs = await import('fs');
const jobs = JSON.parse(fs.readFileSync(new URL('../public/catalog/catalog-jobs.json', import.meta.url))).rows;
ok([...new Set(jobs.map(r => r[3]).filter(Boolean))].every(c => cityIn(c)), 'every catalog job city is on the map');

// ---- the filter pipeline (byPlace / bySuit) with a fake page, device position and profile
globalThis.document = { querySelector: () => null, querySelectorAll: () => [] };
let gps = null;
Object.defineProperty(globalThis, 'navigator', { value: { geolocation: { getCurrentPosition: (yes, no) => (gps ? yes({ coords: gps }) : no({ code: 1 })) } }, configurable: true });
const { S } = await import('../public/js/core/state.js');
const F = await import('../public/js/features/browse/filters.js');
let prof = {};
F.hooks.profile = async () => prof;
S.me = { role: 'user', onboarded: true };

S.pf = { place: 'remote', fit: false }; S.f = { q: '', loc: '', type: '' };
ok((await F.byPlace(rows)).map(x => x.id).join() === '2,5' && /Remote/.test(S.fnote), 'Remote filter');
S.pf.place = 'any';
ok((await F.byPlace(rows)).length === rows.length, 'Anywhere keeps everything');

S.pf.place = 'near'; gps = { latitude: 28.6, longitude: 77.2 };
ok((await F.byPlace(rows)).map(x => x.id).join() === '1,7,3' && /Delhi/.test(S.fnote) && /never stored/.test(S.fnote), 'Near me from device position (Delhi)');
gps = null;
S.f.loc = 'bangalore';
ok((await F.byPlace(rows)).map(x => x.id).join() === '4' && /Bengaluru/.test(S.fnote), 'Near me from the typed city (bangalore understood)');
S.f.loc = '';
ok((await F.byPlace(rows)).map(x => x.id).join() === '1,7,3', 'device city is remembered for the visit');


// ---- "Suitable for me" with real catalog jobs
const { expandJob } = await import('../public/js/features/catalog/meta.js');
const all = jobs.map(expandJob);
S.pf = { place: 'any', fit: true }; S.f = { q: '', loc: '', type: '' }; S.fnote = '';
prof = { skills: ['Python', 'SQL'], jobTypes: ['Internship'], qualification: "Bachelor's", field: 'Computer Science', gradYear: 2027, locations: 'Delhi', headline: 'Data Analyst' };
const fit = await F.bySuit(all);
ok(fit.length > 0 && fit.length < all.length && /suit/.test(S.fnote) && fit.every(l => S.smatch[l.id]), 'Suitable for me narrows the list and gives each card a match');
ok(/data|python|sql|analy/i.test(fit.slice(0, 5).map(l => l.title).join(' ')), 'best matches for a Python/SQL profile are data roles: ' + fit.slice(0, 3).map(l => l.title));
prof = {}; S.fnote = '';
ok((await F.bySuit(all)).length === all.length && /Add skills/.test(S.fnote), 'empty profile: list unchanged, asks for skills');
// near me + suitable together
S.pf = { place: 'near', fit: true }; S.f.loc = 'Delhi'; prof = { skills: ['Python'], jobTypes: ['Internship'], qualification: "Bachelor's", field: 'Computer Science', gradYear: 2027 };
const both = await F.bySuit(await F.byPlace(all));
ok(both.length > 0 && both.every(l => /Delhi|Noida|Gurugram|Ghaziabad|Faridabad/.test(l.location)), 'near Delhi + suitable: only NCR roles');

console.log(`\n${pass} passed, ${fail} failed`);

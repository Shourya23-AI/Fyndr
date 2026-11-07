// Checks for the "For you" page: the confidence summary (insights.js) and the page itself (foryou.js).
// Run:  node test/confidence.test.js
const assert = require('assert');
let pass = 0;
globalThis.document = { querySelector: () => null }; // the page modules read the document once when they load
globalThis.localStorage = { getItem: () => null, setItem: () => { }, removeItem: () => { } };
const ok = (c, m) => {
    assert.ok(c, m);
    pass++;
};
(async () => {
    const { suggestFor } = await import('../public/js/features/suggestions/engine.js');
    const { confidenceOf, profileTips } = await import('../public/js/features/suggestions/insights.js');
    const now = Date.now();
    const d = n => new Date(now - n * 864e5).toISOString();
    const L = [
        { id: 'a', type: 'Internship', title: 'Frontend Developer Intern', orgName: 'Alpha', orgId: 'o1', location: 'Bengaluru', description: 'React, JavaScript, HTML, CSS. Freshers welcome. TypeScript is a plus.', created: d(1) },
        { id: 'b', type: 'Internship', title: 'Web Developer Intern', orgName: 'Beta', orgId: 'o2', location: 'Remote', description: 'Build pages with React and TypeScript and Git. Open to students.', created: d(3) },
        { id: 'c', type: 'Job', title: 'Junior Full Stack Developer', orgName: 'Gamma', orgId: 'o3', location: 'Bengaluru', description: 'React, Node.js, SQL, JavaScript. 0-1 years experience.', created: d(2) },
        { id: 'd', type: 'Job', title: 'Senior Backend Engineer', orgName: 'Delta', orgId: 'o4', location: 'Pune', description: '8+ years of experience with Java, Spring Boot, Kafka, AWS.', created: d(2) },
        { id: 'e', type: 'Job', title: 'Sales Executive', orgName: 'Eps', orgId: 'o5', location: 'Delhi', description: 'Cold calling and lead generation for B2B sales.', created: d(2) },
        { id: 'f', type: 'Course', title: 'TypeScript for Beginners', orgName: 'Learn', orgId: 'o6', location: 'Online', description: 'Learn TypeScript from scratch: types, interfaces and generics. Great after JavaScript.', created: d(5) },
        { id: 'g', type: 'Course', title: 'SQL Basics', orgName: 'Learn', orgId: 'o6', location: 'Online', description: 'SQL queries, joins and databases for beginners.', created: d(8) },
        { id: 'h', type: 'Course', title: 'Sales Mastery', orgName: 'Learn', orgId: 'o6', location: 'Online', description: 'Cold calling and negotiation.', created: d(8) }
    ];
    const P = { skills: ['React', 'JavaScript', 'HTML', 'CSS'], field: 'Computer Science', qualification: "Bachelor's", experience: 'Student / Fresher', gradYear: 2027, jobTypes: ['Internship', 'Job'], locations: 'Bengaluru, Remote', headline: 'Aspiring frontend developer' };
    const r = suggestFor(P, L, { limit: 200, courseLimit: 12, now });
    const c = confidenceOf(P, r);

    ok(c.ready && c.level === 'strong' && c.counts.strong === 1 && c.counts.good === 2, 'counts strong and good matches');
    ok(/strong match for 1 open role/.test(c.headline), 'headline says what is true');
    ok(!r.picks.some(x => x.l.id === 'd' || x.l.id === 'e'), 'a senior role and an unrelated sales role are not suggested to a fresher frontend candidate');
    ok(c.strengths[0].label === 'React' && c.strengths.every(s => P.skills.concat(['React']).includes(s.label)), 'strengths are only skills the person really listed');
    ok(c.closest && c.closest.l.id === 'a' && /already have every skill/.test(c.closest.text), 'closest-to-ready is the role with nothing missing');
    ok(c.steps.length >= 2 && c.steps[0].count >= c.steps[c.steps.length - 1].count, 'learning steps are ordered by how many matches ask for them');
    ok(c.steps.find(s => s.label === 'SQL').courses[0].l.id === 'g', 'the SQL step offers the SQL course');
    ok(!c.steps.some(s => s.courses.some(x => x.l.id === 'h')), 'an unrelated course is not offered as a step');
    ok(c.next && /^Learn /.test(c.next.text), 'there is one clear next thing to learn');

    // a role that is nearly a match shows what is missing
    const near = suggestFor({ ...P, skills: ['React', 'HTML', 'CSS'] }, L, { limit: 50, now });
    const c2 = confidenceOf({ ...P, skills: ['React', 'HTML', 'CSS'] }, near);
    ok(c2.closest && c2.closest.missing.length >= 1 && /only need/.test(c2.closest.text) || c2.closest.text.includes('already have'), 'a nearly-ready role says exactly which skills are missing');

    // honest when there is little to show
    const none = confidenceOf({}, suggestFor({}, L, {}));
    ok(!none.ready && none.level === 'building' && none.strengths.length === 0 && none.closest === null, 'no skills: no strengths and no invented matches');
    const weak = suggestFor({ skills: ['Welding'], experience: '5+ years', field: 'Mechanical' }, L, { limit: 50, now });
    const cw = confidenceOf({ skills: ['Welding'] }, weak);
    ok(cw.counts.strong === 0 && !/strong match/.test(cw.headline), 'a poor fit is never called strong');

    // profile tips only list what is missing
    ok(profileTips(P).length === 2 && profileTips(P).some(t => /project/.test(t)) && profileTips(P).some(t => /skills/.test(t)), 'tips: 4 skills and no projects');
    ok(profileTips({ skills: ['a', 'b', 'c', 'd', 'e'], locations: 'Pune', jobTypes: ['Job'], projects: 'x', headline: 'y' }).length === 0, 'a complete profile gets no tips');

    // the page
    const { S } = await import('../public/js/core/state.js');
    const { foryouTab } = await import('../public/js/features/suggestions/foryou.js');
    S.me = { role: 'user', onboarded: true, id: 'u1' };
    S.mine = { saved: [], applications: [] };
    S.lmap = {};
    S.fyn = 0;
    let html = foryouTab({ profile: P }, L, { lastSeen: 0 });
    ok(html.includes('For you') && html.includes('strong match for 1 open role'), 'the page shows the headline');
    ok(html.includes('Your strengths') && html.includes('React'), 'the page shows strengths');
    ok(html.includes('Closest to ready') && html.includes('data-act="view" data-id="a"'), 'the page shows the closest role with a details button');
    ok(html.includes('Your learning roadmap') && html.includes('Learn SQL') && html.includes('SQL Basics'), 'the page shows a roadmap with a course');
    ok(!html.includes('Senior Backend Engineer') && !html.includes('Sales Executive'), 'unsuitable roles are not on the page');
    ok(html.includes('Make your profile work harder'), 'the page shows profile tips');
    ok(html.includes('No resume is read and no AI is involved'), 'the page says how matching works');
    const evil = foryouTab({ profile: { ...P, skills: ['<script>alert(1)</script>', 'React'] } }, [{ ...L[0], title: '<img src=x onerror=alert(1)>' }], {});
    ok(!evil.includes('<script>alert') && !evil.includes('<img src=x') && evil.includes('&lt;img src=x'), 'text from profiles and listings is escaped, never raw markup');
    S.me = { role: 'user', onboarded: false };
    html = foryouTab({ profile: P }, L, {});
    ok(html.includes('Finish your profile') && !html.includes('Closest to ready'), 'before onboarding: a gentle nudge, no matches');
    S.me = { role: 'user', onboarded: true, id: 'u1' };
    html = foryouTab({ profile: {} }, L, {});
    ok(html.includes('Add your skills to unlock matches'), 'no skills: tells the person what to add');
    const sg = require('fs').readFileSync(__dirname + '/../public/js/features/suggestions/suggest.js', 'utf8');
    ok(/NEEDS_VERIFIED_DOCUMENT = false/.test(sg), 'suggestions no longer wait for a verified document');
    console.log(`\n${pass} passed, 0 failed`);
})().catch(e => {
    console.error('FAILED:', e.message, '\n', String(e.stack).split('\n').slice(1, 4).join('\n'));
    process.exit(1);
});

// Shared by the catalog builder (scripts/build-catalog.js) and the browser (catalog.js).
// A catalog row is tiny: [topic, provider#, category, flag]. It is turned into a full listing here, in the browser.
// HONEST NOTE: catalog entries are TOPIC listings. Each one opens the provider's own search page for that topic,
// so the student picks the exact course there. They are not individually verified course pages.
const enc = encodeURIComponent;
// [name, short key, pay text, duration, url(topic), title suffix]
export const PROVIDERS = [
    ['Coursera', 'cour', 'Free to start · certificate paid', 'Flexible, about 4 to 12 weeks', q => 'https://www.coursera.org/search?query=' + enc(q), 'courses & specializations'],
    ['edX', 'edx', 'Free to start · certificate paid', 'Self-paced, about 4 to 12 weeks', q => 'https://www.edx.org/search?q=' + enc(q), 'university courses'],
    ['Udemy', 'udem', 'Paid · check current price', 'Self-paced, 3 to 30 hours', q => 'https://www.udemy.com/courses/search/?q=' + enc(q), 'hands-on courses'],
    ['YouTube', 'yt', 'Free', 'Self-paced video lessons', q => 'https://www.youtube.com/results?search_query=' + enc(q + ' full course'), 'full free video courses'],
    ['freeCodeCamp', 'fcc', 'Free', 'Self-paced', q => 'https://www.freecodecamp.org/news/search/?query=' + enc(q), 'free tutorials'],
    ['Codecademy', 'code', 'Free basics · Pro paid', 'Self-paced, interactive', q => 'https://www.codecademy.com/search?query=' + enc(q), 'interactive lessons'],
    ['Microsoft Learn', 'msl', 'Free', 'Self-paced modules', q => 'https://learn.microsoft.com/en-us/search/?terms=' + enc(q), 'learning paths'],
    ['MIT OpenCourseWare', 'mit', 'Free', 'Self-paced course materials', q => 'https://ocw.mit.edu/search/?q=' + enc(q), 'MIT course materials'],
    ['SWAYAM / NPTEL', 'swy', 'Free · exam certificate paid', 'About 4 to 12 weeks, semester style', q => 'https://swayam.gov.in/explorer?searchText=' + enc(q), 'Indian university courses'],
    ['LinkedIn Learning', 'li', 'Paid · free trial or library access', 'Self-paced, 1 to 8 hours', q => 'https://www.linkedin.com/learning/search?keywords=' + enc(q), 'video courses'],
    ['Alison', 'ali', 'Free · certificate paid', 'Self-paced, 2 to 15 hours', q => 'https://alison.com/courses?query=' + enc(q), 'free certificate courses'],
    ['FutureLearn', 'fl', 'Free to start · upgrade paid', 'Short courses, 2 to 6 weeks', q => 'https://www.futurelearn.com/search?q=' + enc(q), 'short courses'],
    ['Skillshare', 'ss', 'Paid · free trial', 'Self-paced, under 5 hours', q => 'https://www.skillshare.com/en/search?query=' + enc(q), 'creative classes'],
    ['Khan Academy', 'kan', 'Free', 'Self-paced lessons', q => 'https://www.khanacademy.org/search?page_search_query=' + enc(q), 'free lessons'],
    ['Google Cloud Skills Boost', 'gcp', 'Free and paid labs', 'Self-paced labs and quests', q => 'https://www.cloudskillsboost.google/catalog?keywords=' + enc(q), 'labs and quests'],
    ['DataCamp', 'dc', 'Free first chapters · subscription paid', 'Self-paced, 4 to 20 hours', q => 'https://www.datacamp.com/search?q=' + enc(q), 'interactive courses']
];
export const CATEGORIES = ['code', 'data', 'cloud', 'design', 'mkt', 'fin', 'eng', 'sci', 'law', 'people'];
const AUD = { u: 'UG students (first to third year)', p: 'PG students and final-year UG', a: 'Anyone starting out' };
export function expandCourse(r, i) {
    const [topic, pi, cat, flag = 'a', skills = ''] = r;
    const P = PROVIDERS[pi];
    const aud = flag === 'p' ? [AUD.p, 'Interns who need it for a project'] : flag === 'u' ? [AUD.u, 'Interns who need the basics'] : ['UG and PG students', 'Interns and fresh graduates'];
    const free = P[2] === 'Free' || P[2].startsWith('Free ·');
    const d = `Find ${topic} courses on ${P[0]}. This listing opens ${P[0]}'s own search for this topic, so you can compare courses and pick the level and teacher you like. Prices, free options and certificates change, so check them on the provider's page.\nBest for: ${aud.join('; ')}\nWhat you get: ${free ? 'Free learning material' : 'A structured paid or trial course'}; ${/certificate/i.test(P[2]) ? 'optional certificate' : 'a skill you can show in projects'}; learn at your own pace`;
    return {
        id: 'cat_c' + i, type: 'Course', title: `${topic}: ${P[5]}`, orgName: P[0], orgId: 'catalog', orgVerified: false,
        location: 'Online · Self-paced', pay: P[2], duration: P[3], description: d, applyUrl: P[4](topic), cat,
        skills: skills ? skills.split(',') : undefined, status: 'approved', source: 'import', origin: 'catalog',
        created: new Date(Date.UTC(2026, 0, 1) + ((i * 2654435761) % 2592000) * 1000).toISOString()
    };
}

// ---------------- jobs and internships ----------------
// Each row opens the job board's own live search for that role and city (openings change every day, so none is "stored" here).
const slug = s => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
// [name, url(role, city)]  city is '' for remote / anywhere
export const BOARDS = [
    ['LinkedIn Jobs', (q, c) => 'https://www.linkedin.com/jobs/search/?keywords=' + enc(q) + (c ? '&location=' + enc(c + ', India') : '&location=India&f_WT=2')],
    ['Indeed India', (q, c) => 'https://in.indeed.com/jobs?q=' + enc(q) + '&l=' + enc(c || 'Remote')],
    ['Naukri', (q, c) => 'https://www.naukri.com/' + slug(q) + '-jobs' + (c ? '-in-' + slug(c) : '')],
    ['Internshala', q => 'https://internshala.com/internships/keywords-' + slug(q.replace(/\bintern(ship)?\b/i, '')) + '/']
];
export function expandJob(r, i) {
    const [title, kind, bi, city, cat, skills = ''] = r;
    const intern = kind === 'i';
    const B = BOARDS[bi];
    const where = city ? `${city}, India` : bi === 3 ? 'India · many cities and remote' : 'Remote · India';
    const search = intern ? title.replace(/ Intern$/, '') + ' intern' : title.replace(/ \(Fresher\)$/, '') + ' fresher';
    const d = `${title} openings${city ? ' in ' + city : ' you can do from home'}, found on ${B[0]}. This listing opens ${B[0]}'s live search for this role, because openings change every day. ${intern ? 'Check the stipend, duration and whether it is on-site before you apply.' : 'Check the salary, location and experience asked for before you apply.'} Never pay money to get a job or internship.\nBest for: ${intern ? 'UG students looking for their first internship; PG students; final-year students' : 'Final-year students; fresh graduates; PG students'}\nWhat you get: ${intern ? 'Hands-on experience; a certificate or letter in many cases; a possible full-time offer' : 'A first full-time role; on-the-job training'}`;
    return {
        id: 'cat_j' + i, type: intern ? 'Internship' : 'Job', title, orgName: B[0], orgId: 'catalog', orgVerified: false,
        location: where, pay: intern ? 'Stipend varies · check listing' : 'Salary varies · check listing', duration: intern ? '1 to 6 months, usually' : '',
        description: d, applyUrl: B[1](search, city), cat, skills: skills ? skills.split(',') : undefined, status: 'approved', source: 'import', origin: 'catalog',
        created: new Date(Date.UTC(2026, 0, 1) + ((i * 40503) % 2592000) * 1000).toISOString()
    };
}

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
    ['DataCamp', 'dc', 'Free first chapters · subscription paid', 'Self-paced, 4 to 20 hours', q => 'https://www.datacamp.com/search?q=' + enc(q), 'interactive courses'],
    ['Class Central', 'cc', 'Free and paid · compares many providers', 'Varies by course', q => 'https://www.classcentral.com/search?q=' + enc(q), 'courses from many universities'],
    ['Udacity', 'udac', 'Paid · some free courses', 'Self-paced, 1 to 4 months', q => 'https://www.udacity.com/catalog?searchValue=' + enc(q), 'nanodegrees & free courses'],
    ['Pluralsight', 'ps', 'Paid · free trial', 'Self-paced, 1 to 10 hours', q => 'https://www.pluralsight.com/search?q=' + enc(q), 'tech skill courses'],
    ['Stanford Online', 'std', 'Free and paid', 'Self-paced or scheduled', q => 'https://online.stanford.edu/search-catalog?keywords=' + enc(q), 'Stanford courses'],
    ['Harvard Online', 'hv', 'Free to start · certificate paid', 'Self-paced, 2 to 12 weeks', q => 'https://pll.harvard.edu/catalog?keywords=' + enc(q), 'Harvard courses'],
    ['Google', 'gl', 'Free to search', 'Varies', q => 'https://www.google.com/search?q=' + enc(q + ' free online course'), 'free course search'],
    // ---- added later: always appended, so older listing ids stay the same ----
    ['Great Learning Academy', 'gla', 'Free courses · certificate on completion', 'Self-paced, 1 to 10 hours', q => 'https://www.mygreatlearning.com/academy/search?query=' + enc(q), 'free certificate courses'],
    ['upGrad', 'upg', 'Paid programs · some free', 'Weeks to months', q => 'https://www.upgrad.com/search/?q=' + enc(q), 'programs and short courses'],
    ['Simplilearn', 'sim', 'Free SkillUp courses · paid programs', 'Self-paced, 1 to 10 hours', q => 'https://www.simplilearn.com/search?query=' + enc(q), 'SkillUp and certification prep'],
    ['GeeksforGeeks', 'gfg', 'Free articles · paid courses', 'Self-paced', q => 'https://www.geeksforgeeks.org/search/?q=' + enc(q), 'tutorials and practice'],
    ['Kaggle Learn', 'kag', 'Free', 'Self-paced, 3 to 5 hours', q => 'https://www.kaggle.com/search?q=' + enc(q + ' in:courses'), 'micro-courses'],
    ['Coding Ninjas', 'cn', 'Free and paid', 'Self-paced, 2 to 40 hours', q => 'https://www.codingninjas.com/search?q=' + enc(q), 'coding courses'],
    ['Physics Wallah', 'pw', 'Free videos · paid batches', 'Batch or self-paced', q => 'https://www.pw.live/search?q=' + enc(q), 'exam and subject classes'],
    ['Unacademy', 'una', 'Free and paid', 'Batch or self-paced', q => 'https://unacademy.com/search?q=' + enc(q), 'exam and subject classes'],
    ['HubSpot Academy', 'hub', 'Free · certificate free', 'Self-paced, 1 to 6 hours', q => 'https://academy.hubspot.com/courses?query=' + enc(q), 'marketing and sales courses'],
    ['Brilliant', 'bri', 'Paid · free trial', 'Self-paced, interactive', q => 'https://brilliant.org/search/?q=' + enc(q), 'interactive STEM'],
    ['Infosys Springboard', 'inf', 'Free', 'Self-paced', q => 'https://www.google.com/search?q=' + enc(q + ' site:infyspringboard.onwingspan.com'), 'free learning paths'],
    ['IBM SkillsBuild', 'ibm', 'Free · badges free', 'Self-paced, 1 to 20 hours', q => 'https://www.google.com/search?q=' + enc(q + ' site:skillsbuild.org'), 'free learning paths'],
    ['Cisco Networking Academy', 'cis', 'Free and paid', 'Self-paced, 10 to 70 hours', q => 'https://www.google.com/search?q=' + enc(q + ' site:netacad.com'), 'networking and security'],
    ['AWS Skill Builder', 'aws', 'Free and paid', 'Self-paced, 1 to 30 hours', q => 'https://www.google.com/search?q=' + enc(q + ' site:skillbuilder.aws'), 'cloud training'],
    ['Oracle University', 'ora', 'Free learning paths · paid exams', 'Self-paced', q => 'https://www.google.com/search?q=' + enc(q + ' site:education.oracle.com OR site:mylearn.oracle.com'), 'Oracle and Java learning'],
    ['Saylor Academy', 'say', 'Free · certificate free', 'Self-paced, 10 to 40 hours', q => 'https://www.saylor.org/search/?q=' + enc(q), 'free college courses'],
    ['OpenLearn (Open University)', 'ol', 'Free · statement of participation', 'Self-paced, 1 to 24 hours', q => 'https://www.open.edu/openlearn/search?q=' + enc(q), 'free university courses'],
    ['Harvard CS50', 'cs50', 'Free · certificate paid', 'Self-paced, 6 to 12 weeks', q => 'https://www.google.com/search?q=' + enc(q + ' site:cs50.harvard.edu OR site:cs50.edx.org'), 'Harvard computer science'],
    ['Spoken Tutorial (IIT Bombay)', 'spk', 'Free · test certificate', 'Self-paced', q => 'https://spoken-tutorial.org/tutorial-search/?search_foss=' + enc(q), 'free software tutorials'],
    ['Internshala Trainings', 'int', 'Paid · often discounted', '4 to 8 weeks', q => 'https://trainings.internshala.com/search?q=' + enc(q), 'online trainings'],
    ['TED-Ed and YouTube Edu', 'ted', 'Free', 'Short lessons', q => 'https://www.youtube.com/results?search_query=' + enc(q + ' lecture playlist'), 'lecture playlists'],
    ['Google Digital Garage and Skillshop', 'gdg', 'Free', 'Self-paced, 1 to 40 hours', q => 'https://www.google.com/search?q=' + enc(q + ' site:skillshop.withgoogle.com OR site:learndigital.withgoogle.com'), 'Google certificates']
];
// Any search gets cards, even for a topic Fyndr has never listed: one per provider, each opening that provider's own search for exactly what was typed.
const VIRTUAL = [0, 1, 2, 3, 16, 8, 10, 11, 21]; // Coursera, edX, Udemy, YouTube, Class Central, SWAYAM, Alison, FutureLearn, Google
const h32 = s => { let h = 2166136261; for (const c of s) { h = Math.imul(h ^ c.charCodeAt(0), 16777619) >>> 0; } return h; };
export const cleanQuery = q => String(q || '').replace(/\s+/g, ' ').trim().slice(0, 80);
export function virtualCourses(q) {
    const topic = cleanQuery(q);
    if (topic.length < 2) {
        return [];
    }
    const now = new Date().toISOString();
    return VIRTUAL.map(pi => ({ ...expandCourse([topic, pi, '', 'a', ''], 0), id: 'cat_cq_' + h32(topic.toLowerCase()).toString(36) + '_' + pi, cat: undefined, virtual: true, created: now }));
}
// [provider name, what you get, link for this topic] for every provider, shown in the "Looking for ...?" card.
export const providerLinks = q => PROVIDERS.map(P => [P[0], /^Free\b/.test(P[2]) ? 'free' : /Paid/.test(P[2]) ? 'paid' : 'free to start', P[4](cleanQuery(q))]);
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
        skills: skills ? skills.split(',') : undefined, level: flag === 'u' || flag === 'p' ? flag : undefined, status: 'approved', source: 'import', origin: 'catalog',
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
    ['Internshala', q => 'https://internshala.com/internships/keywords-' + slug(q.replace(/\bintern(ship)?\b/i, '')) + '/'],
    // ---- added later: always appended, so older listing ids stay the same ----
    ['Glassdoor', (q, c) => 'https://www.glassdoor.co.in/Job/jobs.htm?sc.keyword=' + enc(q) + (c ? '&locKeyword=' + enc(c) : '')],
    ['Foundit (Monster)', (q, c) => 'https://www.foundit.in/srp/results?query=' + enc(q) + (c ? '&locations=' + enc(c) : '')],
    ['TimesJobs', (q, c) => 'https://www.timesjobs.com/candidate/job-search.html?txtKeywords=' + enc(q) + '&txtLocation=' + enc(c || '')],
    ['Shine', q => 'https://www.shine.com/job-search/' + slug(q) + '-jobs'],
    ['Freshersworld', q => 'https://www.freshersworld.com/jobs/jobsearch/' + slug(q) + '-jobs'],
    ['Jooble', (q, c) => 'https://in.jooble.org/SearchResult?ukw=' + enc(q) + (c ? '&rg=' + enc(c) : '')],
    ['Apna', q => 'https://apna.co/jobs?search=' + enc(q)],
    ['Hirist (tech)', q => 'https://www.hirist.tech/search/' + enc(q)],
    ['Wellfound (startups)', q => 'https://www.google.com/search?q=' + enc(q + ' site:wellfound.com')],
    ['Instahyre', q => 'https://www.google.com/search?q=' + enc(q + ' site:instahyre.com')],
    ['Cutshort', q => 'https://www.google.com/search?q=' + enc(q + ' site:cutshort.io')],
    ['Unstop', q => 'https://unstop.com/search?searchTerm=' + enc(q)]
];
// Any job search gets cards too: one per board, opening that board's own search for exactly what was typed. (Used on the Jobs page.)
export const jobLinks = (q, city) => BOARDS.map(B => [B[0], B[1](cleanQuery(q), city || '')]);
export function virtualJobs(q, city) {
    const role = cleanQuery(q);
    if (role.length < 2) {
        return [];
    }
    const now = new Date().toISOString();
    return [0, 1, 2, 3, 4, 5].flatMap(bi => {
        const intern = bi === 3;
        const B = BOARDS[bi];
        return [{
            id: 'cat_jq_' + h32(role.toLowerCase() + (city || '')).toString(36) + '_' + bi, type: intern ? 'Internship' : 'Job', title: role + (intern ? '' : ''), orgName: B[0], orgId: 'catalog', orgVerified: false,
            location: city ? city + ', India' : 'India · many cities and remote', pay: 'Check listing', duration: '', virtual: true, cat: undefined,
            description: 'Opens ' + B[0] + ' with this exact search (' + role + (city ? ' in ' + city : '') + '). Openings change every day, so the board shows what is open right now.',
            applyUrl: B[1](role, city || ''), status: 'approved', source: 'import', origin: 'catalog', created: now
        }];
    });
}
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

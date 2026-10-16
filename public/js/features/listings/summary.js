// Auto description for a listing, built with plain rules from the listing's own text (no AI, nothing sent anywhere).
// Gives the details popup and the cards: a short summary, key skills, WHO IT IS BEST FOR, WHAT YOU GET and how to apply.
//
// Two ways the "best for" and "what you get" lists are found:
//   1. The text says it. A line such as  "Best for: final-year students; freshers"  or  "What you get: certificate; mentor support"
//      (also "Ideal for", "Who should apply", "Benefits", "Perks", "You'll learn" ...) is used as written and removed from the long description.
//   2. Otherwise plain keyword rules look for the usual signals (intern, fresher, remote, certificate, stipend, mentor ...).
//      If the text says nothing, the list stays empty and the page tells the student to check the official page. Nothing is invented.
import { SKILLS, AMBIGUOUS } from '../suggestions/taxonomy.js';
const clean = s => String(s || '').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
const escH = x => String(x).replace(/[&<>"']/g, c => '&#' + c.charCodeAt(0) + ';');
export const hostOf = u => {
    try {
        return new URL(u).hostname.replace(/^www\./, '');
    } catch {
        return 'the employer\'s page';
    }
};
const POOL = [...new Map(SKILLS.filter(r => r[1].length > 2 && !AMBIGUOUS.has(r[0])).flatMap(r => [r[0], r[1], ...(r[3] || []).filter(x => x.length > 3)].map(k => [k.toLowerCase(), r[1]]))).entries()];
export function skillsIn(text) {
    const t = ' ' + text.toLowerCase().replace(/[^a-z0-9+# ]/g, ' ').replace(/\s+/g, ' ') + ' ';
    return [...new Set(POOL.filter(([k]) => t.includes(' ' + k.replace(/[^a-z0-9+# ]/g, ' ').trim() + ' ')).map(([, label]) => label))].slice(0, 8);
}
// Where a listing came from (shown as "Listed via ..."). Search links (the built-in catalog) are not listed "via" anywhere: see origin.js.
export const SOURCES = {
    greenhouse: 'the employer\'s Greenhouse job board',
    lever: 'the employer\'s Lever job board',
    ashby: 'the employer\'s Ashby job board',
    smartrecruiters: 'the employer\'s SmartRecruiters job board',
    page: 'the employer\'s careers page',
    catalog: 'Fyndr\'s picked course list',
    adzuna: 'Adzuna'
};
export const sourceOf = l => (l.search || String(l.id).startsWith('cat_') ? '' : l.source === 'import' ? (SOURCES[l.origin] || 'the official page') : '');

// ---------- 1. lines the writer labelled themselves ----------
const LABELS = {
    bestFor: /^(?:(?:best|ideal|suitable|perfect|great)\s+for|who\s+(?:is\s+(?:it|this)\s+for|should\s+(?:apply|join|take(?:\s+this(?:\s+course)?)?)))$/i,
    provides: /^(?:what\s+you(?:'|’)?ll\s+get|what\s+you\s+will\s+get|what\s+you\s+get|you\s+(?:will\s+)?get|what\s+(?:it|this)\s+(?:provides|offers|gives\s+you)|what\s+we\s+offer|benefits(?:\s+and\s+perks)?|perks(?:\s+and\s+benefits)?|(?:what\s+)?you(?:'|’)?ll\s+learn|(?:what\s+)?you\s+will\s+learn)$/i
};
const BULLET = /^\s*(?:[-*•–]|\d{1,2}[.)])\s+/;
const trimItem = s => {
    s = s.replace(BULLET, '').replace(/^[\s*_#>]+|[\s*_]+$/g, '').replace(/[;,.]+$/, '').trim();
    s = s.charAt(0).toUpperCase() + s.slice(1);
    return s.length > 110 ? s.slice(0, 107).replace(/\s+\S*$/, '') + '…' : s;
};
const splitInline = s => {
    let parts = s.split(/\s*(?:;|\||•|\n)\s*/).filter(Boolean);
    if (parts.length === 1 && parts[0].length < 160 && /,\s/.test(parts[0])) {
        const c = parts[0].split(/,\s+(?:and\s+)?/);
        if (c.every(x => x.length < 45)) {
            parts = c;
        }
    }
    return parts;
};
export function labelled(text) {
    const lines = String(text || '').replace(/\r/g, '').split('\n');
    const found = { bestFor: [], provides: [] };
    const rest = [];
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const bare = line.replace(/^[\s#>*•–-]+/, '');
        const m = bare.match(/^([A-Za-z'’ ]{3,34}?)\s*(?::|\s[-–]\s)\s*(.*)$/) || bare.match(/^([A-Za-z'’ ]{3,34}?)\s*()$/);
        const key = m && Object.keys(LABELS).find(k => LABELS[k].test(m[1].replace(/\*+/g, '').trim()));
        if (!key) {
            rest.push(line);
            continue;
        }
        const taken = [line];
        const items = splitInline(m[2].replace(/\*+/g, '').trim());
        while (i + 1 < lines.length && BULLET.test(lines[i + 1])) {
            taken.push(lines[++i]);
            items.push(lines[i]);
        }
        const got = items.map(trimItem).filter(x => x.length > 1);
        if (!got.length || found[key].length) {
            rest.push(...taken); // empty, or a second block with the same label: leave it in the long description
            continue;
        }
        found[key] = got.slice(0, 6);
    }
    return { ...found, rest: rest.join('\n').replace(/\n{3,}/g, '\n\n').trim() };
}

// ---------- 2. keyword rules when nothing was labelled ----------
const FIELDS = [
    [/computer science|\bcse\b|information technology|software engineering/i, 'computer science / IT'],
    [/data science|statistics|mathematics|analytics/i, 'data, statistics or maths'],
    [/electronics|electrical|mechanical|civil|engineering|b\.?\s?tech|\bb\.?e\.?\b/i, 'engineering'],
    [/design|ux|ui\b|architecture|fine arts/i, 'design'],
    [/marketing|communications?|journalism|mass\s+comm|media|content/i, 'marketing or communication'],
    [/finance|accounting|commerce|b\.?com|economics|\bca\b|\bmba\b|business/i, 'business or finance'],
    [/\blaw\b|legal/i, 'law']
];
const SENIOR = /\b(senior|sr\.?|lead|principal|staff|manager|head\s+of|director|vp|architect)\b/i;
const FRESH = /\b(fresher|freshers|entry[- ]level|new\s+grad(?:uate)?s?|recent\s+graduates?|graduate\s+(?:programme|program|trainee)|campus|junior|early\s+career)\b|\b0\s*[-–to]+\s*[12]\s*years?/i;
const STUDENT = /\b(intern|interns|internship|trainee|apprentice(?:ship)?)\b/i;
export function yearsNeeded(text) {
    const m = String(text).match(/(\d{1,2})\s*(?:\+|plus)?\s*(?:[-–]|to)?\s*(?:\d{1,2})?\s*(?:years?|yrs?)(?:\s+of)?\s+(?:of\s+)?(?:relevant\s+|professional\s+|work\s+|industry\s+|hands[- ]on\s+|prior\s+)?experience/i);
    return m ? +m[1] : null;
}
export function levelOf(l) {
    const title = String(l.title || '');
    const text = `${title} ${clean(l.description)}`;
    const years = yearsNeeded(text);
    if (l.type === 'Course') {
        return /\b(advanced|expert|masterclass)\b/i.test(title) ? 'advanced' : /\b(beginner|beginners|introduction|introductory|basics|from\s+scratch|no\s+(?:prior\s+)?experience|for\s+everyone)\b/i.test(text) ? 'beginner' : /\bintermediate\b/i.test(text) ? 'intermediate' : '';
    }
    if (l.type === 'Internship' || STUDENT.test(title)) {
        return 'student';
    }
    if (SENIOR.test(title) || (years !== null && years >= 3)) {
        return 'experienced';
    }
    if (FRESH.test(text) || years === 0) {
        return 'fresher';
    }
    return years !== null && years >= 1 ? 'early' : '';
}
const LEVEL_TEXT = { student: 'Students and freshers welcome', fresher: 'Freshers welcome', early: '1–2 years', experienced: 'Experienced', beginner: 'Beginners welcome', intermediate: 'Some basics needed', advanced: 'Advanced' };
const bestForByRules = (l, level, skills, text) => {
    const course = l.type === 'Course';
    const out = [];
    const years = yearsNeeded(text);
    if (course) {
        if (level === 'beginner') {
            out.push('Complete beginners, no experience needed');
        } else if (level === 'intermediate' || level === 'advanced') {
            out.push('Learners who already know the basics');
        }
        if (/^(free|no\s+cost|₹\s*0|rs\.?\s*0|0)\b/i.test(l.pay || '')) {
            out.push('Learners on a budget (it is listed as free)');
        }
        if (/self[- ]paced|at\s+your\s+own\s+pace|on[- ]demand/i.test(text)) {
            out.push('Students who study alongside college or work');
        }
        if (skills.length) {
            out.push(`Anyone who wants to learn ${skills.slice(0, 3).join(', ')}`);
        }
    } else {
        if (level === 'student') {
            out.push('Students and recent graduates looking for hands-on experience');
        } else if (level === 'fresher') {
            out.push('Freshers and recent graduates');
        } else if (level === 'experienced') {
            out.push(years ? `People with ${years}+ years of experience` : 'Experienced professionals');
        } else if (level === 'early') {
            out.push('People with 1–2 years of experience');
        }
        const fields = FIELDS.filter(([re]) => re.test(text)).map(f => f[1]).slice(0, 2);
        if (fields.length) {
            out.push(`Students or graduates in ${fields.join(' or ')}`);
        }
        if (skills.length) {
            out.push(`People comfortable with ${skills.slice(0, 3).join(', ')}`);
        }
        if (/remote|work\s+from\s+home|\bwfh\b/i.test(`${l.location} ${text}`)) {
            out.push('People who can work remotely');
        } else if (l.location && !/^see listing$/i.test(l.location)) {
            out.push(`People based in, or able to travel to, ${l.location.split(/[;|]/)[0].trim()}`);
        }
        if (/part[- ]time|flexible\s+(?:hours|schedule|timing)|weekends?\s+only/i.test(text)) {
            out.push('Students who need flexible hours');
        }
    }
    return out.slice(0, 4);
};
const PROVIDES = [
    [/certificat/i, 'A certificate'],
    [/letter\s+of\s+(?:recommendation|reference)|\blor\b/i, 'A letter of recommendation'],
    [/\bppo\b|pre[- ]?placement\s+offer|full[- ]time\s+(?:offer|conversion|opportunit)|convert(?:ed)?\s+to\s+(?:a\s+)?full[- ]time|return\s+offer/i, 'A chance at a full-time offer'],
    [/mentor/i, 'Mentorship from experienced people'],
    [/hands[- ]on|real[- ]world\s+projects?|capstone|portfolio\s+projects?|build\s+projects?|projects?\s+you\s+can\s+show/i, 'Hands-on, real-world projects'],
    [/live\s+(?:classes|sessions|lectures|mentoring)/i, 'Live sessions'],
    [/self[- ]paced|at\s+your\s+own\s+pace|on[- ]demand/i, 'Learn at your own pace'],
    [/lifetime\s+access/i, 'Lifetime access to the material'],
    [/video\s+(?:lectures?|lessons?|tutorials?)|lectures?\s+videos?/i, 'Video lessons'],
    [/quizzes|assignments|practice\s+(?:exercises|problems)|exercises/i, 'Practice exercises and quizzes'],
    [/community|forum|discord|study\s+group/i, 'A community to ask questions'],
    [/placement\s+(?:support|assistance)|job\s+assistance|career\s+(?:support|services|guidance)|interview\s+prep/i, 'Career and interview support'],
    [/work\s+from\s+home|\bremote(?:ly)?\b|\bwfh\b/i, 'Remote / work from home'],
    [/\bhybrid\b/i, 'Hybrid working'],
    [/flexible\s+(?:hours|work|schedule|timing)/i, 'Flexible hours'],
    [/health\s+(?:insurance|cover|coverage)|medical\s+(?:insurance|cover)/i, 'Health insurance'],
    [/\besops?\b|stock\s+options|equity/i, 'Stock options / equity'],
    [/learning\s+(?:budget|allowance|stipend)|upskilling|training\s+(?:programme|program|budget)|learning\s+and\s+development|\bl&d\b/i, 'Training and learning support'],
    [/bonus|incentives?/i, 'Bonus / incentives'],
    [/relocation/i, 'Relocation support'],
    [/free\s+(?:lunch|meals|snacks)|meals\s+provided/i, 'Free meals']
];
const providesByRules = (l, skills, text) => {
    const course = l.type === 'Course';
    const out = [];
    const money = l.pay && !/^see listing$/i.test(l.pay) ? l.pay : '';
    if (money) {
        out.push(course ? `Price: ${money}` : /stipend/i.test(text) ? `Stipend: ${money}` : `Pay: ${money}`);
    } else if (/stipend/i.test(text)) {
        out.push('A stipend');
    }
    for (const [re, label] of PROVIDES) {
        if (re.test(text)) {
            out.push(label);
        }
    }
    if (l.duration) {
        out.push(`Duration: ${l.duration}`);
    }
    if (skills.length) {
        out.push(course ? `You will learn: ${skills.slice(0, 4).join(', ')}` : `Practice with: ${skills.slice(0, 4).join(', ')}`);
    }
    return [...new Set(out)].slice(0, 7);
};

// ---------- the result ----------
const MEMO = new WeakMap();
export function summarize(l) {
    const key = `${l.description}|${l.pay}|${l.title}`;
    const hit = MEMO.get(l);
    if (hit && hit.key === key) {
        return hit.val;
    }
    const course = l.type === 'Course';
    const lab = labelled(l.description);
    const about = lab.rest;
    const d = clean(about);
    const text = `${l.title || ''} ${clean(l.description)}`;
    const first = (d.match(/[^.!?]{25,}[.!?]/) || [d.slice(0, 180)])[0].trim();
    const where = !l.location || /^see listing$/i.test(l.location) ? '' : /^(online|remote)\b/i.test(l.location) ? `, ${l.location.toLowerCase()}` : ` in ${l.location}`;
    const pay = l.pay && !/^see listing$/i.test(l.pay) ? (course ? ` Price: ${l.pay}.` : ` Pay: ${l.pay}.`) : '';
    const dur = l.duration ? ` Duration: ${l.duration}.` : '';
    const overview = course
        ? `${l.title} is a course from ${l.orgName}${where}.${dur}${pay} ${first}`.trim()
        : `${l.orgName} is hiring for ${l.title} (${l.type})${where}.${pay}${dur} ${first}`.trim();
    const skills = skillsIn(`${l.title} ${d}`);
    const level = levelOf(l);
    const bestFor = lab.bestFor.length ? lab.bestFor : bestForByRules(l, level, skills, text);
    const provides = lab.provides.length ? lab.provides : providesByRules(l, skills, text);
    const steps = [];
    if (l.search) {
        steps.push(`Pick a ${course ? 'learning site' : 'job board'} below. The first buttons are the most popular ones.`);
        steps.push(`It opens that ${course ? 'site' : 'board'}'s own search for ${escH(l.title)} in a new tab. Fyndr has not checked what you will find there.`);
        steps.push(course ? 'Compare level, price, reviews and whether you get a certificate before you enrol.' : 'Check the company, the stipend or salary and whether it is on-site before you apply.');
        steps.push('A real employer never asks you to pay a fee or share an OTP. Apply or enrol on that site\'s own page.');
    } else if (l.applyUrl) {
        steps.push(`Press <b>${course ? 'Go to the course page' : 'Apply on the official page'}</b>. It opens ${escH(hostOf(l.applyUrl))} in a new tab.`);
        steps.push('Check the address bar. A real employer never asks you to pay a fee or share an OTP.');
        steps.push(course ? 'Follow the enrolment steps on that page.' : 'Create an account or fill their form there, and attach your resume.');
        steps.push('Keep a screenshot or email of your submission.');
    } else {
        steps.push('Press <b>Apply</b>. A form opens on Fyndr.');
        steps.push('Fill in your details (name, contact, education, skills, experience, links, short note).');
        steps.push('Choose a resume: your Fyndr resume or your own PDF.');
        steps.push(`Submit. ${l.orgName || 'The organization'} sees it and updates your status in your dashboard.`);
    }
    const val = { overview, skills, steps, bestFor, provides, level, experience: LEVEL_TEXT[level] || '', about };
    MEMO.set(l, { key, val });
    return val;
}

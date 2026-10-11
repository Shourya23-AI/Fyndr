// Auto description for a listing, built with plain rules from the listing's own text (no AI, nothing sent anywhere).
import { SKILLS, AMBIGUOUS } from '../suggestions/taxonomy.js';
const clean = s => String(s || '').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
const POOL = [...new Map(SKILLS.filter(r => r[1].length > 2 && !AMBIGUOUS.has(r[0])).flatMap(r => [r[0], r[1], ...(r[3] || []).filter(x => x.length > 3)].map(k => [k.toLowerCase(), r[1]]))).entries()];
export function skillsIn(text) {
    const t = ' ' + text.toLowerCase().replace(/[^a-z0-9+# ]/g, ' ').replace(/\s+/g, ' ') + ' ';
    return [...new Set(POOL.filter(([k]) => t.includes(' ' + k.replace(/[^a-z0-9+# ]/g, ' ').trim() + ' ')).map(([, label]) => label))].slice(0, 8);
}
export function summarize(l) {
    const course = l.type === 'Course';
    const d = clean(l.description);
    const first = (d.match(/[^.!?]{25,}[.!?]/) || [d.slice(0, 180)])[0].trim();
    const where = l.location ? ` in ${l.location}` : '';
    const pay = l.pay ? (course ? ` Price: ${l.pay}.` : ` Pay: ${l.pay}.`) : '';
    const dur = l.duration ? ` Duration: ${l.duration}.` : '';
    const overview = course
        ? `${l.title} is a course from ${l.orgName}${where}.${dur}${pay} ${first}`.trim()
        : `${l.orgName} is hiring for ${l.title} (${l.type})${where}.${pay}${dur} ${first}`.trim();
    const skills = skillsIn(`${l.title} ${d}`);
    const steps = [];
    if (l.applyUrl) {
        steps.push(`Press <b>Apply on the official page</b>. It opens ${hostOf(l.applyUrl)} in a new tab.`);
        steps.push('Check the address bar. A real employer never asks you to pay a fee or share an OTP.');
        steps.push(course ? 'Follow the enrolment steps on that page.' : 'Create an account or fill their form there, and attach your resume.');
        steps.push('Keep a screenshot or email of your submission.');
    } else {
        steps.push('Press <b>Apply</b>. A form opens on Fyndr.');
        steps.push('Fill in your details (name, contact, education, skills, experience, links, short note).');
        steps.push('Choose a resume: your Fyndr resume or your own PDF.');
        steps.push(`Submit. ${l.orgName || 'The organization'} sees it and updates your status in your dashboard.`);
    }
    return { overview, skills, steps };
}
export const hostOf = u => {
    try {
        return new URL(u).hostname.replace(/^www\./, '');
    } catch {
        return 'the employer\'s page';
    }
};

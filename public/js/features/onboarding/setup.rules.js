// First-run profile setup: the four steps, what each step needs, a live "profile strength" number, the draft that survives a page
// reload, and the "what next" list shown on the profile page. Pure functions: no DOM and no network (storage is passed in).
// The setup pages use it, and test/setup-flow.test.js checks it against the real backend (same numbers as the server's completion()).
import { QUAL, EXP, JT } from '../profile/constants.js';
import { cleanStudy } from '../suggestions/study.js';

export const STEPS = [
    { id: 'education', title: 'Education', lead: 'Where do you study, or where did you?', why: 'Jobs and courses are matched to your field and where you are in your studies.' },
    { id: 'skills', title: 'Skills', lead: 'What can you already do?', why: 'Add the skills you have. Each listing is checked against them, and you can change them any time.' },
    { id: 'goals', title: 'Goals', lead: 'What are you looking for?', why: 'So you see internships, jobs or courses in the places you would actually go to.' },
    { id: 'intro', title: 'Intro', lead: 'A face and a line about you', why: 'Optional. Organizations see this on your applications.' }
];
// A few one-tap skills for people who do not know where to start (they can type their own).
export const QUICK_SKILLS = ['Communication', 'Teamwork', 'Excel', 'Python', 'JavaScript', 'SQL', 'Java', 'Data analysis', 'Writing', 'Design'];

const MAX = { field: 80, institution: 100, locations: 150, headline: 100, summary: 500, skill: 30, skills: 30 };
const clip = (v, n) => String(v ?? '').replace(/[\u0000-\u001f\u007f<>]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, n);
const para = (v, n) => String(v ?? '').replace(/\r\n?/g, '\n').replace(/[\u0000-\u0009\u000b-\u001f\u007f]+/g, ' ').replace(/[ \t]+/g, ' ').replace(/ ?\n ?/g, '\n').replace(/\n{3,}/g, '\n\n').trim().slice(0, n);
const lvl = n => (Math.round(+n) >= 1 && Math.round(+n) <= 5 ? Math.round(+n) : 3);

// Anything that comes from a form, from storage or from an older version of the page becomes a clean draft (right types, right sizes, known values only).
export function cleanDraft(raw) {
    const r = raw && typeof raw === 'object' ? raw : {};
    const skills = [...new Set((Array.isArray(r.skills) ? r.skills : []).map(s => clip(s, MAX.skill)).filter(Boolean))].slice(0, MAX.skills);
    const sl = r.skillLevels && typeof r.skillLevels === 'object' ? r.skillLevels : {};
    const study = cleanStudy(r) || {};
    const yr = String(r.gradYear ?? '').replace(/\D/g, '').slice(0, 4);
    const step = Math.round(+r.step);
    return {
        qualification: QUAL.includes(r.qualification) ? r.qualification : '',
        field: clip(r.field, MAX.field),
        institution: clip(r.institution, MAX.institution),
        gradYear: yr,
        programme: study.programme || '',
        studyYear: study.studyYear || '',
        semester: study.semester || '',
        experience: EXP.includes(r.experience) ? r.experience : '',
        skills,
        skillLevels: Object.fromEntries(skills.map(s => [s, lvl(sl[s])])),
        jobTypes: [...new Set((Array.isArray(r.jobTypes) ? r.jobTypes : []).filter(t => JT.includes(t)))],
        locations: clip(r.locations, MAX.locations),
        headline: clip(r.headline, MAX.headline),
        summary: para(r.summary, MAX.summary),
        step: step >= 0 && step < STEPS.length ? step : 0
    };
}

// A draft from what the account already has (a saved profile, what sign-up remembered about the studies).
export const draftFrom = (profile, study) => cleanDraft({ ...(study || {}), ...(profile || {}), gradYear: profile?.gradYear, jobTypes: profile?.jobTypes, locations: profile?.locations });

// Problems of ONE step, as { field: message }. An empty object means the step is fine. Messages are written for the person to read.
export function stepErrors(id, d, year = new Date().getFullYear()) {
    d = cleanDraft(d);
    const e = {};
    if (id === 'education') {
        !d.qualification && (e.qualification = 'Choose your highest qualification');
        !d.field && (e.field = 'Enter your field of study, for example Computer Science');
        !d.institution && (e.institution = 'Enter your college or institution');
        const y = +d.gradYear;
        (d.gradYear.length !== 4 || y < 1970 || y > year + 8) && (e.gradYear = `Enter the year you finish or finished, between 1970 and ${year + 8}`);
    } else if (id === 'skills') {
        !d.experience && (e.experience = 'Choose your experience level, "Student / Fresher" is fine');
        !d.skills.length && (e.skills = 'Add at least one skill. Tap one below or type your own and press Enter');
    }
    return e;
}
export const firstError = e => Object.values(e)[0] || '';
// First step that still has a problem, or -1 when every step is fine (used before the final save).
export const firstBadStep = d => STEPS.findIndex(s => Object.keys(stepErrors(s.id, d)).length);

// The same nine checks the server uses for the "% complete" number (helpers.js completion()), so the preview never disagrees with what is saved afterwards.
export function previewCompletion(d, hasResume = false) {
    d = cleanDraft(d);
    return Math.round([d.qualification, d.field, d.institution, d.gradYear, d.skills.length, d.experience, d.jobTypes.length, d.locations, hasResume].filter(Boolean).length / 9 * 100);
}
// Setup progress: step 1 of 4 shows 25%, the last step 100%.
export const stepPercent = i => Math.round((Math.min(Math.max(+i || 0, 0), STEPS.length - 1) + 1) / STEPS.length * 100);

// The body that PUT /api/profile expects (the backend checks it again and knows nothing about drafts).
export function toProfileBody(d) {
    d = cleanDraft(d);
    return {
        qualification: d.qualification, field: d.field, institution: d.institution, gradYear: +d.gradYear,
        ...(d.programme ? { programme: d.programme, studyYear: d.studyYear, semester: d.semester } : {}),
        experience: d.experience, skills: d.skills, skillLevels: d.skillLevels, jobTypes: d.jobTypes, locations: d.locations,
        headline: d.headline, summary: d.summary
    };
}

// ---------- the draft, kept on this device (so a reload or a closed tab does not lose the steps already done) ----------
const KEY = id => 'fyndr-setup:' + (id || 'anon');
export function saveDraft(store, id, d) {
    try {
        store.setItem(KEY(id), JSON.stringify(cleanDraft(d)));
    } catch { /* storage full or blocked: setup still works, it just cannot be resumed */ }
}
export function loadDraft(store, id) {
    try {
        const t = store.getItem(KEY(id));
        return t ? cleanDraft(JSON.parse(t)) : null;
    } catch {
        return null;
    }
}
export function clearDraft(store, id) {
    try {
        store.removeItem(KEY(id));
    } catch { }
}

// ---------- after setup: what is still worth doing, shown on the profile page ----------
// ctx = { phone: bool, resume: bool, photo: bool, profile: the saved profile }.  Each item: { id, title, why, done, href | go }.
export function nextSteps(ctx) {
    const p = ctx?.profile || {};
    return [
        { id: 'phone', title: 'Verify your phone number', why: 'Needed before you can apply to a listing.', done: !!ctx?.phone, href: '#/phone' },
        { id: 'resume', title: 'Upload your resume', why: 'A PDF, optional. Without one, Fyndr builds a resume from your profile.', done: !!ctx?.resume, go: 'resume' },
        { id: 'photo', title: 'Add a profile photo', why: 'Applications with a face get noticed.', done: !!ctx?.photo, go: 'photo' },
        { id: 'intro', title: 'Write a short intro', why: 'One or two lines about you, shown under your name.', done: !!(p.headline || p.summary), go: 'intro' }
    ];
}
export const pending = ctx => nextSteps(ctx).filter(x => !x.done);

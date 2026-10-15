// Where the person is in their studies (UG or PG, year, semester) and what suits them at that point.
// Pure functions: no DOM, no network. Used by the sign-up form, the profile form, and the Jobs and Courses pages.
export const PROGRAMMES = [['UG', 'UG (Bachelor’s degree)'], ['PG', 'PG (Master’s degree)']];
export const MAX_YEAR = { UG: 5, PG: 3 }; // UG 5 covers 5-year integrated and law courses; PG 3 covers 3-year programmes
export const yearsFor = p => Array.from({ length: MAX_YEAR[p] || 0 }, (_, i) => i + 1);
// the two semesters of a given year: year 2 -> [3, 4]
export const semestersFor = y => (y >= 1 ? [y * 2 - 1, y * 2] : []);
const int = v => (Number.isInteger(+v) ? +v : 0);
// Clean a { programme, studyYear, semester } from a form or a profile. Returns null when it is not a complete, sensible choice.
export function cleanStudy(x) {
    const programme = x && x.programme;
    const year = int(x && x.studyYear);
    const semester = int(x && x.semester);
    if (!MAX_YEAR[programme] || year < 1 || year > MAX_YEAR[programme] || !semestersFor(year).includes(semester)) {
        return null;
    }
    return { programme, studyYear: year, semester };
}
// Remembered on this device between the sign-up form and the profile form (the profile is only saved after the email is verified).
const KEY = 'fyndr-study';
export const rememberStudy = s => {
    try {
        s ? localStorage.setItem(KEY, JSON.stringify(s)) : localStorage.removeItem(KEY);
    } catch { }
};
export const recalledStudy = () => {
    try {
        return cleanStudy(JSON.parse(localStorage.getItem(KEY)));
    } catch {
        return null;
    }
};
// start = first year, build = middle years, launch = last year(s): placements, higher studies or the first job.
export function stageOf(s) {
    const c = cleanStudy(s);
    if (!c) {
        return null;
    }
    const last = c.programme === 'UG' ? 4 : 2;
    return c.studyYear >= last ? 'launch' : c.studyYear === 1 && c.programme === 'UG' ? 'start' : 'build';
}
const ADVICE = {
    start: {
        title: 'Start strong', blurb: 'Learn the basics and build good habits. Short internships and free courses are the best use of your time now.',
        topics: ['Python for Beginners', 'Soft Skills for Freshers', 'English Communication', 'Excel for Placements', 'Git and GitHub', 'Aptitude and Reasoning'], level: 'u', work: 'Internship'
    },
    build: {
        title: 'Build skills and projects', blurb: 'Pick a direction, build projects and try an internship. Recruiters look for real work from this stage.',
        topics: ['Data Structures for Placements', 'SQL for Data Analysis', 'Web Development Bootcamp', 'Machine Learning A to Z', 'Portfolio Building', 'Becoming a Software Intern'], level: 'u', work: 'Internship'
    },
    launch: {
        title: 'Get placed', blurb: 'Prepare for interviews, finish a strong project and apply for jobs and internships that can turn into offers.',
        topics: ['Cracking Campus Placements', 'Interview Preparation', 'Resume Writing for Freshers', 'System Design for Interviews', 'GATE Preparation', 'CAT Preparation'], level: 'p', work: 'Job'
    }
};
const PG_BUILD = ['Research Methodology', 'Machine Learning A to Z', 'Data Analysis with Python', 'Thesis and Dissertation Writing', 'Portfolio Building', 'Becoming a Software Intern'];
// -> { label, title, blurb, topics[], level ('u' | 'p'), work ('Internship' | 'Job'), stage } for this person, or null.
export function adviceFor(s) {
    const c = cleanStudy(s);
    const stage = stageOf(c);
    if (!stage) {
        return null;
    }
    const a = { ...ADVICE[stage], stage };
    if (c.programme === 'PG') {
        a.level = 'p';
        if (stage === 'build') {
            a.topics = PG_BUILD;
        }
    }
    a.label = `${c.programme} · Year ${c.studyYear} · Semester ${c.semester}`;
    return a;
}
// Rows -> the same rows with the ones that suit this stage first (order inside each group is kept). Courses by level (UG / PG), jobs by internship or job.
export function preferFor(rows, s) {
    const a = adviceFor(s);
    if (!a || !Array.isArray(rows)) {
        return rows;
    }
    const fits = l => (l.type === 'Course' ? l.level === a.level || !l.level : l.type === a.work);
    const yes = [];
    const no = [];
    rows.forEach(l => (fits(l) ? yes : no).push(l));
    return yes.concat(no);
}

// UG/PG -> year -> semester: each select appears and fills after the one before it. Works for the sign-up form and the profile form.
// (This one function touches the page; everything above it is pure.)
export function fillStudy(root) {
    const g = k => root.querySelector(`[data-study=${k}]`);
    const prog = g('programme');
    const sub = g('sub');
    const yr = g('year');
    const sem = g('sem');
    if (!prog || !yr || !sem) {
        return;
    }
    const opts = (arr, label, keep) => `<option value="">${label}</option>` + arr.map(n => `<option value="${n}" ${String(keep) === String(n) ? 'selected' : ''}>${typeof label === 'string' && label.startsWith('Year') ? 'Year ' + n : 'Semester ' + n}</option>`).join('');
    const keepYear = yr.value || yr.dataset.keep || '';
    const keepSem = sem.value || sem.dataset.keep || '';
    delete yr.dataset.keep; // a remembered choice is only used the first time
    sub && (sub.hidden = !prog.value);
    yr.innerHTML = opts(yearsFor(prog.value), 'Year…', keepYear);
    sem.innerHTML = opts(semestersFor(+yr.value), +yr.value ? 'Semester…' : 'Pick a year first', keepSem);
    delete sem.dataset.keep;
    sem.disabled = !+yr.value;
    const note = root.querySelector('.study-note');
    if (note) {
        const a = adviceFor({ programme: prog.value, studyYear: yr.value, semester: sem.value });
        note.hidden = !a;
        note.textContent = a ? `${a.title}: ${a.blurb}` : '';
    }
}

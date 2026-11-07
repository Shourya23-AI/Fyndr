import { S } from '../../core/state.js';
import { $, esc, safeUrl } from '../../core/dom.js';
import { api } from '../../core/api.js';
import { QUAL, EXP } from '../profile/constants.js';
import { ROLES, AREAS, EXAMPLES, roleById, rolesIn } from './roles.js';
import { understand, assess, learnOrder, parseSkills, matchQual, matchExperience } from './guide.engine.js';
import { readGuide, saveGuide, clearGuide } from './guide.state.js';
import { loadCatalog } from '../catalog/catalog.js';
import { tierText } from '../catalog/group.js';
import { indexCourses, buildPlan } from './guide.courses.js';
import { bookLinks, libraryHref, bestCopy } from './guide.books.js';
import { askGuide, resetAsk } from './guide.ai.js';
import { buildRoadmap, roadmapText, totalWeeks, saveRoadmap, loadRoadmap, forgetRoadmap } from './guide.roadmap.js';
// Career guide on the landing page: a chat that asks for the dream job, checks the person's qualifications and skills against it,
// and says what is missing, then turns the gaps into a course plan (guide.courses.js), and finally into a 3-phase roadmap with books that can be saved and shared (guide.roadmap.js).
// It is a guided conversation written in plain rules, plain rules, and nothing leaves the browser, until the person chooses "Ask the guide a question" (guide.ai.js): then that question, the job and the skill list go to the server's AI.
let pending = null; // a job typed in the landing page hero, waiting for the chat to be ready
let g = null; // the conversation that is open: { id, me, step, role, p, own, busy }
const SEND = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m4 12 16-8-6 17-2.5-6.5z"/></svg>';
const delay = ms => new Promise(r => setTimeout(r, ms));
const calm = () => window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
const alive = id => !!g && g.id === id && !!$('#gd-msgs');
const list = a => (a.length < 2 ? a.join('') : a.slice(0, -1).join(', ') + ' and ' + a[a.length - 1]);
const chip = (label, id, s) => `<button type="button" class="gd-qc" data-act="guide-pick" data-id="${esc(id)}" data-s="${s}">${esc(label)}</button>`;

export function mountGuide(me) {
    const root = $('#guide');
    if (!root) {
        return;
    }
    if (!me || me.role !== 'user') {
        root.remove(); // signed-out visitors, organizations and staff do not get the guide: it is for signed-in students only
        return;
    }
    g = { id: (mountGuide.n = (mountGuide.n || 0) + 1), me, step: 'job', role: null, p: null, own: false, busy: false };
    root.innerHTML = `<div class="gd-intro"><h2>Tell us your dream job. We will map the way there.</h2><p class="lead">Answer a few quick questions and get an honest check of where you stand, what is missing and what to learn first.</p></div>
<div class="gd" role="region" aria-label="Career guide chat"><div class="gd-top"><span class="gd-av" aria-hidden="true">F</span><div class="gd-who"><b>Fyndr guide</b><small>Your answers stay in this browser until you ask the guide a question.</small></div><button type="button" class="gd-reset" data-act="guide-reset">Start over</button></div>
<div class="gd-msgs" id="gd-msgs" role="log" aria-live="polite"></div><div class="gd-quick" id="gd-quick"></div>
<form class="gd-form" data-form="guide" autocomplete="off"><input id="gd-in" name="msg" maxlength="200" aria-label="Your answer" placeholder="Type your dream job"><button class="gd-send" aria-label="Send">${SEND}</button></form><p class="err gd-err"></p></div>`;
    greet(g.id);
}

// ---------- chat plumbing ----------
function put(who, html) {
    const m = $('#gd-msgs');
    if (!m) {
        return null;
    }
    const d = document.createElement('div');
    d.className = 'gd-row ' + who;
    d.innerHTML = `<div class="gd-bub">${html}</div>`;
    m.appendChild(d);
    m.scrollTop = m.scrollHeight;
    return d;
}
async function say(id, ...parts) {
    for (const html of parts) {
        if (!alive(id)) {
            return false;
        }
        const t = put('bot', '<span class="gd-dots" aria-label="Typing"><i></i><i></i><i></i></span>');
        await delay(calm() ? 0 : Math.min(900, 300 + html.length * 4));
        t && t.remove();
        if (!alive(id)) {
            return false;
        }
        put('bot', html);
    }
    return true;
}
function busy(on) {
    g.busy = on;
    ['#gd-in', '.gd-send'].forEach(s => { const e = $(s); e && (e.disabled = on); });
    const q = $('#gd-quick');
    q && q.classList.toggle('off', on);
    if (!on) {
        const i = $('#gd-in');
        i && !matchMedia('(pointer: coarse)').matches && i.focus({ preventScroll: true });
    }
}
// Show the answer chips and the hint for the next question.
function ask(step, ph, chips = []) {
    g.step = step;
    const i = $('#gd-in');
    const q = $('#gd-quick');
    if (i) {
        i.value = '';
        i.placeholder = ph;
    }
    if (q) {
        q.innerHTML = chips.map(c => chip(c[0], c[1], c[2] || step)).join('');
    }
}
async function flow(fn) {
    if (!g || g.busy) {
        return;
    }
    const id = g.id;
    busy(true);
    try {
        await fn(id);
    } finally {
        if (g && g.id === id) {
            busy(false);
        }
    }
}

// ---------- the conversation ----------
async function greet(id) {
    const first = String((g.me && g.me.name) || '').trim().split(/\s+/)[0];
    const saved = readGuide();
    const back = roleById(saved.roleId);
    const keep = loadRoadmap();
    await flow(async () => {
        await say(id, `Hi${first ? ' ' + esc(first) : ''}! I am the Fyndr career guide.`, 'What is your dream job? Type it below, or tap an example.');
        ask('job', 'Type your dream job, e.g. Data analyst', [...(keep ? [['Open my saved roadmap: ' + keep.role.title, 'x', 'saved']] : []), ...(back ? [['Continue: ' + back.title, back.id, 'role']] : []), ...EXAMPLES.map(t => [t, t, 'job'])]);
    });
    if (pending && g && g.id === id) {
        await drain(); // the job was typed on the landing page before the chat was ready
    }
}

export function pick(label, value, kind) {
    return flow(async id => {
        if (kind === 'reset') {
            return;
        }
        put('me', esc(label));
        $('#gd-quick').innerHTML = '';
        if (kind === 'plan') {
            return plan(id);
        }
        if (kind === 'roadmap' || kind === 'save' || kind === 'share' || kind === 'saved' || kind === 'forget') {
            return ({ roadmap, save: saveIt, share: shareIt, saved: openSaved, forget: forgetIt })[kind](id);
        }
        if (kind === 'aiask') {
            await say(id, 'Ask me anything about this path, for example: what should I build first, how do I show these skills on a resume, or how do I prepare for the interview.', '<small>Only your question, this job and your skill list are sent to the AI that answers. Your name and email are not.</small>');
            return ask('aiq', 'Type your question', [['Back to my plan', 'x', 'back']]);
        }
        if (kind === 'back') {
            await say(id, 'Okay. What would you like to do next?');
            return ask('more', 'Add skills you have, e.g. SQL, Excel', moreChips());
        }
        if (kind === 'change') {
            await say(id, 'Sure. Which job do you want to check next?');
            return ask('job', 'Type another dream job', EXAMPLES.map(t => [t, t, 'job']));
        }
        if (kind === 'more') {
            await say(id, 'Type the skills you have, separated by commas. For example: SQL, Excel, Python.');
            return ask('more', 'Skills you have, e.g. SQL, Excel', [['Try a different job', 'x', 'change']]);
        }
        if (kind === 'area') {
            await say(id, 'Here are the jobs I can map in that area. Which is closest?');
            return ask('job', 'Or type your own dream job', [...rolesIn(value).map(r => [r.title, r.id, 'role']), ['None of these', 'x', 'none']]);
        }
        if (kind === 'none') {
            return ask('job', 'Type your dream job in a few words');
        }
        if (kind === 'role') {
            return chosen(id, roleById(value));
        }
        return step(id, value, kind);
    });
}
export const send = text => flow(async id => {
    const t = String(text || '').trim().slice(0, 200);
    if (!t) {
        return;
    }
    put('me', esc(t));
    $('#gd-quick').innerHTML = '';
    await step(id, t, g.step);
});

async function step(id, t, s) {
    if (s === 'aiq') {
        return aiAnswer(id, t);
    }
    if (s === 'job' || s === 'change') {
        return job(id, t);
    }
    if (s === 'qual') {
        const q = matchQual(t);
        if (!q) {
            await say(id, 'I did not catch that. Pick the closest option:');
            return ask('qual', 'Or type it, e.g. B.Tech', QUAL.map(x => [x, x]));
        }
        g.p.qualification = q;
        await say(id, 'Got it. What is your field of study, or the subject you are studying now?');
        return ask('field', 'e.g. Computer Science, Commerce, Mechanical');
    }
    if (s === 'field') {
        g.p.field = t.slice(0, 80);
        await say(id, 'And how much work experience do you have?');
        return ask('exp', 'Or type it, e.g. 2 years', EXP.map(x => [x, x]));
    }
    if (s === 'exp') {
        const e = matchExperience(t, EXP);
        if (!e) {
            await say(id, 'Pick the closest option:');
            return ask('exp', 'Or type it, e.g. 2 years', EXP.map(x => [x, x]));
        }
        g.p.experience = e;
        await say(id, 'Last one: which skills do you already have? Tools, languages, software, anything you can do. Separate them with commas.');
        return ask('skills', 'e.g. Python, Excel, Photoshop', [['No skills yet', 'none']]);
    }
    if (s === 'skills') {
        g.p.skills = parseSkills(t === 'none' ? '' : t);
        await say(id, g.p.skills.length ? `Noted: ${esc(list(g.p.skills))}.` : 'No problem, everyone starts somewhere.');
        saveGuide({ answers: { qualification: g.p.qualification, field: g.p.field, experience: g.p.experience, skills: g.p.skills } });
        return result(id);
    }
    // after the result: whatever is typed is more skills
    const add = parseSkills(t).filter(x => !(g.p.skills || []).some(y => y.toLowerCase() === x.toLowerCase()));
    if (!add.length) {
        await say(id, 'I did not find new skills in that. Type them separated by commas (for example SQL, Excel), or pick an option.');
        return ask('more', 'Skills you have, e.g. SQL, Excel', moreChips());
    }
    g.p.skills = [...(g.p.skills || []), ...add];
    g.pl = g.r = null; // the plan and roadmap were built for the old skills
    g.own || saveGuide({ answers: { qualification: g.p.qualification, field: g.p.field, experience: g.p.experience, skills: g.p.skills } });
    await say(id, `Added ${esc(list(add))}. Here is your updated check.`);
    return result(id);
}

// A typed question after the check: answered by the AI, using this person's job and gaps.
async function aiAnswer(id, t) {
    const wait = put('bot', '<span class="gd-dots" aria-label="Thinking"><i></i><i></i><i></i></span>');
    try {
        const reply = await askGuide(t, g);
        wait && wait.remove();
        alive(id) && put('bot', esc(reply).replace(/\n/g, '<br>'));
    } catch (e) {
        wait && wait.remove();
        alive(id) && put('bot', esc(e.message || 'The guide could not answer right now.') + ' You can still use the plan above.');
    }
    alive(id) && ask('aiq', 'Ask another question', [['Back to my plan', 'x', 'back']]);
}

async function job(id, t) {
    // small talk ("hi", "thanks", "help") is not a job: answer it kindly and steer back to the dream-job question
    if (/^\s*(hi+|hello+|hey+|hii+|yo|sup|namaste|good\s*(morning|afternoon|evening)|thanks?( you)?|thx|ok(ay)?|cool|help|who are you|what can you do)\W*$/i.test(t)) {
        const thanks = /thank|thx|^\s*(ok|cool)/i.test(t);
        await say(id, thanks ? 'Happy to help!' : 'Hey! Good to see you. I can map any job to the skills and courses you need.', 'Type the job you dream of, like <b>Data analyst</b>, or tap an example.');
        return ask('job', 'Type your dream job, e.g. Data analyst', EXAMPLES.map(x => [x, x, 'job']));
    }
    const u = understand(t);
    if (u.kind === 'role' && u.fuzzy) {
        await say(id, `I read that as <b>${esc(u.role.title)}</b>. Is that the job you mean?`);
        return ask('job', 'Or type the job again', [['Yes, ' + u.role.title, u.role.id, 'role'], ['No, let me retype', 'x', 'none']]);
    }
    if (u.kind === 'role') {
        return chosen(id, u.role);
    }
    if (u.kind === 'choose') {
        await say(id, 'Which of these is closest to what you mean?');
        return ask('job', 'Or type it differently', [...u.roles.map(r => [r.title, r.id, 'role']), ['None of these', 'x', 'none']]);
    }
    if (u.kind === 'area') {
        const a = AREAS.find(x => x[0] === u.area);
        await say(id, `That sounds like ${esc(a[1])}. Here are the jobs I can map there:`);
        return ask('job', 'Or type your own dream job', [...u.roles.map(r => [r.title, r.id, 'role']), ['None of these', 'x', 'none']]);
    }
    await say(id, 'I could not match that to a job yet. Try a job title like <b>Data analyst</b> or <b>Graphic designer</b>, or pick the area that interests you most and I will show the jobs I can check:');
    return ask('job', 'Or type a different job', AREAS.map(a => [a[1], a[0], 'area']));
}

async function chosen(id, role) {
    g.role = role;
    saveGuide({ roleId: role.id });
    await say(id, `<b>${esc(role.title)}</b>. ${esc(role.summary)}`);
    if (g.me && !g.p) {
        try {
            const d = await api('/profile');
            g.p = d.profile || {};
            g.own = true;
        } catch {
            g.p = null;
        }
    }
    const p = g.p;
    if (g.own && p && (p.qualification || (p.skills || []).length)) {
        const bits = [p.qualification && `a ${esc(p.qualification)}${p.field ? ' in ' + esc(p.field) : ''}`, (p.skills || []).length && `${p.skills.length} skill${p.skills.length > 1 ? 's' : ''} listed`, p.experience && esc(p.experience).toLowerCase() + ' experience'].filter(Boolean);
        await say(id, `I checked your Fyndr profile: ${list(bits)}. I will compare that with this job.`);
        return result(id);
    }
    g.p = g.p && g.own ? g.p : (readGuide().answers && readGuide().roleId === role.id ? { ...readGuide().answers } : {});
    if (g.p.qualification && g.p.field && g.p.experience && g.p.skills) {
        await say(id, 'I still have your answers from a moment ago, so I will use them.');
        return result(id);
    }
    await say(id, g.own ? 'Your profile is still empty, so let me ask a few quick things. Which is your highest qualification?' : 'To see how close you are, I need four quick details. First, what is your highest qualification?');
    return ask('qual', 'Or type it, e.g. B.Tech', QUAL.map(x => [x, x]));
}

const moreChips = () => [['Ask the guide a question', 'x', 'aiask'], ['Add more skills', 'x', 'more'], ['Try a different job', 'x', 'change'], ['Start over', 'x', 'reset']].filter(c => c[2] !== 'reset');
const ADVICE = {
    close: 'You are close. What is left is mostly proof: build one or two projects that show these skills, then start applying.',
    solid: 'You already have a real base. Close the core gaps first, then the nice-to-haves, and keep a project for each new skill.',
    base: 'You are early on this path, which is completely normal. Do not try to learn everything at once: take the first two core skills and go deep.',
    start: 'You are starting from the beginning for this job, and that is fine. We will go in order: foundations first, then tools, then projects.'
};
const tag = (cls, t) => `<span class="gd-tag ${cls}">${esc(t)}</span>`;

function qualLine(a) {
    const q = a.qual;
    if (q.status === 'met') {
        return ['ok', `Your ${esc(q.have)} meets the usual minimum for this job (${esc(q.need)}).`];
    }
    if (q.status === 'on-track') {
        return ['ok', `You are on track: the usual minimum is a ${esc(q.need)}, and you are working towards it.`];
    }
    if (q.status === 'gap') {
        return ['warn', `Most openings ask for a ${esc(q.need)}, and you listed ${esc(q.have)}. You can still get in with certificates and projects, but expect fewer openings.`];
    }
    return ['warn', `The usual minimum is a ${esc(q.need)}. Add your qualification to your profile so I can check it.`];
}
function resultCard(a) {
    const [qc, qt] = qualLine(a);
    const f = a.field;
    const fl = f.kind === 'direct' ? ['ok', `Your field${f.field ? ' (' + esc(f.field) + ')' : ''} points straight to this kind of work.`] : f.kind === 'related' ? ['ok', `Your field${f.field ? ' (' + esc(f.field) + ')' : ''} is related, so a lot of what you studied carries over.`] : f.kind === 'different' ? ['info', `Your field${f.field ? ' (' + esc(f.field) + ')' : ''} is different, which is common. For most of these jobs, skills and projects matter more than the degree.`] : null;
    const years = a.years >= 1 ? ['ok', `You have about ${a.years}+ years of experience to build on.`] : ['info', 'As a fresher, aim for internships and entry-level openings first. Each project you finish counts as experience.'];
    const by = (tier, st) => a.items.filter(i => i.tier === tier && i.status === st);
    const group = (title, items, cls) => (items.length ? `<div class="gd-sec"><h4>${title}</h4><div class="gd-tags">${items.map(i => tag(cls, i.label)).join('')}</div></div>` : '');
    const have = a.items.filter(i => i.status === 'have');
    const part = a.items.filter(i => i.status === 'partial');
    const band = a.readiness >= 75 ? 'good' : a.readiness >= 45 ? 'mid' : 'low';
    return `<div class="gd-card"><div class="gd-head"><div class="gd-ring ${band}" style="--p:${a.readiness}"><b>${a.readiness}%</b><span>ready</span></div><div><h3>${esc(a.role.title)}</h3><p class="desc">${a.coreMissing ? `${a.coreMissing} core skill${a.coreMissing > 1 ? 's' : ''} still to go.` : 'You cover every core skill.'}</p></div></div>
<div class="gd-sec"><h4>Qualification check</h4><p class="gd-line ${qc}">${qt}</p>${fl ? `<p class="gd-line ${fl[0]}">${fl[1]}</p>` : ''}<p class="gd-line ${years[0]}">${years[1]}</p>${a.qual.note ? `<p class="desc">${esc(a.qual.note)}</p>` : ''}</div>
${group('Skills you already have', have, 'have')}${group('Partly covered', part, 'part')}${group('Core skills you still need', by('must', 'missing'), 'need')}${group('Nice to have', by('nice', 'missing'), 'nice')}
${a.otherSkills.length ? `<p class="desc">Other skills you listed: ${esc(list(a.otherSkills.slice(0, 8)))}. They are not part of this job\u2019s core list, but they still help.</p>` : ''}</div>`;
}

async function result(id) {
    const a = assess(g.role, g.p || {});
    g.a = a;
    g.pl = g.r = null;
    await say(id, `Here is where you stand for <b>${esc(a.role.title)}</b>.`);
    put('bot', resultCard(a));
    const first = learnOrder(a).slice(0, 2).map(i => i.label);
    await say(id, ADVICE[a.level], first.length ? `If I were you, I would start with ${esc(list(first))}.` : 'You can move straight to building projects and applying.');
    if (a.items.some(i => i.status !== 'have')) {
        await say(id, 'Want me to turn that into a step-by-step course plan?');
        return ask('more', 'Or add skills you have, e.g. SQL, Excel', [['Build my course plan', 'x', 'plan'], ...moreChips()]);
    }
    await say(id, 'You already cover every skill on my list for this job, so courses are not what is holding you back. Build projects and start applying.');
    ask('more', 'Add skills you have, e.g. SQL, Excel', moreChips());
}

let courseIndex = null;
// The course plan for the current check (built once, rebuilt after new skills are added).
async function ensurePlan(id) {
    try {
        courseIndex = courseIndex || indexCourses(await loadCatalog());
    } catch {
        courseIndex = [];
    }
    if (!alive(id)) {
        return null;
    }
    g.pl = g.pl || buildPlan(courseIndex, g.a);
    return g.pl;
}
async function plan(id) {
    await say(id, 'Give me a moment to look through the course catalog.');
    const pl = await ensurePlan(id);
    if (!pl) {
        return;
    }
    saveGuide({ plan: pl.steps.map(x => ({ key: x.item.key, label: x.item.label, tier: x.item.tier })) });
    put('bot', planCard(pl));
    await say(id, 'Start at step 1 and move down. Foundations come first, so each step makes the next one easier.', 'Next I can add books to each step and lay it all out as a roadmap in three phases: foundations, tools and projects.');
    ask('more', 'Add skills you have, e.g. SQL, Excel', [['Build my 3-phase roadmap', 'x', 'roadmap'], ...moreChips()]);
}

// ---------- Part 3: books, the 3-phase roadmap, save and share ----------
const afterRoadmap = () => ask('job', 'Or type another dream job', [['Ask the guide a question', 'x', 'aiask'], ['Save my roadmap', 'x', 'save'], ['Share my roadmap', 'x', 'share'], ['Add skills I have', 'x', 'more'], ['Try a different job', 'x', 'change']]);
async function roadmap(id) {
    if (!g.a) {
        return;
    }
    await say(id, 'Adding books to each step and splitting the work into three phases.');
    const pl = await ensurePlan(id);
    if (!pl) {
        return;
    }
    g.r = buildRoadmap(g.a, pl);
    live(put('bot', roadmapCard(g.r)));
    await say(id, `Work through it in order: about ${totalWeeks(g.r)} weeks in total at roughly 5 hours a week. Move to the next phase only when the current one is done.`, g.me ? 'When you learn a skill, add it to your Fyndr profile so job matching sees it.' : 'Create a free account and add each skill you learn to your profile, so job matching sees it.');
    afterRoadmap();
}
async function saveIt(id) {
    if (!g.r) {
        return;
    }
    await say(id, saveRoadmap(g.r) ? 'Saved on this device. It will be here next time you open this page in this browser, and it is not sent anywhere. To keep a copy elsewhere, use Share.' : 'I could not save here, probably because the browser blocks storage (private mode, for example). Use Share to keep a copy.');
    afterRoadmap();
}
async function shareIt(id) {
    if (!g.r) {
        return;
    }
    const text = roadmapText(g.r, location.origin + location.pathname);
    try {
        if (navigator.share) {
            await navigator.share({ title: 'My career roadmap: ' + g.r.role.title, text });
            await say(id, 'Shared.');
            return afterRoadmap();
        }
    } catch (e) {
        if (e && e.name === 'AbortError') {
            return afterRoadmap();
        }
    }
    try {
        await navigator.clipboard.writeText(text);
        await say(id, 'Copied your roadmap as plain text. Paste it into a message or a note. It is a copy of the text, not a live link.');
    } catch {
        await say(id, 'I could not copy it automatically. Select the text below and copy it:');
        put('bot', `<textarea class="gd-copy" readonly rows="10" aria-label="Your roadmap as text">${esc(text)}</textarea>`);
    }
    afterRoadmap();
}
async function openSaved(id) {
    const r = loadRoadmap();
    if (!r) {
        await say(id, 'I could not find a saved roadmap in this browser.');
        return ask('job', 'Type your dream job');
    }
    g.r = r;
    await say(id, `Here is the roadmap you saved${r.at ? ' on ' + new Date(r.at).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) : ''}. It shows your skills as they were then. Type a job to start a fresh check.`);
    live(put('bot', roadmapCard(r)));
    ask('job', 'Or type a dream job for a fresh check', [['Share my roadmap', 'x', 'share'], ['Delete my saved roadmap', 'x', 'forget'], ['Try a different job', 'x', 'change']]);
}
async function forgetIt(id) {
    forgetRoadmap();
    await say(id, 'Deleted. Nothing is saved on this device any more.');
    ask('job', 'Type your dream job', EXAMPLES.map(t => [t, t, 'job']));
}

const LEVEL_WHY = { must: 'Core skill', nice: 'Nice to have' };
function planCard({ steps, more }) {
    const link = l => `<a class="gd-link" href="${esc(safeUrl(l.u))}" target="_blank" rel="noopener noreferrer">${esc(l.n)}${l.tier === 'free' || l.kind === 'free' ? '<i>Free</i>' : l.tier === 'freemium' || l.kind === 'free to start' ? '<i>Free to start</i>' : ''}</a>`;
    const course = c => `<div class="gd-course"><b>${esc(c.title)}</b><span>${esc(tierText(c.allFree ? 'free' : c.free ? 'freemium' : 'paid') || (c.allFree ? 'Free' : c.free ? 'Free options' : 'Paid'))}${c.cert ? ' · certificate available' : ''}</span><div class="gd-links">${(c.links || []).slice(0, 4).map(link).join('')}</div></div>`;
    const li = (st, i) => `<li class="gd-step"><span class="gd-num">${i + 1}</span><div><h4>${esc(st.item.label)} <small class="gd-why ${st.item.tier}">${LEVEL_WHY[st.item.tier]}${st.item.status === 'partial' ? ' · you know part of it' : ''}</small></h4>
${st.courses.length ? st.courses.map(course).join('') : `<div class="gd-course"><b>Search for ${esc(st.item.label)} courses</b><div class="gd-links">${st.search.map(link).join('')}</div></div>`}</div></li>`;
    return `<div class="gd-card gd-plan"><div class="gd-head"><div><h3>Your course plan</h3><p class="desc">${steps.length} step${steps.length > 1 ? 's' : ''}, foundations first. As a rough guide, allow 2 to 4 weeks per step at about 5 hours a week.${more ? ` ${more} more skill${more > 1 ? 's' : ''} can wait until these are done.` : ''}</p></div></div>
<ol class="gd-steps">${steps.map(li).join('')}</ol><p class="desc">Each button opens that learning site\u2019s own search for the topic. Fyndr has not checked the individual courses there, so compare a few and check current prices.</p></div>`;
}

// Looks up each step's first book in the Library's open catalogs, two at a time, and adds a direct "read / borrow" link when a copy exists.
async function live(row) {
    const els = row ? [...row.querySelectorAll('[data-bk]')] : [];
    if (!els.length) {
        return;
    }
    let search;
    try {
        ({ searchCatalogs: search } = await import('../library/library.js'));
    } catch {
        return;
    }
    let next = 0;
    const work = async () => {
        while (next < els.length) {
            const el = els[next++];
            const slot = el.querySelector('.gd-live');
            if (!slot || !el.isConnected) {
                continue;
            }
            slot.textContent = 'Checking for a copy online\u2026';
            try {
                const t = el.dataset.bk;
                const c = bestCopy(t, (await search({ q: t, free: false })).books);
                slot.innerHTML = c ? `<a class="gd-link gd-hit" href="${esc(c.u)}" target="_blank" rel="noopener noreferrer">${esc(c.label)}</a>` : 'No copy found in the open catalogs. Try the links below.';
            } catch {
                slot.textContent = '';
            }
        }
    };
    await Promise.all([work(), work()]);
}
const PHASE_NOTE = {
    foundations: 'The basics everything else rests on. Do these first, in order.',
    tools: 'The tools employers ask for. Learn them once the foundations feel comfortable.',
    projects: 'Proof that you can do the work. This is what you show in applications.'
};
function roadmapCard(r) {
    const link = (l, cls = 'gd-link') => {
        const u = l.app ? l.u : safeUrl(l.u);
        return u ? `<a class="${cls}" href="${esc(u)}"${l.app ? '' : ' target="_blank" rel="noopener noreferrer"'}>${esc(l.n)}</a>` : '';
    };
    const bookEl = (b, n) => `<div class="gd-book"${n === 0 ? ` data-bk="${esc(b.t)}"` : ''}><b>${esc(b.t)}</b><span>${esc(b.a)}</span>${n === 0 ? '<p class="gd-live" aria-live="polite"></p>' : ''}<div class="gd-links">${b.free ? link({ n: 'Free official edition', u: b.free }) : ''}${bookLinks(b).map(l => link(l)).join('')}</div></div>`;
    const item = (it, i) => {
        const c = it.courses[0];
        const cl = c ? `<div class="gd-course"><b>Course: ${esc(c.t)}</b>${c.u ? `<div class="gd-links">${link({ n: c.n ? 'Open on ' + c.n : 'Open course', u: c.u })}</div>` : ''}</div>` : it.search.length ? `<div class="gd-course"><b>Find a ${esc(it.label)} course</b><div class="gd-links">${it.search.map(l => link(l)).join('')}</div></div>` : '';
        const bl = it.books.length ? it.books.map((b, n) => bookEl(b, n)).join('') : `<div class="gd-book"><b>No hand-picked book for this one yet</b><div class="gd-links">${link({ n: 'Search the Library for ' + it.label, u: libraryHref(it.label), app: true })}</div></div>`;
        return `<li class="gd-step"><span class="gd-num">${i + 1}</span><div><h4>${esc(it.label)} <small class="gd-why ${it.tier}">${LEVEL_WHY[it.tier]}</small></h4>${cl}${bl}</div></li>`;
    };
    const phase = (p, n) => {
        const body = p.id === 'projects'
            ? `<ul class="gd-ideas">${p.ideas.map(x => `<li>${esc(x)}</li>`).join('')}</ul>${p.uses && p.uses.length ? `<p class="desc">Use ${esc(list(p.uses))} in it, so the project shows what you just learned.</p>` : ''}<div class="gd-links"><button type="button" class="gd-link" data-act="guide-openings" data-id="${esc(r.role.title)}">Find ${esc(r.role.title)} openings</button><a class="gd-link" href="#/courses">Explore courses</a>${g && g.me ? '<a class="gd-link" href="#/profile">Update my profile</a>' : ''}</div>`
            : p.items.length ? `<ol class="gd-steps" start="1">${p.items.map(item).join('')}</ol>` : '<p class="desc">Nothing extra to learn here for now. Use these weeks to finish the foundations well.</p>';
        return `<section class="gd-phase ${esc(p.id)}"><header><span class="gd-pn">${n + 1}</span><div><h4>${esc(p.title)}</h4><p class="desc">${esc(PHASE_NOTE[p.id] || '')}</p></div><span class="gd-wk">about ${p.weeks} week${p.weeks === 1 ? '' : 's'}</span></header>${body}</section>`;
    };
    return `<div class="gd-card gd-road"><div class="gd-head"><div><h3>Your roadmap: ${esc(r.role.title)}</h3><p class="desc">Three phases, about ${totalWeeks(r)} weeks at roughly 5 hours a week.${r.more ? ` ${r.more} more skill${r.more > 1 ? 's' : ''} can wait until these are done.` : ''}</p></div></div>${r.phases.map(phase).join('')}<p class="desc">The books are a hand-made list of well-known titles. Fyndr has not checked that a copy is available, so use the Library search or the other links to find one, and compare prices before buying.</p></div>`;
}

const drain = () => {
    const t = pending;
    pending = null;
    return t ? send(t) : undefined;
};
// The landing page hero ("I want to be a ...") and its example buttons start the guide with that job.
export function startWith(text) {
    const t = String(text || '').trim().slice(0, 200);
    jump();
    if (!t) {
        const i = $('#gd-in');
        return i && i.focus({ preventScroll: true });
    }
    pending = t;
    if (!g || g.busy) {
        return; // the greeting is still running (or the chat is loading): greet() sends it when it is done
    }
    if (g.step === 'job') {
        return drain();
    }
    restart(); // a different check was open: start a fresh one with this job
}
export function restart() {
    resetAsk();
    clearGuide();
    mountGuide(S.me);
}
export function jump() {
    const e = $('#guide');
    e && e.scrollIntoView({ behavior: calm() ? 'auto' : 'smooth', block: 'start' });
}
export { ROLES };

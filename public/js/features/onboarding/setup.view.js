// First-run setup screens as plain HTML strings (no DOM, no network), so the markup can be tested without a browser.
// setup.page.js puts them on the page; profile.view.js uses profileHead() for the progress card at the top of the profile page.
import { esc } from '../../core/dom.js';
import { QUAL, EXP, JT } from '../profile/constants.js';
import { PROGRAMMES } from '../suggestions/study.js';
import { STEPS, QUICK_SKILLS, stepPercent, previewCompletion, nextSteps, pending } from './setup.rules.js';

const opt = (arr, v) => arr.map(x => `<option ${x === v ? 'selected' : ''}>${esc(x)}</option>`).join('');
// One labelled field. `err` is the problem found on the last "Continue", shown right under the field.
const fld = (label, input, err, id) => `<label class="su-fld ${err ? 'bad' : ''}"><span>${label}</span>${input}${err ? `<small class="su-err" id="${id}-e">${esc(err)}</small>` : ''}</label>`;

const BODY = {
    education: (d, e) => `${fld('Highest qualification', `<select name="qualification" required aria-describedby="qualification-e"><option value="">Choose one</option>${opt(QUAL, d.qualification)}</select>`, e.qualification, 'qualification')}
${fld('Field of study', `<input name="field" value="${esc(d.field)}" placeholder="e.g. Computer Science" maxlength="80" required autocomplete="off" aria-describedby="field-e">`, e.field, 'field')}
${fld('College or institution', `<input name="institution" value="${esc(d.institution)}" placeholder="e.g. BMS Institute of Technology" maxlength="100" required autocomplete="organization" aria-describedby="institution-e">`, e.institution, 'institution')}
${fld('Year you finish (or finished)', `<input name="gradYear" value="${esc(d.gradYear)}" inputmode="numeric" pattern="[0-9]{4}" maxlength="4" placeholder="e.g. 2027" required aria-describedby="gradYear-e">`, e.gradYear, 'gradYear')}
<div class="su-study study-pick"><p class="desc">Still studying? Tell us where you are, so we can suggest what suits this stage. (optional)</p><div class="study-sub su-study-row"><select name="programme" data-study="programme" aria-label="UG or PG"><option value="">UG or PG</option>${PROGRAMMES.map(([k, t]) => `<option value="${k}" ${k === d.programme ? 'selected' : ''}>${esc(t)}</option>`).join('')}</select><select name="studyYear" data-study="year" data-keep="${esc(d.studyYear)}" aria-label="Year of study"></select><select name="semester" data-study="sem" data-keep="${esc(d.semester)}" aria-label="Semester"></select></div><p class="desc study-note" hidden></p></div>`,
    skills: (d, e) => `${fld('Experience so far', `<select name="experience" required aria-describedby="experience-e"><option value="">Choose one</option>${opt(EXP, d.experience)}</select>`, e.experience, 'experience')}
<div class="su-skills ${e.skills ? 'bad' : ''}"><p class="su-label" id="sk-l">Your skills <small>pick a level for each one</small></p><div class="chips" id="chips" aria-live="polite"></div>
<input id="skillin" placeholder="Type a skill and press Enter" maxlength="30" autocomplete="off" aria-labelledby="sk-l" aria-describedby="skills-e">${e.skills ? `<small class="su-err" id="skills-e">${esc(e.skills)}</small>` : ''}
<div class="su-quick" role="group" aria-label="Quick add"><span>Quick add:</span>${QUICK_SKILLS.filter(s => !d.skills.includes(s)).map(s => `<button type="button" class="chip-q" data-act="su-skill" data-id="${esc(s)}">+ ${esc(s)}</button>`).join('')}</div></div>`,
    goals: d => `<div class="su-fld"><span>What are you looking for?</span><div class="checks su-checks" role="group" aria-label="Looking for">${JT.map(t => `<label><input type="checkbox" name="jobTypes" value="${esc(t)}" ${d.jobTypes.includes(t) ? 'checked' : ''}> ${esc(t)}</label>`).join('')}</div><small class="su-hint">Pick any that apply. You can skip this and still see everything.</small></div>
${fld('Where would you work or study?', `<input name="locations" value="${esc(d.locations)}" placeholder="e.g. Bengaluru, Remote" maxlength="150" autocomplete="off">`, '', 'locations')}<small class="su-hint">Cities separated by commas. Leave it empty to see listings from everywhere.</small>`,
    intro: d => `<div class="su-photo photo-row" id="photo"></div>
${fld('Headline', `<input name="headline" value="${esc(d.headline)}" placeholder="e.g. Final-year CS student" maxlength="100" autocomplete="off">`, '', 'headline')}
${fld('About you', `<textarea name="summary" rows="4" maxlength="500" placeholder="A few lines about you, your projects or what you want to do">${esc(d.summary)}</textarea>`, '', 'summary')}`
};

// The whole setup page for one step. d = the draft, step = 0..3, errs = { field: message } from the last Continue.
export function setupHtml(d, step, errs = {}) {
    const s = STEPS[step];
    const last = step === STEPS.length - 1;
    return `<div class="container page"><section class="su" aria-labelledby="su-h">
<header class="su-head"><p class="su-kick">Welcome to Fyndr</p><h2 id="su-h">Let’s set up your profile</h2><p class="desc">Four short steps, about two minutes. You can change all of it later.</p></header>
<div class="su-prog"><ol class="su-steps" aria-label="Setup steps">${STEPS.map((x, i) => `<li class="${i < step ? 'done' : i === step ? 'on' : ''}" ${i === step ? 'aria-current="step"' : ''}><b>${i < step ? '✓' : i + 1}</b><span>${esc(x.title)}</span></li>`).join('')}</ol>
<div class="bar" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${stepPercent(step)}" aria-label="Setup progress"><i style="width:${stepPercent(step)}%"></i></div>
<p class="su-meta"><span>Step ${step + 1} of ${STEPS.length}</span><span>Profile ${previewCompletion(d)}% complete</span></p></div>
<form class="su-card form" data-form="sustep" novalidate><h3 id="su-t" tabindex="-1">${esc(s.lead)}</h3><p class="desc">${esc(s.why)}</p>
${BODY[s.id](d, errs)}
<p class="err" role="alert" aria-live="assertive">${Object.keys(errs).length ? 'Please fix the highlighted ' + (Object.keys(errs).length > 1 ? 'fields' : 'field') + ' to continue.' : ''}</p>
<div class="su-nav">${step ? '<button type="button" class="button" data-act="su-back">Back</button>' : '<span></span>'}<button class="button button-dark">${last ? 'Finish and see my profile' : 'Continue'}</button></div></form>
</section></div>`;
}

// ---------- the progress card at the top of the profile page ----------
// d = GET /profile ({ profile, resume, photo, phone, completion }), welcome = just finished setup.
export function profileHead(d, welcome = false) {
    const ctx = { phone: !!d.phone, resume: !!d.resume, photo: !!d.photo, profile: d.profile || {} };
    const left = pending(ctx);
    const pct = d.completion ?? 0;
    const list = left.length ? `<ul class="su-todo">${nextSteps(ctx).map(x => `<li class="${x.done ? 'done' : ''}"><span class="su-tick" aria-hidden="true">${x.done ? '✓' : ''}</span><div><b>${esc(x.title)}</b>${x.done ? '' : `<small>${esc(x.why)}</small>`}</div>${x.done ? '<em>Done</em>' : x.href ? `<a class="button button-small" href="${x.href}">Do it</a>` : `<button type="button" class="button button-small" data-act="pf-goto" data-id="${x.go}">Do it</button>`}</li>`).join('')}</ul>` : '<p class="su-done">Everything here is done. Nice work.</p>';
    return `<section class="su-card pf-head2" aria-labelledby="pfh">${welcome ? `<div class="su-welcome" role="status"><b>You’re all set.</b> Your profile is saved and we are already matching listings to it.</div>` : ''}
<div class="pf-top"><div><h2 id="pfh">Your profile</h2><p class="desc">Profile ${pct}% complete${left.length ? ` · ${left.length} thing${left.length > 1 ? 's' : ''} left to do` : ''}</p></div><a class="button button-dark" href="#/jobs">See jobs for you</a></div>
<div class="bar" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${pct}" aria-label="Profile completeness"><i style="width:${pct}%"></i></div>${list}</section>`;
}

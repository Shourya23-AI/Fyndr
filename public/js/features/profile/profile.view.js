import { S } from '../../core/state.js';
import { $, esc } from '../../core/dom.js';
import { api } from '../../core/api.js';
import { skeleton } from '../../core/skeleton.js';
import { QUAL, EXP, JT, LEVELS } from './constants.js';
import { recalledStudy, fillStudy, PROGRAMMES } from '../suggestions/study.js';
// #/profile: education, skills chips, job types, resume.
const lvOpts = v => LEVELS.map((t, i) => `<option value="${i + 1}" ${(+v || 3) === i + 1 ? 'selected' : ''}>${t}</option>`).join('');
export const chips = () => {
    const c = $('#chips');
    if (c) {
        c.innerHTML = S.skills.map((s, i) => `<span class="chip-s">${esc(s)}<select data-skl="${i}" aria-label="Level for ${esc(s)}">${lvOpts(S.skillLv[s])}</select><button type="button" data-act="rmskill" data-id="${i}">×</button></span>`).join('');
    }
};
export const addSkill = s => {
    s = s.trim();
    if (s && !S.skills.includes(s) && S.skills.length < 30) {
        S.skills.push(s);
        S.skillLv[s] = S.skillLv[s] || 3;
    }
    chips();
};
export const photoUI = ph => {
    const e = $('#photo');
    if (e) {
        e.innerHTML = `${ph ? `<img class="av-lg" src="${ph}" alt="">` : `<span class="av-lg ph">${esc((S.me.name || '?')[0].toUpperCase())}</span>`}<div><p class="desc">Profile photo (shown on your profile button and resume)</p><input type="file" id="photoin" accept="image/png,image/jpeg,image/webp">${ph ? ' <button type="button" class="mini no" data-act="rmphoto">Remove</button>' : ''}</div>`;
    }
};
export const resumeUI = r => {
    const e = $('#resume');
    if (e) {
        e.innerHTML = r ? `<span class="pill approved">${esc(r.name)} · ${Math.round(r.size / 1024)} KB</span> <button type="button" class="mini no" data-act="rmresume">Remove</button>` : '';
    }
};
// Repeating blocks (work experience, extra education, languages). Inputs are plain named fields; the form handler reads them with FormData.getAll().
const fld = (n, ph, v, max) => `<input name="${n}" placeholder="${ph}" value="${esc(v)}" maxlength="${max}">`;
export const REP = {
    job: v => `<div class="rep"><button type="button" class="mini no rep-x" data-act="rmrep">Remove</button>${fld('job_role', 'Job title', v.role, 80)}${fld('job_org', 'Company / organization', v.org, 80)}${fld('job_place', 'Location', v.place, 60)}<div class="two">${fld('job_from', 'From (Mar 2024)', v.from, 20)}${fld('job_to', 'To (Present)', v.to, 20)}</div><textarea name="job_points" class="full" maxlength="600" placeholder="What you did here, one point per line">${esc(v.points)}</textarea></div>`,
    edu: v => `<div class="rep"><button type="button" class="mini no rep-x" data-act="rmrep">Remove</button>${fld('edu_degree', 'Degree / course', v.degree, 80)}${fld('edu_inst', 'Institution', v.institution, 100)}${fld('edu_place', 'Location', v.place, 60)}${fld('edu_year', 'Year (e.g. 2022)', v.year, 20)}<textarea name="edu_points" class="full" maxlength="400" placeholder="Highlights, one per line (optional)">${esc(v.points)}</textarea></div>`,
    lang: v => `<div class="rep rep-row"><button type="button" class="mini no rep-x" data-act="rmrep">Remove</button>${fld('lang_name', 'Language', v.name, 30)}<select name="lang_level">${lvOpts(v.level)}</select></div>`
};
const reps = (k, list) => (list || []).map(REP[k]).join('');
export async function profileView() {
    $('#app').innerHTML = skeleton('center');
    const d = await api('/profile');
    const p = d.profile;
    const onb = !S.me.onboarded;
    S.skills = [...(p.skills || [])];
    S.skillLv = { ...(p.skillLevels || {}) };
    const rf = p.reference || {};
    const st = { ...(recalledStudy() || {}), ...(p.programme ? { programme: p.programme, studyYear: p.studyYear, semester: p.semester } : {}) }; // saved profile wins over what sign-up remembered
    const opt = (arr, v) => arr.map(x => `<option ${x === v ? 'selected' : ''}>${x}</option>`).join('');
    $('#app').innerHTML = `<div class="container page"><div class="panel" style="max-width:720px;margin:auto"><h2>${onb ? 'Tell us about your education' : 'Your profile'}</h2>
<p class="desc">${onb ? 'This helps us match you with the right jobs and courses. You can change it anytime.' : `Profile ${d.completion}% complete`}</p><br>
<form class="form cols" data-form="profile">
<select name="qualification" required><option value="">Highest qualification</option>${opt(QUAL, p.qualification)}</select>
<input name="field" placeholder="Field of study" value="${esc(p.field)}" required>
<input name="institution" placeholder="Institution" value="${esc(p.institution)}" required>
<input name="gradYear" type="number" placeholder="Graduation year" value="${esc(p.gradYear)}" required>
<div class="full study-pick"><p class="desc">Where are you in your studies? Jobs and courses are suggested to match.</p><div class="study-sub" style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px"><select name="programme" data-study="programme"><option value="">UG or PG</option>${PROGRAMMES.map(([k, t]) => `<option value="${k}" ${k === st.programme ? 'selected' : ''}>${t}</option>`).join('')}</select><select name="studyYear" data-study="year" data-keep="${esc(st.studyYear || '')}"></select><select name="semester" data-study="sem" data-keep="${esc(st.semester || '')}"></select></div><p class="desc study-note" hidden></p></div>
<select name="experience" required><option value="">Experience level</option>${opt(EXP, p.experience)}</select>
<input name="locations" placeholder="Preferred locations (comma separated)" value="${esc(p.locations)}">
<div class="full photo-row" id="photo"></div>
<input name="headline" class="full" placeholder="Title shown under your name, e.g. Final-year CS student (optional)" value="${esc(p.headline)}" maxlength="100">
<textarea name="summary" class="full" placeholder="Short summary for your resume (optional)" maxlength="500">${esc(p.summary)}</textarea>
<textarea name="projects" class="full" placeholder="Projects, one per line (optional)" maxlength="800">${esc(p.projects)}</textarea>
<div class="full"><div class="chips" id="chips"></div><input id="skillin" placeholder="Skills — type and press Enter, then pick a level"></div>
<h3 class="full sec">Resume details <small>all optional: any part you leave empty is left off your resume</small></h3>
<input name="address" class="full" placeholder="Address on resume, e.g. Bengaluru, Karnataka" value="${esc(p.address)}" maxlength="150">
<input name="linkedin" placeholder="LinkedIn link" value="${esc(p.linkedin)}" maxlength="200">
<input name="twitter" placeholder="Twitter / X link" value="${esc(p.twitter)}" maxlength="200">
<input name="link" class="full" placeholder="GitHub / portfolio link" value="${esc(p.link)}" maxlength="200">
<input name="hobbies" class="full" placeholder="Hobbies, comma separated" value="${esc((p.hobbies || []).join(', '))}" maxlength="300">
<div class="full"><p class="desc">Work experience</p><div id="jobs">${reps('job', p.jobs)}</div><button type="button" class="button button-small" data-act="addrep" data-id="job">+ Add experience</button></div>
<div class="full"><p class="desc">More education (your highest qualification above is added automatically)</p><div id="edus">${reps('edu', p.education)}</div><button type="button" class="button button-small" data-act="addrep" data-id="edu">+ Add education</button></div>
<div class="full"><p class="desc">Languages</p><div id="langs">${reps('lang', p.languages)}</div><button type="button" class="button button-small" data-act="addrep" data-id="lang">+ Add language</button></div>
<div class="full"><p class="desc">Reference (optional)</p></div>
<input name="ref_name" placeholder="Reference name" value="${esc(rf.name)}" maxlength="60">
<input name="ref_role" placeholder="Designation / company" value="${esc(rf.role)}" maxlength="100">
<input name="ref_phone" placeholder="Reference phone" value="${esc(rf.phone)}" maxlength="30">
<input name="ref_email" type="email" placeholder="Reference email" value="${esc(rf.email)}" maxlength="80">
<h3 class="full sec">Preferences</h3>
<div class="full"><p class="desc">Looking for</p><div class="checks">${JT.map(t => `<label><input type="checkbox" name="jobTypes" value="${t}" ${p.jobTypes?.includes(t) ? 'checked' : ''}> ${t}</label>`).join('')}</div></div>
<div class="full"><p class="desc">Resume (PDF, max 2 MB, optional)</p><div id="resume"></div><input type="file" id="resumein" accept="application/pdf"></div>
<button class="button button-dark full">${onb ? 'Save and continue' : 'Save changes'}</button><p class="err full" id="err"></p></form></div></div>`;
    chips();
    resumeUI(d.resume);
    photoUI(d.photo);
    fillStudy($('form[data-form=profile]'));
}

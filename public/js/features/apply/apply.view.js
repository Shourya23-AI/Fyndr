import { S } from '../../core/state.js';
import { $, esc } from '../../core/dom.js';
import { api } from '../../core/api.js';
import { summarize } from '../listings/summary.js';
// Full apply page (#/apply/<listing id>) for jobs posted on Fyndr. Replaces the small popup.
const EXP = ['Student / Fresher', '0–1 years', '1–3 years', '3–5 years', '5+ years'];
export async function applyView() {
    const id = S.arg;
    const app = $('#app');
    app.innerHTML = '<div class="container page"><div class="sk"></div></div>';
    const [ls, d] = await Promise.all([api('/listings?type=Job,Internship,Course'), api('/profile')]);
    const l = ls.find(x => x.id === id);
    if (!l) {
        app.innerHTML = '<div class="container page"><div class="empty"><b>Listing not found</b><p>It may have been closed.</p><a class="button button-dark button-small" href="#/jobs">Back to listings</a></div></div>';
        return;
    }
    if (l.source === 'import') {
        location.hash = '#/jobs';
        return;
    }
    S.lmap[l.id] = l;
    S.apply = { id, resume: 'site', pending: null, has: !!d.resume, resName: d.resume?.name || '' };
    const p = d.profile || {};
    const edu = [p.qualification, p.field, p.institution].filter(Boolean).join(', ');
    const v = (n, val, extra = '') => `<label class="fld"><span class="desc">${n}</span>${val}</label>${extra}`;
    const sm = summarize(l);
    app.innerHTML = `<section class="container page apply-page"><a class="link" href="#/jobs">← Back</a>
<h1 style="margin:10px 0 4px">Apply: ${esc(l.title)}</h1><p class="desc">${esc(l.orgName)} · ${esc(l.location)}</p>
<form class="form apply-form" data-form="applyfull" id="applyform">
<div class="panel"><h3>About you</h3>
${v('Full name *', `<input name="fullName" required maxlength="80" value="${esc(d.name)}" autocomplete="name">`)}
${v('Email', `<input name="email" type="email" value="${esc(d.email)}" readonly>`)}
${v('Phone *', `<input name="phone" required maxlength="30" value="${esc(d.phone)}" autocomplete="tel">`)}
${v('Current city *', `<input name="city" required maxlength="80" autocomplete="address-level2" placeholder="e.g. Bengaluru">`)}</div>
<div class="panel"><h3>Background</h3>
${v('Education', `<input name="education" maxlength="200" value="${esc(edu)}">`)}
${v('Skills (comma separated)', `<input name="skills" maxlength="400" value="${esc((p.skills || []).join(', '))}">`)}
${v('Experience', `<select name="experience">${EXP.map(x => `<option ${x === p.experience ? 'selected' : ''}>${x}</option>`).join('')}</select>`)}
${v('LinkedIn link', '<input name="linkedin" type="url" maxlength="200" placeholder="https://linkedin.com/in/...">')}
${v('Portfolio or GitHub link', '<input name="portfolio" type="url" maxlength="200" placeholder="https://...">')}</div>
<div class="panel"><h3>Short cover note *</h3>
<textarea name="note" required maxlength="1500" rows="5" placeholder="Why are you a good fit for ${esc(l.title)}?"></textarea></div>
<div class="panel"><h3>Resume</h3>
<div id="ap-res"></div></div>
<p class="ap-consent">Your details and resume will be shared with <b>${esc(l.orgName)}</b> and Fyndr admins. <a href="#/privacy" target="_blank" rel="noopener">Privacy Policy</a></p>
<p class="err"></p><div class="ap-acts"><a class="button button-small" href="#/jobs">Cancel</a><button class="button button-dark">Submit application</button></div></form>
<div class="panel" style="margin-top:18px"><h3>About this role</h3><p>${esc(sm.overview)}</p></div></section>`;
    drawRes();
}
export function drawRes() {
    const a = S.apply;
    const box = $('#ap-res');
    if (!box || !a) {
        return;
    }
    box.innerHTML = `<button type="button" class="rs-opt ${a.resume === 'site' ? 'on' : ''}" data-act="aprs" data-id="site"><b>Fyndr website resume</b><span>Built from your profile details</span></button>
<button type="button" class="rs-opt ${a.resume === 'own' ? 'on' : ''}" data-act="aprs" data-id="own"><b>My own resume (PDF)</b><span>${a.pending ? esc(a.pending.name) : a.has ? esc(a.resName) : 'Upload a PDF (max 2 MB)'}</span></button>
${a.resume === 'own' ? '<label class="fld" style="margin-top:12px"><span class="desc">Choose a PDF</span><input type="file" id="apfile2" accept="application/pdf"></label>' : ''}`;
}

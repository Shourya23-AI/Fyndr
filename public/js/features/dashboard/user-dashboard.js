import { S } from '../../core/state.js';
import { esc, fmt, table, pill } from '../../core/dom.js';
import { api } from '../../core/api.js';
import { card } from '../browse/card.js';
import { buildResume, pdfUrl } from './resume.js';
import { privacyPanel } from '../privacy/privacy.view.js';
import { foryouTab } from '../suggestions/foryou.js';
import { lastVisit } from '../suggestions/suggest.js';
import { trackerTab, dueCount } from '../tracker/tracker.view.js';
// Candidate dashboard: left sidebar (Profile / Resume / Applications), read-only. Editing lives on #/profile.
const TABS = [['foryou', 'For you', 'M12 3l2.6 5.6 6.1.7-4.5 4.2 1.2 6L12 16.5 6.6 19.5l1.2-6L3.3 9.3l6.1-.7z'], ['profile', 'Profile', 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zm-8 9a8 8 0 0 1 16 0'], ['resume', 'Resume', 'M7 3h8l4 4v14H7zM14 3v5h5M10 13h6M10 17h6'], ['apps', 'Applications', 'M4 7h16v12H4zM9 7V4h6v3'], ['tracker', 'Tracker', 'M4 5h4v14H4zM10 5h4v9h-4zM16 5h4v5h-4z'], ['privacy', 'Privacy & data', 'M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6zM9 12l2 2 4-4']];
const row = (k, v) => `<div class="info-row"><span>${k}</span><b>${v || '<i class="na">Not added</i>'}</b></div>`;
const RT = { site: 'Website resume', own: 'Uploaded resume' };
export const resumeLabel = t => RT[t] || RT.site;
// Resume details (only the parts the candidate filled in).
const more = p => {
    const rf = p.reference || {};
    const L = (p.languages || []).map(l => l.name).join(', ');
    const H = (p.hobbies || []).join(', ');
    const rows = [['Address', p.address], ['LinkedIn', p.linkedin], ['Twitter / X', p.twitter], ['Hobbies', H], ['Languages', L], ['Reference', [rf.name, rf.role].filter(Boolean).join(', ')]].filter(r => r[1]).map(r => row(r[0], esc(r[1]))).join('');
    const jobs = (p.jobs || []).map(j => `<div class="info-row"><span>${esc([j.from, j.to].filter(Boolean).join(' - '))}</span><b>${esc(j.role)}${j.org ? ' · ' + esc(j.org) : ''}</b></div>`).join('');
    return `${rows ? `<div class="panel"><h3>Resume details</h3>${rows}</div>` : ''}${jobs ? `<div class="panel"><h3>Work experience</h3>${jobs}</div>` : ''}`;
};
function profileTab(d, me) {
    const p = d.profile || {};
    return `<div class="dash-head"><h2>Profile</h2><p class="desc">Your details as employers see them.</p></div>
<div class="panel prof-top">${me.photo ? `<img class="av-lg" src="${me.photo}" alt="">` : `<span class="av-lg ph">${esc((me.name || '?')[0].toUpperCase())}</span>`}<div><h3 style="margin:0">${esc(me.name)}</h3><p class="desc">${esc(p.headline || me.email)}</p><div class="bar" style="width:220px;margin-top:10px"><i style="width:${S.me.completion}%"></i></div><p class="desc" style="margin-top:4px">${S.me.completion}% complete</p></div></div>
<div class="dash-grid"><div class="panel"><h3>Account</h3>${row('Name', esc(me.name))}${row('Email', esc(me.email))}${row('Phone', d.phone ? esc(S.me.phoneMasked) + ' <span class="tag tag-verified">Verified</span>' : '')}${row('Member since', fmt(d.joined || S.me.created))}${row('Document check', S.me.proofStatus ? pill(S.me.proofStatus) : '')}</div>
<div class="panel"><h3>Education</h3>${row('Qualification', esc(p.qualification))}${row('Field', esc(p.field))}${row('Institution', esc(p.institution))}${row('Graduation', esc(p.gradYear))}${row('Experience', esc(p.experience))}</div>
<div class="panel"><h3>Skills</h3>${(p.skills || []).length ? `<div class="chips">${p.skills.map(s => `<span class="chip-s">${esc(s)}</span>`).join('')}</div>` : '<p class="desc">No skills added.</p>'}</div>
<div class="panel"><h3>Preferences</h3>${row('Looking for', esc((p.jobTypes || []).join(', ')))}${row('Locations', esc(p.locations))}${row('Link', esc(p.link))}${row('Resume file', d.resume ? esc(d.resume.name) : '')}</div>
${more(p)}
${p.summary || p.projects ? `<div class="panel wide"><h3>About &amp; projects</h3>${p.summary ? `<p>${esc(p.summary)}</p>` : ''}${p.projects ? `<p class="desc" style="white-space:pre-line;margin-top:10px">${esc(p.projects)}</p>` : ''}</div>` : ''}</div>`;
}
function resumeTab(d, me) {
    const sel = S.rsel === 'own' && d.resume ? 'own' : 'site';
    return `<div class="dash-head"><h2>Resume</h2><p class="desc">Built automatically from your profile. Choose which one to preview.</p></div>
<div class="resume-split"><div class="resume-side"><button class="rs-opt ${sel === 'site' ? 'on' : ''}" data-act="rsel" data-id="site"><b>Website resume</b><span>Generated from your profile</span></button>
<button class="rs-opt ${sel === 'own' ? 'on' : ''}" data-act="rsel" data-id="own" ${d.resume ? '' : 'disabled'}><b>My uploaded resume</b><span>${d.resume ? esc(d.resume.name) : 'None uploaded yet'}</span></button>
<button class="button button-dark button-small" data-act="printresume">Download / print PDF</button><p class="desc" style="margin-top:12px">You pick one of these each time you apply.</p></div>
<div class="resume-view panel" id="resview">${sel === 'site' ? buildResume({
        ...d, ...me, profile: d.profile
    }) : '<p class="desc">Loading…</p>'}</div></div>`;
}
function appsTab(saved) {
    const ap = S.mine.applications;
    const iv = ap.filter(x => ['interview', 'accepted'].includes(x.status));
    const rowsOf = (l, w) => l.map(x => `<tr><td>${esc(x.listing?.title)}</td><td>${esc(x.listing?.orgName)}</td><td>${fmt(x.created)}</td><td>${resumeLabel(x.resumeType)}</td><td>${pill(x.status)}</td>${w ? `<td><button class="mini no" data-act="withdraw" data-id="${x.id}">Withdraw</button></td>` : ''}</tr>`);
    return `<div class="dash-head"><h2>Applications</h2><p class="desc">${ap.length} applied · ${iv.length} qualified for interview</p></div>
<div class="stats3"><div class="stat"><b>${ap.length}</b><span>Applied</span></div><div class="stat"><b>${ap.filter(x => x.status === 'reviewing').length}</b><span>In review</span></div><div class="stat"><b>${iv.length}</b><span>Interview / selected</span></div></div>
<div class="panel"><h3>Qualified for interview</h3>${table(['Role', 'Company', 'Applied', 'Resume used', 'Status'], rowsOf(iv))}</div>
<div class="panel"><h3>All applications</h3>${table(['Role', 'Company', 'Applied', 'Resume used', 'Status', ''], rowsOf(ap, true))}</div>
<h3 style="margin:24px 0 14px">Saved</h3><div class="opportunity-grid">${saved.map(l => card(l)).join('') || '<p style="color:var(--muted)">No saved listings.</p>'}</div>`;
}
// Privacy & data: what was shared with whom, and the download / delete controls.
function privacyTab(d) {
    const ap = S.mine.applications;
    return `<div class="dash-head"><h2>Privacy &amp; data</h2><p class="desc">You decide what is shared and for how long.</p></div>
<div class="panel"><h3>Shared with organizations</h3>${table(['Organization', 'Role', 'Shared on', 'What was shared', ''], ap.map(x => `<tr><td>${esc(x.listing?.orgName)}</td><td>${esc(x.listing?.title)}</td><td>${fmt(x.consentAt || x.created)}</td><td>${resumeLabel(x.resumeType)}</td><td><button class="mini no" data-act="withdraw" data-id="${x.id}">Withdraw</button></td></tr>`))}<p class="desc" style="margin-top:10px">Withdrawing removes the application and the copy of your resume that organization received.</p></div>
${privacyPanel(S.me, !!d.resume)}`;
}
export async function userDashboard(a) {
    const [mine, d, ls] = await Promise.all([api('/my'), api('/profile'), api('/listings')]);
    S.mine = mine;
    S.dtab = S.dtab || 'foryou';
    const me = {
        name: d.name || S.me.name, email: d.email || S.me.email, phone: d.phone, photo: d.photo
    };
    const body = {
        foryou: () => foryouTab(d, ls, { lastSeen: lastVisit(S.me.id || S.me.email) }), profile: () => profileTab(d, me), resume: () => resumeTab(d, me), apps: () => appsTab(ls.filter(l => S.mine.saved.includes(l.id))), tracker: () => trackerTab(ls.filter(l => S.mine.saved.includes(l.id))), privacy: () => privacyTab(d)
    }[S.dtab]();
    a.innerHTML = `<div class="dash-layout"><aside class="dash-side"><nav>${TABS.map(([id, t, ic]) => `<button class="side-btn ${S.dtab === id ? 'on' : ''}" data-act="dtab" data-id="${id}"><svg viewBox="0 0 24 24"><path d="${ic}"/></svg>${t}${id === 'tracker' && dueCount() ? `<b class="tk-badge" title="Follow-ups due">${dueCount()}</b>` : ''}</button>`).join('')}</nav><a class="side-link" href="#/profile">Manage profile ↗</a></aside><main class="dash-main">${body}</main></div>`;
    S.dd = { d, me };
    if (S.dtab === 'resume' && S.rsel === 'own' && d.resume) {
        showOwn();
    }
}
export async function showOwn() {
    const el = document.getElementById('resview');
    if (!el) {
        return;
    }
    try {
        const r = await api('/resume/file');
        el.innerHTML = `<iframe class="pdf-frame" src="${await pdfUrl(r.data)}" title="Uploaded resume"></iframe>`;
    } catch (x) {
        el.innerHTML = '<p class="desc">Could not load your uploaded resume. Re-upload it from Manage profile.</p>';
    }
}

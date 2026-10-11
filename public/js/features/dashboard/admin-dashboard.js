import { S } from '../../core/state.js';
import { esc, fmt, table, pill } from '../../core/dom.js';
import { api } from '../../core/api.js';
import { RETENTION } from '../privacy/retention.js';
import { trustScore, TRUST_MIN } from '../trust/trust.js';
import { aggregate, weeklyReport } from '../insights/insights.js';
// Admin dashboard (sidebar like the candidate one): Overview · Organizations · Listings · Verification · Candidates.
// Data comes from GET /admin/data. Org size + Gmail-posting controls are <select>s handled by onChange in dashboard.actions.js.
const TABS = [['overview', 'Overview', 'M4 13h6V4H4zM14 20h6V4h-6zM4 20h6v-3H4z'], ['orgs', 'Organizations', 'M4 21V7l8-4 8 4v14M9 21v-6h6v6'], ['listings', 'Listings', 'M4 7h16v12H4zM9 7V4h6v3'], ['verify', 'Verification', 'M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6zM9 12l2 2 4-4'], ['people', 'Candidates', 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zm-8 9a8 8 0 0 1 16 0'], ['insights', 'Insights', 'M4 20V10M10 20V4M16 20v-7M22 20H2'], ['team', 'Team', 'M9 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM3 20a6 6 0 0 1 12 0M16 11a2.5 2.5 0 1 0 0-5M17 14.5a5 5 0 0 1 4 5.5']];
const isAdmin = () => S.me?.role === 'admin'; // moderators see everything they can act on, nothing more
const SIZE = { small: 'Small business', enterprise: 'Enterprise' };
const head = (t, d) => `<div class="dash-head"><h2>${t}</h2><p class="desc">${d}</p></div>`;
const url = u => /^https?:\/\//i.test(u || '') ? `<br><a class="link" href="${esc(u)}" target="_blank" rel="noopener noreferrer">${esc(u.replace(/^https?:\/\//i, ''))}</a>` : '';
const sel = (attr, id, cur, opts) => `<select ${attr}="${id}">${opts.map(([v, t]) => `<option value="${v}" ${v === cur ? 'selected' : ''}>${t}</option>`).join('')}</select>`;
const lstActs = l => `<button class="mini ok" data-act="lstat" data-id="${l.id}" data-s="approved">Approve</button> <button class="mini no" data-act="lstat" data-id="${l.id}" data-s="rejected">Reject</button> <button class="mini" data-act="dellist" data-id="${l.id}">Delete</button>`;
const trustTag = l => {
    const t = l.trust != null ? { score: l.trust, reasons: l.trustReasons || [] } : trustScore(l);
    return `<span class="tag ${t.score >= TRUST_MIN ? 'tag-verified' : 'tag-warn'}" title="Trust score. ${TRUST_MIN} or more is published automatically.">Trust ${t.score}</span>${l.source === 'import' ? ' <span class="tag">Imported</span>' : ''}${t.reasons.length ? `<br><span class="desc">${esc(t.reasons.join(' · '))}</span>` : ''}${l.applyUrl ? `<br><a class="link" href="${esc(l.applyUrl)}" target="_blank" rel="noopener noreferrer nofollow">Open apply link</a>` : ''}`;
};
const lstRow = l => `<tr><td>${l.image && l.image.startsWith('data:image/') ? `<img class="thumb" src="${l.image}" alt="">` : ''}<b>${esc(l.title)}</b><br><span class="desc">${esc([l.duration, l.location, l.pay].filter(Boolean).join(' · '))}</span>${l.description ? `<br><span class="desc">${esc(l.description.slice(0, 160))}${l.description.length > 160 ? '…' : ''}</span>` : ''}<br>${trustTag(l)}</td><td>${esc(l.orgName)}</td><td>${l.type}</td><td>${pill(l.status)}</td><td>${lstActs(l)}</td></tr>`;
function overview(d) {
    const s = d.stats;
    const pend = d.listings.filter(l => l.status === 'pending');
    const free = d.orgs.filter(o => o.free);
    const tile = (n, l) => `<div class="stat"><b>${n}</b><span>${l}</span></div>`;
    const todo = (n, t, tab) => n ? `<div class="todo"><span><b>${n}</b> ${t}</span><button class="button button-small" data-act="atab" data-id="${tab}">Review</button></div>` : '';
    const items = todo(s.pendingListings, 'listing(s) waiting for approval', 'listings') + todo(s.pendingVerifications, 'verification document(s) to review', 'verify') + todo(free.length, `organization(s) use a Gmail-type email (${free.filter(o => o.gmailAllowed).length} can post)`, 'orgs');
    return head('Overview', 'What needs your attention right now.') + `<div class="stats3">${tile(s.candidates, 'Candidates') + tile(s.organizations, 'Organizations') + tile(s.listings, 'Listings') + tile(s.pendingListings, 'Listings pending') + tile(s.pendingVerifications, 'Verifications pending') + tile(s.applications, 'Applications')}</div>
<div class="panel"><h3>Needs attention</h3>${items || '<p class="desc">All caught up.</p>'}</div>
${isAdmin() ? `<div class="panel"><h3>Data retention</h3><p class="desc">Applications (and the resume copies shared with organizations) are deleted ${RETENTION.closedListingDays} days after a listing is closed, and ${RETENTION.maxApplicationDays} days after the candidate applied. This runs when an admin opens this dashboard (at most once an hour)${d.cleaned ? `: <b>${d.cleaned}</b> removed just now` : ''}.</p><button class="button button-small" style="margin-top:12px" data-act="cleanup">Run cleanup now</button></div>` : ''}
<div class="panel"><h3>Waiting for approval</h3>${table(['Title', 'Org', 'Type', 'Status', 'Actions'], pend.slice(0, 5).map(lstRow))}${pend.length > 5 ? `<p class="desc" style="margin-top:10px">${pend.length - 5} more in Listings.</p>` : ''}</div>`;
}
function orgs(d) {
    const rows = d.orgs.map(o => {
        const ver = o.verified ? pill('verified') : o.proofStatus ? pill(o.proofStatus) : '<span class="pill">No proof</span>';
        const gm = o.free ? `${isAdmin() ? sel('data-orggm', o.id, o.gmailOk === true ? 'allow' : o.gmailOk === false ? 'block' : 'default', [['default', `Default (${o.orgType === 'small' ? 'allow' : 'block'})`], ['allow', 'Allow'], ['block', 'Block']]) + '<br>' : ''}${o.gmailAllowed ? '<span class="tag tag-verified">Can post</span>' : '<span class="tag tag-warn">Cannot post</span>'}` : '<span class="desc">Not needed</span>';
        return `<tr><td><b>${esc(o.orgName)}</b><br><span class="desc">${esc(o.email || '—')}</span>${url(o.website)}</td><td>${isAdmin() && !o.remote ? sel('data-orgtype', o.id, o.orgType, Object.entries(SIZE)) : SIZE[o.orgType]}</td><td>${o.free ? '<span class="tag tag-warn">Gmail / free</span>' : '<span class="tag tag-verified">Work email</span>'}</td><td>${gm}</td><td>${ver}</td><td>${o.listings}</td><td><button class="mini ok" data-act="verify" data-id="${o.id}" data-s="${o.verified ? '' : '1'}">${o.verified ? 'Unverify' : 'Verify'}</button> ${isAdmin() && !o.remote ? `<button class="mini no" data-act="deluser" data-id="${o.id}">Delete</button>` : ''}</td></tr>`;
    });
    return head('Organizations', 'Small businesses may post with Gmail by default; enterprises may not. Override per organization below.') + `<div class="panel">${table(['Organization', 'Size', 'Email', 'Gmail posting', 'Verification', 'Listings', ''], rows)}</div>`;
}
function listings(d) {
    const f = S.afilt || 'all';
    const cnt = s => s === 'all' ? d.listings.length : d.listings.filter(l => l.status === s).length;
    const chips = ['all', 'pending', 'approved', 'rejected', 'closed'].map(s => `<button class="chip-f ${f === s ? 'on' : ''}" data-act="afilt" data-id="${s}">${s[0].toUpperCase() + s.slice(1)} (${cnt(s)})</button>`).join('');
    const imp = `<div class="panel"><h3>Import jobs and courses</h3><p class="desc">Run <b>node scripts/import-jobs.js</b> on your computer, then choose the file it makes (<b>imports/jobs.json</b>). Listings with trust 50 or more are published; the rest wait below for you; obvious scams are skipped.</p><input type="file" id="impfile" accept="application/json,.json" aria-label="Import file"><p class="desc" id="impout">${esc(S.impResult || '')}</p></div>`;
    return head('Listings', 'Approve or reject what organizations post. Anything with a trust score under 50 needs a person to check it.') + imp + `<div class="chip-row">${chips}</div><div class="panel">${table(['Title', 'Org', 'Type', 'Status', 'Actions'], d.listings.filter(l => f === 'all' || l.status === f).map(lstRow))}</div>`;
}
function insights(d, x) {
    const a30 = aggregate(x.analytics, x.listings, x.applicationDates.filter(c => String(c) >= new Date(Date.now() - 30 * 864e5).toISOString()).length, 30);
    const a7 = aggregate(x.analytics, x.listings, x.applicationDates.filter(c => String(c) >= new Date(Date.now() - 7 * 864e5).toISOString()).length, 7);
    const t = a30.totals;
    const tile = (n, l) => `<div class="stat"><b>${n}</b><span>${l}</span></div>`;
    const drop = (a, b, l) => `<tr><td>${l}</td><td>${a}</td><td>${b ? Math.round(100 * a / b) + '%' : '—'}</td></tr>`;
    return head('Insights', 'Daily totals from visitors who said yes to usage counts. No names, no listing ids. Last 30 days.') + `<div class="stats3">${tile(t.views, 'Listing views') + tile(t.searches, 'Searches') + tile(t.emptySearches, 'Searches with no result') + tile(t.saves, 'Saves') + tile(t.applyClicks, 'Apply clicks') + tile(a30.applications, 'Applications on Fyndr')}</div>
<div class="panel"><h3>Where people drop off</h3>${table(['Step', 'Count', 'Of the step before'], [drop(t.views, 0, 'Viewed a listing'), drop(t.applyClicks, t.views, 'Clicked Apply'), drop(a30.applications, t.applyClicks, 'Applied on Fyndr (Fyndr jobs only)')])}</div>
<div class="panel"><h3>Searches that found nothing</h3>${table(['Search words', 'Times'], a30.topEmpty.map(([k, v]) => `<tr><td>${esc(k)}</td><td>${v}</td></tr>`))}</div>
<div class="panel"><h3>Skills: demand and supply</h3><p class="desc">Views are how often listings mentioning the skill were opened. Listings is how many open listings mention it.</p>${table(['Skill', 'Views', 'Listings', 'Read'], [...a30.shortage.map(s => `<tr><td>${esc(s.skill)}</td><td>${s.views}</td><td>${s.listings}</td><td><span class="tag tag-warn">Needs more listings</span></td></tr>`), ...a30.surplus.map(s => `<tr><td>${esc(s.skill)}</td><td>${s.views}</td><td>${s.listings}</td><td><span class="tag">Plenty of listings</span></td></tr>`)])}</div>
<div class="panel"><h3>Weekly report</h3><p class="desc">Written from the totals above only. Copy it into an email to yourself.</p><div class="ins-report" id="weekrep">${esc(weeklyReport(a7))}</div><button class="button button-small" style="margin-top:12px" data-act="copyrep">Copy</button></div>`;
}
function verify(d) {
    const CK = {
        https: 'HTTPS site', workEmail: 'Work email', emailMatchesSite: 'Email matches site', nameInSite: 'Name in site'
    };
    return head('Verification', 'Check each organization or candidate document, then approve or reject.') + `<div class="panel">${table(['Who', 'Type', 'Checks', 'Proof', 'Status', ''], d.proofs.map(x => `<tr><td>${esc(x.name)}<br><span class="desc">${esc(x.email)}</span></td><td>${x.role}</td><td>${x.signals ? Object.entries(CK).map(([k, t]) => `<span class="tag ${x.signals[k] ? 'tag-verified' : 'tag-warn'}">${t}</span>`).join(' ') : '—'}${x.portal ? `<br><a class="link" href="${esc(x.portal)}" target="_blank" rel="noopener noreferrer">Careers page</a>` : ''}</td><td><button class="mini" data-act="viewproof" data-id="${x.id}">View</button></td><td>${pill(x.status)}</td><td><button class="mini ok" data-act="pstat" data-id="${x.id}" data-s="verified">Approve</button> <button class="mini no" data-act="pstat" data-id="${x.id}" data-s="rejected">Reject</button></td></tr>`))}</div>`;
}
function people(d) {
    return head('Candidates', `${d.candidates.length} registered`) + `<div class="panel">${table(['Name', 'Email', 'Phone', 'Profile', 'Applications', 'Joined', ''], d.candidates.map(u => `<tr><td>${esc(u.name)}</td><td>${esc(u.email)}</td><td>${u.phoneVerified ? '<span class="tag tag-verified">Verified</span>' : '<span class="desc">—</span>'}</td><td>${u.completion}%</td><td>${u.applications}</td><td>${fmt(u.created)}</td><td>${isAdmin() && !u.remote ? `<button class="mini no" data-act="deluser" data-id="${u.id}">Delete</button>` : ''}</td></tr>`))}</div>`;
}
// Team: every account with a role selector. The main admin is permanent (no selector, cannot be changed or deleted).
const ROLE_LABEL = { admin: 'Admin', moderator: 'Moderator' };
function team(d) {
    if (d.teamError) {
        // Browser-only / GitHub Pages mode: roles live in the shared Firebase database, which needs one-time setup.
        return head('Team', 'The shared team database is not ready yet.') + `<div class="panel"><h3>One-time setup needed</h3><p class="err">${esc(d.teamError)}</p><ol class="desc"><li>Open <b>Firebase Console</b> for your project, then <b>Build &gt; Firestore Database</b> and click <b>Create database</b> (production mode).</li><li>Open the <b>Rules</b> tab, paste the contents of <b>firestore.rules</b> from the Fyndr folder, and click <b>Publish</b>.</li><li>Reload this page.</li></ol></div>`;
    }
    if (!Array.isArray(d.team)) {
        return head('Team', 'Team roles are not available here.') + '<div class="panel"><h3>Team data is unavailable</h3><p class="desc">Reload the page. If this keeps happening, make sure you are signed in as an admin and that the site files are the latest version.</p></div>';
    }
    d.invites = d.invites || [];
    const q = (S.tq || '').toLowerCase();
    const staff = d.team.filter(t => t.staff);
    const list = d.team.filter(t => !q || (t.name + ' ' + t.email).toLowerCase().includes(q));
    const row = t => {
        const who = `<b>${esc(t.name)}</b>${t.id === S.me.id ? ' <span class="tag">You</span>' : ''}<br><span class="desc">${esc(t.email)}</span>`;
        let role;
        if (t.permanent) {
            role = '<span class="tag tag-verified perm" title="Built in. Cannot be changed or removed.">★ Permanent admin</span>';
        } else if (t.id === S.me.id) {
            role = `<span class="tag">${ROLE_LABEL[t.staff] || 'Member'}</span>`;
        } else {
            role = sel('data-staff', t.id, t.staff || 'none', [['none', 'Member'], ['moderator', 'Moderator'], ['admin', 'Admin']]).replace('<select', `<select data-email="${esc(t.email)}"`);
        }
        return `<tr><td>${who}</td><td>${t.kind}</td><td>${role}</td><td>${fmt(t.created)}</td></tr>`;
    };
    return head('Team', 'Choose who can moderate or administer Fyndr. Moderators can approve listings and verifications. Admins can do everything, including managing this team.') + `<div class="panel"><h3>Current team <span class="desc">(${staff.length})</span></h3><div class="team-chips">${staff.map(t => `<span class="team-chip ${t.permanent ? 'perm' : ''}"><b>${esc(t.name)}</b> ${t.permanent ? '★ Permanent admin' : ROLE_LABEL[t.staff]}</span>`).join('')}</div></div>
<div class="panel"><h3>Add by email</h3><p class="desc">Give a role to anyone, even before they have an account. It applies automatically when they sign up and confirm their email.</p><form class="form invite-form" data-form="invite"><input type="email" name="email" placeholder="name@example.com" required aria-label="Email"><select name="role" aria-label="Role"><option value="admin">Admin</option><option value="moderator">Moderator</option></select><button class="button button-dark">Add</button><p class="err"></p></form>${d.invites.length ? `<div class="team-chips" style="margin-top:12px">${d.invites.map(i => `<span class="team-chip">${esc(i.email)} · ${ROLE_LABEL[i.role]} (waiting for sign-up) <button class="mini no" data-act="revokeinvite" data-id="${esc(i.email)}">Cancel</button></span>`).join('')}</div>` : ''}</div>
<div class="panel"><h3>All accounts</h3><div class="form" style="margin-bottom:12px"><input type="search" id="tq" placeholder="Search name or email" value="${esc(S.tq || '')}" aria-label="Search accounts"></div>${table(['Account', 'Type', 'Role', 'Joined'], list.map(row))}<p class="desc" style="margin-top:10px">People must have signed up and confirmed their email first. A role takes effect the next time they open Fyndr.</p></div>`;
}
const BUILD = () => document.querySelector('meta[name=fyndr-build]')?.content || 'dev';
// If a tab fails to draw, say why on the page itself (with the build id) instead of silently doing nothing.
export async function adminDashboard(a) {
    try {
        await drawAdmin(a);
    } catch (x) {
        console.error('Admin dashboard failed', x);
        a.innerHTML = `<div class="container sk-page"><div class="panel"><h3>The ${esc(S.atab || 'overview')} tab could not be shown</h3><p class="err">${esc(x.message || String(x))}</p><p class="desc">Build ${esc(BUILD())}. Please send this message to the developer.</p><button class="button" data-act="atab" data-id="overview">Back to overview</button></div></div>`;
    }
}
async function drawAdmin(a) {
    const d = await api('/admin/data');
    S.atab = S.atab || 'overview';
    const extra = S.atab === 'insights' ? await api('/admin/insights') : null;
    const badge = { listings: d.stats.pendingListings, verify: d.stats.pendingVerifications };
    const tabs = TABS.filter(t => t[0] !== 'team' || isAdmin());
    if (!tabs.some(t => t[0] === S.atab)) {
        S.atab = 'overview';
    }
    const body = {
        overview, orgs, listings, verify, people, team, insights
    }[S.atab](d, extra);
    const keep = document.activeElement?.id === 'tq'; // keep typing in the search box after a redraw
    a.innerHTML = `<div class="dash-layout"><aside class="dash-side"><nav>${tabs.map(([id, t, ic]) => `<button class="side-btn ${S.atab === id ? 'on' : ''}" data-act="atab" data-id="${id}"><svg viewBox="0 0 24 24"><path d="${ic}"/></svg>${t}${badge[id] ? `<span class="side-badge">${badge[id]}</span>` : ''}</button>`).join('')}</nav><span class="side-link">${S.me.permanent ? '★ Main admin (permanent)' : S.me.role === 'moderator' ? 'Signed in as moderator' : 'Signed in as admin'}</span><span class="side-link desc" style="font-size:11px">Build ${BUILD()}</span></aside><main class="dash-main">${body}</main></div>`;
    if (keep) {
        const el = document.getElementById('tq');
        el.focus();
        el.setSelectionRange(el.value.length, el.value.length);
    }
}

import { S } from '../../core/state.js';
import { esc, fmt, table, pill } from '../../core/dom.js';
import { api } from '../../core/api.js';
import { safeImg } from '../../core/image.js';
import { privacyPanel } from '../privacy/privacy.view.js';
// after the form is drawn, show the reused logo (if any)
const showLogo = () => {
    const v = document.getElementById('logo-val')?.value;
    const d = document.getElementById('logo-drop');
    if (v && d) {
        d.classList.add('has');
        d.insertAdjacentHTML('afterbegin', `<img src="${safeImg(v)}" alt="">`);
    }
};
// Organization dashboard: verification, phone, post a listing, my listings, applicants.
export async function orgDashboard(a) {
    const [ls, ap] = await Promise.all([api('/org/listings'), api('/org/applications')]);
    const lastLogo = (ls.find(l => l.logo) || {}).logo || ''; // the logo from your last listing is reused
    a.innerHTML = `<div class="container page"><h2>${esc(S.me.orgName)} dashboard <span class="tag" style="vertical-align:middle">${S.me.orgType === 'enterprise' ? 'Enterprise' : 'Small business'}</span></h2>${S.me.gmailBlocked ? `<div class="panel"><h3>Posting not enabled for this email</h3><p class="desc">${esc(S.me.email)} is a free email address, which is not enabled for ${S.me.orgType === 'enterprise' ? 'an enterprise' : 'your'} organization. Use a work email, or ask Fyndr admin to allow it.</p></div>` : ''}${S.me.verified ? '' : `<div class="panel"><h3>Verification</h3><p class="desc">${S.me.proofStatus === 'rejected' ? 'Your proof was not accepted.' : 'Your organization is awaiting review.'} You can post once it is verified.</p><a class="button button-dark button-small" style="margin-top:12px" href="#/proof">${S.me.proofStatus === 'pending' ? 'View submission' : 'Upload proof'}</a></div>`}<br>
<div class="panel"><h3>Phone</h3>${S.me.phoneVerified ? `<span class="tag tag-verified">✓ Phone verified</span> <span class="desc">${esc(S.me.phoneMasked)}</span>` : `<p class="desc">${{ user: 'Verify your phone to apply for opportunities.', org: 'Verify your phone to post opportunities.' }[S.me.role]}</p><a class="button button-dark button-small" style="margin-top:12px" href="#/phone">Verify phone</a>`}</div>
<div class="panel"><h3>Post an opportunity</h3>${S.me.phoneVerified ? '' : '<p class="desc">Posting unlocks after phone verification.</p>'}<form class="form cols" data-form="post" ${S.me.phoneVerified && S.me.verified && !S.me.gmailBlocked ? '' : 'inert style="opacity:.5"'}>
<div class="img-row full"><div class="img-pick"><b>Cover image <span style="color:var(--bad-fg)">*</span></b><label class="img-drop cover" id="cover-drop"><span>Tap to choose a picture</span><input type="file" id="cover-in" accept="image/png,image/jpeg,image/webp"></label><small>Shown at the top of your card. Wide pictures (16:9) look best: a banner, poster or course thumbnail.</small><input type="hidden" name="image" id="cover-val"></div>
<div class="img-pick"><b>Logo</b><label class="img-drop logo" id="logo-drop"><span>Add logo</span><input type="file" id="logo-in" accept="image/png,image/jpeg,image/webp"></label><small>Your organization's logo, shown on the card. Optional.</small><input type="hidden" name="logo" id="logo-val" value="${esc(lastLogo)}"></div></div>
<input name="title" placeholder="Title" required maxlength="120"><select name="type" id="post-type"><option>Job</option><option>Internship</option><option>Course</option></select>
<input name="location" placeholder="Location (or Online)" required maxlength="120"><input name="pay" placeholder="Pay / price" required maxlength="80">
<input class="full" name="duration" placeholder="Duration, e.g. 12 weeks or 6 months (optional)" maxlength="40"><textarea class="full" name="description" placeholder="Description" maxlength="4000"></textarea><p class="err full" id="post-err" style="margin:0"></p><button class="button button-dark full">Submit for review</button></form></div>
<div class="panel"><h3>My listings</h3>${table(['Title', 'Type', 'Status', 'Applicants', ''], ls.map(l => `<tr><td>${l.image ? `<img class="thumb" src="${safeImg(l.image)}" alt="">` : ''}${esc(l.title)}</td><td>${l.type}</td><td>${pill(l.status)}</td><td>${l.applicants}</td><td><button class="mini no" data-act="dellist" data-id="${l.id}">Delete</button></td></tr>`))}</div>
<div class="panel"><h3>Applicants</h3>${table(['Candidate', 'Email', 'For', 'Resume', 'Status'], ap.map(x => `<tr><td>${esc(x.name)}</td><td>${esc(x.email)}</td><td>${esc(x.title)}</td><td><button class="mini" data-act="oresume" data-id="${x.id}">${x.resumeType === 'own' ? 'Uploaded' : 'Website'} · View</button></td><td><select data-appid="${x.id}">${['applied', 'reviewing', 'interview', 'accepted', 'rejected'].map(s => `<option ${s === x.status ? 'selected' : ''}>${s}</option>`).join('')}</select></td></tr>`))}</div>
${privacyPanel(S.me, false)}</div>`;
    showLogo();
}

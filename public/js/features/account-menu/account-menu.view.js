import { S } from '../../core/state.js';
import { esc } from '../../core/dom.js';
import { api } from '../../core/api.js';
import { avatar } from '../layout/nav.js';
// The card that drops down when you click your name in the top bar: basic details + an edit button.
const ROLE = {
    user: 'Candidate', org: 'Organization', admin: 'Admin', moderator: 'Moderator'
};
const row = (k, v) => v ? `<div class="me-row"><span>${k}</span><b>${esc(v)}</b></div>` : '';
const head = m => `<div class="me-head">${avatar(m, true)}<div><strong>${esc(m.orgName || m.name)}</strong><span class="me-mail">${esc(m.email)}</span></div><span class="tag">${ROLE[m.role] || m.role}</span></div>`;
const phone = m => (m.role === 'admin' || m.role === 'moderator') ? '' : m.phoneVerified ? `<div class="me-row"><span>Phone</span><b>${esc(m.phoneMasked || 'Verified')} <span class="tag tag-verified">Verified</span></b></div>` : `<div class="me-row"><span>Phone</span><a class="tag tag-warn" href="#/phone">Verify phone</a></div>`;
const foot = edit => `<div class="me-foot">${edit}<button class="button button-dark me-logout" data-act="logout">Log out</button></div>`;
export const cardHtml = (m, p) => {
    if (m.role === 'user') {
        const sk = (p?.skills || []).slice(0, 6).map(s => `<span class="chip-s">${esc(s)}</span>`).join('') + ((p?.skills || []).length > 6 ? `<span class="chip-s">+${p.skills.length - 6}</span>` : '');
        return head(m) + `<div class="me-body">${phone(m)}${p ? row('Qualification', p.qualification) + row('Field', p.field) + row('Institution', p.institution) + row('Graduation', p.gradYear) + row('Experience', p.experience) + (sk ? `<div class="me-row"><span>Skills</span><div class="chips">${sk}</div></div>` : '') : '<p class="desc">Loading…</p>'}${m.completion != null ? `<div class="me-row"><span>Profile</span><b>${m.completion}% complete</b></div>` : ''}</div>` + foot('<a class="button button-small" href="#/dashboard" data-act="mecloseonly">Dashboard</a>');
    }
    if (m.role === 'org') {
        return head(m) + `<div class="me-body">${row('Contact name', m.name)}${phone(m)}${row('Verification', m.verified ? 'Verified' : m.proofStatus === 'pending' ? 'Under review' : 'Not submitted')}</div>` + foot('<a class="button button-dark button-small" href="#/dashboard" data-act="mecloseonly">Dashboard</a><a class="button button-small" href="#/proof" data-act="mecloseonly">Verification &amp; documents</a>');
    }
    return head(m) + `<div class="me-body">${row('Role', m.permanent ? 'Main administrator (permanent)' : m.role === 'moderator' ? 'Moderator' : 'Administrator')}</div>` + foot('<a class="button button-dark button-small" href="#/dashboard" data-act="mecloseonly">Admin dashboard</a>');
};
export async function openCard(btn) {
    const wrap = btn.closest('.me-wrap');
    const card = document.createElement('div');
    card.className = 'me-card';
    card.id = 'mecard';
    card.setAttribute('role', 'dialog');
    card.setAttribute('aria-label', 'Your details');
    card.innerHTML = cardHtml(S.me, null);
    wrap.append(card);
    btn.setAttribute('aria-expanded', 'true');
    if (S.me.role === 'user') {
        try {
            const d = await api('/profile');
            if (document.getElementById('mecard') === card) {
                card.innerHTML = cardHtml(S.me, d.profile);
            }
        } catch {
            card.innerHTML = cardHtml(S.me, {});
        }
    }
}
export function closeCard() {
    document.getElementById('mecard')?.remove();
    document.querySelector('[data-act=me]')?.setAttribute('aria-expanded', 'false');
}

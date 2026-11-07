import { S } from '../../core/state.js';
import { esc, toast } from '../../core/dom.js';
import { api } from '../../core/api.js';
import { openAuth } from '../auth/auth-modal.js';
import { REASONS, NOTE_MAX } from './report.rules.js';
import { isSearch } from '../listings/origin.js';
// "Report this listing" window: why it looks wrong + an optional note. Signed-in people only (a report is tied to a person so one person cannot report the same listing many times).
let el;
let onKey;
export function closeReport() {
    if (el) {
        el.remove();
        el = null;
        removeEventListener('keydown', onKey);
    }
}
export function openReport(id) {
    const l = S.lmap[id];
    if (!l) {
        return;
    }
    if (!S.me) {
        sessionStorage.next = location.hash || '#/';
        return openAuth('signin');
    }
    if (!['user', 'org'].includes(S.me.role)) {
        return toast('Staff review listings from the dashboard');
    }
    closeReport();
    const search = isSearch(l);
    el = document.createElement('div');
    el.className = 'ap-back rp-back';
    el.innerHTML = `<div class="ap-box rp-box" role="dialog" aria-modal="true" aria-labelledby="rp-t" tabindex="-1"><button class="dt-x" data-act="reportclose" aria-label="Close">×</button>
<h3 id="rp-t">${search ? 'Report a problem' : 'Report this listing'}</h3><p class="desc">${esc(l.title)}${l.orgName && !search ? ' · ' + esc(l.orgName) : ''}</p>
<form class="form" data-form="report"><input type="hidden" name="id" value="${esc(l.id)}">
<fieldset class="rp-reasons"><legend>What is wrong?</legend>${REASONS.map(([k, t], i) => `<label class="rp-r"><input type="radio" name="reason" value="${k}" ${i === 0 ? 'required' : ''}> <span>${esc(t)}</span></label>`).join('')}</fieldset>
<label class="fld"><span>Anything we should know? (optional)</span><textarea name="note" maxlength="${NOTE_MAX}" rows="3" placeholder="What did they ask you for? Which link?"></textarea></label>
<p class="desc">Never share an OTP or pay a fee to get a job. Our team reads every report. Please do not put your phone number or other personal details here.</p>
<div class="rp-acts"><button type="button" class="button" data-act="reportclose">Cancel</button><button class="button button-dark">Send report</button></div><p class="err"></p></form></div>`;
    el.addEventListener('click', e => {
        if (e.target === el) {
            closeReport();
        }
    });
    onKey = e => {
        if (e.key === 'Escape') {
            closeReport();
        }
    };
    addEventListener('keydown', onKey);
    document.body.append(el);
    el.querySelector('input[name=reason]').focus();
}
export const actions = {
    reportopen(b, id) {
        openReport(id);
    },
    reportclose() {
        closeReport();
    }
};
export const forms = {
    async report(d) {
        const l = S.lmap[d.id];
        if (!l) {
            throw new Error('Listing not found');
        }
        await api('/report/' + encodeURIComponent(d.id), 'POST', { reason: d.reason, note: d.note || '', title: l.title, orgName: l.orgName });
        closeReport();
        toast('Thank you. Our team will look at it.');
    }
};

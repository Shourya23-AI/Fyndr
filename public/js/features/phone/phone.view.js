import { S } from '../../core/state.js';
import { $, esc } from '../../core/dom.js';
import { skeleton } from '../../core/skeleton.js';
import { readPhoneTrail } from '../../services/phone-email/phone-email.js';

const ICON_PHONE = '<svg viewBox="0 0 24 24"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92z"/></svg>';
const ICON_CHECK = '<svg viewBox="0 0 24 24"><path d="m5 12.5 4.5 4.5L19 7.5"/></svg>';
const SPIN = '<span class="spinner" aria-hidden="true"></span>';

// One centred card (see css/pages/phone.css).
const card = (inner, icon = ICON_PHONE) => {
    $('#app').innerHTML = `
        <div class="phone-page">
            <div class="panel phone-card" role="status" aria-live="polite">
                <span class="phone-icon">${icon}</span>
                ${inner}
            </div>
        </div>`;
};

// Three visible steps so the person always knows where they are: 1 phone.email (number + code) -> 2 we confirm -> 3 done.
const OTP_STEPS = ['Your number', 'Enter the code', 'Done'];
const steps = (at, labels = ['Enter number and code', 'We confirm it', 'Done']) => `<ol class="phone-steps">${labels.map((t, i) => `<li class="${i < at ? 'done' : i === at ? 'now' : ''}"><i>${i < at ? '✓' : i + 1}</i>${t}</li>`).join('')}</ol>`;
const error = () => S.ph.error ? `<p class="err phone-err" id="err" role="alert">${esc(S.ph.error)}</p>` : '<p class="err" id="err"></p>';

// What happened during the last attempt (written by phone-email.js and phone-callback.js), for when it did not work.
const trail = () => {
    const t = readPhoneTrail();
    return t ? `<details class="ph-log"><summary>Technical details</summary><pre>${esc(t)}</pre><p>If you ask for help, send this text along. Site owner: in the phone.email dashboard the Domain URL and Redirect URL must be exactly ${esc(location.origin)} and ${esc(location.origin)}/phone-callback.html.</p></details>` : '';
};

// #/phone: one button opens phone.email (number + one-time code); our server then confirms the result.
export function phoneRender() {
    if (S.ph.done || S.me.phoneVerified) {
        return card(`
            <h3>Phone verified</h3>
            ${steps(3)}
            <p class="desc"><span class="tag tag-verified">✓ Phone verified</span> ${esc(S.me.phoneMasked || '')}</p>
            <div class="form"><a class="button button-dark" href="${S.me.role === 'user' ? '#/profile' : '#/dashboard'}">${S.me.role === 'user' ? 'Continue to your profile' : 'Continue'}</a></div>`, ICON_CHECK);
    }
    if (S.ph.cid === undefined) {
        $('#app').innerHTML = skeleton('center');
        return;
    }
    if (!S.ph.cid) {
        return card(`
            <h3>Phone verification is not set up</h3>
            <p class="desc">The site owner needs to add a phone.email Client ID (see <b>config/phone-email.json</b> or the <b>PHONE_EMAIL_CLIENT_ID</b> environment variable) and restart the server.</p>`);
    }
    if (S.ph.verifying) {
        return card(`
            <h3>${SPIN} Confirming your number…</h3>
            ${steps(1)}
            <p class="desc">phone.email accepted your code. We are checking it with the server, this takes a few seconds.</p>`);
    }
    if (S.ph.checking) {
        return card(`<h3>${SPIN} Checking…</h3><p class="desc">Looking at your account.</p>`);
    }
    if (S.ph.busy) {
        return card(`
            <h3>${SPIN} Finish in the popup</h3>
            ${steps(0)}
            <p class="desc">Enter your phone number and the one-time code in the window that just opened. This page updates by itself when you are done. If no window opened, allow pop-ups for this site and press Cancel, then try again.</p>
            ${S.ph.stalled ? '<p class="err phone-err" role="alert">The phone.email window is closed, but nothing came back to this page. Press the button below and try once more.</p>' : ''}
            <div class="form"><button class="button" data-act="phone-cancel">Cancel and start again</button></div>
            ${S.ph.stalled ? trail() : ''}`);
    }
    const why = S.me.role === 'org' ? 'Organizations must verify a phone number before posting.' : 'You must verify a phone number before applying.';
    card(`
        <h3>Verify your phone</h3>
        ${steps(0)}
        <p class="desc">${why} You enter your number and a one-time code, then come straight back here. One phone number can be linked to up to 5 accounts.</p>
        <div class="form">
            ${error()}
            <button class="button button-dark" data-act="phone-open">${S.ph.error ? 'Try again' : 'Verify with phone'}</button>
            <button class="button" data-act="phone-recheck">I already verified: check again</button>
        </div>
        ${S.ph.error ? trail() : ''}`);
}

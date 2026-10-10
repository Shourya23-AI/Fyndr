import { S } from '../../core/state.js';
import { $, esc } from '../../core/dom.js';

const ICON_PHONE = '<svg viewBox="0 0 24 24"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92z"/></svg>';
const ICON_CHECK = '<svg viewBox="0 0 24 24"><path d="m5 12.5 4.5 4.5L19 7.5"/></svg>';

// One centred card (see css/pages/phone.css).
const card = (inner, icon = ICON_PHONE) => {
    $('#app').innerHTML = `
        <div class="phone-page">
            <div class="panel phone-card">
                <span class="phone-icon">${icon}</span>
                ${inner}
            </div>
        </div>`;
};

// #/phone: one button opens the phone.email popup (number + one-time code); our server then confirms the result.
export function phoneRender() {
    if (S.me.phoneVerified) {
        return card(`
            <h3>Phone verified</h3>
            <p class="desc"><span class="tag tag-verified">✓ Phone verified</span> ${esc(S.me.phoneMasked)}</p>
            <div class="form"><a class="button button-dark" href="#/dashboard">Back to dashboard</a></div>`, ICON_CHECK);
    }
    if (S.ph.cid === undefined) {
        return card('<p class="desc">Loading…</p>');
    }
    if (!S.ph.cid) {
        return card(`
            <h3>Phone verification is not set up</h3>
            <p class="desc">The site owner needs to add a phone.email Client ID (see <b>config/phone-email.json</b> or the <b>PHONE_EMAIL_CLIENT_ID</b> environment variable) and restart the server.</p>`);
    }
    if (S.ph.verifying) {
        return card(`
            <h3>Verifying your number…</h3>
            <p class="desc">Hang on, we are confirming your phone number.</p>`);
    }
    if (S.ph.busy) {
        return card(`
            <h3>Finish in the popup</h3>
            <p class="desc">Enter your phone number and the one-time code in the window that just opened. This page updates by itself when you are done.</p>
            <div class="form"><button class="button" data-act="phone-cancel">Cancel and start again</button></div>`);
    }
    const why = S.me.role === 'org' ? 'Organizations must verify a phone number before posting.' : 'You must verify a phone number before applying.';
    card(`
        <h3>Verify your phone</h3>
        <p class="desc">${why} A small window opens where you enter your number and a one-time code. One phone number can be linked to one account only.</p>
        <div class="form">
            <button class="button button-dark" data-act="phone-open">Verify with phone</button>
            <p class="err" id="err">${esc(S.ph.error)}</p>
        </div>`);
}

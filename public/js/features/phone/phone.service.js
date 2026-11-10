import { S } from '../../core/state.js';
import { api, clearApiCache } from '../../core/api.js';
import { toast } from '../../core/dom.js';
import { ferr } from '../../core/errors.js';
import { phoneMsg } from './phone.errors.js';
import { startLogin, takePendingToken, phoneTrail } from '../../services/phone-email/phone-email.js';
import { phoneRender } from './phone.view.js';
import { nav } from '../layout/nav.js';
import { SITE_ORIGIN, onWrongHost } from '../../core/site.js';

const wrongAddress = () => 'Please open ' + SITE_ORIGIN.replace('https://', '') + ' to verify your phone. This address is not the main site, so the verification cannot finish here.';

// After a number is saved: show a clear success screen, then move on by itself.
// Members continue to their profile (basic info, education, skills); organizations go to their dashboard.
function finishUp() {
    S.ph.verifying = false;
    S.ph.confirming = false;
    S.ph.done = true;
    toast('Phone verified ✓');
    nav();
    if (location.hash.startsWith('#/phone')) {
        phoneRender();
        setTimeout(() => {
            if (location.hash === '#/phone') {
                location.hash = S.me.role === 'user' ? '#/profile' : '#/dashboard';
            }
        }, 1500);
    }
}

// Sends the phone.email token to our server, which confirms it and stores the verified number.
async function phoneConfirm(token) {
    S.ph.verifying = true;
    S.ph.error = '';
    phoneRender();
    phoneTrail('asking the server to confirm the result');
    S.me = await api('/phone/verify', 'POST', { access_token: token });
    phoneTrail('number verified');
    finishUp();
}

// "Check again": asks the server whether this account already has a verified number (e.g. verification finished in another tab).
export async function phoneRecheck() {
    clearApiCache();
    S.ph.checking = true;
    S.ph.error = '';
    phoneRender();
    try {
        S.me = await api('/me');
        nav();
        if (S.me.phoneVerified) {
            S.ph.done = true;
        } else {
            S.ph.error = 'Not verified yet. Press "Verify with phone" and finish the steps.';
        }
    } catch (x) {
        S.ph.error = ferr(x);
    } finally {
        S.ph.checking = false;
        phoneRender();
    }
}

// Opens the phone.email popup, waits for its token, and lets our server confirm it.
// phone.email finishes by sending this tab to phone-callback.html, which returns here, and phoneResume() then confirms the token.
// If the browser blocks the popup, startLogin() throws and we show a message asking to allow pop-ups.
export async function phoneVerify() {
    if (!S.ph.cid) {
        throw { message: 'Phone verification is not set up yet. The site owner must add a phone.email Client ID.' };
    }
    if (onWrongHost()) {
        // phone.email only returns to the one address saved in its dashboard, so verifying from any other address always fails.
        S.ph.error = wrongAddress();
        phoneRender();
        return;
    }
    S.ph.error = '';
    S.ph.stalled = false;
    let wait;
    try {
        // opens the popup immediately (inside the click)
        wait = startLogin(S.ph.cid, {
            onStall() {
                S.ph.stalled = true;
                if (location.hash === '#/phone' && S.ph.busy) {
                    phoneRender();
                }
            }
        });
    } catch (x) {
        S.ph.error = ferr(x);
        phoneRender();
        return;
    }
    S.ph.busy = true;
    S.ph.cancel = () => wait.cancel();
    phoneRender();
    try {
        await phoneConfirm(await wait);
    } catch (x) {
        if (x && x.cancelled) {
            return;
        }
        S.ph.error = phoneMsg(x); // shown on the page (a toast alone is easy to miss)
        phoneTrail('failed: ' + S.ph.error);
    } finally {
        S.ph.verifying = false;
        S.ph.busy = false;
        S.ph.cancel = null;
        if (location.hash === '#/phone') {
            phoneRender();
        }
    }
}

// Full-page flow: phone-callback.html left a token for us. Confirm it with the server.
export async function phoneResume() {
    const token = takePendingToken();
    if (!token || S.me.phoneVerified) {
        return;
    }
    phoneTrail('back on the phone page with a result from phone.email');
    try {
        await phoneConfirm(token);
    } catch (x) {
        S.ph.error = phoneMsg(x);
        phoneTrail('failed: ' + S.ph.error);
    } finally {
        S.ph.verifying = false;
        if (location.hash === '#/phone') {
            phoneRender();
        }
    }
}

export const phoneCancel = () => {
    S.ph.cancel?.();
};

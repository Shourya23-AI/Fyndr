import { S } from '../../core/state.js';
import { api, clearApiCache } from '../../core/api.js';
import { toast } from '../../core/dom.js';
import { ferr } from '../../core/errors.js';
import { startLogin, takePendingToken } from '../../services/phone-email/phone-email.js';
import { phoneRender } from './phone.view.js';
import { nav } from '../layout/nav.js';

// Sends the phone.email token to our server, which confirms it and stores the verified number.
async function phoneConfirm(token) {
    S.ph.verifying = true;
    S.ph.error = '';
    phoneRender();
    S.me = await api('/phone/verify', 'POST', { access_token: token });
    // Show a clear success screen, then move on by itself.
    S.ph.verifying = false;
    S.ph.done = true;
    toast('Phone verified ✓');
    nav();
    if (location.hash.startsWith('#/phone')) {
        phoneRender();
        setTimeout(() => {
            if (location.hash === '#/phone') {
                location.hash = '#/dashboard';
            }
        }, 2500);
    }
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
// If the browser blocks the popup, startLogin() continues in this tab and phoneResume() finishes the job on return.
export async function phoneVerify() {
    if (!S.ph.cid) {
        throw { message: 'Phone verification is not set up yet. The site owner must add a phone.email Client ID.' };
    }
    S.ph.error = '';
    const wait = startLogin(S.ph.cid); // opens the popup immediately (inside the click)
    S.ph.busy = true;
    S.ph.redirecting = !!wait.redirected;
    S.ph.cancel = () => wait.cancel();
    phoneRender();
    try {
        await phoneConfirm(await wait);
    } catch (x) {
        if (x && x.cancelled) {
            return;
        }
        S.ph.error = ferr(x); // shown on the page (a toast alone is easy to miss)
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
    try {
        await phoneConfirm(token);
    } catch (x) {
        S.ph.error = ferr(x);
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

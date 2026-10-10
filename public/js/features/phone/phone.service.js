import { S } from '../../core/state.js';
import { api } from '../../core/api.js';
import { toast } from '../../core/dom.js';
import { ferr } from '../../core/errors.js';
import { startLogin, takePendingToken } from '../../services/phone-email/phone-email.js';
import { phoneRender } from './phone.view.js';

// Sends the phone.email token to our server, which confirms it and stores the verified number.
async function phoneConfirm(token) {
    S.me = await api('/phone/verify', 'POST', { access_token: token });
    toast('Phone verified ✓');
    location.hash = '#/dashboard';
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
    S.ph.cancel = () => wait.cancel();
    phoneRender();
    try {
        await phoneConfirm(await wait);
    } catch (x) {
        if (x && x.cancelled) {
            return;
        }
        S.ph.error = ferr(x);
        throw x;
    } finally {
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
    S.ph.verifying = true;
    phoneRender();
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

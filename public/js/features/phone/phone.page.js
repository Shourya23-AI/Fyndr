import { S } from '../../core/state.js';
import { phoneClientId } from '../../services/phone-email/phone-email.js';
import { phoneRender } from './phone.view.js';
import { phoneResume } from './phone.service.js';

// Route entry for #/phone: draw the page, load the Client ID, then finish a pending full-page verification (if any).
export async function phoneView() {
    if (!S.me || S.me.role === 'admin' || S.me.role === 'moderator') {
        return location.hash = '#/dashboard';
    }
    S.ph.cancel?.();
    S.ph = { busy: false, redirecting: false, verifying: false, done: false, error: '', cancel: null, cid: undefined };
    phoneRender();
    const id = await phoneClientId();
    if (location.hash !== '#/phone') {
        return;
    }
    S.ph.cid = id;
    phoneRender();
    await phoneResume();
}

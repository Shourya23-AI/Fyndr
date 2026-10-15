import { toast } from '../../core/dom.js';
import { fb } from '../../services/firebase/firebase-init.js';
import { resetCode } from './reset.view.js';
// Save the new password, drop the one-time code from the address bar, send the person to log in.
export const actions = {};
export const forms = {
    async reset(d) {
        if (d.pw !== d.pw2) {
            throw { message: 'The two passwords do not match' };
        }
        await fb.resetConfirm(resetCode(), d.pw);
        history.replaceState(null, '', location.pathname + '#/login');
        toast('Password changed. Log in with your new password.');
        dispatchEvent(new HashChangeEvent('hashchange'));
    }
};

import { S } from '../../core/state.js';
import { phoneVerify, phoneCancel } from './phone.service.js';
export const bind = () => addEventListener('hashchange', () => {
    if (location.hash !== '#/phone') {
        phoneCancel();
    }
});
export const actions = {
    'phone-open': () => phoneVerify(),
    'phone-cancel': () => phoneCancel()
};

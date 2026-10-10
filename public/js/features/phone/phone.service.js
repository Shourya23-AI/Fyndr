import {S} from '../../core/state.js';
import {api} from '../../core/api.js';
import {toast} from '../../core/dom.js';
import {fb} from '../../services/firebase/firebase-init.js';
import {phoneRender,cooldown} from './phone.view.js';
// Sends the SMS through Firebase, then syncs the verified number to our backend.
export const phoneSend=async num=>{await fb.phoneSend(num);S.ph.step=2;S.ph.num=num;phoneRender();cooldown(30)};
export const phoneSync=async()=>{S.me=await api('/phone/sync','POST');toast('Phone verified ✓');location.hash='#/dashboard'};

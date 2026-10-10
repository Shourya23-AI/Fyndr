import {S} from '../../core/state.js';
import {api} from '../../core/api.js';
import {toast} from '../../core/dom.js';
import {startLogin} from '../../services/phone-email/phone-email.js';
import {phoneRender} from './phone.view.js';
// Opens the phone.email popup, waits for its token, and lets our server confirm it.
export async function phoneVerify(){
  if(!S.ph.cid)throw{message:'Phone verification is not set up yet. The site owner must add a phone.email Client ID.'};
  const wait=startLogin(S.ph.cid); // opens the popup immediately (inside the click)
  S.ph.busy=true;S.ph.cancel=()=>wait.cancel();phoneRender();
  try{const token=await wait;S.me=await api('/phone/verify','POST',{access_token:token});toast('Phone verified ✓');location.hash='#/dashboard'}
  catch(x){if(x&&x.cancelled)return;throw x}
  finally{S.ph.busy=false;S.ph.cancel=null;if(location.hash==='#/phone')phoneRender()}}
export const phoneCancel=()=>{S.ph.cancel?.()};

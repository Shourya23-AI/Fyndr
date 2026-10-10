import {$,esc} from '../../core/dom.js';
import {fb} from '../../services/firebase/firebase-init.js';
import {ferr} from '../../core/errors.js';
// "Choose a new password" page. Firebase's reset email links here as  /?mode=resetPassword&oobCode=XXXX
// (set the link target in Firebase console -> Authentication -> Templates -> Password reset -> customize action URL).
export const resetCode=()=>new URLSearchParams(location.search).get('oobCode')||'';
export async function resetView(){
  const A=h=>$('#app').innerHTML=`<div class="auth-page"><div class="glass auth-solo">${h}</div></div>`;
  A('<h3>Reset password</h3><p class="desc">Checking your link…</p>');
  let email;
  try{email=await fb.resetCheck(resetCode())}
  catch(x){return A(`<h3>Link problem</h3><p class="desc">${esc(ferr(x))}</p><div class="form"><a class="button button-dark" href="#/forgot">Request a new link</a></div>`)}
  A(`<h3>Choose a new password</h3><p class="desc">For <b>${esc(email)}</b></p><form class="form" data-form="reset"><input name="pw" type="password" minlength="6" autocomplete="new-password" placeholder="New password (min 6 characters)" required><input name="pw2" type="password" minlength="6" autocomplete="new-password" placeholder="Repeat new password" required><button class="button button-dark">Save new password</button><p class="err" id="err"></p></form>`)}

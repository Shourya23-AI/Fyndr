import {S} from '../../core/state.js';
import {$,esc} from '../../core/dom.js';
import {phoneClientId} from '../../services/phone-email/phone-email.js';
// #/phone: one button opens the phone.email popup (number + one-time code); our server then confirms the result.
export function phoneRender(){
  const A=h=>$('#app').innerHTML=`<div class="container"><div class="panel auth">${h}</div></div>`;
  if(S.me.phoneVerified)return A(`<h3>Phone verified</h3><p class="desc"><span class="tag tag-verified">✓ Phone verified</span> ${esc(S.me.phoneMasked)}</p><div class="form"><a class="button button-dark" href="#/dashboard">Back to dashboard</a></div>`);
  if(S.ph.cid===undefined)return A('<p class="desc">Loading…</p>');
  if(!S.ph.cid)return A('<h3>Phone verification is not set up</h3><p class="desc">The site owner needs to add a phone.email Client ID (see <b>config/phone-email.json</b> or the <b>PHONE_EMAIL_CLIENT_ID</b> environment variable) and restart the server.</p>');
  if(S.ph.busy)return A('<h3>Finish in the popup</h3><p class="desc">Enter your phone number and the one-time code in the window that just opened. This page updates by itself when you are done.</p><br><div class="form"><button class="button" data-act="phone-cancel">Cancel and start again</button></div>');
  const why=S.me.role==='org'?'Organizations must verify a phone number before posting.':'You must verify a phone number before applying.';
  A(`<h3>Verify your phone</h3><p class="desc">${why} A small window opens where you enter your number and a one-time code. One phone number can be linked to one account only.</p><br><div class="form"><button class="button button-dark" data-act="phone-open">Verify with phone</button><p class="err" id="err"></p></div>`)}
export async function phoneView(){
  if(!S.me||S.me.role==='admin')return location.hash='#/dashboard';
  S.ph.cancel?.();S.ph={busy:false,cancel:null,cid:undefined};phoneRender();
  const id=await phoneClientId();if(location.hash!=='#/phone')return;S.ph.cid=id;phoneRender()}

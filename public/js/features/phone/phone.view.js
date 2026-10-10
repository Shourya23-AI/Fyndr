import {S} from '../../core/state.js';
import {$,esc} from '../../core/dom.js';
// #/phone: two-step wizard (enter number, enter code) with a resend cooldown.
export const cooldown=n=>{clearInterval(S.ph.t);S.ph.cool=n;const tick=()=>{const b=$('#resend');if(b){b.disabled=S.ph.cool>0;b.textContent=S.ph.cool>0?`Resend code (${S.ph.cool}s)`:'Resend code'}if(S.ph.cool<=0)return clearInterval(S.ph.t);S.ph.cool--};tick();S.ph.t=setInterval(tick,1000)};
export function phoneRender(){
  const A=h=>$('#app').innerHTML=`<div class="container"><div class="panel auth">${h}</div></div>`;
  if(S.me.phoneVerified)return A(`<h3>Phone verified</h3><p class="desc"><span class="tag tag-verified">✓ Phone verified</span> ${esc(S.me.phoneMasked)}</p><div class="form"><a class="button button-dark" href="#/dashboard">Back to dashboard</a></div>`);
  const why=S.me.role==='org'?'Organizations must verify a phone number before posting.':'You must verify a phone number before applying.';
  if(S.ph.step===1)return A(`<h3>Verify your phone</h3><p class="desc">${why} We'll text a 6-digit code. One phone number can be linked to one account only.</p><br><form class="form" data-form="phone-send"><div style="display:flex;gap:8px"><input name="cc" value="+91" style="width:84px" aria-label="Country code"><input name="num" type="tel" inputmode="numeric" placeholder="Phone number" required></div><button class="button button-dark">Send code</button><p class="err" id="err"></p><div id="recaptcha"></div></form>`);
  A(`<h3>Enter the code</h3><p class="desc">Sent to <b>${esc(S.ph.num)}</b>. Codes expire after a few minutes.</p><br><form class="form" data-form="phone-verify"><input name="code" inputmode="numeric" maxlength="6" pattern="\\d{6}" placeholder="6-digit code" autocomplete="one-time-code" required><button class="button button-dark">Verify</button><button type="button" class="button" id="resend" data-act="resendcode" disabled>Resend code</button><button type="button" class="mini" data-act="changenum">Change number</button><p class="err" id="err"></p><div id="recaptcha"></div></form>`);
  cooldown(S.ph.cool)}
export function phoneView(){if(!S.me||S.me.role==='admin')return location.hash='#/dashboard';S.ph={step:1,num:'',cool:0,t:clearInterval(S.ph.t)};phoneRender()}

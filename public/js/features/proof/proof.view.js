import {S} from '../../core/state.js';
import {$,esc,pill} from '../../core/dom.js';
import {openAuth} from '../auth/auth-modal.js';
// #/proof: organizations upload registration proof (required to post), candidates optional documents.
const STEPS=['Account','Email','Proof','Review'],stepper=n=>`<ol class="steps">${STEPS.map((t,i)=>`<li class="${i<n?'done':i===n?'now':''}">${t}</li>`).join('')}</ol>`;
export function proofView(){
  if(!S.me)return openAuth('signin');if(S.me.role==='admin')return location.hash='#/dashboard';
  const org=S.me.role==='org',st=S.me.proofStatus,t=org?['Prove your organization is real','Add your careers page and a clear photo of a registration document, such as a GST or incorporation certificate. Our team checks both before you can post.','Registration proof']:['Verify your documents','Optional. Add a clear photo of your degree, marksheet or student ID. Browsing and applying never need this; it unlocks suggestions picked for you.','Qualification document'];
  $('#app').innerHTML=`<div class="auth-page"><div class="glass auth-solo wide">${org?stepper(st?3:2):''}<h3>${t[0]}</h3><p class="desc">${t[1]}</p>
${st?`<p style="margin:14px 0 0">${pill(st)} <span class="desc">${{pending:'Under review by our team.',verified:'Verified.',rejected:'We could not verify this. Upload a clearer file.'}[st]}</span></p>`:''}
${st==='verified'?'<div class="form" style="margin-top:16px"><a class="button button-dark" href="#/dashboard">Back to dashboard</a></div>':`<form class="form" data-form="proof" style="margin-top:16px">${org?`<label class="fld"><span>Careers page link</span><input name="portal" type="url" placeholder="https://yourcompany.com/careers" value="${esc(S.me.portal)}" required></label>`:''}<label class="fld"><span>${t[2]}</span><input type="file" name="file" accept="image/*,application/pdf" required></label><p class="desc">Photos are compressed in your browser. Only you and Fyndr admins can open this file.</p><button class="button button-dark">Submit for review</button><p class="err"></p></form>`}</div></div>`}

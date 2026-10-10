import {$} from '../../core/dom.js';
// The sliding sign-in / create-account panel. openAuth(mode, role, clickPoint) is the single entry point.
const RS='<div class="role-switch" role="tablist"><button type="button" role="tab" class="on" data-act="role" data-role="candidate">Candidate</button><button type="button" role="tab" data-act="role" data-role="org">Organization</button></div>';
const pwField=(reg)=>`<label class="fld"><span>Password</span><span class="pw"><input name="password" type="password" autocomplete="${reg?'new-password':'current-password'}" ${reg?'minlength="8" pattern="(?=.*[A-Za-z])(?=.*\\d).{8,}" title="At least 8 characters with a letter and a number"':'minlength="6"'} required><button type="button" class="mini" data-act="showpw" aria-label="Show password">Show</button></span></label>`;
export function openAuth(mode='signin',role,pt){
  closeAuth();const el=document.createElement('div');el.className='auth-page modal';el.id='authModal';if(pt){el.style.setProperty('--ox',pt.x+'px');el.style.setProperty('--oy',pt.y+'px')}
  el.innerHTML=`<div class="auth-box glass" id="authBox" data-role="candidate"><button class="auth-x" data-act="closeauth" aria-label="Close">×</button>
<div class="pane signin"><h2>Welcome back</h2>${RS}<button type="button" class="gbtn" data-act="google"><span class="g">G</span>Continue with Google</button><div class="or"><span>or use email</span></div>
<form class="form" data-form="login"><label class="fld"><span>Email</span><input name="email" type="email" autocomplete="email" required></label>${pwField(0)}<button class="button button-dark">Sign in</button><p class="err" role="alert"></p><a class="small" href="#/forgot">Forgot password?</a></form>
<p class="swap">New here? <button type="button" data-act="slide" data-to="signup">Create an account</button></p></div>
<div class="pane signup"><h2>Create your account</h2>${RS}<button type="button" class="gbtn" data-act="google"><span class="g">G</span>Sign up with Google</button><div class="or"><span>or use email</span></div>
<form class="form" data-form="register"><label class="fld org-only"><span>Organization name</span><input name="orgName" autocomplete="organization" required disabled></label><label class="fld org-only"><span>Organization type</span><select name="orgType" required disabled><option value="">Choose…</option><option value="small">Small business</option><option value="enterprise">Enterprise</option></select></label><label class="fld"><span><b class="nm">Your name</b></span><input name="name" autocomplete="name" required></label>
<label class="fld"><span>Email <em class="org-only org-note">(work email for enterprises)</em></span><input name="email" type="email" autocomplete="email" required></label><label class="fld org-only"><span>Website</span><input name="website" type="url" placeholder="https://" required disabled></label>${pwField(1)}
<p class="desc org-only">Small businesses can sign up with Gmail. Enterprises need a work email.</p><p class="desc org-only">Next: confirm your email, then upload proof of your organization for review.</p><label class="agree"><input type="checkbox" required> <span>I agree to the Terms and Privacy Policy.</span></label><button class="button button-dark">Create account</button><p class="err" role="alert"></p></form>
<p class="swap">Have an account? <button type="button" data-act="slide" data-to="signin">Sign in</button></p></div>
<div class="overlay"><div class="overlay-inner"><div class="ov ov-left"><h3>Already a member?</h3><p>Sign in to see your matches and applications.</p><button type="button" class="btn-glass" data-act="slide" data-to="signin">Sign in</button></div>
<div class="ov ov-right"><h3>New here?</h3><p>Free for students. It takes about a minute.</p><button type="button" class="btn-glass" data-act="slide" data-to="signup">Create account</button></div></div></div></div>`;
  document.body.append(el);document.body.classList.add('lock');setRole(role);slide(mode)}
export function closeAuth(){$('#authModal')?.remove();document.body.classList.remove('lock')}
export function setRole(r){const b=$('#authBox');if(!b)return;const org=r==='org';b.dataset.role=org?'org':'candidate';
  b.querySelectorAll('.role-switch button').forEach(x=>{const on=x.dataset.role===b.dataset.role;x.classList.toggle('on',on);x.setAttribute('aria-selected',on)});
  b.querySelectorAll('.org-only input,.org-only select').forEach(i=>i.disabled=!org);b.querySelectorAll('.nm').forEach(n=>n.textContent=org?'Contact person':'Your name')}
export function slide(mode){const b=$('#authBox');if(!b)return;const up=mode==='signup';b.classList.toggle('is-signup',up);
  b.querySelector('.signin').toggleAttribute('inert',up);b.querySelector('.signup').toggleAttribute('inert',!up);
  setTimeout(()=>b.querySelector(up?'.signup input:not([disabled])':'.signin input')?.focus({preventScroll:true}),350)}

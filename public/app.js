import {fb} from './firebase-init.js';
import {localApi} from './local-api.js';
const $=s=>document.querySelector(s),esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let me=null,f={type:'',q:'',loc:''},mine={saved:[],applications:[]};
const fmt=d=>new Date(d).toLocaleDateString();
async function api(p,m='GET',b){if(fb.local){const u=fb.user();return localApi(p,m,b,u&&{uid:u.uid,email:u.email,displayName:u.displayName,phoneNumber:u.phoneNumber})}const t=await fb.token();const r=await fetch('/api'+p,{method:m,headers:{'Content-Type':'application/json',Authorization:'Bearer '+t},body:b?JSON.stringify(b):undefined});const d=await r.json().catch(()=>({}));if(!r.ok){const e=new Error(d.error||'Something went wrong');e.code=d.code;throw e}return d}
const toast=m=>{const t=$('#toast');t.textContent=m;t.hidden=false;clearTimeout(toast.t);toast.t=setTimeout(()=>t.hidden=true,2500)};
const table=(h,rows)=>`<div class="tbl-wrap"><table class="tbl"><tr>${h.map(x=>`<th>${x}</th>`).join('')}</tr>${rows.join('')||`<tr><td colspan="${h.length}" style="color:var(--muted)">Nothing here yet.</td></tr>`}</table></div>`;
const pill=s=>`<span class="pill ${s}">${s}</span>`;

const LOGO='<span class="logo-mark"><svg viewBox="0 0 24 24"><circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 4.5 4.5"/></svg></span>',
  TICK='<svg viewBox="0 0 24 24"><path d="m5 12 4.5 4.5L19 7"/></svg>',
  FREE=/@(gmail|yahoo|outlook|hotmail|proton|protonmail|icloud|aol)\./i;
const markNav=r=>document.querySelectorAll('.nav-links a').forEach(a=>{const on=a.dataset.r===(['login','register','forgot'].includes(r)?'':r);on?a.setAttribute('aria-current','page'):a.removeAttribute('aria-current')});
function nav(){
  $('#nav').innerHTML=`<a class="logo" href="#/">${LOGO}Fyndr</a><div class="nav-links">${me?`<a href="#/" data-r="">Browse</a>${me.role==='user'?'<a href="#/profile" data-r="profile">Profile</a>':''}<a href="#/dashboard" data-r="dashboard">Dashboard</a>`:'<a href="#/organizations" data-r="organizations">For organizations</a>'}</div>
<div class="nav-actions"><button class="icon-btn" data-act="theme" aria-label="Toggle dark mode">◐</button>${me?`<span class="who">${esc(me.orgName||me.name)}</span>${me.role!=='admin'?(me.phoneVerified?'<span class="tag tag-verified">Phone verified</span>':'<a class="tag tag-warn" href="#/phone">Verify phone</a>'):''}<button class="button button-dark button-small" data-act="logout">Log out</button>`
:fb.user()?`<button class="button button-dark button-small" data-act="logout">Log out</button>`:`<button class="button button-dark button-small" data-act="auth" data-mode="signin">Sign in</button>`}</div>`}

const card=l=>{const sv=mine.saved.includes(l.id),ap=mine.applications.some(a=>a.listingId===l.id),canApply=!(me?.role==='org'||me?.role==='admin');
return `<article class="card"><span class="company-logo">${esc(l.orgName[0])}</span>
<div><div class="tags"><span class="tag">${l.type}</span>${l.orgVerified?`<span class="tag tag-verified">${TICK}Verified</span>`:''}</div><h3>${esc(l.title)}</h3><p class="company">${esc(l.orgName)}</p><p class="loc">${esc(l.location)}</p><p class="desc">${esc(l.description)}</p></div>
<div class="card-side"><strong class="pay">${esc(l.pay)}</strong><span class="when">${fmt(l.created)}</span><div class="acts">${me?.role==='user'?`<button class="save-button ${sv?'saved':''}" data-act="save" data-id="${l.id}" aria-pressed="${sv}" aria-label="${sv?'Remove from saved':'Save'}"><svg viewBox="0 0 24 24"><path d="M6 4h12v17l-6-4-6 4z"/></svg></button>`:''}${canApply?`<button class="button button-dark button-small" data-act="apply" data-id="${l.id}" ${ap?'disabled':''}>${ap?'Applied':'Apply'}</button>`:''}</div></div></article>`};

async function loadListings(){
  $('#grid').setAttribute('aria-busy','true');$('#grid').innerHTML='<div class="sk"></div>'.repeat(3);
  const qs=new URLSearchParams(Object.entries(f).filter(([,v])=>v)).toString(),ls=await api('/listings?'+qs);
  $('#grid').innerHTML=ls.map(card).join('')||'<div class="empty"><b>No matches yet</b><p>Try fewer keywords or a different location.</p><button class="button button-dark button-small" data-act="clear">Clear search</button></div>';$('#grid').removeAttribute('aria-busy')}
const CHECKS=['Organization verified by our team','Reviewed before going live','Poster\'s email confirmed','Poster\'s phone confirmed'];
const SPEC=()=>`<aside class="specimen" aria-label="Example of a checked listing"><div class="spec-top"><span>Example listing</span><span class="tag tag-verified">${TICK}Verified</span></div><h3>Product Design Intern</h3><p>Linear, Remote</p><ul class="cks">${CHECKS.map(c=>`<li><span class="ck">${TICK}</span>${c}</li>`).join('')}</ul></aside>`;
async function browse(){
  if(me?.role==='user')mine=await api('/my');
  $('#app').innerHTML=`<section class="hero container"><div><h1>Every listing is checked before you see it.</h1><p class="lead">Internships, jobs and courses from organizations our team has verified. Apply without second-guessing.</p>
<form class="search-box" data-form="search"><label class="search-field"><input name="q" type="search" aria-label="Role, skill, or company" placeholder="Role, skill or company" value="${esc(f.q)}"></label><label class="search-field"><input name="loc" aria-label="Location" placeholder="Remote or city" value="${esc(f.loc)}"></label><button class="search-button">Search</button></form>
</div>
${SPEC()}</section>
${me?.role==='user'?'<section class="container sugg" id="sugg"></section>':''}<section class="container page" id="browse"><h2>Latest opportunities</h2><p class="desc">Every listing here has been reviewed.</p><div class="tabs">${[['','All'],['Job','Jobs'],['Internship','Internships'],['Course','Courses']].map(([v,t])=>`<button class="${f.type===v?'active':''}" data-act="tab" data-id="${v}">${t}</button>`).join('')}</div><div class="opportunity-grid" id="grid"></div></section>
<section class="container how"><h2>Four checks between a posting and your screen.</h2><div class="rows">${[['Verified organization','A person on our team confirms who the organization is before it can post.'],['Reviewed listing','New postings wait in a review queue and appear only after an admin approves them.'],['Confirmed email','Every account verifies its email address before it can do anything.'],['Confirmed phone','Candidates verify a phone before applying, organizations before posting. One number, one account.']].map(([t,d])=>`<div class="row"><span class="ck">${TICK}</span><b>${t}</b><p>${d}</p></div>`).join('')}</div></section>`;
  if(me?.role==='user')suggest().catch(()=>{});
  loadListings().catch(()=>{$('#grid').innerHTML='<div class="empty"><b>Could not load listings</b><p>Check your connection and try again.</p><button class="button button-dark button-small" data-act="clear">Retry</button></div>'})}
function landing(){$('#app').innerHTML=`<section class="hero landing container"><div><h1>Every listing is checked before you see it.</h1><p class="lead">Fyndr lists internships, jobs and courses only from organizations our team has verified. Create a free account to browse and apply.</p>
<div class="cta"><button class="btn-primary" data-act="auth" data-mode="signup">Get started</button><button class="btn-line" data-act="auth" data-mode="signin">Sign in</button></div><p class="desc" style="margin-top:20px">Hiring? <a class="link" href="#/organizations">Register your organization</a></p></div>${SPEC()}</section>`}
const home=()=>me?browse():landing();
function orgPage(){$('#app').innerHTML=`<section class="org-hero container"><h1>Hire people who applied on purpose.</h1><p class="lead">Free to post. Reach students on a board that checks every listing, and review applicants in one place.</p>
<div class="cta"><button class="btn-primary" data-act="auth" data-mode="signup" data-role="org">Register your organization</button><button class="btn-line" data-act="auth" data-mode="signin" data-role="org">Organization sign in</button></div></section>
<section class="container benefits"><div><h3>Reach verified students</h3><p>Candidates confirm their email and phone before they can apply.</p></div><div><h3>Free to post</h3><p>Submit a listing and it goes live once our team approves it.</p></div><div><h3>Applicants in one place</h3><p>See who applied to each listing and move them from reviewing to accepted.</p></div></section>
<section class="container how"><h2>How we verify organizations</h2><div class="rows">${[['Register with a work email','Free providers like Gmail are not accepted. We send a link to confirm the address.'],['Our team reviews it','We check the website and the organization details. Until then, your listings stay in review.'],['Get the verified badge','Approved organizations show a Verified tag on every listing they post.']].map(([t,d])=>`<div class="row"><span class="ck">${TICK}</span><b>${t}</b><p>${d}</p></div>`).join('')}</div></section>`}

/* ---- Proof of identity: org (required to post) / candidate (optional, unlocks suggestions) ---- */
const STEPS=['Account','Email','Proof','Review'],stepper=n=>`<ol class="steps">${STEPS.map((t,i)=>`<li class="${i<n?'done':i===n?'now':''}">${t}</li>`).join('')}</ol>`;
const b64=file=>new Promise((ok,no)=>{const r=new FileReader();r.onload=()=>ok(r.result.split(',')[1]);r.onerror=no;r.readAsDataURL(file)});
async function shrink(file){
  if(file.type==='application/pdf'){if(file.size>1.5*1024*1024)throw{message:'PDF must be under 1.5 MB'};return{name:file.name,data:await b64(file)}}
  if(!file.type.startsWith('image/'))throw{message:'Upload a photo (JPG, PNG, WebP) or a PDF'};
  const bm=await createImageBitmap(file),k=Math.min(1,1600/Math.max(bm.width,bm.height)),c=document.createElement('canvas');c.width=bm.width*k;c.height=bm.height*k;c.getContext('2d').drawImage(bm,0,0,c.width,c.height);
  return{name:file.name.replace(/\.\w+$/,'')+'.jpg',data:c.toDataURL('image/jpeg',.82).split(',')[1]}}
function proofView(){
  if(!me)return openAuth('signin');if(me.role==='admin')return location.hash='#/dashboard';
  const org=me.role==='org',st=me.proofStatus,t=org?['Prove your organization is real','Add your careers page and a clear photo of a registration document, such as a GST or incorporation certificate. Our team checks both before you can post.','Registration proof']:['Verify your documents','Optional. Add a clear photo of your degree, marksheet or student ID. Browsing and applying never need this; it unlocks suggestions picked for you.','Qualification document'];
  $('#app').innerHTML=`<div class="auth-page"><div class="glass auth-solo wide">${org?stepper(st?3:2):''}<h3>${t[0]}</h3><p class="desc">${t[1]}</p>
${st?`<p style="margin:14px 0 0">${pill(st)} <span class="desc">${{pending:'Under review by our team.',verified:'Verified.',rejected:'We could not verify this. Upload a clearer file.'}[st]}</span></p>`:''}
${st==='verified'?'<div class="form" style="margin-top:16px"><a class="button button-dark" href="#/dashboard">Back to dashboard</a></div>':`<form class="form" data-form="proof" style="margin-top:16px">${org?`<label class="fld"><span>Careers page link</span><input name="portal" type="url" placeholder="https://yourcompany.com/careers" value="${esc(me.portal)}" required></label>`:''}<label class="fld"><span>${t[2]}</span><input type="file" name="file" accept="image/*,application/pdf" required></label><p class="desc">Photos are compressed in your browser. Only you and Fyndr admins can open this file.</p><button class="button button-dark">Submit for review</button><p class="err"></p></form>`}</div></div>`}
async function suggest(){const el=$('#sugg');if(!el)return;
  if(me.proofStatus!=='verified'){el.innerHTML=`<div class="nudge"><div><h3>Get suggestions picked for you</h3><p class="desc">Verify a qualification document and we will rank listings by the skills on your profile. Browsing and applying never need this.</p></div><a class="button button-dark button-small" href="#/proof">${me.proofStatus==='pending'?'Under review':'Add documents'}</a></div>`;return}
  const[pr,ls]=await Promise.all([api('/profile'),api('/listings')]),sk=(pr.profile.skills||[]).map(x=>x.toLowerCase());
  const top=ls.map(l=>{const tx=(l.title+' '+l.description).toLowerCase(),m=sk.filter(x=>tx.includes(x));return{l,m,n:Math.round(Math.min(1,m.length/Math.min(sk.length||1,3))*100)}}).filter(x=>x.m.length).sort((a,b)=>b.n-a.n).slice(0,3);
  el.innerHTML=`<h2>Suggested for you</h2><p class="desc">Ranked by the skills on your profile.</p><div class="opportunity-grid">${top.map(x=>card({...x.l,description:`${x.n}% skill match (${x.m.join(', ')}). ${x.l.description}`})).join('')||'<p class="desc" style="padding:16px 0">Add more skills to your profile to see suggestions.</p>'}</div>`}

/* ---- Auth: one entry point, openAuth(mode, role) ---- */
const RS='<div class="role-switch" role="tablist"><button type="button" role="tab" class="on" data-act="role" data-role="candidate">Candidate</button><button type="button" role="tab" data-act="role" data-role="org">Organization</button></div>';
const pwField=(reg)=>`<label class="fld"><span>Password</span><span class="pw"><input name="password" type="password" autocomplete="${reg?'new-password':'current-password'}" ${reg?'minlength="8" pattern="(?=.*[A-Za-z])(?=.*\\d).{8,}" title="At least 8 characters with a letter and a number"':'minlength="6"'} required><button type="button" class="mini" data-act="showpw" aria-label="Show password">Show</button></span></label>`;
function openAuth(mode='signin',role,pt){
  closeAuth();const el=document.createElement('div');el.className='auth-page modal';el.id='authModal';if(pt){el.style.setProperty('--ox',pt.x+'px');el.style.setProperty('--oy',pt.y+'px')}
  el.innerHTML=`<div class="auth-box glass" id="authBox" data-role="candidate"><button class="auth-x" data-act="closeauth" aria-label="Close">×</button>
<div class="pane signin"><h2>Welcome back</h2>${RS}<button type="button" class="gbtn" data-act="google"><span class="g">G</span>Continue with Google</button><div class="or"><span>or use email</span></div>
<form class="form" data-form="login"><label class="fld"><span>Email</span><input name="email" type="email" autocomplete="email" required></label>${pwField(0)}<button class="button button-dark">Sign in</button><p class="err" role="alert"></p><a class="small" href="#/forgot">Forgot password?</a></form>
<p class="swap">New here? <button type="button" data-act="slide" data-to="signup">Create an account</button></p></div>
<div class="pane signup"><h2>Create your account</h2>${RS}<button type="button" class="gbtn" data-act="google"><span class="g">G</span>Sign up with Google</button><div class="or"><span>or use email</span></div>
<form class="form" data-form="register"><label class="fld org-only"><span>Organization name</span><input name="orgName" autocomplete="organization" required disabled></label><label class="fld"><span><b class="nm">Your name</b></span><input name="name" autocomplete="name" required></label>
<label class="fld"><span>Email <em class="org-only org-note">(work email)</em></span><input name="email" type="email" autocomplete="email" required></label><label class="fld org-only"><span>Website</span><input name="website" type="url" placeholder="https://" required disabled></label>${pwField(1)}
<p class="desc org-only">Next: confirm your email, then upload proof of your organization for review.</p><label class="agree"><input type="checkbox" required> <span>I agree to the Terms and Privacy Policy.</span></label><button class="button button-dark">Create account</button><p class="err" role="alert"></p></form>
<p class="swap">Have an account? <button type="button" data-act="slide" data-to="signin">Sign in</button></p></div>
<div class="overlay"><div class="overlay-inner"><div class="ov ov-left"><h3>Already a member?</h3><p>Sign in to see your matches and applications.</p><button type="button" class="btn-glass" data-act="slide" data-to="signin">Sign in</button></div>
<div class="ov ov-right"><h3>New here?</h3><p>Free for students. It takes about a minute.</p><button type="button" class="btn-glass" data-act="slide" data-to="signup">Create account</button></div></div></div></div>`;
  document.body.append(el);document.body.classList.add('lock');setRole(role);slide(mode)}
function closeAuth(){$('#authModal')?.remove();document.body.classList.remove('lock')}
function setRole(r){const b=$('#authBox');if(!b)return;const org=r==='org';b.dataset.role=org?'org':'candidate';
  b.querySelectorAll('.role-switch button').forEach(x=>{const on=x.dataset.role===b.dataset.role;x.classList.toggle('on',on);x.setAttribute('aria-selected',on)});
  b.querySelectorAll('.org-only input').forEach(i=>i.disabled=!org);b.querySelectorAll('.nm').forEach(n=>n.textContent=org?'Contact person':'Your name')}
function slide(mode){const b=$('#authBox');if(!b)return;const up=mode==='signup';b.classList.toggle('is-signup',up);
  b.querySelector('.signin').toggleAttribute('inert',up);b.querySelector('.signup').toggleAttribute('inert',!up);
  setTimeout(()=>b.querySelector(up?'.signup input:not([disabled])':'.signin input')?.focus({preventScroll:true}),350)}
addEventListener('keydown',e=>{if(e.key==='Escape')closeAuth()});

const gbtn='<button type="button" class="button gbtn" data-act="google">Continue with Google</button><p class="desc" style="text-align:center">or</p>';
const roleSel=`<select name="role" onchange="document.getElementById('on').hidden=this.value!=='org'"><option value="user">I'm looking for opportunities</option><option value="org">I'm an organization hiring</option></select>`;
const ferr=e=>({'auth/invalid-email':'Enter a valid email address','auth/network-request-failed':'Network problem: check your connection','auth/popup-blocked':'Your browser blocked the sign-in popup. Allow popups and retry','auth/user-disabled':'This account has been disabled','auth/cancelled-popup-request':'Sign-in cancelled','auth/wrong-password':'Wrong email or password','auth/invalid-credential':'Wrong email or password','auth/email-already-in-use':'That email is already registered','auth/weak-password':'Password is too weak','auth/user-not-found':'No account with that email','auth/too-many-requests':'Too many attempts, try again later','auth/popup-closed-by-user':'Sign-in cancelled',
'auth/invalid-verification-code':'That code is wrong — check the SMS and try again','auth/code-expired':'That code has expired — tap Resend to get a new one',
'auth/invalid-phone-number':'That phone number looks invalid (include the country code)','auth/missing-phone-number':'Enter your phone number',
'auth/credential-already-in-use':'This phone number is already linked to another account','auth/account-exists-with-different-credential':'This phone number is already linked to another account',
'auth/captcha-check-failed':'reCAPTCHA check failed — refresh and try again','auth/quota-exceeded':'SMS limit reached — try again later or use a Firebase test number',
'auth/operation-not-allowed':'Phone sign-in is not enabled in the Firebase console','auth/app/no-session':'Request a code first','app/no-session':'Request a code first','PHONE_TAKEN':'This phone number is already used by another account'}[e.code]||(/^Firebase/.test(e.message)?'Something went wrong. Please try again':e.message));
const authView=m=>{
  const A=h=>$('#app').innerHTML=`<div class="auth-page"><div class="glass auth-solo">${h}</div></div>`;
  if(!fb.configured)return A('<h3>Firebase not set up</h3><p class="desc">Paste your Firebase web config into <b>firebase-config.json</b> and restart the server.</p>');
  clearInterval(authView.t);
  if(m==='verify')authView.t=setInterval(async()=>{if(!fb.user())return clearInterval(authView.t);try{await fb.reload();if(fb.user().emailVerified){clearInterval(authView.t);route()}}catch{}},4000);
  if(m==='verify')return A(`<h3>Verify your email</h3><p class="desc">We sent a link to <b>${esc(fb.user()?.email)}</b>. Click it, then continue.</p><div class="form"><button class="button button-dark" data-act="verified">I've verified</button><button class="button" data-act="resend">Resend email</button><button class="mini" data-act="logout">Use a different email</button></div>`);
  if(m==='forgot')return A(`<h3>Reset password</h3><form class="form" data-form="forgot"><input name="email" type="email" placeholder="Email" required><button class="button button-dark">Send reset link</button><p class="err" id="err"></p><a href="#/login" style="font-size:13px">Back to log in</a></form>`);
  if(m==='setup')return A(`<h3>Finish setting up</h3><form class="form" data-form="setup">${roleSel}<input name="name" placeholder="Your name" value="${esc(fb.user()?.displayName)}" required><input id="on" name="orgName" placeholder="Organization name" hidden><button class="button button-dark">Continue</button><p class="err" id="err"></p></form>`);
  openAuth(m==='register'?'signup':'signin')};
async function loadMe(){me=null;const u=fb.user();if(!u)return'login';if(!u.emailVerified)return'verify';
  try{me=await api('/me')}catch(e){loadMe.err=e.message;return /profile/.test(e.message)?'setup':'login'}return''}

const QUAL=['High School','Diploma',"Bachelor's","Master's",'PhD','Other'],EXP=['Student / Fresher','0–1 years','1–3 years','3–5 years','5+ years'],JT=['Job','Internship','Freelance','Course'];
let skills=[];
const chips=()=>{const c=$('#chips');if(c)c.innerHTML=skills.map((s,i)=>`<span class="chip-s">${esc(s)}<button type="button" data-act="rmskill" data-id="${i}">×</button></span>`).join('')};
const addSkill=s=>{s=s.trim();if(s&&!skills.includes(s)&&skills.length<30)skills.push(s);chips()};
const resumeUI=r=>{const e=$('#resume');if(e)e.innerHTML=r?`<span class="pill approved">${esc(r.name)} · ${Math.round(r.size/1024)} KB</span> <button type="button" class="mini no" data-act="rmresume">Remove</button>`:''};
async function profileView(){
  const d=await api('/profile'),p=d.profile,onb=!me.onboarded;skills=[...(p.skills||[])];
  const opt=(arr,v)=>arr.map(x=>`<option ${x===v?'selected':''}>${x}</option>`).join('');
  $('#app').innerHTML=`<div class="container page"><div class="panel" style="max-width:720px;margin:auto"><h2>${onb?'Tell us about your education':'Your profile'}</h2>
<p class="desc">${onb?'This helps us match you with the right jobs and courses. You can change it anytime.':`Profile ${d.completion}% complete`}</p><br>
<form class="form cols" data-form="profile">
<select name="qualification" required><option value="">Highest qualification</option>${opt(QUAL,p.qualification)}</select>
<input name="field" placeholder="Field of study" value="${esc(p.field)}" required>
<input name="institution" placeholder="Institution" value="${esc(p.institution)}" required>
<input name="gradYear" type="number" placeholder="Graduation year" value="${esc(p.gradYear)}" required>
<select name="experience" required><option value="">Experience level</option>${opt(EXP,p.experience)}</select>
<input name="locations" placeholder="Preferred locations (comma separated)" value="${esc(p.locations)}">
<div class="full"><div class="chips" id="chips"></div><input id="skillin" placeholder="Skills — type and press Enter"></div>
<div class="full"><p class="desc">Looking for</p><div class="checks">${JT.map(t=>`<label><input type="checkbox" name="jobTypes" value="${t}" ${p.jobTypes?.includes(t)?'checked':''}> ${t}</label>`).join('')}</div></div>
<div class="full"><p class="desc">Resume (PDF, max 2 MB, optional)</p><div id="resume"></div><input type="file" id="resumein" accept="application/pdf"></div>
<button class="button button-dark full">${onb?'Save and continue':'Save changes'}</button><p class="err full" id="err"></p></form></div></div>`;
  chips();resumeUI(d.resume)}
document.addEventListener('keydown',e=>{if(e.target.id==='skillin'&&(e.key==='Enter'||e.key===',')){e.preventDefault();addSkill(e.target.value.replace(',',''));e.target.value=''}});
document.addEventListener('change',e=>{if(e.target.id!=='resumein')return;const file=e.target.files[0];if(!file)return;
  if(file.type!=='application/pdf'||file.size>2*1024*1024){e.target.value='';return toast('Resume must be a PDF under 2 MB')}
  const rd=new FileReader();rd.onload=async()=>{try{resumeUI(await api('/resume','POST',{name:file.name,data:rd.result.split(',')[1]}));toast('Resume uploaded')}catch(x){toast(x.message)}};rd.readAsDataURL(file)});

let ph={step:1,num:'',cool:0,t:null};
const cooldown=n=>{clearInterval(ph.t);ph.cool=n;const tick=()=>{const b=$('#resend');if(b){b.disabled=ph.cool>0;b.textContent=ph.cool>0?`Resend code (${ph.cool}s)`:'Resend code'}if(ph.cool<=0)return clearInterval(ph.t);ph.cool--};tick();ph.t=setInterval(tick,1000)};
function phoneRender(){
  const A=h=>$('#app').innerHTML=`<div class="container"><div class="panel auth">${h}</div></div>`;
  if(me.phoneVerified)return A(`<h3>Phone verified</h3><p class="desc"><span class="tag tag-verified">✓ Phone verified</span> ${esc(me.phoneMasked)}</p><div class="form"><a class="button button-dark" href="#/dashboard">Back to dashboard</a></div>`);
  const why=me.role==='org'?'Organizations must verify a phone number before posting.':'You must verify a phone number before applying.';
  if(ph.step===1)return A(`<h3>Verify your phone</h3><p class="desc">${why} We'll text a 6-digit code. One phone number can be linked to one account only.</p><br><form class="form" data-form="phone-send"><div style="display:flex;gap:8px"><input name="cc" value="+91" style="width:84px" aria-label="Country code"><input name="num" type="tel" inputmode="numeric" placeholder="Phone number" required></div><button class="button button-dark">Send code</button><p class="err" id="err"></p><div id="recaptcha"></div></form>`);
  A(`<h3>Enter the code</h3><p class="desc">Sent to <b>${esc(ph.num)}</b>. Codes expire after a few minutes.</p><br><form class="form" data-form="phone-verify"><input name="code" inputmode="numeric" maxlength="6" pattern="\\d{6}" placeholder="6-digit code" autocomplete="one-time-code" required><button class="button button-dark">Verify</button><button type="button" class="button" id="resend" data-act="resendcode" disabled>Resend code</button><button type="button" class="mini" data-act="changenum">Change number</button><p class="err" id="err"></p><div id="recaptcha"></div></form>`);
  cooldown(ph.cool)}
function phoneView(){if(!me||me.role==='admin')return location.hash='#/dashboard';ph={step:1,num:'',cool:0,t:clearInterval(ph.t)};phoneRender()}
const phoneSend=async num=>{await fb.phoneSend(num);ph.step=2;ph.num=num;phoneRender();cooldown(30)};
const phoneSync=async()=>{me=await api('/phone/sync','POST');toast('Phone verified ✓');location.hash='#/dashboard'};

async function dashboard(){
  if(!me)return location.hash='#/login';
  const a=$('#app');
  if(me.role==='user'){mine=await api('/my');
    const saved=(await api('/listings')).filter(l=>mine.saved.includes(l.id));
    a.innerHTML=`<div class="container page"><h2>My dashboard</h2><br><div class="panel"><h3>Profile ${me.completion}% complete</h3><div class="bar"><i style="width:${me.completion}%"></i></div><a class="button button-dark button-small" style="margin-top:14px" href="#/profile">Edit profile</a></div><div class="panel"><h3>Document verification</h3><p class="desc">Optional. Needed only for suggestions picked for you.</p>${me.proofStatus?`<p style="margin-top:10px">${pill(me.proofStatus)}</p>`:''}<a class="button button-dark button-small" style="margin-top:12px" href="#/proof">${me.proofStatus?'View submission':'Add documents'}</a></div><div class="panel"><h3>Phone</h3>${me.phoneVerified?`<span class="tag tag-verified">✓ Phone verified</span> <span class="desc">${esc(me.phoneMasked)}</span>`:`<p class="desc">${{user:'Verify your phone to apply for opportunities.',org:'Verify your phone to post opportunities.'}[me.role]}</p><a class="button button-dark button-small" style="margin-top:12px" href="#/phone">Verify phone</a>`}</div><div class="panel"><h3>My applications</h3>${table(['Role','Company','Applied','Status'],mine.applications.map(x=>`<tr><td>${esc(x.listing?.title)}</td><td>${esc(x.listing?.orgName)}</td><td>${fmt(x.created)}</td><td>${pill(x.status)}</td></tr>`))}</div>
<h3 style="margin:24px 0 14px">Saved</h3><div class="opportunity-grid">${saved.map(card).join('')||'<p style="color:var(--muted)">No saved listings.</p>'}</div></div>`}
  if(me.role==='org'){const [ls,ap]=await Promise.all([api('/org/listings'),api('/org/applications')]);
    a.innerHTML=`<div class="container page"><h2>${esc(me.orgName)} dashboard</h2>${me.verified?'':`<div class="panel"><h3>Verification</h3><p class="desc">${me.proofStatus==='rejected'?'Your proof was not accepted.':'Your organization is awaiting review.'} You can post once it is verified.</p><a class="button button-dark button-small" style="margin-top:12px" href="#/proof">${me.proofStatus==='pending'?'View submission':'Upload proof'}</a></div>`}<br>
<div class="panel"><h3>Phone</h3>${me.phoneVerified?`<span class="tag tag-verified">✓ Phone verified</span> <span class="desc">${esc(me.phoneMasked)}</span>`:`<p class="desc">${{user:'Verify your phone to apply for opportunities.',org:'Verify your phone to post opportunities.'}[me.role]}</p><a class="button button-dark button-small" style="margin-top:12px" href="#/phone">Verify phone</a>`}</div>
<div class="panel"><h3>Post an opportunity</h3>${me.phoneVerified?'':'<p class="desc">Posting unlocks after phone verification.</p>'}<form class="form cols" data-form="post" ${me.phoneVerified&&me.verified?'':'inert style="opacity:.5"'}><input name="title" placeholder="Title" required><select name="type"><option>Job</option><option>Internship</option><option>Course</option></select>
<input name="location" placeholder="Location" required><input name="pay" placeholder="Pay / price" required><textarea class="full" name="description" placeholder="Description"></textarea><button class="button button-dark full">Submit for review</button></form></div>
<div class="panel"><h3>My listings</h3>${table(['Title','Type','Status','Applicants',''],ls.map(l=>`<tr><td>${esc(l.title)}</td><td>${l.type}</td><td>${pill(l.status)}</td><td>${l.applicants}</td><td><button class="mini no" data-act="dellist" data-id="${l.id}">Delete</button></td></tr>`))}</div>
<div class="panel"><h3>Applicants</h3>${table(['Candidate','Email','For','Status'],ap.map(x=>`<tr><td>${esc(x.name)}</td><td>${esc(x.email)}</td><td>${esc(x.title)}</td><td><select data-appid="${x.id}">${['applied','reviewing','accepted','rejected'].map(s=>`<option ${s===x.status?'selected':''}>${s}</option>`).join('')}</select></td></tr>`))}</div></div>`}
  if(me.role==='admin'){const d=await api('/admin/data'),s=d.stats;
    a.innerHTML=`<div class="container page"><h2>Admin dashboard</h2><br><div class="stats">${Object.entries(s).map(([k,v])=>`<div class="stat"><b>${v}</b><span>${k}</span></div>`).join('')}</div>
<div class="panel"><h3>Listings</h3>${table(['Title','Org','Type','Status','Actions'],d.listings.map(l=>`<tr><td>${esc(l.title)}</td><td>${esc(l.orgName)}</td><td>${l.type}</td><td>${pill(l.status)}</td><td><button class="mini ok" data-act="lstat" data-id="${l.id}" data-s="approved">Approve</button> <button class="mini no" data-act="lstat" data-id="${l.id}" data-s="rejected">Reject</button> <button class="mini" data-act="dellist" data-id="${l.id}">Delete</button></td></tr>`))}</div>
<div class="panel"><h3>Verification queue</h3>${table(['Who','Type','Checks','Proof','Status',''],d.proofs.map(x=>`<tr><td>${esc(x.name)}<br><span class="desc">${esc(x.email)}</span></td><td>${x.role}</td><td>${x.signals?Object.entries({https:'HTTPS site',workEmail:'Work email',emailMatchesSite:'Email matches site',nameInSite:'Name in site'}).map(([k,t])=>`<span class="tag ${x.signals[k]?'tag-verified':'tag-warn'}">${t}</span>`).join(' '):'—'}${x.portal?`<br><a class="link" href="${esc(x.portal)}" target="_blank" rel="noopener noreferrer">Careers page</a>`:''}</td><td><button class="mini" data-act="viewproof" data-id="${x.id}">View</button></td><td>${pill(x.status)}</td><td><button class="mini ok" data-act="pstat" data-id="${x.id}" data-s="verified">Approve</button> <button class="mini no" data-act="pstat" data-id="${x.id}" data-s="rejected">Reject</button></td></tr>`))}</div>
<div class="panel"><h3>Users & organizations</h3>${table(['Name','Email','Role','Verified','Actions'],d.users.map(u=>`<tr><td>${esc(u.orgName||u.name)}</td><td>${esc(u.email)}</td><td>${u.role}</td><td>${u.verified?'✓':'—'}</td><td>${u.role==='org'?`<button class="mini ok" data-act="verify" data-id="${u.id}" data-s="${u.verified?'':'1'}">${u.verified?'Unverify':'Verify'}</button> `:''}${u.id===me.id?'':`<button class="mini no" data-act="deluser" data-id="${u.id}">Delete</button>`}</td></tr>`))}</div></div>`}
}

async function route(){
  const rid=route.n=(route.n||0)+1;await fb.ready();const gate=await loadMe();if(rid!==route.n)return;nav();if(me||gate==='verify')closeAuth();let r=location.hash.slice(2)||'';
  if(gate==='verify'||gate==='setup')r=gate;else if(!me&&!['','login','register','forgot','verify','setup','organizations'].includes(r))r='login';else if(me&&['login','register','forgot'].includes(r)){const n=sessionStorage.next;sessionStorage.removeItem('next');if(n&&n!==location.hash){location.hash=n;return}r=''}
  if(me?.role==='user'&&!me.onboarded)r='profile';else if(me&&me.role!=='user'&&r==='profile')r='dashboard';
  if(!me&&r==='phone')r='login';if(me?.role==='org'&&!me.proofStatus&&['','dashboard'].includes(r))r='proof';
  markNav(r);try{if(!['login','register'].includes(r))closeAuth();({'':home,login:()=>{home();openAuth('signin')},register:()=>{home();openAuth('signup')},organizations:orgPage,proof:proofView,forgot:()=>authView('forgot'),verify:()=>authView('verify'),setup:()=>authView('setup'),dashboard,profile:profileView,phone:phoneView}[r]||home)()}catch(e){toast(e.message)}}
addEventListener('hashchange',route);route();

document.addEventListener('click',async e=>{const b=e.target.closest('[data-act]');if(!b)return;const{act,id,s}=b.dataset;
  try{
    if(act==='logout'){await fb.out();me=null;location.hash='#/';route()}
    else if(act==='auth'){const r=b.getBoundingClientRect();openAuth(b.dataset.mode||'signin',b.dataset.role,{x:r.left+r.width/2,y:r.top+r.height/2})}
    else if(act==='closeauth'){closeAuth();if(/^#\/(login|register)$/.test(location.hash))history.replaceState(null,'','#/')}
    else if(act==='role')setRole(b.dataset.role)
    else if(act==='slide')slide(b.dataset.to)
    else if(act==='viewproof'){const w=window.open('','_blank');try{const r=await api('/proof/file/'+id),u8=Uint8Array.from(atob(r.data),c=>c.charCodeAt(0));w.location=URL.createObjectURL(new Blob([u8],{type:r.mime}))}catch(x){w?.close();throw x}}
    else if(act==='pstat'){await api('/admin/proof/'+id,'PATCH',{status:s});toast('Updated');dashboard()}
    else if(act==='theme'){const t=document.documentElement.dataset.theme==='dark'?'light':'dark';document.documentElement.dataset.theme=t;localStorage.theme=t}
    else if(act==='google'){await fb.google();closeAuth();location.hash='#/';route()}
    else if(act==='verified'){await fb.reload();if(!fb.user().emailVerified)toast('Not verified yet — check your inbox');route()}
    else if(act==='resend'){await fb.verify();toast('Verification email sent')}
    else if(act==='showpw'){const i=b.closest('.pw').querySelector('input'),hid=i.type==='password';i.type=hid?'text':'password';b.textContent=hid?'Hide':'Show';b.setAttribute('aria-label',hid?'Hide password':'Show password')}
    else if(act==='rmskill'){skills.splice(+id,1);chips()}
    else if(act==='rmresume'){await api('/resume','DELETE');resumeUI(null)}
    else if(act==='resendcode'){try{await phoneSend(ph.num);toast('New code sent')}catch(x){const el=$('#err');if(el)el.textContent=ferr(x)}}
    else if(act==='changenum'){fb.phoneReset();ph={step:1,num:'',cool:0,t:clearInterval(ph.t)};phoneRender()}
    else if(act==='tab'){f.type=id;document.querySelectorAll('.tabs button').forEach(t=>t.classList.toggle('active',t.dataset.id===id));loadListings()}
    else if(act==='clear'){f={type:'',q:'',loc:''};home()}
    else if(['save','apply'].includes(act)){if(!me){sessionStorage.next=location.hash||'#/';return openAuth('signin')}await api(`/${act}/${id}`,'POST');if(act==='apply')toast('Application sent!');location.hash.includes('dashboard')?dashboard():home()}
    else if(act==='dellist'){if(confirm('Delete this listing?')){await api('/listings/'+id,'DELETE');dashboard()}}
    else if(act==='lstat'){await api('/admin/listings/'+id,'PATCH',{status:s});dashboard()}
    else if(act==='verify'){await api('/admin/users/'+id,'PATCH',{verified:!!s});dashboard()}
    else if(act==='deluser'){if(confirm('Delete this account?')){await api('/admin/users/'+id,'DELETE');dashboard()}}
  }catch(x){if(x.code==='NOT_VERIFIED'){toast(x.message)}else if(x.code==='PHONE_REQUIRED'){toast(x.message);location.hash='#/phone'}else toast(ferr(x))}});
document.addEventListener('change',async e=>{const id=e.target.dataset.appid;if(!id)return;try{await api('/applications/'+id,'PATCH',{status:e.target.value});toast('Updated')}catch(x){toast(ferr(x))}});
document.addEventListener('submit',async e=>{const fm=e.target.dataset.form;if(!fm)return;e.preventDefault();const d=Object.fromEntries(new FormData(e.target)),sb=e.target.querySelector('button:not([type=button])');if(sb){sb.disabled=true;sb.classList.add('is-loading')}const er=e.target.querySelector('.err')||$('#err');if(er)er.textContent='';
  try{
    if(fm==='search'){f.q=d.q;f.loc=d.loc;loadListings()}
    else if(fm==='profile'){const fd=new FormData(e.target),pend=$('#skillin').value.trim();if(pend)addSkill(pend);await api('/profile','PUT',{...d,jobTypes:fd.getAll('jobTypes'),skills});toast('Profile saved');location.hash='#/dashboard';route()}
    else if(fm==='post'){await api('/listings','POST',d);toast('Submitted for review');dashboard()}
    else if(fm==='login'){const want=$('#authBox')?.dataset.role||'candidate';await fb.signIn(d.email,d.password);const g=await loadMe();if(g==='login'){await fb.out();throw{message:'Signed in, but we could not load your account ('+(loadMe.err||'no response')+'). Check that the server is running and try again.'}}
      if(me&&me.role!=='admin'&&(me.role==='org')!==(want==='org')){const wasOrg=me.role==='org';await fb.out();me=null;throw{message:wasOrg?'This is an organization account. Switch to Organization.':'This is a candidate account. Switch to Candidate.'}}
      closeAuth();location.hash='#/';route()}
    else if(fm==='register'){const org=$('#authBox')?.dataset.role==='org';d.role=org?'org':'user';
      if(org&&FREE.test(d.email))throw{message:'Use your work email. Free providers like Gmail are not accepted for organizations.'};
      await fb.signUp(d.email,d.password,d.name);await api('/init','POST',d);await fb.verify();closeAuth();route()}
    else if(fm==='forgot'){await fb.reset(d.email);toast('Reset link sent. Check your inbox.');location.hash='#/login'}
    else if(fm==='phone-send'){const num='+'+d.cc.replace(/\D/g,'')+d.num.replace(/\D/g,'').replace(/^0+/,'');if(!/^\+\d{8,15}$/.test(num))throw{message:'Enter a valid phone number'};
      try{await phoneSend(num)}catch(x){if(x.code==='auth/provider-already-linked'){await fb.reload();await phoneSync()}else throw x}}
    else if(fm==='phone-verify'){await fb.phoneConfirm(d.code.trim());
      try{await phoneSync()}catch(x){if(x.code==='PHONE_TAKEN')await fb.unlinkPhone().catch(()=>{});throw x}}
    else if(fm==='proof'){const{name,data}=await shrink(d.file);me=await api('/proof','POST',{portal:d.portal,name,data});toast('Submitted for review');location.hash='#/dashboard';route()}
    else if(fm==='setup'){await api('/init','POST',d);location.hash='#/dashboard';route()}
  }catch(x){er?er.textContent=ferr(x):toast(ferr(x))}finally{if(sb){sb.disabled=false;sb.classList.remove('is-loading')}}});

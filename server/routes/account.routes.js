const {R,bad,need}=require('../lib/router');
const {db,save}=require('../db/store');
const {pub,meOf,ORG_TYPES,isFree}=require('../lib/helpers');
const {PHONE_EMAIL_CLIENT_ID}=require('../config');
// Sign-up profile creation, /me and phone verification.
R('POST','/api/init','fb',({fb,body:b})=>{
  if(db.users.some(u=>u.id===fb.sub))bad(409,'Profile already exists');
  const email=(fb.email||'').toLowerCase();
  const role=b.role==='org'?'org':'user';if(role==='org'){need(b,'orgName');if(!ORG_TYPES.includes(b.orgType))bad(400,'Choose your organization type: small business or enterprise');if(b.orgType==='enterprise'&&isFree(email))bad(400,'Enterprise organizations must use a work email. Small businesses can use Gmail.')}
  const u={id:fb.sub,name:String(b.name||fb.name||email.split('@')[0]).trim(),email,role,orgName:role==='org'?b.orgName.trim():undefined,orgType:role==='org'?b.orgType:undefined,website:role==='org'?String(b.website||'').trim().slice(0,200):undefined,verified:role!=='org',created:new Date().toISOString()};
  db.users.push(u);save();return pub(u)});
R('GET','/api/me',['user','org','admin'],({user})=>meOf(user));
// Phone: phone.email runs the SMS + OTP in a popup and hands the browser a short-lived access_token.
// We never trust a number sent by the browser: the server exchanges the token with phone.email and stores the number it returns.
R('POST','/api/phone/verify',['user','org'],async({user,body:b})=>{
  if(!PHONE_EMAIL_CLIENT_ID)bad(503,'Phone verification is not set up yet. The site owner must add a phone.email Client ID.','NOT_CONFIGURED');
  const tok=String(b.access_token||'').trim();if(!tok||tok.length>4000)bad(400,'Missing verification token','PHONE_FAILED');
  const fd=new FormData();fd.append('access_token',tok);fd.append('client_id',PHONE_EMAIL_CLIENT_ID);
  let d;try{d=await (await fetch('https://eapi.phone.email/getuser',{method:'POST',body:fd,signal:AbortSignal.timeout(10000)})).json()}
  catch{bad(502,'Could not reach the phone verification service. Please try again.','PHONE_UNREACHABLE')}
  const ph=d&&d.status===200&&d.phone_no?'+'+String(d.country_code||'').replace(/\D/g,'')+String(d.phone_no).replace(/\D/g,''):'';
  if(!/^\+\d{8,15}$/.test(ph))bad(400,'Phone verification failed or expired. Please try again.','PHONE_FAILED');
  if(db.users.some(u=>u.id!==user.id&&u.phone===ph))bad(409,'This phone number is already used by another account','PHONE_TAKEN');
  user.phone=ph;user.phoneAt=new Date().toISOString();save();return meOf(user)});

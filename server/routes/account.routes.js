const {R,bad,need}=require('../lib/router');
const {db,save}=require('../db/store');
const {pub,meOf,ORG_TYPES,isFree}=require('../lib/helpers');
// Sign-up profile creation, /me and phone sync.
R('POST','/api/init','fb',({fb,body:b})=>{
  if(db.users.some(u=>u.id===fb.sub))bad(409,'Profile already exists');
  const email=(fb.email||'').toLowerCase();
  const role=b.role==='org'?'org':'user';if(role==='org'){need(b,'orgName');if(!ORG_TYPES.includes(b.orgType))bad(400,'Choose your organization type: small business or enterprise');if(b.orgType==='enterprise'&&isFree(email))bad(400,'Enterprise organizations must use a work email. Small businesses can use Gmail.')}
  const u={id:fb.sub,name:String(b.name||fb.name||email.split('@')[0]).trim(),email,role,orgName:role==='org'?b.orgName.trim():undefined,orgType:role==='org'?b.orgType:undefined,website:role==='org'?String(b.website||'').trim().slice(0,200):undefined,verified:role!=='org',created:new Date().toISOString()};
  db.users.push(u);save();return pub(u)});
R('GET','/api/me',['user','org','admin'],({user})=>meOf(user));
// Phone: Firebase does the SMS + OTP check; the verified number then appears as `phone_number` in the ID token.
// Firebase already refuses to link one number to two accounts; we double-check here and store it.
R('POST','/api/phone/sync',['user','org'],({user,fb})=>{
  const ph=fb.phone_number;if(!ph)bad(400,'Phone not verified yet','NO_PHONE');
  if(db.users.some(u=>u.id!==user.id&&u.phone===ph))bad(409,'This phone number is already used by another account','PHONE_TAKEN');
  user.phone=ph;user.phoneAt=new Date().toISOString();save();return meOf(user)});

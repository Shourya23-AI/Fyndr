const {R,bad,need}=require('../lib/router');
const {db,save}=require('../db/store');
const {uid,gmailAllowed}=require('../lib/helpers');
// Organization: post listings, see own listings and applicants.
R('POST','/api/listings',['org'],({user,body:b})=>{
  if(!user.verified)bad(403,'Your organization must be verified before posting','NOT_VERIFIED');if(!gmailAllowed(user))bad(403,'Posting with a Gmail or other free email is not enabled for your organization. Use a work email, or ask Fyndr admin to allow it.','FREE_EMAIL');if(!user.phone)bad(403,'Verify your phone number before posting','PHONE_REQUIRED');
  need(b,'title','type','location','pay');if(!['Job','Internship','Course'].includes(b.type))bad(400,'Invalid type');
  db.listings.push({id:uid(),orgId:user.id,orgName:user.orgName,title:b.title.trim(),type:b.type,location:b.location.trim(),pay:b.pay.trim(),description:(b.description||'').trim(),status:'pending',created:new Date().toISOString()});save();return{ok:1}});
R('GET','/api/org/listings',['org'],({user})=>db.listings.filter(l=>l.orgId===user.id).map(l=>({...l,applicants:db.applications.filter(a=>a.listingId===l.id).length})));
R('GET','/api/org/applications',['org'],({user})=>{
  const mine=db.listings.filter(l=>l.orgId===user.id);
  return db.applications.filter(a=>mine.some(l=>l.id===a.listingId)).map(a=>{const u=db.users.find(x=>x.id===a.userId)||{};return{...a,title:mine.find(l=>l.id===a.listingId).title,name:u.name,email:u.email}})});
// Org opens the resume an applicant chose: their own PDF, or the profile data the website resume is built from.
R('GET','/api/org/applications/:id/resume',['org'],({user,p})=>{
  const a=db.applications.find(x=>x.id===p[0]),l=a&&db.listings.find(x=>x.id===a.listingId);
  if(!l||l.orgId!==user.id)bad(404,'Not found');const u=db.users.find(x=>x.id===a.userId);if(!u)bad(404,'Candidate not found');
  if(a.resumeType==='own'&&u.resume){const f=require('path').join(require('../config').UP_DIR,u.id+'.pdf');try{return{type:'own',mime:'application/pdf',data:require('fs').readFileSync(f).toString('base64')}}catch{bad(404,'Resume file missing')}}
  return{type:'site',name:u.name,email:u.email,phone:u.phone||null,photo:u.photo||null,profile:u.profile||{}}});
R('PATCH','/api/applications/:id',['org'],({user,p,body:b})=>{
  const a=db.applications.find(x=>x.id===p[0]),l=a&&db.listings.find(x=>x.id===a.listingId);
  if(!l||l.orgId!==user.id)bad(404,'Not found');if(!['applied','reviewing','interview','accepted','rejected'].includes(b.status))bad(400,'Bad status');
  a.status=b.status;save();return{ok:1}});
R('DELETE','/api/listings/:id',['org','admin'],({user,p})=>{
  const l=db.listings.find(x=>x.id===p[0]);if(!l||(user.role==='org'&&l.orgId!==user.id))bad(404,'Not found');
  db.listings=db.listings.filter(x=>x!==l);db.applications=db.applications.filter(a=>a.listingId!==l.id);save();return{ok:1}});

const {R,bad,need}=require('../lib/router');
const {db,save}=require('../db/store');
const {uid}=require('../lib/helpers');
// Candidate actions: my applications/saved, apply, save.
R('GET','/api/my',['user'],({user})=>({
  saved:db.saved.filter(s=>s.userId===user.id).map(s=>s.listingId),
  applications:db.applications.filter(a=>a.userId===user.id).map(a=>({...a,listing:db.listings.find(l=>l.id===a.listingId)}))}));
const onboarded=u=>{if(!u.profile?.done)bad(403,'Complete your profile first')};
R('POST','/api/apply/:id',['user'],({user,p,body:b})=>{onboarded(user);if(!user.phone)bad(403,'Verify your phone number before applying','PHONE_REQUIRED');
  const l=db.listings.find(x=>x.id===p[0]&&x.status==='approved');if(!l)bad(404,'Listing not found');
  if(db.applications.some(a=>a.userId===user.id&&a.listingId===l.id))bad(409,'Already applied');
  const rt=b&&b.resume==='own'?'own':'site';if(rt==='own'&&!user.resume)bad(400,'Upload your resume first');
  db.applications.push({id:uid(),userId:user.id,listingId:l.id,status:'applied',resumeType:rt,created:new Date().toISOString()});save();return{ok:1}});
R('POST','/api/save/:id',['user'],({user,p})=>{onboarded(user);
  const i=db.saved.findIndex(s=>s.userId===user.id&&s.listingId===p[0]);
  if(i>=0)db.saved.splice(i,1);else db.saved.push({userId:user.id,listingId:p[0]});save();return{saved:i<0}});

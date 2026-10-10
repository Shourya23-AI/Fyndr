import {ADMIN_EMAILS} from './config.js';
import {db,save,uid,now,bad} from './store.js';
import {QUAL,EXP,JT,pub,completion,cleanExtras,meOf,need,listings,signals,ORG_TYPES,isFree,gmailAllowed,adminData} from './helpers.js';
// Same routes as the Node server (server/routes/*), answered from localStorage.
export async function localApi(path,method,b={},fu){
  const url=new URL(path,'http://x'),p=url.pathname,q=url.searchParams,id=p.split('/').pop();
  const k=method+' '+p.replace(/^(\/(?:apply|save|listings|applications|admin\/listings|admin\/orgs|admin\/users|admin\/proof|proof\/file))\/[^/]+$/,'$1/:id');
  if(!fu)bad('Please log in');
  if(k==='GET /listings')return listings(q);
  if(k==='POST /init'){
    if(db.users.some(u=>u.id===fu.uid))bad('Profile already exists');
    const role=b.role==='org'?'org':'user';if(role==='org'){need(b,'orgName');if(!ORG_TYPES.includes(b.orgType))bad('Choose your organization type: small business or enterprise');if(b.orgType==='enterprise'&&isFree(fu.email))bad('Enterprise organizations must use a work email. Small businesses can use Gmail.')}
    const u={id:fu.uid,name:String(b.name||fu.displayName||(fu.email||'').split('@')[0]).trim(),email:(fu.email||'').toLowerCase(),role,orgName:role==='org'?b.orgName.trim():undefined,orgType:role==='org'?b.orgType:undefined,website:role==='org'?String(b.website||'').trim().slice(0,200):undefined,verified:role!=='org',created:now()};
    db.users.push(u);save();return pub(u)}
  const user=db.users.find(x=>x.id===fu.uid);if(!user)bad('no profile');
  if(user.role!=='admin'&&ADMIN_EMAILS.map(e=>e.toLowerCase()).includes((fu.email||'').toLowerCase())){Object.assign(user,{role:'admin',verified:true});delete user.orgName;save()}
  const only=(...r)=>{if(!r.includes(user.role))bad('Forbidden')};
  const onboarded=()=>{if(!user.profile?.done)bad('Complete your profile first')};
  const om=p.match(/^\/org\/applications\/([^/]+)\/resume$/);
  if(method==='GET'&&om){only('org');const a=db.applications.find(x=>x.id===om[1]),l=a&&db.listings.find(x=>x.id===a.listingId);if(!l||l.orgId!==user.id)bad('Not found');const u=db.users.find(x=>x.id===a.userId);if(!u)bad('Candidate not found');
    if(a.resumeType==='own'&&u.resume&&u.resumeData)return{type:'own',mime:'application/pdf',data:u.resumeData};
    return{type:'site',name:u.name,email:u.email,phone:u.phone||null,photo:u.photo||null,profile:u.profile||{}}}
  switch(k){
    case'GET /me':return meOf(user);
    case'POST /proof':{only('user','org');let r;try{r=atob(String(b.data||''))}catch{bad('Invalid file')}
      const mime=r.startsWith('%PDF-')?'application/pdf':r.startsWith('\xFF\xD8')?'image/jpeg':r.startsWith('\x89PNG')?'image/png':(r.startsWith('RIFF')&&r.slice(8,12)==='WEBP')?'image/webp':null;
      if(!mime)bad('Upload a clear photo (JPG, PNG, WebP) or a PDF');if(r.length>2*1024*1024)bad('File must be under 2 MB');
      let portal='';if(user.role==='org'){portal=String(b.portal||'').trim().slice(0,200);if(!/^https:\/\/[^\s]+\.[^\s]+$/i.test(portal))bad('Enter your careers page link starting with https://')}
      user.proof={portal,mime,name:String(b.name||'proof').replace(/[^\w.\- ]/g,'').slice(0,80),size:r.length,status:'pending',at:now()};user.proofData=b.data;
      try{save()}catch{delete user.proof;delete user.proofData;bad('Browser storage is full. Use a smaller file.')}return meOf(user)}
    case'GET /proof/file/:id':{const u=db.users.find(x=>x.id===id);if(!u?.proof||(u.id!==user.id&&user.role!=='admin'))bad('Not found');return{mime:u.proof.mime,data:u.proofData}}
    case'PATCH /admin/proof/:id':{only('admin');const u=db.users.find(x=>x.id===id);if(!u?.proof)bad('Not found');if(!['verified','rejected'].includes(b.status))bad('Bad status');
      u.proof.status=b.status;if(u.role==='org')u.verified=b.status==='verified';save();return{ok:1}}
    case'POST /phone/sync':{only('user','org');const ph=fu.phoneNumber;if(!ph)bad('Phone not verified yet','NO_PHONE');
      if(db.users.some(u=>u.id!==user.id&&u.phone===ph))bad('This phone number is already used by another account','PHONE_TAKEN');
      user.phone=ph;save();return meOf(user)}
    case'GET /my':only('user');return{saved:db.saved.filter(s=>s.userId===user.id).map(s=>s.listingId),applications:db.applications.filter(a=>a.userId===user.id).map(a=>({...a,listing:db.listings.find(l=>l.id===a.listingId)}))};
    case'POST /apply/:id':{only('user');onboarded();const rt=b.resume==='own'?'own':'site';if(rt==='own'&&!user.resume)bad('Upload your resume first');if(!user.phone)bad('Verify your phone number before applying','PHONE_REQUIRED');
      const l=db.listings.find(x=>x.id===id&&x.status==='approved');if(!l)bad('Listing not found');
      if(db.applications.some(a=>a.userId===user.id&&a.listingId===id))bad('Already applied');
      db.applications.push({id:uid(),userId:user.id,listingId:id,status:'applied',resumeType:rt,created:now()});save();return{ok:1}}
    case'POST /save/:id':{only('user');onboarded();const i=db.saved.findIndex(s=>s.userId===user.id&&s.listingId===id);
      if(i>=0)db.saved.splice(i,1);else db.saved.push({userId:user.id,listingId:id});save();return{saved:i<0}}
    case'GET /profile':only('user');return{profile:user.profile||{},resume:user.resume||null,completion:completion(user),phone:user.phone||null,name:user.name,email:user.email,photo:user.photo||null,joined:user.created};
    case'PUT /profile':{only('user');need(b,'qualification','field','institution','experience');
      const yr=+b.gradYear;if(!(yr>=1970&&yr<=new Date().getFullYear()+8))bad('Enter a valid graduation year');
      if(!QUAL.includes(b.qualification)||!EXP.includes(b.experience))bad('Invalid selection');
      const skills=[...new Set((Array.isArray(b.skills)?b.skills:[]).map(s=>String(s).trim().slice(0,30)).filter(Boolean))].slice(0,30);if(!skills.length)bad('Add at least one skill');
      user.profile={qualification:b.qualification,field:b.field.trim().slice(0,80),institution:b.institution.trim().slice(0,100),gradYear:yr,skills,experience:b.experience,jobTypes:(Array.isArray(b.jobTypes)?b.jobTypes:[]).filter(t=>JT.includes(t)),locations:String(b.locations||'').trim().slice(0,150),headline:String(b.headline||'').trim().slice(0,100),summary:String(b.summary||'').trim().slice(0,500),projects:String(b.projects||'').trim().slice(0,800),link:String(b.link||'').trim().slice(0,200),...cleanExtras(b,skills),done:true};
      save();return{completion:completion(user)}}
    case'POST /resume':{only('user');let ok=false;try{ok=atob(String(b.data||'').slice(0,8)).startsWith('%PDF-')}catch{}
      if(!ok)bad('Only PDF files are allowed');user.resume={name:String(b.name||'resume.pdf').replace(/[^\w.\- ]/g,'').slice(0,80),size:Math.floor(b.data.length*3/4),at:now()};user.resumeData=b.data;try{save()}catch{delete user.resume;delete user.resumeData;bad('Browser storage is full. Use a smaller file.')}return user.resume}
    case'GET /resume/file':only('user');if(!user.resume||!user.resumeData)bad('No resume uploaded');return{mime:'application/pdf',data:user.resumeData};
    case'POST /photo':{only('user');const d=String(b.data||'');if(!/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(d)||d.length>400000)bad('Upload a JPG, PNG or WebP photo');user.photo=d;save();return{photo:d}}
    case'DELETE /photo':only('user');delete user.photo;save();return{ok:1}
    case'DELETE /resume':only('user');delete user.resume;delete user.resumeData;save();return{ok:1};
    case'POST /listings':{only('org');if(!user.verified)bad('Your organization must be verified before posting','NOT_VERIFIED');if(!gmailAllowed(user))bad('Posting with a Gmail or other free email is not enabled for your organization. Use a work email, or ask Fyndr admin to allow it.','FREE_EMAIL');if(!user.phone)bad('Verify your phone number before posting','PHONE_REQUIRED');need(b,'title','type','location','pay');
      if(!['Job','Internship','Course'].includes(b.type))bad('Invalid type');
      db.listings.push({id:uid(),orgId:user.id,orgName:user.orgName,title:b.title.trim(),type:b.type,location:b.location.trim(),pay:b.pay.trim(),description:(b.description||'').trim(),status:'pending',created:now()});save();return{ok:1}}
    case'GET /org/listings':only('org');return db.listings.filter(l=>l.orgId===user.id).map(l=>({...l,applicants:db.applications.filter(a=>a.listingId===l.id).length}));
    case'GET /org/applications':{only('org');const mine=db.listings.filter(l=>l.orgId===user.id);
      return db.applications.filter(a=>mine.some(l=>l.id===a.listingId)).map(a=>{const u=db.users.find(x=>x.id===a.userId)||{};return{...a,title:mine.find(l=>l.id===a.listingId).title,name:u.name,email:u.email}})}
    case'PATCH /applications/:id':{only('org');const a=db.applications.find(x=>x.id===id),l=a&&db.listings.find(x=>x.id===a.listingId);
      if(!l||l.orgId!==user.id)bad('Not found');if(!['applied','reviewing','interview','accepted','rejected'].includes(b.status))bad('Bad status');a.status=b.status;save();return{ok:1}}
    case'DELETE /listings/:id':{only('org','admin');const l=db.listings.find(x=>x.id===id);if(!l||(user.role==='org'&&l.orgId!==user.id))bad('Not found');
      db.listings=db.listings.filter(x=>x!==l);db.applications=db.applications.filter(a=>a.listingId!==id);save();return{ok:1}}
    case'GET /admin/data':only('admin');return adminData(db);
    case'PATCH /admin/orgs/:id':{only('admin');const u=db.users.find(x=>x.id===id&&x.role==='org');if(!u)bad('Organization not found');
      if('orgType' in b){if(!ORG_TYPES.includes(b.orgType))bad('Bad organization type');u.orgType=b.orgType}
      if('gmailOk' in b){if(b.gmailOk===null)delete u.gmailOk;else if(typeof b.gmailOk==='boolean')u.gmailOk=b.gmailOk;else bad('Bad value')}
      save();return{ok:1}}
    case'PATCH /admin/listings/:id':{only('admin');const l=db.listings.find(x=>x.id===id);if(!l)bad('Not found');if(!['approved','rejected','pending'].includes(b.status))bad('Bad status');l.status=b.status;save();return{ok:1}}
    case'PATCH /admin/users/:id':{only('admin');const u=db.users.find(x=>x.id===id);if(!u)bad('Not found');u.verified=!!b.verified;save();return{ok:1}}
    case'DELETE /admin/users/:id':{only('admin');if(id===user.id)bad("You can't delete yourself");
      db.users=db.users.filter(u=>u.id!==id);db.listings=db.listings.filter(l=>l.orgId!==id);db.applications=db.applications.filter(a=>a.userId!==id&&db.listings.some(l=>l.id===a.listingId));save();return{ok:1}}
  }
  bad('Not found');
}

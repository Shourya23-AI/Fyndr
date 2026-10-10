// Browser-only backend for Live Server (no Node needed).
// Data lives in this browser's localStorage, so it is for local testing only: nothing is shared between users or devices.
export const ADMIN_EMAILS=[]; // e.g. ['you@gmail.com'] to get the admin dashboard
const KEY='fyndr-db',uid=()=>Math.random().toString(36).slice(2,14),now=()=>new Date().toISOString();
const QUAL=['High School','Diploma',"Bachelor's","Master's",'PhD','Other'],EXP=['Student / Fresher','0–1 years','1–3 years','3–5 years','5+ years'],JT=['Job','Internship','Freelance','Course'];
const bad=(m,code)=>{throw Object.assign(new Error(m),{code})};
let db=JSON.parse(localStorage.getItem(KEY)||'null');
if(!db){
  const L=(title,type,location,pay,description)=>({id:uid(),orgId:'seed-org',orgName:'Linear',title,type,location,pay,description,status:'approved',created:now()});
  db={users:[{id:'seed-org',name:'Linear HR',email:'',role:'org',orgName:'Linear',verified:true,created:now()}],applications:[],saved:[],listings:[
    L('Product Design Intern','Internship','Remote · Worldwide','$2,000–$3,000 / month','Work with our design team on real product features.'),
    L('Junior Frontend Developer','Job','New York, NY · Hybrid','$75K–$95K / year','Build and ship UI with React and TypeScript.'),
    L('Data Analytics Certificate','Course','Online · Self-paced','$14 / month','Learn SQL, spreadsheets and dashboards.')]};
}
const save=()=>localStorage.setItem(KEY,JSON.stringify(db));
const pub=u=>({id:u.id,name:u.name,email:u.email,role:u.role,orgName:u.orgName,verified:u.verified,phoneVerified:!!u.phone,created:u.created});
const completion=u=>{const p=u.profile||{};return Math.round([p.qualification,p.field,p.institution,p.gradYear,p.skills?.length,p.experience,p.jobTypes?.length,p.locations,u.resume].filter(Boolean).length/9*100)};
const meOf=u=>({...pub(u),proofStatus:u.proof?.status,portal:u.proof?.portal,phoneMasked:u.phone?u.phone.replace(/\d(?=\d{4})/g,'•'):undefined,...(u.role==='user'?{onboarded:!!u.profile?.done,completion:completion(u)}:{})});
const need=(b,...k)=>k.forEach(x=>{if(!String(b[x]||'').trim())bad(x+' is required')});
function listings(q){
  const s=(q.get('q')||'').toLowerCase(),t=q.get('type'),l=(q.get('loc')||'').toLowerCase(),org=Object.fromEntries(db.users.filter(u=>u.role==='org').map(u=>[u.id,u.verified]));
  return db.listings.filter(x=>x.status==='approved'&&(!t||x.type===t)&&(!s||(x.title+x.orgName+x.description).toLowerCase().includes(s))&&(!l||x.location.toLowerCase().includes(l)))
    .sort((a,b)=>b.created.localeCompare(a.created)).map(x=>({...x,orgVerified:!!org[x.orgId]}))}

const FREE=/@(gmail|yahoo|outlook|hotmail|proton|protonmail|icloud|aol)\./i;
const signals=u=>{const h=(()=>{try{return new URL(u.proof.portal).hostname.replace(/^www\./,'')}catch{return''}})(),ed=(u.email.split('@')[1]||'').toLowerCase(),tok=(u.orgName||'').toLowerCase().replace(/[^a-z0-9]/g,'').slice(0,6);
  return{https:(u.proof.portal||'').startsWith('https://'),workEmail:!FREE.test(u.email),emailMatchesSite:!!h&&(ed===h||ed.endsWith('.'+h)||h.endsWith('.'+ed)),nameInSite:!!tok&&h.replace(/[^a-z0-9]/g,'').includes(tok)}};
export async function localApi(path,method,b={},fu){
  const url=new URL(path,'http://x'),p=url.pathname,q=url.searchParams,id=p.split('/').pop();
  const k=method+' '+p.replace(/^(\/(?:apply|save|listings|applications|admin\/listings|admin\/users|admin\/proof|proof\/file))\/[^/]+$/,'$1/:id');
  if(!fu)bad('Please log in');
  if(k==='GET /listings')return listings(q);
  if(k==='POST /init'){
    if(db.users.some(u=>u.id===fu.uid))bad('Profile already exists');
    const role=b.role==='org'?'org':'user';if(role==='org'){need(b,'orgName');if(/@(gmail|yahoo|outlook|hotmail|proton|protonmail|icloud|aol)\./i.test(fu.email||''))bad('Use your work email. Free providers are not accepted for organizations.')}
    const u={id:fu.uid,name:String(b.name||fu.displayName||(fu.email||'').split('@')[0]).trim(),email:(fu.email||'').toLowerCase(),role,orgName:role==='org'?b.orgName.trim():undefined,website:role==='org'?String(b.website||'').trim().slice(0,200):undefined,verified:role!=='org',created:now()};
    db.users.push(u);save();return pub(u)}
  const user=db.users.find(x=>x.id===fu.uid);if(!user)bad('no profile');
  if(user.role!=='admin'&&ADMIN_EMAILS.map(e=>e.toLowerCase()).includes((fu.email||'').toLowerCase())){Object.assign(user,{role:'admin',verified:true});delete user.orgName;save()}
  const only=(...r)=>{if(!r.includes(user.role))bad('Forbidden')};
  const onboarded=()=>{if(!user.profile?.done)bad('Complete your profile first')};
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
    case'POST /apply/:id':{only('user');onboarded();if(!user.phone)bad('Verify your phone number before applying','PHONE_REQUIRED');
      const l=db.listings.find(x=>x.id===id&&x.status==='approved');if(!l)bad('Listing not found');
      if(db.applications.some(a=>a.userId===user.id&&a.listingId===id))bad('Already applied');
      db.applications.push({id:uid(),userId:user.id,listingId:id,status:'applied',created:now()});save();return{ok:1}}
    case'POST /save/:id':{only('user');onboarded();const i=db.saved.findIndex(s=>s.userId===user.id&&s.listingId===id);
      if(i>=0)db.saved.splice(i,1);else db.saved.push({userId:user.id,listingId:id});save();return{saved:i<0}}
    case'GET /profile':only('user');return{profile:user.profile||{},resume:user.resume||null,completion:completion(user)};
    case'PUT /profile':{only('user');need(b,'qualification','field','institution','experience');
      const yr=+b.gradYear;if(!(yr>=1970&&yr<=new Date().getFullYear()+8))bad('Enter a valid graduation year');
      if(!QUAL.includes(b.qualification)||!EXP.includes(b.experience))bad('Invalid selection');
      const skills=[...new Set((Array.isArray(b.skills)?b.skills:[]).map(s=>String(s).trim().slice(0,30)).filter(Boolean))].slice(0,30);if(!skills.length)bad('Add at least one skill');
      user.profile={qualification:b.qualification,field:b.field.trim().slice(0,80),institution:b.institution.trim().slice(0,100),gradYear:yr,skills,experience:b.experience,jobTypes:(Array.isArray(b.jobTypes)?b.jobTypes:[]).filter(t=>JT.includes(t)),locations:String(b.locations||'').trim().slice(0,150),done:true};
      save();return{completion:completion(user)}}
    case'POST /resume':{only('user');let ok=false;try{ok=atob(String(b.data||'').slice(0,8)).startsWith('%PDF-')}catch{}
      if(!ok)bad('Only PDF files are allowed');user.resume={name:String(b.name||'resume.pdf').replace(/[^\w.\- ]/g,'').slice(0,80),size:Math.floor(b.data.length*3/4),at:now()};save();return user.resume} // file itself is not stored in this mode
    case'DELETE /resume':only('user');delete user.resume;save();return{ok:1};
    case'POST /listings':{only('org');if(!user.verified)bad('Your organization must be verified before posting','NOT_VERIFIED');if(!user.phone)bad('Verify your phone number before posting','PHONE_REQUIRED');need(b,'title','type','location','pay');
      if(!['Job','Internship','Course'].includes(b.type))bad('Invalid type');
      db.listings.push({id:uid(),orgId:user.id,orgName:user.orgName,title:b.title.trim(),type:b.type,location:b.location.trim(),pay:b.pay.trim(),description:(b.description||'').trim(),status:'pending',created:now()});save();return{ok:1}}
    case'GET /org/listings':only('org');return db.listings.filter(l=>l.orgId===user.id).map(l=>({...l,applicants:db.applications.filter(a=>a.listingId===l.id).length}));
    case'GET /org/applications':{only('org');const mine=db.listings.filter(l=>l.orgId===user.id);
      return db.applications.filter(a=>mine.some(l=>l.id===a.listingId)).map(a=>{const u=db.users.find(x=>x.id===a.userId)||{};return{...a,title:mine.find(l=>l.id===a.listingId).title,name:u.name,email:u.email}})}
    case'PATCH /applications/:id':{only('org');const a=db.applications.find(x=>x.id===id),l=a&&db.listings.find(x=>x.id===a.listingId);
      if(!l||l.orgId!==user.id)bad('Not found');if(!['applied','reviewing','accepted','rejected'].includes(b.status))bad('Bad status');a.status=b.status;save();return{ok:1}}
    case'DELETE /listings/:id':{only('org','admin');const l=db.listings.find(x=>x.id===id);if(!l||(user.role==='org'&&l.orgId!==user.id))bad('Not found');
      db.listings=db.listings.filter(x=>x!==l);db.applications=db.applications.filter(a=>a.listingId!==id);save();return{ok:1}}
    case'GET /admin/data':only('admin');return{stats:{users:db.users.filter(u=>u.role==='user').length,orgs:db.users.filter(u=>u.role==='org').length,listings:db.listings.length,pending:db.listings.filter(l=>l.status==='pending').length,applications:db.applications.length},users:db.users.map(pub),listings:db.listings,proofs:db.users.filter(u=>u.proof).map(u=>({id:u.id,name:u.orgName||u.name,email:u.email,role:u.role,portal:u.proof.portal,status:u.proof.status,signals:u.role==='org'?signals(u):null}))};
    case'PATCH /admin/listings/:id':{only('admin');const l=db.listings.find(x=>x.id===id);if(!l)bad('Not found');if(!['approved','rejected','pending'].includes(b.status))bad('Bad status');l.status=b.status;save();return{ok:1}}
    case'PATCH /admin/users/:id':{only('admin');const u=db.users.find(x=>x.id===id);if(!u)bad('Not found');u.verified=!!b.verified;save();return{ok:1}}
    case'DELETE /admin/users/:id':{only('admin');if(id===user.id)bad("You can't delete yourself");
      db.users=db.users.filter(u=>u.id!==id);db.listings=db.listings.filter(l=>l.orgId!==id);db.applications=db.applications.filter(a=>a.userId!==id&&db.listings.some(l=>l.id===a.listingId));save();return{ok:1}}
  }
  bad('Not found');
}

const {R}=require('../lib/router');
const {db}=require('../db/store');
// Public listing search (any signed-in role).
R('GET','/api/listings',['user','org','admin'],({q})=>{
  const s=(q.get('q')||'').toLowerCase(),t=q.get('type'),l=(q.get('loc')||'').toLowerCase();
  const org=Object.fromEntries(db.users.filter(u=>u.role==='org').map(u=>[u.id,u.verified]));
  return db.listings.filter(x=>x.status==='approved'&&(!t||t.split(',').includes(x.type))&&(!s||(x.title+x.orgName+x.description).toLowerCase().includes(s))&&(!l||x.location.toLowerCase().includes(l)))
    .sort((a,b)=>b.created.localeCompare(a.created)).map(x=>({...x,orgVerified:!!org[x.orgId]}))});

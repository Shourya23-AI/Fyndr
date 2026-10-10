const {R,bad,need}=require('../lib/router');
const {db,save}=require('../db/store');
const {adminData,ORG_TYPES}=require('../lib/helpers');
// Admin: review proofs, listings and users.
R('PATCH','/api/admin/proof/:id',['admin'],({p,body:b})=>{const u=db.users.find(x=>x.id===p[0]);if(!u?.proof)bad(404,'Not found');
  if(!['verified','rejected'].includes(b.status))bad(400,'Bad status');u.proof.status=b.status;if(u.role==='org')u.verified=b.status==='verified';save();return{ok:1}});
R('GET','/api/admin/data',['admin'],()=>adminData(db));
// Admin: change an organization's size and/or whether it may post with a Gmail-type address (true / false / null = default by size).
R('PATCH','/api/admin/orgs/:id',['admin'],({p,body:b})=>{
  const u=db.users.find(x=>x.id===p[0]&&x.role==='org');if(!u)bad(404,'Organization not found');
  if('orgType' in b){if(!ORG_TYPES.includes(b.orgType))bad(400,'Bad organization type');u.orgType=b.orgType}
  if('gmailOk' in b){if(b.gmailOk===null)delete u.gmailOk;else if(typeof b.gmailOk==='boolean')u.gmailOk=b.gmailOk;else bad(400,'Bad value')}
  save();return{ok:1}});
R('PATCH','/api/admin/listings/:id',['admin'],({p,body:b})=>{
  const l=db.listings.find(x=>x.id===p[0]);if(!l)bad(404,'Not found');if(!['approved','rejected','pending'].includes(b.status))bad(400,'Bad status');
  l.status=b.status;save();return{ok:1}});
R('PATCH','/api/admin/users/:id',['admin'],({p,body:b})=>{
  const u=db.users.find(x=>x.id===p[0]);if(!u)bad(404,'Not found');u.verified=!!b.verified;save();return{ok:1}});
R('DELETE','/api/admin/users/:id',['admin'],({user,p})=>{
  if(p[0]===user.id)bad(400,"You can't delete yourself");
  db.users=db.users.filter(u=>u.id!==p[0]);db.listings=db.listings.filter(l=>l.orgId!==p[0]);
  db.applications=db.applications.filter(a=>a.userId!==p[0]&&db.listings.some(l=>l.id===a.listingId));
  save();return{ok:1}});

import {S} from '../../core/state.js';
import {esc,fmt,table,pill} from '../../core/dom.js';
import {api} from '../../core/api.js';
// Admin dashboard (sidebar like the candidate one): Overview · Organizations · Listings · Verification · Candidates.
// Data comes from GET /admin/data. Org size + Gmail-posting controls are <select>s handled by onChange in dashboard.actions.js.
const TABS=[['overview','Overview','M4 13h6V4H4zM14 20h6V4h-6zM4 20h6v-3H4z'],['orgs','Organizations','M4 21V7l8-4 8 4v14M9 21v-6h6v6'],['listings','Listings','M4 7h16v12H4zM9 7V4h6v3'],['verify','Verification','M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6zM9 12l2 2 4-4'],['people','Candidates','M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zm-8 9a8 8 0 0 1 16 0']];
const SIZE={small:'Small business',enterprise:'Enterprise'};
const head=(t,d)=>`<div class="dash-head"><h2>${t}</h2><p class="desc">${d}</p></div>`;
const url=u=>/^https?:\/\//i.test(u||'')?`<br><a class="link" href="${esc(u)}" target="_blank" rel="noopener noreferrer">${esc(u.replace(/^https?:\/\//i,''))}</a>`:'';
const sel=(attr,id,cur,opts)=>`<select ${attr}="${id}">${opts.map(([v,t])=>`<option value="${v}" ${v===cur?'selected':''}>${t}</option>`).join('')}</select>`;
const lstActs=l=>`<button class="mini ok" data-act="lstat" data-id="${l.id}" data-s="approved">Approve</button> <button class="mini no" data-act="lstat" data-id="${l.id}" data-s="rejected">Reject</button> <button class="mini" data-act="dellist" data-id="${l.id}">Delete</button>`;
const lstRow=l=>`<tr><td>${esc(l.title)}</td><td>${esc(l.orgName)}</td><td>${l.type}</td><td>${pill(l.status)}</td><td>${lstActs(l)}</td></tr>`;

function overview(d){
  const s=d.stats,pend=d.listings.filter(l=>l.status==='pending'),free=d.orgs.filter(o=>o.free);
  const tile=(n,l)=>`<div class="stat"><b>${n}</b><span>${l}</span></div>`;
  const todo=(n,t,tab)=>n?`<div class="todo"><span><b>${n}</b> ${t}</span><button class="button button-small" data-act="atab" data-id="${tab}">Review</button></div>`:'';
  const items=todo(s.pendingListings,'listing(s) waiting for approval','listings')+todo(s.pendingVerifications,'verification document(s) to review','verify')+todo(free.length,`organization(s) use a Gmail-type email (${free.filter(o=>o.gmailAllowed).length} can post)`,'orgs');
  return head('Overview','What needs your attention right now.')+`<div class="stats3">${tile(s.candidates,'Candidates')+tile(s.organizations,'Organizations')+tile(s.listings,'Listings')+tile(s.pendingListings,'Listings pending')+tile(s.pendingVerifications,'Verifications pending')+tile(s.applications,'Applications')}</div>
<div class="panel"><h3>Needs attention</h3>${items||'<p class="desc">All caught up.</p>'}</div>
<div class="panel"><h3>Waiting for approval</h3>${table(['Title','Org','Type','Status','Actions'],pend.slice(0,5).map(lstRow))}${pend.length>5?`<p class="desc" style="margin-top:10px">${pend.length-5} more in Listings.</p>`:''}</div>`}

function orgs(d){
  const rows=d.orgs.map(o=>{
    const ver=o.verified?pill('verified'):o.proofStatus?pill(o.proofStatus):'<span class="pill">No proof</span>';
    const gm=o.free?`${sel('data-orggm',o.id,o.gmailOk===true?'allow':o.gmailOk===false?'block':'default',[['default',`Default (${o.orgType==='small'?'allow':'block'})`],['allow','Allow'],['block','Block']])}<br>${o.gmailAllowed?'<span class="tag tag-verified">Can post</span>':'<span class="tag tag-warn">Cannot post</span>'}`:'<span class="desc">Not needed</span>';
    return `<tr><td><b>${esc(o.orgName)}</b><br><span class="desc">${esc(o.email||'—')}</span>${url(o.website)}</td><td>${sel('data-orgtype',o.id,o.orgType,Object.entries(SIZE))}</td><td>${o.free?'<span class="tag tag-warn">Gmail / free</span>':'<span class="tag tag-verified">Work email</span>'}</td><td>${gm}</td><td>${ver}</td><td>${o.listings}</td><td><button class="mini ok" data-act="verify" data-id="${o.id}" data-s="${o.verified?'':'1'}">${o.verified?'Unverify':'Verify'}</button> <button class="mini no" data-act="deluser" data-id="${o.id}">Delete</button></td></tr>`});
  return head('Organizations','Small businesses may post with Gmail by default; enterprises may not. Override per organization below.')+`<div class="panel">${table(['Organization','Size','Email','Gmail posting','Verification','Listings',''],rows)}</div>`}

function listings(d){
  const f=S.afilt||'all',cnt=s=>s==='all'?d.listings.length:d.listings.filter(l=>l.status===s).length;
  const chips=['all','pending','approved','rejected'].map(s=>`<button class="chip-f ${f===s?'on':''}" data-act="afilt" data-id="${s}">${s[0].toUpperCase()+s.slice(1)} (${cnt(s)})</button>`).join('');
  return head('Listings','Approve or reject what organizations post.')+`<div class="chip-row">${chips}</div><div class="panel">${table(['Title','Org','Type','Status','Actions'],d.listings.filter(l=>f==='all'||l.status===f).map(lstRow))}</div>`}

function verify(d){
  const CK={https:'HTTPS site',workEmail:'Work email',emailMatchesSite:'Email matches site',nameInSite:'Name in site'};
  return head('Verification','Check each organization or candidate document, then approve or reject.')+`<div class="panel">${table(['Who','Type','Checks','Proof','Status',''],d.proofs.map(x=>`<tr><td>${esc(x.name)}<br><span class="desc">${esc(x.email)}</span></td><td>${x.role}</td><td>${x.signals?Object.entries(CK).map(([k,t])=>`<span class="tag ${x.signals[k]?'tag-verified':'tag-warn'}">${t}</span>`).join(' '):'—'}${x.portal?`<br><a class="link" href="${esc(x.portal)}" target="_blank" rel="noopener noreferrer">Careers page</a>`:''}</td><td><button class="mini" data-act="viewproof" data-id="${x.id}">View</button></td><td>${pill(x.status)}</td><td><button class="mini ok" data-act="pstat" data-id="${x.id}" data-s="verified">Approve</button> <button class="mini no" data-act="pstat" data-id="${x.id}" data-s="rejected">Reject</button></td></tr>`))}</div>`}

function people(d){
  return head('Candidates',`${d.candidates.length} registered`)+`<div class="panel">${table(['Name','Email','Phone','Profile','Applications','Joined',''],d.candidates.map(u=>`<tr><td>${esc(u.name)}</td><td>${esc(u.email)}</td><td>${u.phoneVerified?'<span class="tag tag-verified">Verified</span>':'<span class="desc">—</span>'}</td><td>${u.completion}%</td><td>${u.applications}</td><td>${fmt(u.created)}</td><td><button class="mini no" data-act="deluser" data-id="${u.id}">Delete</button></td></tr>`))}</div>`}

export async function adminDashboard(a){
  const d=await api('/admin/data');S.atab=S.atab||'overview';
  const badge={listings:d.stats.pendingListings,verify:d.stats.pendingVerifications};
  const body={overview,orgs,listings,verify,people}[S.atab](d);
  a.innerHTML=`<div class="dash-layout"><aside class="dash-side"><nav>${TABS.map(([id,t,ic])=>`<button class="side-btn ${S.atab===id?'on':''}" data-act="atab" data-id="${id}"><svg viewBox="0 0 24 24"><path d="${ic}"/></svg>${t}${badge[id]?`<span class="side-badge">${badge[id]}</span>`:''}</button>`).join('')}</nav><span class="side-link">Signed in as admin</span></aside><main class="dash-main">${body}</main></div>`}

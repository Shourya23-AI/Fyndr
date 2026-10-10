import {esc} from '../../core/dom.js';
// Builds the website resume (two-column template: dark sidebar + main column) from the details the candidate saved.
// Pure HTML string, so it can be shown in the dashboard, in the apply popup, and printed / saved as PDF from its own window.
// A section is drawn ONLY if the profile has data for it; empty sections are left out.
const lines=t=>String(t||'').split(/\n+/).map(x=>x.trim()).filter(Boolean);
const bullets=t=>lines(t).length?`<ul>${lines(t).map(x=>`<li>${esc(x)}</li>`).join('')}</ul>`:'';
const link=u=>{u=String(u||'').trim();if(!u)return'';const t=esc(u.replace(/^https?:\/\//i,'').replace(/\/$/,''));return/^https?:\/\//i.test(u)?`<a href="${esc(u)}" target="_blank" rel="noopener">${t}</a>`:t};
const ICON={pin:'M12 21s-6-5.6-6-10a6 6 0 0 1 12 0c0 4.4-6 10-6 10zm0-8a2 2 0 1 0 0-4 2 2 0 0 0 0 4z',phone:'M6 3h4l1.5 4-2 1.5a11 11 0 0 0 5 5l1.5-2L20 13v4a2 2 0 0 1-2 2A15 15 0 0 1 4 5a2 2 0 0 1 2-2z',mail:'M3 6h18v12H3zM3 7l9 6 9-6'};
const ci=(k,v)=>v?`<li><i><svg viewBox="0 0 24 24"><path d="${ICON[k]}"/></svg></i><span>${v}</span></li>`:'';
const bar=(n,l)=>`<div class="rs-bar"><span>${esc(n)}</span><em><b style="width:${Math.min(5,Math.max(1,+l||3))*20}%"></b></em></div>`;
const side=(t,b)=>b?`<section><h4>${t}</h4>${b}</section>`:'';
const main=(t,b)=>b?`<section><h3>${t}</h3>${b}</section>`:'';
const entry=(left,role,body)=>`<div class="rs-entry"><div class="rs-when">${left}</div><div class="rs-what"><b>${role}</b>${body||''}</div></div>`;
const span=(a,b)=>[a,b].filter(Boolean).map(esc).join(' - ');
export function buildResume(d){
  const p=d.profile||{},me=d,skills=p.skills||[],sl=p.skillLevels||{};
  const ref=p.reference||{},jobs=p.jobs||[],langs=p.languages||[],hobbies=p.hobbies||[];
  const links=[['LinkedIn',p.linkedin],['Twitter',p.twitter],['Portfolio',p.link]].filter(x=>x[1]);
  const edu=[];
  if(p.qualification||p.institution)edu.push(entry(`${p.institution?`<strong>${esc(p.institution)}</strong>`:''}${p.gradYear?`<span>${esc(p.gradYear)}</span>`:''}`,esc(`${p.qualification||''}${p.field?(p.qualification?' in ':'')+p.field:''}`)));
  (p.education||[]).forEach(e=>edu.push(entry(`${e.institution?`<strong>${esc(e.institution)}</strong>`:''}${e.place?`<span>${esc(e.place)}</span>`:''}${e.year?`<span>${esc(e.year)}</span>`:''}`,esc(e.degree),bullets(e.points))));
  const sb=[
    me.photo?`<img class="rs-photo" src="${me.photo}" alt="">`:'',
    side('Links',links.map(([k,u])=>`<p><small>${k}</small>${link(u)}</p>`).join('')),
    side('Reference',ref.name?`<p><strong>${esc(ref.name)}</strong></p>${ref.role?`<p>${esc(ref.role)}</p>`:''}${ref.phone?`<p>${esc(ref.phone)}</p>`:''}${ref.email?`<p>${esc(ref.email)}</p>`:''}`:''),
    side('Hobbies',hobbies.length?`<ul>${hobbies.map(h=>`<li>${esc(h)}</li>`).join('')}</ul>`:'')].join('');
  const contact=[ci('pin',esc(p.address)),ci('phone',esc(me.phone)),ci('mail',esc(me.email))].join('');
  return `<div class="rs-doc"><div class="rs-page"><aside>${sb}</aside><div class="rs-main">
<header><div><h2>${esc(me.name)}</h2>${p.headline?`<p class="rs-head">${esc(p.headline)}</p>`:''}</div>${contact?`<ul class="rs-contact">${contact}</ul>`:''}</header>
${main('Profile',p.summary?`<p>${esc(p.summary)}</p>`:'')}
${main('Work Experience',jobs.map(j=>entry(`${j.org?`<strong>${esc(j.org)}</strong>`:''}${j.place?`<span>${esc(j.place)}</span>`:''}${j.from||j.to?`<span>${span(j.from,j.to)}</span>`:''}`,esc(j.role),bullets(j.points))).join(''))}
${main('Education',edu.join(''))}
${main('Projects',bullets(p.projects))}
${main('Skills',skills.length?`<div class="rs-bars">${skills.map(s=>bar(s,sl[s])).join('')}</div>`:'')}
${main('Languages',langs.length?`<div class="rs-bars">${langs.map(l=>bar(l.name,l.level)).join('')}</div>`:'')}
</div></div></div>`}
// Styles are scoped to .rs-doc so they can live in the app page (injected once) and in the print window.
export const RESUME_CSS=`.rs-doc{container-type:inline-size;background:#fff;color:#222;font:12px/1.5 Lato,"Segoe UI",Helvetica,Arial,sans-serif;-webkit-print-color-adjust:exact;print-color-adjust:exact}
.rs-doc *{box-sizing:border-box}.rs-doc a{color:inherit;text-decoration:none}.rs-doc p{margin:0}.rs-doc ul{list-style:none;margin:0;padding:0}
.rs-page{display:grid;grid-template-columns:32% 1fr;min-height:1050px}
.rs-doc aside{background:#3b3b3d;color:#fff;padding:26px 20px}
.rs-photo{display:block;width:104px;height:104px;border-radius:50%;object-fit:cover;margin:0 auto 22px;border:3px solid #55555a}
.rs-doc aside section{padding:14px 0;border-top:1px solid #58585c}.rs-doc aside section:first-child,.rs-photo+section{border-top:0;padding-top:0}
.rs-doc aside h4{margin:0 0 8px;font-size:10px;font-weight:800;letter-spacing:.14em;text-transform:uppercase}
.rs-doc aside p{font-size:11px;overflow-wrap:anywhere;margin-bottom:5px}.rs-doc aside small{display:block;font-size:9px;letter-spacing:.1em;text-transform:uppercase;color:#b9b9bd}
.rs-doc aside li{font-size:11px;padding-left:12px;position:relative;margin-bottom:4px}.rs-doc aside li::before{content:"";position:absolute;left:0;top:.55em;width:4px;height:4px;background:#fff}
.rs-main{padding:26px 26px 30px;min-width:0}
.rs-main header{display:flex;justify-content:space-between;align-items:flex-start;gap:16px;padding-bottom:16px;margin-bottom:6px;border-bottom:1px solid #d6d6d6}
.rs-main h2{margin:0;font-size:25px;line-height:1.1;font-weight:900;letter-spacing:.08em;text-transform:uppercase;overflow-wrap:anywhere}
.rs-head{margin-top:6px;font-size:9px;letter-spacing:.16em;text-transform:uppercase;color:#777}
.rs-contact{display:grid;gap:7px;font-size:10px;min-width:0;max-width:46%}.rs-contact li{display:flex;align-items:center;gap:8px;min-width:0}.rs-contact span{overflow-wrap:anywhere}
.rs-contact i{flex:none;width:18px;height:18px;border-radius:50%;background:#2d2d2f;display:grid;place-items:center}.rs-contact svg{width:10px;height:10px;fill:none;stroke:#fff;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}
.rs-main section{margin-top:20px;break-inside:avoid}
.rs-main h3{margin:0 0 12px;padding-bottom:5px;border-bottom:1px solid #222;font-size:10px;font-weight:800;letter-spacing:.14em;text-transform:uppercase}
.rs-main section>p{font-size:11.5px}
.rs-entry{display:grid;grid-template-columns:27% 1fr;gap:0 14px;margin-bottom:14px;break-inside:avoid}
.rs-when{font-size:10px;color:#666;display:grid;gap:1px;align-content:start;overflow-wrap:anywhere}.rs-when strong{color:#222;font-size:9.5px;font-weight:800;letter-spacing:.07em;text-transform:uppercase}
.rs-what{position:relative;padding-left:16px;border-left:1px solid #333;min-width:0}.rs-what::before{content:"";position:absolute;left:-5px;top:2px;width:9px;height:9px;border-radius:50%;background:#333}
.rs-what b{display:block;font-size:11.5px;margin-bottom:3px}
.rs-what li{position:relative;padding-left:12px;font-size:10.5px;color:#444;margin-bottom:2px}.rs-what li::before{content:"";position:absolute;left:0;top:.55em;width:4px;height:4px;background:#999}
.rs-main section>ul li{position:relative;padding-left:12px;font-size:11px;margin-bottom:3px}.rs-main section>ul li::before{content:"";position:absolute;left:0;top:.55em;width:4px;height:4px;background:#999}
.rs-bars{display:grid;grid-template-columns:1fr 1fr;gap:12px 28px}.rs-bar span{display:block;margin-bottom:4px;font-size:9px;letter-spacing:.09em;text-transform:uppercase;color:#444;overflow-wrap:anywhere}
.rs-bar em{display:block;height:3px;background:#d4d4d4}.rs-bar b{display:block;height:3px;background:#2d2d2f}
@container (max-width:560px){.rs-page{grid-template-columns:1fr;min-height:0}.rs-main header{flex-direction:column}.rs-contact{max-width:none}.rs-entry{grid-template-columns:1fr;gap:4px}.rs-bars{grid-template-columns:1fr}.rs-doc aside{padding-bottom:12px}.rs-doc aside:empty{display:none}}
@media print{.rs-page{min-height:297mm}}`;
export const PAGE_CSS='body{margin:0}@page{size:A4;margin:0}';
const doc=(title,d)=>`<!doctype html><meta charset="utf-8"><title>${esc(title)} - Resume</title><style>${PAGE_CSS}${RESUME_CSS}</style>${buildResume(d)}`;
// Used by the app page itself: add the resume styles once.
if(typeof document!=='undefined'&&!document.getElementById('rs-style')){const s=document.createElement('style');s.id='rs-style';s.textContent=RESUME_CSS;document.head.append(s)}
export const resumeDoc=(d)=>doc(d.name,d);
export function printResume(d){const w=window.open('','_blank');if(!w)throw new Error('Allow popups to download your resume');
  w.document.write(resumeDoc(d));w.document.close();setTimeout(()=>w.print(),400)}
export const pdfUrl=async data=>URL.createObjectURL(new Blob([Uint8Array.from(atob(data),c=>c.charCodeAt(0))],{type:'application/pdf'}));

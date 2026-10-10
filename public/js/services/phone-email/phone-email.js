// phone.email helpers: read the Client ID, open the login popup, wait for the token it returns.
let cid;
export async function phoneClientId(){
  if(cid!==undefined)return cid;
  try{const r=await fetch('api/phone-config');if(!r.ok)throw 0;cid=(await r.json()).clientId}
  catch{try{cid=(await (await fetch('config/phone-email.json')).json()).clientId}catch{cid=null}} // Live Server mode has no /api
  if(!cid||/^YOUR/i.test(cid))cid=null;return cid}

// Opens the popup and resolves with the access_token. Must be called straight from a click so popup blockers allow it.
// `wait.cancel()` stops listening. (We do not poll popup.closed: some browsers report it as closed once the popup visits another site.)
export function startLogin(id){
  const redirect=new URL('phone-callback.html',location.href).href;
  const url='https://www.phone.email/auth/log-in?client_id='+encodeURIComponent(id)+'&redirect_url='+encodeURIComponent(redirect);
  const w=window.open(url,'peLoginWindow','toolbar=0,scrollbars=0,location=0,statusbar=0,menubar=0,resizable=0,width=500,height=560,top='+(screen.height-600)/2+',left='+(screen.width-500)/2);
  if(!w)throw{message:'Your browser blocked the popup. Allow popups for this site and try again.'};
  let stop;const wait=new Promise((res,rej)=>{
    const bc='BroadcastChannel' in window?new BroadcastChannel('fyndr-phone'):null;
    const on=m=>{if(m&&m.type==='fyndr-phone-token'&&m.token){stop();res(m.token)}};
    const onWin=e=>{if(e.origin===location.origin)on(e.data)};
    if(bc)bc.onmessage=e=>on(e.data);addEventListener('message',onWin);
    stop=()=>{bc&&bc.close();removeEventListener('message',onWin)};
    wait.cancel=()=>{stop();try{w.close()}catch{}rej({cancelled:true})}});
  return wait}

// Browser-only (Live Server) mode: no Node server, so ask phone.email directly.
export async function lookupPhone(token,id){
  const fd=new FormData();fd.append('access_token',token);fd.append('client_id',id);
  const d=await (await fetch('https://eapi.phone.email/getuser',{method:'POST',body:fd})).json();
  const ph=d&&d.status===200&&d.phone_no?'+'+String(d.country_code||'').replace(/\D/g,'')+String(d.phone_no).replace(/\D/g,''):'';
  return /^\+\d{8,15}$/.test(ph)?ph:null}

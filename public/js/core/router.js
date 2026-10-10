import {S} from './state.js';
import {toast} from './dom.js';
import {fb} from '../services/firebase/firebase-init.js';
import {nav,markNav} from '../features/layout/nav.js';
import {loadMe} from '../features/auth/load-me.js';
import {openAuth,closeAuth} from '../features/auth/auth-modal.js';
import {authView} from '../features/auth/auth-views.js';
import {home} from '../features/home/home.js';
import {browse} from '../features/browse/browse.js';
import {orgPage} from '../features/organizations/org-page.js';
import {proofView} from '../features/proof/proof.view.js';
import {profileView} from '../features/profile/profile.view.js';
import {phoneView} from '../features/phone/phone.view.js';
import {dashboard} from '../features/dashboard/dashboard.js';
import {resetView} from '../features/password-reset/reset.view.js';
import {termsView,privacyView,contactView} from '../features/legal/legal.view.js';

// Hash router: '#/organizations', '#/dashboard', ... Decides which page to draw and redirects people who are signed out or not set up yet.
export async function route(){
  const rid=route.n=(route.n||0)+1;await fb.ready();const gate=await loadMe();if(rid!==route.n)return;nav();if(S.me||gate==='verify')closeAuth();let r=location.hash.slice(2)||'';const q=new URLSearchParams(location.search);if(q.get('mode')==='resetPassword'&&q.get('oobCode'))r='reset';
  if(gate==='verify'||gate==='setup')r=gate;else if(!S.me&&!['','login','register','forgot','verify','setup','organizations','terms','privacy','contact','reset'].includes(r))r='login';else if(S.me&&['login','register','forgot'].includes(r)){const n=sessionStorage.next;sessionStorage.removeItem('next');if(n&&n!==location.hash){location.hash=n;return}r=''}
  if(S.me?.role==='user'&&!S.me.onboarded)r='profile';else if(S.me&&S.me.role!=='user'&&r==='profile')r='dashboard';
  if(!S.me&&r==='phone')r='login';if(S.me?.role==='org'&&!S.me.proofStatus&&['','dashboard'].includes(r))r='proof';
  if(S.me&&r==='')r=S.me.role==='admin'?'dashboard':'jobs';
  markNav(r);document.title='Fyndr: internships and jobs, checked before you see them';try{if(!['login','register'].includes(r))closeAuth();({'':home,login:()=>{home();openAuth('signin')},register:()=>{home();openAuth('signup')},jobs:()=>browse('jobs'),courses:()=>browse('courses'),organizations:orgPage,proof:proofView,forgot:()=>authView('forgot'),verify:()=>authView('verify'),setup:()=>authView('setup'),dashboard,profile:profileView,phone:phoneView,terms:termsView,privacy:privacyView,contact:contactView,reset:resetView}[r]||home)()}catch(e){toast(e.message)}}

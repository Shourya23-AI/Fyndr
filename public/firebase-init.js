import {initializeApp} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js';
import {getAuth,createUserWithEmailAndPassword,signInWithEmailAndPassword,signInWithPopup,GoogleAuthProvider,sendPasswordResetEmail,sendEmailVerification,updateProfile,signOut,onAuthStateChanged,RecaptchaVerifier,linkWithPhoneNumber,unlink} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
let cfg,local=false;
try{cfg=await (await fetch('api/firebase-config')).json()}catch{local=true;cfg=await (await fetch('firebase-config.json')).json()} // no Node server (e.g. Live Server): run in browser-only mode
const configured=!!cfg.apiKey&&!cfg.apiKey.startsWith('YOUR');
const auth=configured?getAuth(initializeApp(cfg)):null;
const ready=new Promise(r=>configured?onAuthStateChanged(auth,r):r(null));
let rv=null,conf=null;
export const fb={local,configured,ready:()=>ready,user:()=>auth?.currentUser||null,
  token:async()=>auth?.currentUser?auth.currentUser.getIdToken():'',
  signUp:async(e,p,n)=>{const c=await createUserWithEmailAndPassword(auth,e,p);await updateProfile(c.user,{displayName:n});return c.user},
  signIn:(e,p)=>signInWithEmailAndPassword(auth,e,p).then(c=>c.user),
  google:()=>signInWithPopup(auth,new GoogleAuthProvider()).then(c=>c.user),
  reset:e=>sendPasswordResetEmail(auth,e),verify:()=>sendEmailVerification(auth.currentUser),
  reload:async()=>{await auth.currentUser.reload();await auth.currentUser.getIdToken(true);return auth.currentUser},
  out:()=>signOut(auth),
  // Phone OTP: links the phone to the signed-in account. Invisible reCAPTCHA is created fresh for every send.
  phoneReset(){try{rv?.clear()}catch{}rv=null},
  async phoneSend(num){fb.phoneReset();rv=new RecaptchaVerifier(auth,'recaptcha',{size:'invisible'});
    try{conf=await linkWithPhoneNumber(auth.currentUser,num,rv)}catch(e){fb.phoneReset();throw e}},
  async phoneConfirm(code){if(!conf)throw{code:'app/no-session'};await conf.confirm(code);await auth.currentUser.getIdToken(true)},
  unlinkPhone:()=>unlink(auth.currentUser,'phone')};

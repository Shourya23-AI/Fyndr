import {S} from '../../core/state.js';
import {$,toast} from '../../core/dom.js';
import {fb} from '../../services/firebase/firebase-init.js';
import {ferr} from '../../core/errors.js';
import {phoneRender} from './phone.view.js';
import {phoneSend,phoneSync} from './phone.service.js';

export const actions={
  async resendcode(){try{await phoneSend(S.ph.num);toast('New code sent')}catch(x){const el=$('#err');if(el)el.textContent=ferr(x)}},
  changenum(){fb.phoneReset();S.ph={step:1,num:'',cool:0,t:clearInterval(S.ph.t)};phoneRender()}
};
export const forms={
  async 'phone-send'(d){const num='+'+d.cc.replace(/\D/g,'')+d.num.replace(/\D/g,'').replace(/^0+/,'');if(!/^\+\d{8,15}$/.test(num))throw{message:'Enter a valid phone number'};
      try{await phoneSend(num)}catch(x){if(x.code==='auth/provider-already-linked'){await fb.reload();await phoneSync()}else throw x}},
  async 'phone-verify'(d){await fb.phoneConfirm(d.code.trim());
      try{await phoneSync()}catch(x){if(x.code==='PHONE_TAKEN')await fb.unlinkPhone().catch(()=>{});throw x}}
};

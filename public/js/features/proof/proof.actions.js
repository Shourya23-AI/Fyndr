import {S} from '../../core/state.js';
import {api} from '../../core/api.js';
import {toast} from '../../core/dom.js';
import {route} from '../../core/router.js';
import {shrink} from './upload.js';

export const actions={
  async viewproof(b,id){const w=window.open('','_blank');try{const r=await api('/proof/file/'+id),u8=Uint8Array.from(atob(r.data),c=>c.charCodeAt(0));w.location=URL.createObjectURL(new Blob([u8],{type:r.mime}))}catch(x){w?.close();throw x}}
};
export const forms={
  async proof(d){const{name,data}=await shrink(d.file);S.me=await api('/proof','POST',{portal:d.portal,name,data});toast('Submitted for review');location.hash='#/dashboard';route()}
};

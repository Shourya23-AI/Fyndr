import {S} from '../../core/state.js';
import {$} from '../../core/dom.js';
import {api} from '../../core/api.js';
import {card} from './card.js';
export async function loadListings(){
  $('#grid').setAttribute('aria-busy','true');$('#grid').innerHTML='<div class="sk"></div>'.repeat(3);
  const type=S.f.type||(S.scope==='courses'?'Course':'Job,Internship'),qs=new URLSearchParams(Object.entries({...S.f,type}).filter(([,v])=>v)).toString(),ls=await api('/listings?'+qs);
  $('#grid').innerHTML=ls.map(card).join('')||'<div class="empty"><b>No matches yet</b><p>Try fewer keywords or a different location.</p><button class="button button-dark button-small" data-act="clear">Clear search</button></div>';$('#grid').removeAttribute('aria-busy')}

import {toast} from '../../core/dom.js';
import {CONTACT_EMAIL} from './constants.js';
// Contact form: opens the visitor's email app with the message filled in (no server needed).
export const actions={};
export const forms={
  async contact(d){const s=encodeURIComponent(`[Fyndr] ${d.topic}`),b=encodeURIComponent(`${d.msg}\n\n— ${d.name} (${d.email})`);
    location.href=`mailto:${CONTACT_EMAIL}?subject=${s}&body=${b}`;toast('Opening your email app…')}
};

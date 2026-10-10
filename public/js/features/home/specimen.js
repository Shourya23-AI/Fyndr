import {TICK} from '../../core/dom.js';
// The "example listing" card shown beside the hero text.
const CHECKS=['Organization verified by our team','Reviewed before going live','Poster\'s email confirmed','Poster\'s phone confirmed'];
export const SPEC=()=>`<aside class="specimen" aria-label="Example of a checked listing"><div class="spec-top"><span>Example listing</span><span class="tag tag-verified">${TICK}Verified</span></div><h3>Product Design Intern</h3><p>Linear, Remote</p><ul class="cks">${CHECKS.map(c=>`<li><span class="ck">${TICK}</span>${c}</li>`).join('')}</ul></aside>`;

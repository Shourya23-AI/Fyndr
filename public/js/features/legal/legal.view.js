import {$,esc} from '../../core/dom.js';
import {CONTACT_EMAIL,UPDATED} from './constants.js';
// Footer pages: #/terms, #/privacy, #/contact. Plain text pages, no sign-in needed.
const page=(title,body,dated=true)=>{$('#app').innerHTML=`<article class="container legal"><h1>${title}</h1>${dated?`<p class="legal-date">Last updated ${UPDATED}</p>`:''}${body}<p><a class="button" href="#/">← Back to Fyndr</a></p></article>`;scrollTo(0,0);document.title=title+' · Fyndr'};
const sec=(h,...p)=>`<h2>${h}</h2>${p.map(x=>`<p>${x}</p>`).join('')}`;

export function termsView(){page('Terms &amp; Conditions',
 sec('1. Using Fyndr','Fyndr lists internships, jobs and courses from organizations our team has reviewed. By creating an account or using the site you agree to these terms. If you do not agree, please do not use Fyndr.')+
 sec('2. Your account','You must give accurate information and keep your login private. You are responsible for what happens under your account. You must verify your email, and your phone number before applying (candidates) or posting (organizations).')+
 sec('3. Candidates','Only apply to listings you are genuinely interested in. Do not upload documents that are not yours or that contain false information.')+
 sec('4. Organizations','Listings must be real, lawful and accurately described. Do not ask candidates for money, and do not use Fyndr to collect personal data for any other purpose. We may remove a listing or suspend an organization that breaks these rules.')+
 sec('5. Verification','A Verified badge means our team checked the organization\'s details at the time of review. It is not a guarantee about any offer, employer or outcome. Please do your own checks before sharing personal information or paying anyone.')+
 sec('6. Content you upload','You keep ownership of what you upload (profiles, listings, proof documents). You allow Fyndr to store and display it as needed to run the service.')+
 sec('7. Availability and changes','We may change, pause or stop parts of Fyndr at any time. We may update these terms; continuing to use Fyndr after a change means you accept it.')+
 sec('8. Liability','Fyndr is provided as is. To the extent the law allows, we are not liable for hiring decisions, listing accuracy or losses arising from use of the site.')+
 sec('9. Contact',`Questions about these terms? Write to <a href="mailto:${esc(CONTACT_EMAIL)}">${esc(CONTACT_EMAIL)}</a> or use the <a href="#/contact">Contact page</a>.`))}

export function privacyView(){page('Privacy Policy',
 sec('What we collect','Your name, email address and phone number; profile details you enter (education, skills); for organizations, the organization name, careers page link and registration proof; documents you choose to upload as proof; and your applications.')+
 sec('How we use it','To run your account, show your profile to organizations you apply to, verify organizations and candidates, prevent fraud (for example, one phone number per account) and keep the service secure.')+
 sec('Who handles it','Sign-in is handled by Google Firebase Authentication. Phone verification is handled by phone.email, which sends a one-time code by SMS to your number and tells us the verified number. Fyndr\'s own server stores your profile, listings and uploaded proof files.')+
 sec('Who can see it','Organizations see your profile and details only for listings you apply to. Verification staff can view proof documents to review them, and each view is logged. We do not sell your personal data.')+
 sec('Cookies and local storage','We store your theme (light/dark) and sign-in session in your browser. We do not use advertising cookies.')+
 sec('Your choices','You can ask us to correct or delete your account and data at any time by contacting us. Some records may be kept where the law requires.')+
 sec('Security','We use industry-standard tools, but no online service is perfectly secure. Use a strong, unique password.')+
 sec('Contact',`Privacy questions: <a href="mailto:${esc(CONTACT_EMAIL)}">${esc(CONTACT_EMAIL)}</a>.`))}

export function contactView(){page('Contact Us',
 `<p>Questions, feedback or a problem with a listing? Send us a message and we will get back to you by email.</p>
 <form class="form legal-form" data-form="contact"><input name="name" placeholder="Your name" required><input name="email" type="email" placeholder="Your email" required>
 <select name="topic" aria-label="Topic"><option>General question</option><option>Report a listing</option><option>Organization verification</option><option>Account or phone problem</option><option>Privacy request</option></select>
 <textarea name="msg" rows="6" placeholder="How can we help?" required></textarea><button class="button button-dark">Send message</button><p class="err" id="err"></p></form>
 <p>Or email us directly: <a href="mailto:${esc(CONTACT_EMAIL)}">${esc(CONTACT_EMAIL)}</a></p>`,false)}

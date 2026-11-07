import { $, esc } from '../../core/dom.js';
import { CONTACT_EMAIL, UPDATED } from './constants.js';
import { RETENTION } from '../privacy/retention.js';
// Footer pages: #/terms, #/privacy, #/contact. Plain text pages, no sign-in needed.
const page = (title, body, dated = true) => {
    $('#app').innerHTML = `<article class="container legal"><h1>${title}</h1>${dated ? `<p class="legal-date">Last updated ${UPDATED}</p>` : ''}${body}<p><a class="button" href="#/">← Back to Fyndr</a></p></article>`;
    scrollTo(0, 0);
    document.title = title + ' · Fyndr';
};
const sec = (h, ...p) => `<h2>${h}</h2>${p.map(x => `<p>${x}</p>`).join('')}`;
export function termsView() {
    page('Terms &amp; Conditions', sec('1. Using Fyndr', 'Fyndr lists internships, jobs and courses from organizations our team has reviewed. By creating an account or using the site you agree to these terms. If you do not agree, please do not use Fyndr.') +
        sec('2. Your account', 'You must give accurate information and keep your login private. You are responsible for what happens under your account. You must verify your email, and your phone number before applying (candidates) or posting (organizations).') +
        sec('3. Candidates', 'Only apply to listings you are genuinely interested in. Do not upload documents that are not yours or that contain false information. When you apply, the resume you choose is shared with that organization and with Fyndr admins, as described in the <a href="#/privacy">Privacy Policy</a>. You can withdraw an application at any time.') +
        sec('4. Organizations', 'Listings must be real, lawful and accurately described. Do not ask candidates for money, and do not use Fyndr to collect personal data for any other purpose. Use the resumes and details candidates share with you only to consider them for the listing they applied to, and do not pass them on to anyone else. We may remove a listing or suspend an organization that breaks these rules.') +
        sec('5. Verification', 'A Verified badge means our team checked the organization\'s details at the time of review. It is not a guarantee about any offer, employer or outcome. Please do your own checks before sharing personal information or paying anyone.') +
        sec('6. Content you upload', 'You keep ownership of what you upload (profiles, listings, proof documents). You allow Fyndr to store and display it as needed to run the service.') +
        sec('7. Availability and changes', 'We may change, pause or stop parts of Fyndr at any time. We may update these terms; continuing to use Fyndr after a change means you accept it.') +
        sec('8. Liability', 'Fyndr is provided as is. To the extent the law allows, we are not liable for hiring decisions, listing accuracy or losses arising from use of the site.') +
        sec('9. Contact', `Questions about these terms? Write to <a href="mailto:${esc(CONTACT_EMAIL)}">${esc(CONTACT_EMAIL)}</a> or use the <a href="#/contact">Contact page</a>.`));
}
export function privacyView() {
    const d = RETENTION;
    page('Privacy Policy', sec('What we collect', 'Your name, email address and phone number; profile details you enter (education, skills, work experience and similar); a profile photo and a resume PDF if you add them; for organizations, the organization name, website, careers page link and the registration proof you upload; documents you choose to upload for verification; your applications and saved listings; and a record of when you accepted the Terms and this policy.') +
        sec('How we use it', 'To run your account, show your resume to organizations you apply to, verify organizations and candidates, prevent fraud (for example, one phone number per account), review listings and reports, and keep the service secure.') +
        sec('Who can see it', 'When you apply, the organization that owns the listing receives a copy of the resume you chose (your website resume as it was at that moment, or your uploaded PDF), plus your name, email and the status of your application. Fyndr admins and moderators can see account details and the documents used for verification, and may review applications to keep the service safe. Nobody else can see your profile or resume. We do not sell your personal data.') +
        sec('Who handles it', 'Sign-in and storage run on Google Firebase (Authentication and Firestore), so your data is stored on Google\'s servers, which can be located outside India. Phone verification is handled by phone.email, which sends a one-time code by SMS and tells us the verified number.') +
        sec('How long we keep it', `Your account and profile: until you delete your account. An application, and the copy of your resume shared through it: until you withdraw it, or ${d.closedListingDays} days after the listing is closed or removed, and in any case no longer than ${d.maxApplicationDays} days after you applied; then it is deleted. Organization verification documents: until the organization account is deleted. When you delete your account, your profile, files, applications, saved listings and phone number record are deleted straight away. If you delete an organization account, its listings and the applications it received are deleted too. We may keep limited records where the law requires it.`) +
        sec('Your choices and rights', 'In Dashboard, Privacy &amp; data, you can see who your resume was shared with and withdraw any application, download a copy of your data, and delete your account. You can edit your profile at any time. To ask for a correction or to raise a privacy concern, write to us at the address below.') +
        sec('Usage counts and reports', 'If you say yes, Fyndr counts how often listings are viewed, what is searched (only plain words, and only searches that found nothing), saves and Apply clicks, as daily totals. No account, listing or time of day is stored with them, and you can turn it off any time in Privacy &amp; data. The owner reads these totals in an Insights page and a weekly summary. That summary is written from the totals only (aggregate numbers); no personal data, resumes or application details are used for it.') +
        sec('Cookies and local storage', 'We store your theme (light/dark), your sign-in session and a short-lived copy of recently viewed pages in your browser so Fyndr loads faster. We do not use advertising cookies.') +
        sec('Security', 'We use industry-standard tools, but no online service is perfectly secure. Use a strong, unique password.') +
        sec('Changes to this policy', 'If we change this policy in a way that matters, we will update the date above and ask you to accept it again the next time you sign in.') +
        sec('Contact', `Privacy questions and requests: <a href="mailto:${esc(CONTACT_EMAIL)}">${esc(CONTACT_EMAIL)}</a>.`));
}
export function contactView() {
    page('Contact Us', `<p>Questions, feedback or a problem with a listing? Send us a message and we will get back to you by email.</p>
 <form class="form legal-form" data-form="contact"><input name="name" placeholder="Your name" required><input name="email" type="email" placeholder="Your email" required>
 <select name="topic" aria-label="Topic"><option>General question</option><option>Report a listing</option><option>Organization verification</option><option>Account or phone problem</option><option>Privacy request</option></select>
 <textarea name="msg" rows="6" placeholder="How can we help?" required></textarea><button class="button button-dark">Send message</button><p class="err" id="err"></p></form>
 <p>Or email us directly: <a href="mailto:${esc(CONTACT_EMAIL)}">${esc(CONTACT_EMAIL)}</a></p>`, false);
}

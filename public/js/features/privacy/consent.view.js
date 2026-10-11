import { $ } from '../../core/dom.js';
import { UPDATED } from '../legal/constants.js';
// Shown once to an account that has not accepted the current Terms and Privacy Policy (older accounts, or after the policy changed).
export function consentView() {
    $('#app').innerHTML = `<div class="auth-page"><div class="glass auth-solo"><h3>Please review our updated policies</h3>
<p class="desc">We updated our Terms and Privacy Policy on ${UPDATED}. They explain who can see your resume, how long applications are kept, and how to withdraw an application, download your data or delete your account.</p>
<form class="form" data-form="consent"><label class="agree"><input type="checkbox" name="agree" required> <span>I agree to the <a href="#/terms" target="_blank" rel="noopener">Terms</a> and <a href="#/privacy" target="_blank" rel="noopener">Privacy Policy</a>.</span></label>
<button class="button button-dark">Continue</button><p class="err" role="alert"></p><button type="button" class="mini" data-act="logout">Log out</button></form></div></div>`;
    scrollTo(0, 0);
}

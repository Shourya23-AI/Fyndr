import { $, esc } from '../../core/dom.js';
import { fb } from '../../services/firebase/firebase-init.js';
import { route } from '../../core/router.js';
import { openAuth } from './auth-modal.js';
// Full-page auth screens: verify email, forgot password, finish setup.
const roleSel = `<select name="role" data-role-toggle><option value="user">I'm looking for opportunities</option><option value="org">I'm an organization hiring</option></select>`;
export const authView = m => {
    const A = h => $('#app').innerHTML = `<div class="auth-page"><div class="glass auth-solo">${h}</div></div>`;
    if (!fb.configured) {
        return A('<h3>Firebase not set up</h3><p class="desc">Paste your Firebase web config into <b>config/firebase-config.json</b> (and <b>public/config/firebase-config.json</b> for Live Server) and restart the server.</p>');
    }
    clearInterval(authView.t);
    if (m === 'verify') {
        authView.t = setInterval(async () => {
            if (!fb.user()) {
                return clearInterval(authView.t);
            }
            try {
                await fb.reload();
                if (fb.user().emailVerified) {
                    clearInterval(authView.t);
                    route();
                }
            } catch { }
        }, 4000);
    }
    if (m === 'verify') {
        return A(`<h3>Verify your email</h3><p class="desc">We sent a link to <b>${esc(fb.user()?.email)}</b>. Click it, then continue.</p><div class="form"><button class="button button-dark" data-act="verified">I've verified</button><button class="button" data-act="resend">Resend email</button><button class="mini" data-act="logout">Use a different email</button></div>`);
    }
    if (m === 'forgot') {
        return A(`<h3>Reset password</h3><form class="form" data-form="forgot"><input name="email" type="email" placeholder="Email" required><p class="desc">Enter your account email and we will send a link to choose a new password. Signed up with Google? Use <b>Continue with Google</b> instead, there is no password to reset.</p><button class="button button-dark">Send reset link</button><p class="err" id="err"></p><a href="#/login" style="font-size:13px">Back to log in</a></form>`);
    }
    if (m === 'setup') {
        return A(`<h3>Finish setting up</h3><form class="form" data-form="setup">${roleSel}<input name="name" placeholder="Your name" value="${esc(fb.user()?.displayName)}" required><input class="on-only" name="orgName" placeholder="Organization name" hidden><select class="on-only" name="orgType" hidden><option value="small">Small business (Gmail allowed)</option><option value="enterprise">Enterprise (work email required)</option></select><label class="agree"><input type="checkbox" name="agree" required> <span>I agree to the <a href="#/terms" target="_blank" rel="noopener">Terms</a> and <a href="#/privacy" target="_blank" rel="noopener">Privacy Policy</a>.</span></label><button class="button button-dark">Continue</button><p class="err" id="err"></p></form>`);
    }
    openAuth(m === 'register' ? 'signup' : 'signin');
};

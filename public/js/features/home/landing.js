import { $ } from '../../core/dom.js';
import { SPEC } from './specimen.js';
// Logged-out home page.
export function landing() {
    $('#app').innerHTML = `<section class="hero landing container"><div><h1>Every listing is checked before you see it.</h1><p class="lead">Fyndr lists internships, jobs and courses only from organizations our team has verified. Create a free account to browse and apply.</p>
<div class="cta"><button class="btn-primary" data-act="auth" data-mode="signup">Get started</button><button class="btn-line" data-act="auth" data-mode="signin">Sign in</button></div><p class="desc" style="margin-top:20px">Hiring? <a class="link" href="#/organizations">Register your organization</a></p></div>${SPEC()}</section>`;
}

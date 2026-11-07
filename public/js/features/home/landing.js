import { $ } from '../../core/dom.js';
import { SPEC } from './specimen.js';
import { memberLanding } from './member.js';
// Logged-out home page: a hero, a worked example, how it works, honest labels, numbers, closing call to action.
// The career guide itself is members-only: it is mounted on the signed-in landing page (member.js) and nowhere else.
const STEPS = [
    ['Say the job you want', 'Type it in your own words, or tap an example.'],
    ['See where you stand', 'The guide checks your qualification and skills against what that job usually asks for.'],
    ['Follow the roadmap', 'A course and a book for each missing skill, in three phases: foundations, tools, projects.'],
    ['Apply with proof', 'Find matching internships and jobs, apply from your profile and follow every application.']
];
const LABELS = ['Posted on Fyndr: reviewed first', 'Direct from company: closes automatically', 'Search links: marked, never rated'];
// A worked example, clearly marked as one: what the guide's answer looks like.
const DEMO = `<aside class="lp-demo" aria-label="Example of a career guide result"><p class="lp-demo-k">Example result</p>
<div class="gd-head"><div class="gd-ring mid" style="--p:62"><b>62%</b><span>ready</span></div><div><h3>Data Analyst</h3><p class="desc">2 core skills still to go.</p></div></div>
<div class="gd-sec"><h4>You already have</h4><div class="gd-tags"><span class="gd-tag have">Excel</span><span class="gd-tag have">SQL</span></div></div>
<div class="gd-sec"><h4>Still to learn</h4><div class="gd-tags"><span class="gd-tag need">Power BI</span><span class="gd-tag need">Statistics</span></div></div>
<ol class="lp-phases"><li><b>Foundations</b><span>course + book</span></li><li><b>Tools</b><span>course + book</span></li><li><b>Projects</b><span>one real project</span></li></ol>
<p class="desc">An example only. Your own answer depends on your skills.</p></aside>`;
export function landing(me) {
    if (me) {
        return memberLanding(me); // signed in: no sign-up or sign-in buttons, see member.js
    }
    $('#app').innerHTML = `<div class="lp">
<section class="container lp-hero"><div class="lp-copy"><h1>Your dream job, mapped step by step</h1><p class="lead">Tell us the job you want. We check where you stand, then point you to the courses and books that close the gap, and to real openings when you are ready.</p>
<div class="cta"><button class="btn-primary" data-act="auth" data-mode="signup">Create a free account</button><button class="btn-line" data-act="auth" data-mode="signin">Sign in</button></div>
<p class="desc">Free for students. Hiring? <a class="link" href="#/organizations">Register your organization</a></p></div>
${DEMO}</section>
<section class="container lp-how"><h2>How it works</h2><ol>${STEPS.map((x, i) => `<li><span class="lp-n">${i + 1}</span><h3>${x[0]}</h3><p>${x[1]}</p></li>`).join('')}</ol></section>
<section class="container lp-trust"><div><h2>Every card says where it comes from.</h2><p>Posts from organizations are reviewed by our team before they go live. Openings read from company career pages are marked Direct from company and close when the company removes them. Search links only open a job board or course site, and we do not vouch for what you find there.</p><ul>${LABELS.map(x => `<li>${x}</li>`).join('')}</ul></div><div class="lp-spec">${SPEC()}</div></section>
<section class="container lp-nums"><div><b data-count="7900" data-suf="+">7,900+</b><span>jobs and courses to browse</span></div><div><b data-count="16">16</b><span>course providers</span></div><div><b data-count="4">4</b><span>job boards searched</span></div></section>
<section class="lp-end"><div class="container"><h2>Start with the job you want.</h2><p class="lead">A free account unlocks the career guide and saves your skills, your roadmap and your applications in one place.</p><div class="cta"><button class="btn-primary" data-act="auth" data-mode="signup">Create a free account</button><a class="btn-line" href="#/organizations">For organizations</a></div></div></section></div>`;
    import('../../core/motion.js').then(m => m.landingMotion());
}

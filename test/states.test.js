// Empty, error and loading states (Part 3, step 3).  Run:  node test/states.test.js
globalThis.document = { querySelector: () => null };
globalThis.localStorage = { getItem: () => null, setItem() { }, removeItem() { } };
let pass = 0, fail = 0;
const ok = (c, n) => { c ? pass++ : (fail++, console.log('  FAIL', n)); };
const fs = await import('node:fs');
const rd = f => fs.readFileSync(new URL('../' + f, import.meta.url), 'utf8');
const S = await import('../public/js/features/states/states.js');
const { table } = await import('../public/js/core/dom.js');
const { skeletonFor } = await import('../public/js/core/skeleton.js');

// 1. helpers
let h = S.emptyHtml({ title: 'Nothing <b>yet</b>', text: 'Try "this"', actions: [{ label: 'Go', href: '#/jobs' }, { label: 'Again', act: 'retry' }] });
ok(/Nothing &lt;b&gt;yet&lt;\/b&gt;/.test(h) && !/<b>yet/.test(h), 'title is escaped');
ok(/<a class="button button-dark button-small" href="#\/jobs">Go<\/a>/.test(h) && /<button type="button" class="button button-small" data-act="retry">Again<\/button>/.test(h), 'first action is the main one; link and button forms');
ok(!/\son\w+=/i.test(S.emptyHtml({ title: 'a', text: 'b', actions: [{ label: 'x', href: '#/x' }] })), 'no inline handlers (CSP)');
ok(!/st-cta/.test(S.emptyHtml({ title: 'a' })) && !/<p>/.test(S.emptyHtml({ title: 'a' })), 'no actions or text: no empty wrappers');
ok(S.emptyCell('None yet.', { href: '#/jobs', label: 'Browse' }) === 'None yet. <a href="#/jobs">Browse</a>' && S.emptyCell('<i>') === '&lt;i&gt;', 'cell text escaped, optional link');

// 2. errors speak plainly and never show raw text
ok(/internet connection/.test(S.friendly('Failed to fetch')) && /internet connection/.test(S.friendly('network error')) && /not allowed/.test(S.friendly('Missing or insufficient permissions.')) && /sign in again/i.test(S.friendly('Please log in')), 'known failures get friendly wording');
ok(/Something went wrong/.test(S.friendly('TypeError: x is undefined')) && /Something went wrong/.test(S.friendly(undefined)), 'unknown failures get a calm message');
const eh = S.errorHtml('TypeError: <img src=x onerror=alert(1)> is undefined');
ok(!/TypeError|<img/.test(eh) && /role="alert"/.test(eh) && /data-act="retry"/.test(eh) && /Try again/.test(eh) && /href="#\/jobs"/.test(eh), 'error state: no raw text, announced, retry button, a way out');
ok(!/href="#\/jobs"/.test(S.errorHtml('x', { home: false })), 'way out is optional');
ok(/role="status"/.test(S.loadingText('Loading your resume')) && /Loading your resume…/.test(S.loadingText('Loading your resume')) && /Loading…/.test(S.loadingText()), 'loading text is announced');

// 3. table empty message
ok(/Nothing here yet\./.test(table(['A'], [])) && /colspan="1"[^>]*>Custom message/.test(table(['A'], [], 'Custom message')) && !/Custom/.test(table(['A'], ['<tr><td>x</td></tr>'], 'Custom message')), 'table: default and custom empty message; rows win');

// 4. the screens use them
const ud = rd('public/js/features/dashboard/user-dashboard.js');
ok(/You have not applied to anything on Fyndr yet\./.test(ud) && /Browse jobs and internships/.test(ud) && /Nothing saved yet/.test(ud) && /Nothing shared yet/.test(ud) && /Nothing at interview stage yet/.test(ud) && /Add your skills/.test(ud), 'candidate dashboard empties say what to do');
ok(!/Loading…<\/p>/.test(ud) && /loadingText\('Loading your resume'\)/.test(ud), 'resume loading text is announced');
const od = rd('public/js/features/dashboard/org-dashboard.js');
ok(/No listings yet\./.test(od) && /No applicants yet\./.test(od), 'organization dashboard empties');
ok(/Add skills/.test(rd('public/js/features/suggestions/foryou.js')) && /Create a group/.test(rd('public/js/features/groups/groups.view.js')), 'For you and Groups empties have buttons');

// 5. a failed page no longer leaves the skeleton on screen
const rt = rd('public/js/core/router.js');
ok(/errorHtml\(e && e\.message\)/.test(rt) && /import \{ errorHtml \}/.test(rt), 'router shows the error state when a page fails');
ok(/states\.actions/.test(rd('public/js/core/events.js')) && /return route\(\)/.test(rd('public/js/features/states/states.actions.js')), 'retry action re-runs the route');
ok(skeletonFor('notifications', true) === 'center' && skeletonFor('dashboard', true) === 'dash', 'notifications shows a page-shaped placeholder');
ok(/pages\/states\.css/.test(rd('scripts/bundle-css.js')) && /\.st-cta/.test(rd('public/css/app.css')) && /states\/states\.js/.test(rd('public/precache.json')), 'styles bundled, files precached');
console.log(`states: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);

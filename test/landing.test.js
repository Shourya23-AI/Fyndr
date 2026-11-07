import assert from 'node:assert';
// Logged-out landing page: the markup it builds (no browser needed: `document` is a stub that catches innerHTML).
process.on('unhandledRejection', () => { });
const root = { innerHTML: '' };
globalThis.window = { matchMedia: () => ({ matches: false }) };
globalThis.matchMedia = window.matchMedia;
globalThis.document = { querySelector: () => root, getElementById: () => null, querySelectorAll: () => [], addEventListener() { } };
let n = 0; const ok = (c, msg) => { assert(c, msg); n++; };
const { landing } = await import('../public/js/features/home/landing.js');
landing(null);
const h = root.innerHTML;
ok(/<h1>[^<]+<\/h1>/.test(h) && (h.match(/<h1/g) || []).length === 1, 'one h1');
// The career guide is for signed-in students only: nothing of it (form, example chips, chat mount) is on the logged-out page.
ok(!/data-form="dream"/.test(h) && !/id="lp-job"/.test(h), 'no dream-job form for signed-out visitors');
ok(!/id="guide"/.test(h) && !/guide-start/.test(h), 'the career guide does not mount for signed-out visitors');
ok(!/ on[a-z]+=|<script|javascript:/i.test(h), 'no inline handlers or scripts');
ok(/data-count="7900"/.test(h) && /class="container lp-nums"/.test(h), 'numbers strip kept for the count-up');
ok(/data-act="auth" data-mode="signup"/.test(h) && /data-act="auth" data-mode="signin"/.test(h), 'sign-up and sign-in stay reachable');
ok(/Example result/.test(h) && /An example only/.test(h), 'the worked result is labelled as an example');
// every tag opened is closed (void tags aside)
const VOID = new Set(['input', 'img', 'br', 'hr', 'meta', 'link']);
const stack = [];
for (const m of h.matchAll(/<(\/?)([a-z0-9]+)\b[^>]*?(\/?)>/gi)) {
    const [, close, tag, self] = m; const t = tag.toLowerCase();
    if (VOID.has(t) || self) { continue; }
    if (close) { ok(stack.pop() === t, 'balanced </' + t + '>'); } else { stack.push(t); }
}
ok(stack.length === 0, 'all tags closed');
console.log(`\n${n} passed, 0 failed`);
process.exit(0);

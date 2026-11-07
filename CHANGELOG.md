# Changelog

Versions follow [Semantic Versioning](https://semver.org): MAJOR.MINOR.PATCH. MAJOR = a change that breaks existing data or API callers
(then a new `/api/v2` is added and `/api/v1` keeps working), MINOR = new features, PATCH = fixes. Change `version` in `package.json`; `/readyz` shows it.

## 1.2.0 (production hardening, in progress)
### Added: edit your profile (Basic info card)
- `#/profile` now starts with a **Basic info** card: change your name, photo, headline and about text, and see your sign-in email, verified phone (masked) and member-since date. It saves on its own (`PUT /api/profile/basic`), so you no longer have to fill in every required education field just to fix a name. Before, the name could not be changed at all.
- The long form below it is now "Education, skills and preferences". It no longer contains photo, headline or about (first-time setup still does, as one step), and saving it keeps whatever the Basic info card saved.
- The rules (name 2-80 characters with letters, headline 100, about 500, no angle brackets or control characters in the name) live in one file, `features/profile/basics.rules.js`, used by the browser/Firestore mode and the Node server. No Firestore rules change was needed (the owner could already write `name` and `profile`). `test/profile-edit.test.js` covers the rules, both backends and the "big form keeps headline and about" behaviour.
### Fixed: phone verification in Firefox/Zen and on phones
- The login went through phone.email in the same tab for Firefox-based browsers and phones. phone.email's own page needs the window that opened it (`window.opener`) to finish, so it failed with `TypeError: window.opener is null` and the number was never verified. Phone verification now always opens phone.email in a popup/new tab straight from the click (`startLogin` in `phone-email.js`); the same-tab mode is gone. If the browser blocks the popup, the page says to allow pop-ups and press the button again. The service-worker cache label was bumped so visitors get the new script.
### Changed: landing page for signed-in members
- People who are signed in now get their own landing page (`features/home/member.js`): a welcome, next steps, the career guide, quick links to every section and a phone-verification reminder, with no sign-up or sign-in buttons. Signed-out visitors still see the original page.
### Added: career guide, typos and live links
- The dream job now survives typos ("sofware enginer", "data scintist", "mechnical engineer", "datascientist"): a misspelt word is matched to the closest known job word (a swap of two letters counts as one mistake, a tie is settled by which sentence matches a job best), and the guide asks "I read that as Software Developer. Is that the job you mean?" before going on. Unknown jobs are still not guessed. `editDistance` / `correctTypos` in `guide.engine.js`.
- The roadmap checks the Library's open catalogs (Open Library, Project Gutenberg, Google Books, Internet Archive) for the first book of each step and links straight to a free, preview or borrow copy when one exists (`bestCopy` in `guide.books.js`, `live()` in `guide.view.js`). The roadmap's "Find ... openings" button opens the jobs page already searching for the dream job.
### Changed: new landing page for signed-out visitors
- The hero now starts with the dream job: "I want to be a ..." plus six example jobs. Typing a job (or tapping an example) scrolls to the career guide and sends it, so the guide begins with the job already answered (`startWith` in `guide.view.js`, `guide-start` action and `dream` form in `guide.actions.js`).
- A worked example result (marked as an example) replaces the stock photo and the rotating card. New sections: how it works (4 steps), honest labels with the example listing card, the numbers, and a short closing call to action. Removed the scrolling ticker, the sign-up-opening search box, the category buttons that opened sign-up, the oversized wordmark and the gradient-clipped headline and float animations. One entrance animation only (off for reduced motion). `test/landing.test.js` checks the markup.
### Added: career guide, part 3 of 3 (books and the 3-phase roadmap)
- After the course plan the guide offers a roadmap in three phases: Foundations, Tools and Projects, with the courses from part 2, 1 or 2 books per skill, rough weeks per phase and a project idea for the job's field. Books are a hand-made list of well-known titles (`guide.books.js`), each with a Library search and other places to find it; Fyndr has not checked availability, and the screen says so. A skill with no pick gets a Library search instead.
- Save (this device only, `localStorage` key `fyRoadmap`, read back through a checker) and Share (the phone's share sheet, else copy as plain text, else a box to copy from). "Open my saved roadmap" appears in the chat when one is saved. `features/guide/guide.roadmap.js`.
### Added: career guide, part 2 of 3 (course plan)
- After the readiness check the guide offers a step-by-step course plan: up to 6 skills, core before nice-to-have, foundations first, 1 or 2 catalog courses per skill (free ones first) with buttons to each learning site. Skills with no catalog topic fall back to search links. `features/guide/guide.courses.js`.
### Added: career guide, part 1 of 3
- Landing page: a chat that asks for your dream job, checks your qualification, field, experience and skills (from your profile when signed in, or by asking four quick questions) and shows a readiness check: skills you have, partly have, still need, plus what to learn first. Rules run in the browser (`public/js/features/guide/`); nothing typed is sent anywhere. Parts 2 (courses) and 3 (books and the 3-step plan) follow.
### Security
- Content-Security-Policy: `script-src` no longer allows `'unsafe-inline'`. The two inline scripts and the font `onload` moved to `public/boot.js`, the role `onchange` and the landing search `onsubmit` became delegated listeners, `phone-callback.html` and `app.html` use script files, and `phone-callback.html` has its own strict policy. `test/csp.test.js` fails if an inline script or `on...=""` handler comes back.
### Performance
- The two catalogs (about 1.8 MB) are no longer downloaded on the first visit; they are fetched when first used.
### Housekeeping
- `security.txt` renewed (expires 2027-10-15). Service worker cache label v31.

## 1.1.1
### Fixed
- Tracker (Dashboard > Tracker): rewrote its styles. The five stage columns now sit in one row (swipe sideways on phones) instead of wrapping with "Closed" alone on a second row; buttons no longer stretch across the whole card; cleaner "Add an opening" form, follow-up banner, inputs and focus rings (light and dark).
- Service worker cache label bumped (v30) so visitors get the new stylesheet instead of the cached old one.

## 1.1.0
### Added
- Reliability: the app now times out hung requests, retries safe ones with exponential backoff + jitter, and stops hammering a server that is down (circuit breaker).
- `/readyz` readiness probe next to `/healthz`; graceful draining on shutdown; load shedding above `MAX_INFLIGHT`; slow-loris timeouts.
- Observability: request ids (`X-Request-Id`, shown as "ref ..." on server errors), one JSON log line per API call, `/metrics` with counts, p50/p95/p99 latency, memory.
- `/api/v1/...` address and `X-API-Version` header.
- Data safety: schema versions with migrations (`server/db/migrate.js`), daily backups (7 kept), never overwriting an unreadable `data.json`.
- Server-side phone check (Cloud Function in `functions/`, opt-in) and `firestore.rules.strict-phone`.
- Nightly sweep (expired listings, retention), uptime alert workflow, `firebase.json`, runbook / SLO / postmortem documents, fault injection for rehearsals (`CHAOS_ERROR_RATE`).
### Fixed
- Multi-byte text corruption in large requests, logout storm when Google certificates are briefly unreachable, admin dashboard read-quota drain, expired listings staying visible,
  rejected organizations keeping live listings, files left on disk after account deletion, N+1 scans in organization pages.

## 1.0.0
- First version.

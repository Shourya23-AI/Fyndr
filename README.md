# Fyndr

## Update: new logo, banners, 7,900+ built-in jobs and courses, sliding "Suggested for you" row

- **Logo and icons:** new mark in `core/dom.js`, `index.html`, `favicon.svg` and `public/icons/*`.
- **Banners and letter logos:** `features/browse/banner.js` draws a coloured banner (by kind of work) for any listing with no picture, and a coloured letter logo for providers with no logo. Uploaded or server-found pictures always win. Category chips on the Jobs and Courses pages use the same grouping.
- **Built-in catalog:** `scripts/build-catalog.js` writes `public/catalog/catalog-courses.json` (4,403 courses, 491 topics, 16 providers) and `catalog-jobs.json` (3,505 jobs and internships, 161 roles, 4 job boards). Add a topic or role to the script and run `node scripts/build-catalog.js`. `features/catalog/` turns the rows into listings in the browser and `core/api.js` merges them into every `/listings` request. Saving a catalog item is kept on the device.
- **Honest note:** catalog entries are TOPIC and ROLE listings. Each opens the provider's or job board's own search page, so the student picks the exact course or opening there. They are not individually verified pages, and search-page addresses can change. Real live openings still come from the importer.
- **Suggested for you row:** `features/suggestions/rail.js`, at the top of both pages. Signed-in people with a finished profile get picks from the on-device engine; everyone else gets a daily-rotating "Popular right now" mix. The catalog is pre-filtered to rows that mention the person's skills or field before scoring, so it stays fast.


## Update: job suggester + course suggester with a "For you" page (more confidence for candidates)

**Why candidates saw nothing:** the suggestions only appeared after a qualification document was verified (`NEEDS_VERIFIED_DOCUMENT = true`). Now everyone who has finished their profile gets them. (Set it back to `true` in `features/suggestions/suggest.js` if you want the old rule.)

**New: Dashboard > For you** (the first tab, opened by default). Everything is worked out on the candidate's device from what they typed; no resume is read and no AI is involved. It shows:
- **Where you stand:** how many open roles are a strong or good match, in plain words ("You are a strong match for 3 open roles right now"). A weak profile is never called strong.
- **Your strengths:** skills they have that their best matches keep asking for.
- **Closest to ready:** the role that needs the fewest extra skills, and exactly which ones ("You only need SQL and Git").
- **Jobs and internships for you** with the reasons for each match (and what is missing), **Show more** to see all of them.
- **Your learning roadmap:** the skills that would open the most matches, in order, each with the courses that teach it. Courses found by the importer (Microsoft Learn, your hand-picked list) appear here automatically.
- **More courses picked for you**, and **tips** to improve the profile (only what is actually missing: skills, cities, job types, projects, headline).
- The browse page's "Suggested for you" now links to this page ("See your full plan").

**Files:** `features/suggestions/insights.js` (the confidence summary, pure), `features/suggestions/foryou.js` (the page), `test/confidence.test.js` (25 checks). The matching engine itself (`engine.js`) is unchanged. All suites: `node test/run.test.js` (118), `brand.test.js` (65), `suggest.test.js` (61), `import-live.test.js` (18), `confidence.test.js` (25).

**Honest notes:** a match is a guide, not a promise, and the page says so. Matching is only as good as the profile (skills typed, projects, cities). Not checked on a real phone or browser in my build environment (no Firebase there); the logic and the page's HTML are tested.

## Update: jobs and courses update by themselves (no PowerShell, no importing files)

**What was wrong:** (1) the importers had no time limit, so one slow website made them wait for ever, and the Firebase importer never closed its connection, so it never "finished"; (2) imported jobs waited for an admin (`autoPublish` was `false`); (3) you had to run the script yourself and then upload the file in the dashboard.

**What it does now:** a GitHub workflow (`.github/workflows/import-jobs.yml`) collects jobs, internships and courses **every 3 hours**, **right after you edit** `config/companies.json`, `config/courses.json` or `config/import-settings.json`, and whenever you click *Run workflow*. Trusted ones (score 50+) go live at once; unsure ones wait in your review queue; scams are dropped; jobs that disappear from the employer's page are closed. Visitors who leave the site open get the fresh list when they come back.

### One-time setup (all clicks, no command line)
1. Put the whole project on GitHub (GitHub Desktop: drag the files into the repository folder, *Commit*, *Push*). Do not upload `data/` or `imports/`.
2. Firebase Console > gear icon > **Project settings** > **Service accounts** > **Generate new private key**. Open the downloaded `.json` file in Notepad and copy ALL of it.
3. GitHub repository > **Settings** > **Secrets and variables** > **Actions** > **New repository secret**. Name: `FIREBASE_SERVICE_ACCOUNT`, value: paste. Save. (Never put this file in the repository.)
4. Firebase Console > Firestore > **Rules**: paste `firestore.rules` and **Publish**.
5. GitHub > **Actions** > **Import jobs** > **Run workflow**. Watch it finish (a few minutes). From then on it runs by itself. If the secret is missing the run stops at once and says so in red.

Optional: free keys from developer.adzuna.com as secrets `ADZUNA_APP_ID` and `ADZUNA_APP_KEY` (more internships and fresher jobs in India).

### If the GitHub run is red (Actions > Import jobs > click the run)
The run now checks its setup first and prints ONE red sentence that says what to fix. The usual ones:
- **"Cannot find scripts/import-to-firestore.js"**: the files are inside an extra folder. `.github`, `scripts`, `config`, `public` must be at the very top of the repository (open the repository's first page: you should see them right there, not inside `fyndr/`).
- **"The FIREBASE_SERVICE_ACCOUNT secret is missing / empty / not valid JSON / not a service-account key"**: redo steps 2 and 3. Paste the WHOLE downloaded `.json` file, no quotes. It is not the `firebaseConfig` snippet from the web-app settings.
- **"has no Firestore database yet"**: Firebase Console > Build > Firestore Database > Create database.
- **"The Cloud Firestore API is switched off"**: open the link in the message, click Enable, wait a minute, run again.
- **"Google says this service account may not use Firestore" / "Google refused the key"**: make a new private key in the Firebase project that the site uses (`projectId` in `config/firebase-config.json`) and replace the secret.
- A yellow warning that the key is for another project means the importer would fill a database the site never reads: use a key from the project named in the message.
- Several companies listed as "skipped" or "failed" is normal; the others still import. The run is only red when nothing at all could be collected.
After a green run, the page of the run shows a small table (new, refreshed, closed).

### What changed in the files
- `scripts/import-jobs.js`: every download is cut off after 20 s (8 s for board guesses); several companies are fetched at once (5) instead of one by one; a time limit for the whole run (companies not reached are tried next time); it always ends by itself; **new source `mslearn`**: Microsoft Learn's public catalog, newest free beginner learning paths first, so **new courses appear by themselves** (`{ "type": "mslearn", "levels": ["beginner"], "limit": 40 }` in `config/companies.json`). Hand-picked courses stay in `config/courses.json`; push an edit and it is live minutes later.
- `scripts/import-to-firestore.js`: closes its connection and exits; remembers which job board each `auto` company uses (in the database, document `meta/atsCache`) so every run no longer guesses all of them again; checks existing listings in batches of 100; loads the site's modules in a way that also works on Windows.
- `config/import-settings.json`: `"autoPublish": true`. To go back to approving everything by hand, set it to `false`.
- `public/js/package.json` (`{"type":"module"}`): lets Node read the site's shared modules on any Node version.
- `test/import-live.test.js` (18 checks): timeouts, parallel fetching, deadline, Microsoft Learn mapping, publish-on-first-sight and refresh-on-second. Run all: `node test/run.test.js`, `node test/brand.test.js`, `node test/suggest.test.js`, `node test/import-live.test.js`.

### Honest notes
- Not tested against the real internet (my build environment has none). The Microsoft Learn source follows its documented catalog format; if Microsoft changes it, that source shows as "failed" in the log and the rest carry on. Read the first run's log in GitHub > Actions.
- GitHub may start a scheduled run a few minutes late, and pauses schedules on repositories with no activity for 60 days (a push or *Run workflow* wakes them).
- If you run `node server.js` yourself it is a server and keeps running on purpose; you do not need it for updates any more. On a host that runs it all the time (Render) it also imports by itself (`IMPORT=0` turns that off).

## Update: real company logos, cover pictures and many more companies (found by the system, nothing hardcoded)

**Why the posts looked green and empty:** imported jobs were saved with no logo and no picture, and the page only draws pictures that were uploaded as data. Now the server looks them up itself.

- **Brand finder** (`server/jobs/brand.js`). For every company with listings it finds the official website, then that site's own logo, cover picture and brand colour:
  1. a `"site"` you wrote in `config/companies.json` (optional), else Wikidata's "official website" entry, else guesses from the name (name.com, name.in, name.io ...);
  2. a site is accepted only if its own page title / schema.org name contains the company name (parked "domain for sale" pages are refused);
  3. logo: schema.org logo, then apple-touch-icon, SVG icon, web-app-manifest icons, other icons; cover: the og:image, only if it is wide enough to be a banner (a square logo is not used as a background); colour: `theme-color`.
  - Only pages and files the site's `robots.txt` allows are read. Everything is stored in `DATA_DIR/brands` and shown from your own server (`/api/brand/<id>/logo|cover`), so visitors never contact the company's servers.
  - Cards with no cover now show the company's colour with its logo in the middle (the old green is the last fallback).
  - Results are remembered: refreshed every 30 days, failed lookups retried after 3 days, at most 40 new lookups per run.
  - Switch off: `"brands": false` in `config/import-settings.json`. A company that asks not to be shown: add its domain to `"brandBlocklist"`.
  - Safety: the downloader (`server/jobs/net.js`) is https-only, refuses internal addresses even after redirects or DNS tricks, limits size and time, and recognises files by their bytes (SVGs with scripts are refused; pictures are served with a sandboxing header).
- **New job sources** in `scripts/import-jobs.js`: `ashby`, `smartrecruiters`, and **`auto`**: write only `{ "name": "Stripe", "type": "auto" }` and the system finds the company's public job board (Greenhouse, SmartRecruiters, Lever, Ashby) by itself, checks that it really is that company, remembers it, and logs what it picked. If none is found the company is skipped quietly and tried again after a week.
- `config/companies.json` now lists about 65 more companies as `auto`. Your six hand-written boards are unchanged.
- Not integrated on purpose: Google, Amazon, Microsoft, Apple, Meta, Netflix and similar run their own career sites with no public job feed. "Anyone can open the page" is not the same as "automated copying is allowed" (their terms and robots.txt decide), so they are not scraped. Adzuna (already here, needs its free key) is the legitimate way to get many of those postings.
- Only works in **Node server mode** (the importer and the pictures live on the server). The GitHub Pages + Firebase-only mode is unchanged.
- **Not tested against the real internet** (my build environment has none). `node test/brand.test.js` (65 checks) uses a pretend internet; `node test/run.test.js` still passes (118). Read the first import log: it says which company got which board and which got a logo.
- Imported listings still wait for an admin by default (`"autoPublish": false`), so the browse page only shows approved ones.


## Update: job search runs inside the Node server (no GitHub, no Firebase key)

- `server/jobs/auto-import.js` starts with `node server.js`: it fetches jobs, internships and courses 15 seconds after start and then every 6 hours, scores them (everything waits for an admin by default; scams are dropped), refreshes the ones still open, and closes the ones gone from the employer's page or unseen for 45 days.
- Sources and filters: `config/companies.json` and `config/import-settings.json`. Optional: env `ADZUNA_APP_ID` and `ADZUNA_APP_KEY`.
- Env: `IMPORT=0` turns it off, `IMPORT_EVERY_HOURS=3` changes the interval.
- Needs the Node server to be what your site talks to (set `<meta name="fyndr-api">` in `public/index.html` to its address). The GitHub Pages + Firebase-only setup does not use this.
- The server needs internet access to reach the company job boards.

## Update: every posting is verified by a person, with a legitimacy rating

- **Nothing goes live without an admin or moderator approving it.** Posts from organizations always did; found (imported) jobs now do too (they arrive as "pending"). To let trusted imports (score 50+) publish by themselves, set `"autoPublish": true` in `config/import-settings.json`.
- **Automatic verification at posting time:** the Node server scores every new posting (0-100) the moment it is posted and stores the score and reasons on the listing; an admin then approves or rejects it by clicking. (With Firebase only, the same score is worked out from the listing text whenever it is shown, so it cannot be faked by the poster.)
- **Legitimacy rating (0-100)** is shown on every listing card and in the details popup ("Looks legit" 75+, "Probably legit" 50-74, "Check carefully" under 50; hover for the reasons), and next to each listing in the admin queue. It comes from simple visible rules in `features/trust/trust.js`, not AI. It helps people decide; it is not a guarantee.
- Fixed: the job list crashed when drawing the second card (`.map(card)` passed the index as match info).
- Uploaded cover images are now WebP, 480x270, about 30 KB or less (logos 96x96, about 8 KB).

## Update: job search runs inside the Node server (no GitHub, no Firebase key)

- `server/jobs/auto-import.js` starts with `node server.js`: it fetches jobs, internships and courses 15 seconds after start and then every 6 hours, scores them (everything waits for an admin by default; scams are dropped), refreshes the ones still open, and closes the ones gone from the employer's page or unseen for 45 days.
- Sources and filters: `config/companies.json` and `config/import-settings.json`. Optional: env `ADZUNA_APP_ID` and `ADZUNA_APP_KEY`.
- Env: `IMPORT=0` turns it off, `IMPORT_EVERY_HOURS=3` changes the interval.
- Needs the Node server to be what your site talks to (set `<meta name="fyndr-api">` in `public/index.html` to its address). The GitHub Pages + Firebase-only setup does not use this.
- The server needs internet access to reach the company job boards.

## Update: fully automatic posting

- The importer now runs **every 6 hours** (was daily) and also **reviews posts from organizations**: verified org + verified phone + trust 50 or more -> approved; obvious scam (asks for fees, ID or OTP) -> rejected; anything else stays pending for an admin. Imported listings keep the earlier rules (50+ published, under 50 waits).
- To turn the automatic approval off, add `AUTO_APPROVE: '0'` under `env:` in `.github/workflows/import-jobs.yml`.
- One-time setup you must do yourself: the `FIREBASE_SERVICE_ACCOUNT` GitHub secret, then Actions > Import jobs > Run workflow once. Nothing else is manual after that.
- Fixed: the job list crashed when drawing the second card (`.map(card)` passed the index as match info).
- Uploaded cover images are now WebP, 480x270, about 30 KB or less (logos 96x96, about 8 KB).


## Update: automatic listings + a clearer job/course page

**Before you publish (in this order)**
1. Push the site files to GitHub (service-worker label is `static-2026-10-13-detail`). No new Firestore rules are needed.
2. Make sure the daily importer has its one secret (`FIREBASE_SERVICE_ACCOUNT`, see `.github/workflows/import-jobs.yml`). Then open GitHub > Actions > **Import jobs** > **Run workflow** once, instead of waiting for 02:30 UTC.
3. Optional, for many more internships and fresher jobs in India: get a free key at developer.adzuna.com and add two more secrets, `ADZUNA_APP_ID` and `ADZUNA_APP_KEY`. Without them that source is skipped. Read Adzuna's terms first (they ask for credit; the page already says "From Adzuna").
4. Read the log of that first run. The last lines say **which sources failed**. The company boards in `config/companies.json` are my best guesses (Postman, BrowserStack, Razorpay, CRED, Groww, Paytm); I could not test them without internet. Delete or correct any that fail (the board name is the last part of the company's `boards.greenhouse.io/...` or `jobs.lever.co/...` address).

**What changed**
- **Automatic listings.** The daily importer now keeps the list fresh by itself:
  - New listings are scored (same trust rules; 50+ is published, under 50 goes to your review queue, scams are not stored).
  - Listings still on the employer's page stay open (`lastSeen` is refreshed). Listings that **disappear** from the employer's page are **closed automatically**. Safety stops: only when that page was fetched fine, and never more than 60% of one company in a single run.
  - Anything nobody has seen for 45 days is closed.
- **Student-friendly filter** (`config/import-settings.json`): keeps internships, trainee, fresher, entry-level and 0-2 year roles; drops senior ones and ones with no entry-level signal; keeps India cities, "India" and remote. Change the lists in that file.
- **16 hand-picked free courses** (`config/courses.json`: CS50, freeCodeCamp, Kaggle, Microsoft Learn, NPTEL, SWAYAM, Odin Project, IBM SkillsBuild and more), each with its own "Best for" and "What you get". They load with the same daily run. Add your own by copying an entry. I wrote the descriptions from what I know of these sites; check a link and the certificate/fee wording before you rely on it.
- **New popup when a student clicks a job or course** (also a bottom sheet on phones, with the Apply button pinned at the bottom): quick facts (location, pay, duration, experience, posted), **Who it is best for**, **What it gives you**, About (with Read more), key skills, How to apply, and the **official link** shown in full.
  - If the text says "Best for: ..." or "What you get: ..." (also "Ideal for", "Who should apply", "Benefits", "Perks", "You'll learn"), those lines are shown as written.
  - Otherwise plain keyword rules look for signals (intern, fresher, remote, certificate, stipend, mentor, PPO, health insurance ...). If the listing says nothing, the page says so instead of inventing something. No AI, nothing leaves the device.
  - Cards now show a one-line "Best for".
  - The "Post an opportunity" box tells organizations they can add those two labelled lines.

**Not done / not tested here**
- I could not open the site in a browser, so **how the new popup looks on your screen is untested** (it uses your theme colours). Check it on a phone and tell me what to adjust.
- Live fetching (Greenhouse, Lever, Adzuna) and the GitHub run are untested (no internet in my build environment). The logic around them has tests.
- The "who it is best for" lines made by keyword rules are guesses from the text. Employers who write their own lines give better results.

**Checks:** `node test/run.test.js` runs 114 checks.

## Update: scheduled importer, auto-close, usage counters, Insights, security hardening (plan parts 2-5, partly)

**Before you publish (in this order)**
1. Push the site files to GitHub (service-worker label is `static-2026-10-12-insights`).
2. Firebase Console > Firestore > **Rules**: paste the new `firestore.rules` and **Publish** (new: closing listings, `analytics/{day}` counters).
3. **Test sign-in with Google and the phone check once.** The new Content-Security-Policy line in `index.html` (line 5) could block something I could not test. If a sign-in step breaks, delete that one `<meta http-equiv="Content-Security-Policy" ...>` line and tell me the browser console message.
4. Everyone sees a one-time "Please review our updated policies" screen (policy version `2026-10-12`: usage counts and the weekly summary are now in the Privacy Policy).
5. Go through **SECURITY.md** (App Check, API key restriction, admin 2-step, budget alert). Those are the biggest wins and only you can do them.

**What changed**
- **Scheduled importer:** `.github/workflows/import-jobs.yml` runs `scripts/import-to-firestore.js` daily. Needs one GitHub secret, `FIREBASE_SERVICE_ACCOUNT` (the service-account JSON; never commit it). Same sources, rules and trust bands as before: **50+ published, under 50 review queue, scams not stored** (the number is `TRUST_MIN` in `features/trust/trust.js`; your plan said 70/40, you asked for 50, change it there if you want the plan's bands).
- **Auto-close:** imported listings close after 45 days, posted ones after 90 (`features/listings/expiry.js`). Closing runs when an admin opens the dashboard (hourly), with **Run cleanup now**, and in the daily importer. Closed listings leave the public list and start the 30-day application retention clock.
- **Usage counters (consent):** a one-time question (and a switch in Privacy & data). If yes, the browser sends daily totals only: views, searches, searches that found nothing (plain words only, never numbers or emails), saves, Apply clicks, skill names of viewed listings. No user id, listing id or time per event.
- **Insights tab (admin and moderators):** totals, where people drop off, searches that found nothing, skills people look at vs how many listings mention them, and a **weekly report** written from the totals with fixed sentences (no AI) that you can copy.
- **Security:** Content-Security-Policy and referrer policy, escaping of the generated how-to-apply text, `security.txt`, a rules-checked counter document, and `SECURITY.md`.

**Not done yet (say which you want next)**
- Part 3: crawlable public listing pages + sitemap (needs a build step that writes one HTML page per listing), saved searches and alerts (needs email sending), employer reply times.
- Trending skills feeding back into suggestions (the counters are being collected; wire it once there is data).
- Firebase App Check in code, and a Cloud Function for phone verification.
- The analytics counters accept values inside the two maps without range checks in the rules; a determined signed-in person could skew them.
- Not testable here: `firestore.rules`, the GitHub workflow, live fetching, and how the new screens look in a browser (Insights, usage question, apply page). Syntax is checked and the logic has tests.

**Checks:** `node test/run.test.js` runs 99 checks.

## Update: imported jobs, trust score, auto description, full apply page (plan step 3)

**Before you publish (in this order)**
1. Push the site files to GitHub (the service-worker label is already bumped to `static-2026-10-11-apply-import`).
2. Firebase Console > Firestore Database > **Rules**: paste the new `firestore.rules` and **Publish**. Without it, importing and the new apply form are refused.
3. Optional, to bring in jobs: edit `config/companies.json`, run `node scripts/import-jobs.js` on your computer, then open **Dashboard > Listings > Import jobs and courses** and choose `imports/jobs.json`.

**What changed**
- **Imported listings (no bot that logs in anywhere).** `scripts/import-jobs.js` reads only: Greenhouse and Lever public job boards, and company careers pages that publish schema.org `JobPosting` data (it checks `robots.txt` first and skips pages that disallow it). You choose the companies; it never logs in or fills forms. Sites with no structured data or that block it cannot be covered.
- **Trust score (0-100, plain rules, no AI):** fee or deposit requests, ID/bank/OTP requests, WhatsApp/Telegram hiring, unrealistic earnings, hidden employer, thin text, free-email contact, non-https or mismatching apply link lower it; an official job-board source and a matching company link raise it. Code: `js/features/trust/trust.js`.
  - **50 or more:** published automatically.
  - **Under 50:** goes to the admin review queue (Dashboard > Listings, with the score and the reasons shown on each row).
  - **Obvious scams** (asking for money or ID): not stored at all. The import result says how many were skipped.
  - Listings posted by organizations still wait for admin approval as before; the admin now also sees their trust score.
- **Auto description:** clicking a job or course shows a summary (what it is, key skills found in the text) and numbered **How to apply** steps, built with rules from the listing's own text (`js/features/listings/summary.js`). Nothing is sent to any AI service.
- **Apply button:** for imported listings it opens the employer's own page in a new tab (`rel="noopener noreferrer nofollow"`), labelled with the site name. Fyndr never collects applications for them (the rules and the API both refuse).
- **Apply page for jobs posted on Fyndr:** `#/apply/<listing>` is now a full page instead of a popup: name, email (fixed), phone, current city, education, skills, experience, LinkedIn, portfolio/GitHub, a short cover note (required), resume choice (Fyndr resume or your own PDF), and the same consent line. Details are saved on the application (`form`); the organization sees them under **Applicants > Details**. They are deleted with the application (same retention rules as before).

**Things to know**
- "Totally safe" cannot be promised. The trust score catches common scam patterns; the admin queue is the safety net. Imported listings are only as good as the employer's own page.
- The importer runs on your computer, because the site has no server. For automatic runs use a scheduled GitHub Action later.
- Imported listings have no cover picture (they show the type on a coloured card).
- The Privacy Policy still says the organization and admins see the resume; the form details follow the same rule. Add a sentence about the application form if you want it spelled out.
- Not tested here: `firestore.rules` (use Rules Playground: staff create `listings/imp_abc`, candidate apply with `form`) and live fetching from real sites (no internet in my build environment; the parsing is covered by tests).

**Checks:** `node test/run.test.js` now runs 91 checks (new: import bands, scam skipped, duplicates, staff-only import, no applying to imports, form validation, form reaches the organization, summary, JobPosting parsing).

## Update: resume privacy and consent (plan step 1)

**Before you publish (2 minutes, in this order)**
1. Push the site files to GitHub (the service-worker label is already bumped to `static-2026-10-11-privacy`).
2. Firebase Console > Firestore Database > **Rules**: paste the new `firestore.rules` and **Publish**. New sign-ups and applications need the new rules, and old ones need the new site, so do both close together.
3. Open the site, sign in: accounts created before this update see a one-time **"Please review our updated policies"** screen and accept once.

**What changed**
- **Consent at Apply:** the apply popup says *"Your resume will be shared with <Organization> and Fyndr admins."* above the Apply button, with a Privacy Policy link. The time of consent is stored on the application (`consentAt`).
- **Terms and Privacy checkbox:** now linked to both pages, required, and also shown on the "Finish setting up" screen that Google sign-ups go through (before, Google sign-ups skipped it). The version and time are stored on the account (`consent`). Bump `POLICY_VERSION` in `js/features/legal/constants.js` whenever the policies change and everyone is asked to accept again.
- **The organization now gets a copy of the resume, not live access.** When a candidate applies, the chosen resume (the website resume as it was at that moment, or the PDF) is copied into the application (`blobs/ar_{appId}_{i}`). The organization reads only that copy. Deleting the application deletes the copy, so it takes the organization's access with it. (Applications made before this update keep working through the old `sharedWith` route; withdrawing one removes it.)
- **Withdraw application:** the candidate dashboard has a Withdraw button (Applications tab and the new **Privacy & data** tab).
- **Download my data:** a JSON file (account, profile, applications, consent record, uploaded resume as base64) for candidates; account, listings and applications received for organizations. A separate button downloads the uploaded resume PDF.
- **Delete my account:** asks for the password again (or a Google confirmation), then deletes the profile, files, applications and their resume copies, saved items and the phone claim, and finally the Firebase sign-in. Organizations also lose their listings and the applications they received. Admin and moderator accounts cannot delete themselves (change the role first); the main admin never can.
- **Retention (in the Privacy Policy, from one shared setting):** applications and their resume copies are deleted **30 days after a listing is closed** and in any case **365 days after applying**. Change the numbers in `js/features/privacy/retention.js` and the policy text and the cleanup follow.
- **Cleanup:** it runs when an admin opens the dashboard (at most once an hour) and with **Overview > Data retention > Run cleanup now**. There is no server, so nothing runs while no admin visits; a scheduled job (GitHub Actions or a Cloud Function) is the proper long-term answer.
- **Privacy Policy rewritten** to match how the site really works (Firebase, who sees what, retention, your rights). I removed the line "each view is logged" because no such log exists yet; add it back when the admin audit log (step 3) is built.

**Things to know**
- Closing a listing arrives in step 2. The cleanup already understands it: a listing with `status: 'closed'` and a `closedAt` date. Step 2 must set both.
- Admins cannot open resume copies yet (they can see account details and verification documents). The consent line already mentions admins because step 3 adds that, with its audit log.
- The new rules could not be run in the Firebase emulator here (step 4). After publishing, try one full run: sign up, apply, withdraw, then delete the account. Any "Not allowed" message points at a rules problem.
- The optional Node server (`node server.js`) is not updated for these features; they run on the Firestore backend used by GitHub Pages.
- When you turn on Firestore backups (step 4), add the backup retention period to the Privacy Policy.

**Checks:** `node test/run.test.js` now runs 76 checks (new: consent at sign-up and apply, resume copy stays as shared, withdraw, older applications, data export, delete account for candidates and organizations, retention cleanup).


## GitHub Pages + Firebase only (no server)

The site now runs completely on **GitHub Pages + Firebase**. Accounts, profiles, listings, applications, resumes, saved items, phone claims and staff roles are all stored in **Firestore**, so every device sees the same data. The yellow "Demo mode" bar and the "No server is connected" message are gone. (The optional Node server still works exactly as before if you ever want it; the site picks Firestore automatically when no server answers.)

**One-time setup (about 5 minutes)**
1. Firebase Console > **Build > Firestore Database > Create database** (production mode, any region).
2. **Rules** tab: paste the whole file `firestore.rules` from this folder and **Publish**. *This step is required: the rules are the security of the site now.* Re-publish them whenever this file changes.
3. **Authentication > Sign-in method**: enable Email/Password and Google. **Settings > Authorized domains**: add `YOURNAME.github.io`.
4. phone.email dashboard: set Domain URL to your GitHub Pages address (as before).
5. Push everything to GitHub. In `public/sw.js` change the `static-...` label to anything new whenever you publish an update (it makes visitors drop old cached files).
6. Sign up with `admin.fyndr@gmail.com`, confirm the email: that account is the permanent admin and can make others Admin / Moderator in **Dashboard > Team**.

**Posting with pictures**
- The *Post an opportunity* form now asks the organization for a **cover image** (required) and a **logo** (optional; the logo from the last listing is reused). The browser shrinks them (cover 640x360, logo 128x128) and stores them inside the listing, so **no paid Firebase Storage plan is needed**.
- Listings (jobs, internships and courses) show as cards: cover picture, logo on it, title, provider, duration, location, price, **View Details** and a save heart. View Details opens a popup with everything and the Apply button. Admins see the picture and details when reviewing a listing.
- Optional **Duration** field (e.g. "12 weeks"). Star ratings from the mock-up are not shown because there is no review system behind them.

**Who can do what (enforced by `firestore.rules`)**
- Only staff can approve a listing or verify an organization; an organization cannot verify itself or approve its own post.
- Organizations post only when verified + phone confirmed (and Gmail rule respected). New posts are "pending" until approved.
- A candidate applies once per listing; only that organization can change the application status.
- An organization can read a candidate's profile and resume only after the candidate applied to it.
- One phone number can belong to one account. Staff roles live in `staff/{email}`; the main admin can never be changed.

**Honest limits of having no server**
- Phone verification is checked by the browser against phone.email (a server used to do this). Normal users can't skip it, but a technically skilled person could fake a number. For airtight checks you would need a small Cloud Function (Firebase "Blaze" plan) or the Node server.
- Deleting an account in the admin dashboard removes its data but not its sign-in in Firebase Authentication (delete that in the console if needed).
- Files (resume, proof) are limited to 2 MB and listing pictures to about 150 KB each, to fit in Firestore. The listing page loads all approved listings; that is fine for hundreds, but at thousands add paging.
- Firestore free plan: 50,000 reads / 20,000 writes per day. A rules-check read is counted when staff roles are looked up.
- Data that used to live only in one browser (old demo mode) is not moved into Firestore: people sign in and set up again.

**Checks**: `node test/run.test.js` runs 76 checks of the whole backend logic against an in-memory Firestore stand-in (signup, verification, posting with images, approval, applying, chunked resumes, roles, cascade delete). It cannot test `firestore.rules`; use Firebase Console > Rules > *Rules Playground* for that.

## Latest update: speed, caching, mobile, phone verification, team roles

**Speed (the reload feels instant now)**
- **Instant shell:** the header and shimmering placeholders are in `index.html` itself and are drawn before any JavaScript runs. Returning visitors also get their signed-in header straight away (a small hint is kept on the device; the real profile replaces it a moment later).
- **Lazy Firebase:** the Firebase SDK and its config load in the background and no longer block the first paint (`services/firebase/firebase-init.js`). Config is cached on the device.
- **Fewer requests:** all 27 stylesheets are joined into one `css/app.css` (`scripts/bundle-css.js`, rebuilt automatically when the server starts; run `node scripts/bundle-css.js` by hand after editing CSS in Live Server mode). The server injects `modulepreload` tags so the ~50 JS files download in parallel instead of one after another. Fonts load without blocking.
- **Skeleton shimmer:** grey blocks with a light shade sweeping over them appear exactly where content will show up (home, listings, dashboards, phone and profile pages). Code: `js/core/skeleton.js`, `css/components/skeleton.css`.

**Caching (three layers)**
1. **Server static cache** (`server/http/static.js`): every file is read and gzipped once and served from memory, with ETag/304. JS/CSS: `max-age=60, stale-while-revalidate`; images/icons: 7 days; HTML, `sw.js`, manifest: always revalidated.
2. **Service worker** (`public/sw.js`): stale-while-revalidate for pages and files, so repeat visits open from the device. The server stamps each deploy with a build id (`__BUILD__`), so a deploy gets a fresh cache and the old one is deleted. API calls are never cached by it (except the two public config endpoints).
3. **Client data cache** (`js/core/api.js`): `/me`, listings, `/my`, admin data and so on are kept in memory for 10-45 seconds, duplicate requests share one call, and **any change or sign-out clears it**. The last listings are also saved on the device so a reload draws them immediately while fresh ones load.

**Mobile layout**
The page used to drift to the right on phones. Causes fixed in `css/base/reset.css`: iOS Safari zooms into any field smaller than 16px and stays shifted (fields are now 16px on phones); the page can no longer scroll sideways (`overflow-x: clip` on `html` and `body`, `touch-action: pan-y pinch-zoom`); grid/flex children can shrink; tables scroll inside their own box.

**Phone verification (phone.email)**
- The result is now **visible**: a 3-step indicator (Enter number and code, We confirm it, Done), spinners, a clear red error message on the page (not only a toast), a **Try again** button, an **"I already verified: check again"** button, and a success screen that continues to the dashboard on its own.
- More reliable return from phone.email: `phone-callback.html` accepts the token from `?access_token=`, `#access_token=` or `?token=`, and in same-tab mode (phones) sends it back **inside the link** (`#/phone?token=...`), so it no longer depends on browser storage. The router also lets a candidate who has not finished their profile reach `#/phone` (before, they were bounced to the profile page and the result was lost).
- The server retries phone.email once, times out cleanly, and logs why a token was rejected.
- **Important:** in the phone.email dashboard, *Domain URL* must be exactly the address people use (for example `https://fyndr.com`, not `www.` if you serve without it, and not `localhost`). A mismatch is the most common reason nothing comes back.

**Admin roles: moderators and admins**
- **Main admin (`admin.fyndr@gmail.com`) is permanent.** It shows as "★ Permanent admin", has no role selector, and the server refuses to change, demote or delete it (even by another admin).
- Admins open **Dashboard > Team**, search any account (candidate or organization) and choose **Member / Moderator / Admin** from a dropdown. The person must have signed up and confirmed their email; the role applies the next time they open Fyndr. Demoting returns them to their normal candidate/organization account (nothing is lost).
- **Moderators** can review listings and verification documents and verify organizations. **Admins** can also change organization size / Gmail posting, delete accounts and manage the team. The Team tab is hidden from moderators and the server enforces all of this (`server/routes/admin.routes.js`, `PATCH /api/admin/staff/:id`).
- **Add by email:** in Team, type any email and pick Admin or Moderator. If the person already has an account the role applies now; otherwise it waits and applies automatically once they sign up and confirm their email. Pending invites can be cancelled.
- Extra admins from `ADMIN_EMAILS` are also permanent (set in server config, not editable in the UI).
- Roles work with the Node server. The browser-only Live Server mode (`services/local-api`) does not implement moderators.

**If something fails:** the admin sidebar shows a `Build xxxx` stamp (tells you which version is really running), a failing admin tab now shows its error message on the page, and phone verification errors are shown in red on the phone page. The server log prints `phone.email rejected the token ...` with the reason. Server-side the phone check also accepts phone.email's alternative response formats (`user_json_url`, other field names).

**Tested:** 21 automated checks of the role rules (promotion, demotion, permanent admin, moderator limits), static cache headers, 304s, gzip, build-stamped service worker and modulepreload injection. Please also try the site once on your own phone (see "Mobile checklist" below).

**Mobile checklist (2 minutes):** open the site on your phone, rotate the screen, tap into a search box (the page must not zoom or shift), reload (placeholders then content), sign in, open `#/phone` and run the verification, then in the admin account open Team and change a role.

## Publish checklist (production)
The app is one Node 18+ process with **no npm install**. Any host that runs `node server.js` works (Render, Railway, Fly.io, a VPS, Docker).

1. **Put the code on the host.** `render.yaml` (Render blueprint) and a `Dockerfile` (Fly, Railway, Cloud Run, any Docker host) are included.
2. **Set environment variables** (see `.env.example`):
   - `NODE_ENV=production` (forces HTTPS redirect, HSTS, and does **not** seed the fake demo listings)
   - `DATA_DIR=/data` pointing at a **persistent disk/volume**. The database (`data.json`) and uploaded files live there; on a host without a persistent disk they are wiped on every deploy.
   - `PHONE_EMAIL_CLIENT_ID=...` (or keep it in `config/phone-email.json`)
   - `ADMIN_EMAILS=you@gmail.com` (optional extra admins; `admin.fyndr@gmail.com` is always admin)
3. **Firebase console** > Authentication > Settings > **Authorized domains**: add your live domain (e.g. `fyndr.com`). Without this, Google sign-in and the email links fail on the live site.
4. **phone.email dashboard** > Profile Details: fill **Domain URL** with your live domain (leave it empty only while testing on localhost). Optionally add the Privacy and Terms URLs (`https://your-domain/#/privacy`, `/#/terms`).
5. **Check it works:** open `https://your-domain/healthz` (should print `ok`), sign up with `admin.fyndr@gmail.com`, verify the email, then try phone verification.
6. **Back up** the `DATA_DIR` folder regularly (it is the whole database).

Built in for production: gzip + caching for static files, rate limiting on the API (stricter on sign-up and phone verification), security headers, atomic database writes, `/healthz` health check, graceful shutdown.

## New: admin side + organization size
- **Admin account:** `admin.fyndr@gmail.com` is built in. Create that account yourself (Create account -> Candidate tab, choose your own password, confirm the email link, sign in). It becomes admin automatically. More admins: `ADMIN_EMAILS=a@x.com,b@y.com node server.js` (or edit `services/local-api/config.js` in Live Server mode). Code: `server/config.js`.
- **Admin dashboard** (`features/dashboard/admin-dashboard.js`): Overview, Organizations, Listings, Verification, Candidates. Admins land on it after sign-in.
- **Organization size:** organizations choose *Small business* or *Enterprise* at sign-up. Enterprises must use a work email; small businesses may use Gmail etc.
- **Admin override per organization** (Organizations tab): change the size, and set *Gmail posting* to Default (by size) / Allow / Block. Enforced when posting (`POST /api/listings`). Rules live in `gmailAllowed()` in `server/lib/helpers.js` and `services/local-api/helpers.js`.

## New: resume template + profile details
- The website resume now uses a two-column template (dark sidebar with Links / Reference / Hobbies, main column with Work Experience, Education, Skills and Languages bars). Code: `public/js/features/dashboard/resume.js` (HTML + `RESUME_CSS`).
- Every part of the resume is drawn **only if the profile has data for it**. Empty sections are left out.
- `#/profile` now asks for everything the resume shows (address, LinkedIn, Twitter / X, portfolio, hobbies, work experience, extra education, skill levels, languages, reference). All optional. Saved/sanitized by `cleanExtras()` in `server/lib/helpers.js` and `services/local-api/helpers.js`.
- The **Dashboard** link was removed from the top nav; it is reached from the profile button (organizations now get a Dashboard button in that card too).

## New: candidate dashboard
Sidebar dashboard (Profile · Resume · Applications, read-only), auto-built resume, resume choice when applying, profile photo on the profile button. Editing happens in Manage profile (#/profile). Employers can now mark applicants "interview".


## Setup (once)
1. Firebase console → Authentication → Sign-in method → enable **Email/Password** and **Google**.
2. Project settings → Your apps → Web app → copy the config into `config/firebase-config.json` (and `public/config/firebase-config.json` if you use Live Server).
3. Authentication → Settings → Authorized domains: make sure `localhost` is listed.
4. Run (Node 18+, **no npm install needed**):

       ADMIN_EMAILS=you@gmail.com node server.js
       # Windows (cmd): set ADMIN_EMAILS=you@gmail.com && node server.js

   Open http://localhost:3000. The account with `admin.fyndr@gmail.com` (or an `ADMIN_EMAILS` address) becomes **admin once its email is verified**.
5. Your database and uploads live in `data/`. (If you have an old `data.json` / `uploads/` next to `server.js`, the server moves them into `data/` on first start. An old file from before the Firebase change should be deleted.)

## Phone verification (phone.email, no Firebase billing needed)
Phone numbers are verified with [phone.email](https://www.phone.email). Firebase is still used for email / Google sign-in only, so you do **not** need the Blaze plan.
1. Sign up at https://admin.phone.email and copy the **CLIENT_ID** from *Profile Details*.
2. Give the server the ID, either way:
   - environment variable: `PHONE_EMAIL_CLIENT_ID=your_id node server.js`, or
   - put it in `config/phone-email.json` (`{"clientId":"your_id"}`). For Live Server mode also edit `public/config/phone-email.json`.
3. Restart the server and open `#/phone` while signed in. Check the phone.email dashboard for any allowed-domain / redirect settings and add your site (and `localhost` while developing).
4. How it works: the button opens a phone.email popup → the user enters a number and one-time code → the popup lands on `public/phone-callback.html` with an `access_token` → the page hands it to the Fyndr tab → the browser sends it to `POST /api/phone/verify` → the **server** exchanges it with phone.email and stores the verified number. The browser never supplies the number itself.
5. Users must verify a phone before **applying**; organizations before **posting**. One number can be linked to one account; the server enforces it.
6. You can switch the **Phone** provider off in Firebase console → Authentication → Sign-in method; it is no longer used.

## Where things live
```
fyndr-app/
├─ server.js                  launcher (node server.js)
├─ config/firebase-config.json   Firebase keys for the Node server
├─ data/                      data.json + uploads/ (created automatically)
├─ server/                    Node backend, one folder per concern
│  ├─ index.js                creates the HTTP server
│  ├─ config.js               port, paths, admin emails, Firebase config
│  ├─ auth/                   Firebase ID-token verification
│  ├─ db/                     JSON-file database (load / seed / save)
│  ├─ lib/                    route table + shared helpers
│  ├─ http/                   api-handler.js (auth + dispatch), static.js (serves public/)
│  └─ routes/                 one file per feature: account, listings, candidate, profile, proof, organization, admin
└─ public/                    everything the browser loads
   ├─ index.html              the single page; app.html only redirects
   ├─ config/firebase-config.json   Firebase keys for Live Server mode
   ├─ css/
   │  ├─ base/                theme.css (ALL colors / dark mode), reset.css
   │  ├─ components/          buttons, forms, panel, table, tags, toast, logo, hero, how-it-works
   │  ├─ layout/              header.css, footer.css
   │  └─ pages/               home, browse, organizations, dashboard, profile, proof, auth
   └─ js/
      ├─ main.js              entry point
      ├─ core/                state.js (shared state), router.js, events.js, api.js, dom.js, errors.js
      ├─ services/            firebase/ (Firebase SDK wrapper) and local-api/ (browser-only backend)
      └─ features/            one folder per part of the app:
                              layout, account-menu, home, browse, suggestions, organizations, auth,
                              profile, phone, proof, dashboard, legal (terms / privacy / contact)
```
Debugging tips:
- A button does nothing → find its `data-act="name"` (or `data-form="name"`) and look for `name` in that feature's `*.actions.js`.
- A page looks wrong → the page is drawn by `features/<feature>/*.view.js` (or `<feature>.js`); its styles are in `css/pages/<feature>.css`.
- A request fails → the browser calls `core/api.js`, which hits `server/routes/<feature>.routes.js` (or `services/local-api/` in Live Server mode).
- Wrong color → `css/base/theme.css` only.
- Name-click profile card: `features/account-menu/` (styles `css/layout/account-menu.css`).
- Jobs & Internships (`#/jobs`) and Courses (`#/courses`) are both drawn by `features/browse/browse.js` (`browse('jobs'|'courses')`); the type filter is in `browse/listings.js`.
- Password reset: `features/password-reset/` (landing page for the emailed link). Set Firebase console → Authentication → Templates → Password reset → Customize action URL to your site address (e.g. `http://localhost:3000/`).

## Footer pages (Terms, Privacy, Contact)
Text lives in `public/js/features/legal/legal.view.js`; set your real support email in `legal/constants.js`. Styles: `css/pages/legal.css`. These are starter texts, have a lawyer review them before launch.

## Live Server (no Node)
Open `public/index.html` (landing page) with Live Server; the app itself is `public/app.html`. The app then runs browser-only: data is saved in your browser's localStorage (testing only). To get an admin, put your email in `ADMIN_EMAILS` in `public/js/services/local-api/config.js`. Add `127.0.0.1` to Firebase → Authentication → Settings → Authorized domains.

## Pages
- `public/index.html` is the whole app (loads `js/main.js` and the files in `css/`): home and listings, `#/organizations`, dashboards. Sign in / sign up is one sliding panel opened by `openAuth()`.
- `public/app.html` only redirects old links to `index.html`
- GitHub Pages can only publish the repo root or a `/docs` folder, so upload the contents of `public/` to the repo root (or rename `public` to `docs`). Add your `username.github.io` domain in Firebase -> Authentication -> Settings -> Authorized domains. Without a Node server the app runs in browser-only mode.

## Verification
- Organizations: sign up, confirm email, then `#/proof` (careers page link + photo of registration proof). An admin approves it in the **Verification queue** (shows automated checks). Only verified organizations can post.
- Candidates: optional documents at `#/proof`. Approval unlocks **Suggested for you** (skill matching on the typed profile skills; no AI reads the documents).
- Proof files are saved in `uploads/` (server) or browser storage (Live Server). Admin views are logged in `adminLog` in `data.json`.

## Careers-page card and personal search

**"Not listed on Fyndr" card.** When a signed-in person searches Jobs for a well-known company that has no real openings on Fyndr (Google, Microsoft, TCS, Infosys ...),
the first item in the results is a card that says so and links to the company's own careers page. The list lives in `public/js/features/browse/careers.js`
(one row per company: name, other spellings, https careers link). The card hides itself as soon as real openings from that company are listed, so nothing has to be kept in sync by hand.
Names that are also normal words (Meta, Apple, Oracle, Intel ...) are marked `ambiguous` and only trigger on an exact search or with "jobs" / "careers" / "internship" next to them.
Check the links now and then with `node scripts/check-careers-links.js`.

**Personal search.** For a candidate with a finished profile: (1) "Try:" chips under the search box are made from the headline, best-rated skills, field and first city;
(2) search results are ordered by how well each job fits that person, with a match % on each card (normal newest-first order when there is no search);
(3) people who have not typed any skills yet still get picks, matched on field, headline, level, job type and place. Code: `public/js/features/suggestions/personal.js` and `engine.js`.

Tests: `node test/careers.test.js`, `node test/personal.test.js` (all test files run on every push through `.github/workflows/tests.yml`).
Security review and what to do next: `SECURITY-AUDIT.md`.

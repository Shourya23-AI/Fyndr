# Fyndr

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

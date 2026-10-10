# Fyndr

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

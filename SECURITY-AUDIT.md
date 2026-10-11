# Fyndr security review

Scope: everything in the zip (browser code, Node server, `firestore.rules`, GitHub workflow, Docker/Render files).
Method: read the code and tried to break each trust boundary. I could **not** run the Firestore emulator or open the live site, so rule changes
below are checked by hand and must be tested in the Rules Playground before you rely on them (steps at the end).

Severity: **High** = someone can take over accounts or bypass a core rule. **Medium** = abuse, spoofing or data exposure with some effort. **Low** = hardening.

## Fixed in this version

| # | Sev | Problem | Fix |
|---|-----|---------|-----|
| 1 | **High** | **Stored XSS that runs in the admin's browser.** `users/{uid}.proof.portal` (the "careers page link") was only checked in the browser, never by `firestore.rules`. Anyone could save `javascript:...` there with the Firebase SDK. The admin Verification page turned it into a clickable link, and the CSP allows inline script, so one admin click would run attacker code with admin rights (approve themselves, verify fake organizations). | Rules now require an `https://` link of at most 200 characters. Admin page (and every apply link) now passes through the new `safeUrl()` in `core/dom.js`, which accepts plain https only. `esc()` alone does not stop `javascript:` links. |
| 2 | Medium | Apply links (`applyUrl`) were put into `href` after `esc()` only. Safe today because staff import enforces https, but one bad row would have been a script link on every candidate's screen. | `detail.js` and the admin list use `safeUrl()`. All 7,908 built-in catalog links pass it (checked). |
| 3 | Medium | An application's `email`, `name`, `title`, `orgName` were not checked, so a candidate could show an organization a different email address than the verified one, or write very large text. | Rules: `email` must equal the signed-in verified email; sizes capped. |
| 4 | Low | `name` and `website` on a user could grow to the 1 MB document limit on update (only create was capped). | Rules cap `name` at 80 and `website` at 200 on update. |
| 5 | Low | An organization could create a listing with an `imp_...` id and so block the importer from creating that listing. | Rules refuse `imp_` ids for organization posts. |
| 6 | Low | Node server: `name`, `orgName` and listing fields had no length limit, and a non-text `title` caused a 500. | Values are converted to text and cut to the same limits as the rules. |
| 7 | Low | Clickjacking protection existed only as `X-Frame-Options`. | Added `Content-Security-Policy: frame-ancestors 'none'` on the Node server. |
| 8 | Low | Service-account keys and extra `.env` files were not ignored by git. | `.gitignore` extended. |
| 9 | - | No automatic test run and no dependency alerts for the workflow. | Added `.github/workflows/tests.yml` and `.github/dependabot.yml`. |

## Still open: needs a decision or an action from you

### High
**A. Phone verification can be faked (Firestore / GitHub Pages mode).** The phone.email check runs in the browser (`lookupPhone`), and the rules
accept any `phone` value as long as a `phones/{digits}` document with the person's uid exists, which the same person can create. So "verified phone required"
before applying or posting only stops honest users. SECURITY.md already admits this; I am repeating it because it is the biggest hole left.
Fix: move the check to a server you control. Either (1) a Firebase Cloud Function (needs the Blaze plan) that calls phone.email, writes `phones/{digits}` and `users/{uid}.phone` with the Admin SDK, and rules that then forbid clients from writing `phone`, `phoneId` and `phones/*`; or (2) run the included Node server, whose `/api/phone/verify` already does this on the server.

**B. Content-Security-Policy still allows inline script (`script-src 'unsafe-inline'`).** It is there because `index.html` has two small inline scripts
(install prompt, theme) and `phone-callback.html` has one. While it stays, any future HTML-injection bug becomes script execution. Move the three scripts into
`.js` files, then delete `'unsafe-inline'` from `script-src`. Also consider narrowing `img-src https:` (any site can be an image source, which lets a listing image track viewers).

### Medium
**C. One Gmail account is the root of trust.** `admin.fyndr@gmail.com` is hard-coded as the main admin in the rules and code. Turn on 2-step verification on it (hardware key if possible),
and make sure that account **already exists and is email-verified** in Firebase Authentication. If it does not exist yet, someone could register that address first with a password (they cannot verify it, but it creates confusion and "account pre-hijacking" risks when you later sign in with Google).

**D. phone.email token replay (Node server only).** `/api/phone/verify` also accepts a `user_json_url` pointing to any `*.phone.email` address and trusts the number inside, without tying it to your Client ID. If you do not need that variant, delete the `jsonUrl` branch in `server/routes/account.routes.js`.

**E. Usage counters can be polluted or used to run up cost.** Any signed-in account can write the `analytics/{day}` maps (the values inside are not range-checked by the rules) and every account is allowed unlimited writes per day. Set a Firebase budget alert, turn on App Check, and treat the Insights page as hints, as the rules comment says.

**F. Phone numbers can be looked up.** `phones/{digits}` is readable by any signed-in user, so someone can test whether a number has an account. I left it as is because the app uses that read to show "number already used"; the Cloud Function in (A) would remove the need for it.

**G. Firebase App Check is not set up** (listed in SECURITY.md as the next step). Without it, a script can use your public web keys directly against Firestore. It is the single most effective extra layer after (A).

### Lower / good to manage
- **Node server mode:** database is one JSON file written on every change (no backup, single instance). Put `DATA_DIR` on a persistent disk and copy `data.json` off the machine daily. `CORS_ORIGIN` defaults to `*`; set it to your site. Rate limits are in memory per instance. Tokens are not checked for revocation, so a disabled account keeps access for up to an hour.
- **Supply chain:** the Firebase SDK is loaded from gstatic (pinned to 10.12.2, good; no SRI possible for module imports). The import workflow runs `npm install firebase-admin@12` with no lockfile; commit a `package-lock.json` or pin the exact version. Pin GitHub Actions to commit SHAs when you can (Dependabot will now propose updates).
- **Service-account key** (`FIREBASE_SERVICE_ACCOUNT`) can write anywhere in Firestore. Keep it only as a repository secret, rotate it every few months, and give it the narrowest role that works.
- **Candidate data shared with organizations** includes phone number and the whole profile of the resume copy. That matches the consent text, but consider sharing a masked phone until the organization moves a candidate to "interview".
- **`security.txt`** expires on 2027-10-11. Renew it.
- **Local storage** keeps a profile hint (`fyndr-me`) and, briefly, the phone.email token. Both are cleared on sign-out / after use; nothing long-lived or secret is stored.

## Things worth adding next
1. **Report this listing** button on every listing (and a queue for staff). The strongest scam control after the trust score.
2. **Admin audit log** for approve / reject / verify / delete (today only proof-file views are logged on the Node server).
3. **Email notice to the organization and the candidate** when an application status changes; **email alert to admins** for new organizations waiting for verification.
4. **Per-account limits** on applications per day and listings per day (Cloud Function or Node server), plus a CAPTCHA or App Check on sign-up.
5. **Account lock-out screen** for staff changes (two admins must agree to grant admin).
6. **Monitoring:** Firebase usage alerts, an uptime check on `/healthz`, and a weekly look at the "empty searches" list in Insights. That list now also tells you which big companies people look for.
7. **Careers list upkeep:** run `node scripts/check-careers-links.js` monthly and add companies as students ask for them.

## What to do after you deploy (15 minutes)
1. Copy the new `firestore.rules` into Firebase Console > Firestore > Rules, **Publish**.
2. Rules Playground, simulate as a verified user `X` (authenticated, `email_verified` true):
   - `update /users/X` setting `proof` to `{status:'pending', portal:'javascript:alert(1)'}` must be **denied**; with `portal:'https://example.com/careers'` must be **allowed**.
   - `create /applications/X_<id>` with `email` set to someone else's address must be **denied**.
   - `create /listings/imp_abc` as an organization must be **denied**.
3. Sign in as a normal candidate, apply to a posted listing, and sign in as an organization: confirm the application still arrives (this proves the new application rule).
4. Upload the site files. The service-worker label changed, so returning visitors get the new files on their next visit.
5. Do the console items in SECURITY.md (App Check, API-key restriction, budget alert, admin 2-step).

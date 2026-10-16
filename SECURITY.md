# Fyndr security checklist

The code can only do part of this. The items in **bold** are settings only you can change, and they matter most.

## Already in the code
- Every piece of text from users and imported listings is escaped before it is drawn (`esc()`); apply links must be https and open with `noopener noreferrer nofollow`.
- `firestore.rules` is the real backend security: verified email required, people can only touch their own data, only staff approve listings or verify organizations, one phone number per account, imported listings can only be created by staff, applications can only be changed by the owning organization.
- Content-Security-Policy and referrer policy in `index.html` (blocks scripts and frames from any host that is not Google/Firebase/phone.email). The Node server also sends HSTS, nosniff, X-Frame-Options and a permissions policy.
- Trust score + review queue for imported listings; scam-like listings (fees, ID or OTP requests) are never stored.
- Usage counters are consent-based, daily totals only, rate-capped by the rules, readable only by staff.
- `.well-known/security.txt` so researchers know where to write.

## You must do in the Firebase / Google console
1. **Publish `firestore.rules`** every time it changes (Rules tab). Use the Rules Playground to test one admin write and one candidate write.
2. **Firebase App Check** (Build > App Check > Web, reCAPTCHA v3), then "Enforce" for Firestore and Authentication. This stops scripts that copy your site's keys and hammer the database. (Needs a small code addition; ask for it as the next step.)
3. **Restrict the Firebase web API key**: Google Cloud Console > APIs & Services > Credentials > your browser key > Application restrictions: *Websites* > add your GitHub Pages address (and localhost for testing).
4. **Turn on multi-factor sign-in for admin.fyndr@gmail.com** (Google account 2-step verification, and a long unique password). That account controls everything.
5. **Budget alert**: Google Cloud Console > Billing > Budgets & alerts, so a traffic spike or attack cannot surprise you.
6. **Authentication > Settings**: enable *email enumeration protection*; keep Authorized domains to your own site only.
7. **Firestore backups** (Build > Firestore > Disaster recovery) and add the retention period to the Privacy Policy.
8. **GitHub**: turn on branch protection for `main`, 2FA on your GitHub account, Dependabot alerts, and keep the service-account key only as a repository *secret*.

## Honest limits
- Phone verification is checked in the browser unless you set up the Cloud Function in `functions/` (README: "Server-side phone check") and publish `firestore.rules.strict-phone`. Until then a skilled person could fake it.
- No system can promise "totally safe". The trust score and your review queue catch common scams, not every one.
- Because the site is hosted on GitHub Pages, real HTTP security headers cannot be set; the meta tags are the closest equivalent. Hosting behind Cloudflare or using the Node server adds them.

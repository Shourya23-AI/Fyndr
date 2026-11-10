# Fyndr improvement plan: four parts

Each part is finished, tested and deployed before the next one starts.

## Part 1: Foundation: one address and safe deploys  ✅ done
- One address only: `fyndr-bmsit.vercel.app`. The old address redirects (server side in `vercel.json`, and again in `boot.js`).
- Phone verification refuses to start on any other `*.vercel.app` address and explains why.
- Every deploy gets its own cache name (`scripts/stamp-build.js`), so visitors never see stale files.
- Firestore rules are published automatically when they change (`deploy-rules.yml`), or by one command (`npm run deploy:rules`).
- Written checklist: `docs/DEPLOY.md`. A test keeps the address consistent everywhere.

## Part 2: Reliable phone verification (phone.email only)  ✅ done
Decision: phone verification stays on **phone.email**. No Firebase Phone Auth and no paid plan (Firebase Phone Auth needs the Blaze plan).
- Friendly messages for every phone.email failure (code expired, could not reach phone.email, too many attempts, not set up) instead of raw codes.
- "Technical details" on a failed attempt now names the return address we asked phone.email for, and tells the site owner exactly what the phone.email dashboard must contain. This diagnoses the "sent me to the old domain" problem in one look.
- Node server: at most 10 verify attempts per hour per account (`429 PHONE_RATE`).
- Already in place from Part 1 and earlier: one address only, wrong-address guard, the result reaches the page by three routes (window, tab message, shared storage), up to 5 accounts per number.

## Part 3: Onboarding and engagement  ✅ done
- ✅ Guided first-run profile setup with a progress bar (the completion % already exists) that ends on the profile page.
- ✅ Status-change notifications for applications; alerts for new listings that match a person's skills.
- ✅ Empty states and loading states that tell people what to do next.

## Part 4: Quality and polish
- Lighthouse pass: speed, mobile layout, accessibility; fix what it finds.
- Real end-to-end tests for signup, phone verification and edit profile (the current tests use a mock Firestore).
- Error monitoring and an uptime check on the live address.
- Optional, only if you ever move to the Blaze plan: deploy the Cloud Function + `firestore.rules.strict-phone`, so phone claims cannot be forged from the browser. Not needed for normal use.

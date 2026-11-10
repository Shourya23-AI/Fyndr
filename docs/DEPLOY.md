# Deploying Fyndr (one address, one checklist)

**The only address of the site is `https://fyndr-bmsit.vercel.app`.** The old address `fyndr-2rjv.vercel.app` is retired and
redirects to it. Everything below must use the new address.

## One-time setup (do these once; each takes a minute)

| Where | Setting | Value |
|---|---|---|
| **phone.email** dashboard (Client ID `11330121310479106943`) | Domain URL / Redirect URL | `https://fyndr-bmsit.vercel.app` and `https://fyndr-bmsit.vercel.app/phone-callback.html` (remove `fyndr-2rjv`) |
| **Firebase** > Authentication > Settings > Authorized domains | add | `fyndr-bmsit.vercel.app` (you can remove `fyndr-2rjv.vercel.app`; keep `localhost` for testing) |
| **Vercel** > Project > Settings > Domains | make primary | `fyndr-bmsit.vercel.app`. Keep `fyndr-2rjv.vercel.app` attached to the SAME project so its visitors get redirected (the redirect lives in `vercel.json`) |
| **GitHub** > Settings > Secrets > Actions | add `FIREBASE_TOKEN` | output of `firebase login:ci`. Lets GitHub publish `firestore.rules` for you on every change |

## Every deploy

1. Push to `main`. Vercel builds and deploys by itself.
   - `scripts/stamp-build.js` gives the deploy its own cache name, so nobody keeps seeing old files.
   - `.github/workflows/deploy-rules.yml` publishes `firestore.rules` if it changed (needs the `FIREBASE_TOKEN` secret above).
   - No secret yet? Publish the rules by hand: `npm run deploy:rules`, or paste `firestore.rules` into Firebase Console > Firestore > Rules.
2. Open `https://fyndr-bmsit.vercel.app`, hard-refresh once, and check: sign in, then `#/phone`.

## If phone verification misbehaves

- It must be started from `https://fyndr-bmsit.vercel.app` (the app now says so on any other `*.vercel.app` address).
- phone.email sending you to `fyndr-2rjv...` means its dashboard still has the old address saved. Fix the table above.
- When an attempt fails, the page's **Technical details** shows which return address we asked phone.email for. Compare it with what is saved in the phone.email dashboard: they must match exactly.
- No paid plan is needed for any of this: phone verification uses phone.email only (no Firebase Phone Auth, no Blaze plan).
- "Rules refused": the rules in Firebase are older than `firestore.rules`. Publish them.

## Keeping the address in one place

The address appears in `public/js/core/site.js`, `public/boot.js` and `vercel.json`. `npm test` (test/domain.test.js) fails if they disagree.
To move the site to another address later, change those three, then redo the one-time table.

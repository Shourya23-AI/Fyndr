# Fyndr runbook (read this at 2 a.m.)

## First 10 minutes of any incident
1. **Is it really down?** Open the site on your phone's mobile data (not Wi-Fi). Open `<server>/healthz` (must say `ok`) and `<server>/readyz` (must say `"status":"ready"`).
2. **Say so.** Tell users (pinned post in the community, or a banner) that you know and are working on it. Silence feels worse than the outage.
3. **Stop the bleeding before finding the cause.** Roll back the last change (below). Fixing forward comes later.
4. **Write down times** (when it started, what you did, when it stopped). You need them for the postmortem.

## What to look at
| Question | Where |
|---|---|
| Is the process alive / ready? | `/healthz` (alive), `/readyz` (ready; 503 = draining or data folder not writable) |
| How slow, how many errors? | `/metrics` (production: `Authorization: Bearer $METRICS_TOKEN`). Look at `fyndr_http_latency_ms{quantile="0.99"}` and `fyndr_http_requests_total{class="5xx"}` |
| What happened to ONE failed request? | The user sees "(ref 1a2b3c4d5e6f)". Search the host's logs for that id: one JSON line per API call, errors include the stack |
| Is the server overloaded? | `fyndr_inflight_requests`, `fyndr_load_shed_total` (503s on purpose), `fyndr_rate_limited_total` |
| Memory leak? | `fyndr_process_heap_used_bytes` rising for days without falling. Restart is the fix; open an issue |
| Firestore mode (GitHub Pages)? | Firebase Console > Firestore > Usage (reads/writes vs the free quota) and > Rules (Playground to test a rule) |

## Rolling back
- **Node server on Render:** Dashboard > the service > Events > pick the last good deploy > *Rollback*. (Render deploys are rolling: the new version must pass `/healthz` before the old one stops.)
- **Site on GitHub Pages:** `git revert <bad commit>` and push. Bump the service worker label in `public/sw.js` so browsers drop their cached copy.
- **Firestore rules:** Firebase Console > Firestore > Rules > *History* > pick the previous version > Publish. Keep `firestore.rules` in git identical to what is live.
- **Cloud Function (phone check):** put the normal `firestore.rules` back and remove `verifyUrl` from `config/phone-email.json`; the browser-side check works again.

## Restoring data (Node server)
Files next to `data.json` (on Render: the `/data` disk): `data.json.bak` (at most 10 minutes old), `data.json.daily-YYYYMMDD` (one per day, last 7), `data.json.pre-v<N>` (before a schema migration), `data.json.corrupt-<time>` (a damaged file the server refused to overwrite).
1. Stop the service (so nothing writes while you copy).
2. Keep the current file: `cp data.json data.json.broken`.
3. `cp data.json.daily-20261015 data.json` (pick the newest one that is before the problem).
4. Start the service. Everything after that backup is lost. Say so to the affected people.
Uploaded resumes and proofs live in `uploads/` and are NOT in `data.json`: back that folder up too (Render: disk snapshots).

**Firestore mode:** turn on *Point-in-time recovery* (Firebase Console > Firestore > Disaster recovery) and a *scheduled backup*. Without them a deleted collection cannot be brought back. Recovery targets: lose at most 24 h of data (RPO), be back within 4 h (RTO).

## Scaling limits (read before adding servers)
- The **Node server is one process by design**: the database is a JSON file on one disk and the rate limiter is in memory. **Never set more than one instance**, and never run two copies on the same file. Two copies would overwrite each other's data.
- It comfortably serves a few thousand users. When you outgrow it (the `/metrics` p99 climbs, `data.json` is over ~50 MB), move to **Firestore mode** (already built; it scales on Google's side), not to more Node instances.
- Firestore mode costs per read: the admin dashboard refreshes at most every 10 minutes, listings come in one query. Watch Firestore > Usage after launches.

## Secrets
Service-account key (`FIREBASE_SERVICE_ACCOUNT`), `METRICS_TOKEN`, `PHONE_EMAIL_CLIENT_ID` live in GitHub / Render secret settings, never in git. **If one leaks:** create a new one, replace it in the settings, delete the old one in the Google Cloud console, then redeploy. Do it first, investigate after.

## On-call (even if on-call is just you)
- Turn on GitHub notifications for failed workflow runs (the **Uptime** workflow is your pager). Set the repository variable `SITE_URL` (and `API_URL`) so it runs.
- Decide who answers and when, and tell the team. A solo founder: say "answers within 4 h, 8:00 to 22:00 IST" publicly; do not promise 24/7.
- After a bad night, write the postmortem the next day (template in `docs/POSTMORTEM_TEMPLATE.md`). Nobody is blamed; the question is "what would have caught this earlier?".

## Game day (rehearse failure on purpose, once a quarter)
Run locally, never on the live site: `CHAOS_ERROR_RATE=0.3 CHAOS_LATENCY_MS=800 node server.js`. Click through the app: failed calls should be retried quietly, errors readable, nothing stuck on a spinner.
Then stop the server for a minute: the app should fail fast with "server is busy", then recover on its own when it returns. (`CHAOS_*` are ignored in production unless `CHAOS_ALLOW_PROD=1`.)

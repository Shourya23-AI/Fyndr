# Backend checklist: 111 topics, checked against Fyndr

Source: the "Who's gonna tell vibe coders about..." list (items 1 to 111). Each topic was looked up in this code base.

| Mark | Meaning |
|---|---|
| ✅ had | Already in the project before this review (30) |
| ➕ added | Was missing and is now added (35) |
| 🔶 partly | Partly covered, the gap is named (9) |
| ➖ n/a | Does not apply to an app this size / architecture, with the reason (37) |

"n/a" is not "skipped": for each one the reason is written down. Adding Kubernetes, sharding or a message queue to a one-server app would make it worse, not better.

| # | Topic | Status | Where / why |
|---|---|---|---|
| 1 | Rate Limiting | ✅ had | Per-IP limits on the Node server, strict on sign-up and phone checks (`server/index.js`). Now tunable with env vars. Firestore mode has only the rules' size caps. |
| 2 | Caching | ✅ had | Server memory cache + gzip + ETag, client TTL cache cleared on every write, service worker. |
| 3 | Load Balancing | ➖ n/a | The host (Render / GitHub / Google) already balances in front of the app; one instance by design. |
| 4 | Reverse Proxies | ✅ had | Runs behind the host's proxy: `X-Forwarded-Proto` redirect, `X-Forwarded-For` client IP, keep-alive longer than the proxy's. |
| 5 | API Gateways | ➖ n/a | One small API. Auth + rate limit + CORS in `server/index.js` do the gateway's job. |
| 6 | CI/CD | ✅ had | Tests on every push, importer every 3 h, sweep daily. Now `npm test` runs everything the same way on any computer. |
| 7 | Docker | ✅ had | `Dockerfile`: non-root user, `HEALTHCHECK`. |
| 8 | Kubernetes | ➖ n/a | Needs a shared database first; the JSON-file server is one process. Overkill for this size. |
| 9 | Service Discovery | ➖ n/a | There is one service. |
| 10 | Circuit Breakers | ➕ added | `public/js/core/net.js`: after 5 failures in a row calls fail fast for 15 s, then one probe request. |
| 11 | Timeouts | ➕ added | Browser: 20 s per call. Server: header (20 s) and request (60 s) timeouts. Outbound importer calls already had timeouts. |
| 12 | Retries | ➕ added | Reads and idempotent writes retry on network errors / 429 / 502 / 503 / 504; creating things only on 429 / 503 (nothing was done). |
| 13 | Exponential Backoff | ➕ added | Full jitter (random wait up to 0.4 s x 2^try); `Retry-After` respected (a long one is shown at once). |
| 14 | Idempotency | ✅ had | Application id = `uid_listingId` + create-only rules; the Node server answers 409 for a repeat. Retries never repeat a processed POST. |
| 15 | Message Queues | ➖ n/a | No background work that needs one; the importer is a scheduled job. |
| 16 | Pub/Sub | ➖ n/a | Nothing publishes events to several consumers. |
| 17 | Event-Driven Architecture | ➖ n/a | Not needed. (Chat uses Firestore live listeners, see 22.) |
| 18 | Distributed Transactions | ➖ n/a | One datastore. Firestore transactions are used where two documents must change together (phone claim). |
| 19 | Saga Pattern | ➖ n/a | No workflow across services. Account deletion is a multi-step cleanup that is safe to run again. |
| 20 | Dead Letter Queues | ➖ n/a | No queues. Importer sources that fail are listed in the run summary, which is the same idea. |
| 21 | Cron Jobs | ✅ had | GitHub Actions schedules: import (3 h), sweep (daily), uptime (15 min); `server/jobs/auto-import.js` on the Node server. |
| 22 | WebSockets | ✅ had | Chat and communities use Firestore real-time listeners (Firestore mode). The Node server has no live channel. |
| 23 | Long Polling | ➖ n/a | The Firestore SDK falls back to it by itself when needed. |
| 24 | Server-Sent Events | ➖ n/a | No one-way live feed needed. |
| 25 | Database Indexing | ✅ had | Firestore single-field indexes are automatic and every query is equality-only (no composite index file needed). JSON DB scans are fine until about 50k rows. |
| 26 | Query Optimization | 🔶 partly | In-memory N+1 scans fixed. Still open: browse loads all approved listings and the admin dashboard scans whole collections (needs a pagination design; see `SECURITY-AUDIT` / audit report). |
| 27 | N+1 Queries | ➕ added | Fixed two in `organization.routes.js` (applicants per listing; user per application) with one-pass maps. |
| 28 | Connection Pooling | ✅ had | Node's fetch reuses connections; the Firestore SDK manages its own. No SQL database to pool. |
| 29 | Read Replicas | ➖ n/a | Firestore replicates on Google's side; the Node DB is one file. |
| 30 | Sharding | ➖ n/a | Orders of magnitude below the point where it matters. |
| 31 | Partitioning | ➖ n/a | Data is already split per collection. |
| 32 | Replication | 🔶 partly | Firestore: automatic. Node server: backups (not live replication), see 84. |
| 33 | Leader Election | ➖ n/a | Single instance (`numInstances: 1` in `render.yaml`). |
| 34 | CAP Theorem | ➖ n/a | Single node = consistent; Firestore documents are strongly consistent. No distributed trade-off to make. |
| 35 | Eventual Consistency | 🔶 partly | The browser's listing cache can be up to 2 min old by design and is cleared on every write. |
| 36 | Optimistic Locking | ➖ n/a | Records have one editor at a time (their owner) and moderation is last-write-wins and harmless. Add a version field if two moderators ever clash. |
| 37 | Pessimistic Locking | ➖ n/a | Node is single-threaded; handlers do not wait between "check" and "write". |
| 38 | Distributed Locks | ➖ n/a | One instance. GitHub `concurrency` stops two sweep runs overlapping. |
| 39 | Race Conditions | ✅ had | Checked: no await between the duplicate check and the write on the Node server; Firestore uses deterministic ids + create-only rules; phone claim is a transaction. |
| 40 | Deadlocks | ➖ n/a | No locks, so none possible. |
| 41 | Memory Leaks | ➕ added | Maps are pruned (rate limiter) or bounded (static cache, audit log capped); heap size now in `/metrics` so a slow leak is visible. |
| 42 | Garbage Collection | ➖ n/a | Automatic in Node; heap in `/metrics` shows pressure. |
| 43 | Thread Safety | ➖ n/a | Single-threaded JavaScript; the database file is written to a temp file and renamed, so a write is all-or-nothing. |
| 44 | Backpressure | ➕ added | Load shedding above `MAX_INFLIGHT` (503 + Retry-After), 3.2 MB body cap, client breaker. |
| 45 | Autoscaling | ➖ n/a | Node: deliberately one instance. Firestore and the Cloud Function scale by themselves (function capped at 5 instances for cost). |
| 46 | Horizontal Scaling | ➖ n/a | Impossible with a JSON-file DB. The way to scale out is Firestore mode (documented in the runbook). |
| 47 | Vertical Scaling | ✅ had | Raise the Render plan; nothing in the code blocks it. |
| 48 | CDN | 🔶 partly | GitHub Pages sits behind a CDN. Render serves long cache headers for images; a CDN in front (e.g. Cloudflare) is the next step if traffic grows. |
| 49 | Edge Caching | 🔶 partly | Cache-Control headers are CDN-friendly (7 days for images, stale-while-revalidate); no separate edge layer. |
| 50 | Cache Invalidation | ✅ had | Client cache cleared on writes; server cache keyed by file time; service worker label bump (in the runbook). |
| 51 | Feature Flags | ➕ added | `READ_ONLY=1` incident kill switch (writes refused, browsing works). `config/import-settings.json` already gates auto-publish. |
| 52 | Blue-Green Deployment | ➖ n/a | Render's rolling deploy (54) gives the same zero-downtime result at this size. |
| 53 | Canary Releases | ➖ n/a | Not worth the machinery for one small server; use rollback (55). |
| 54 | Rolling Deployments | ✅ had | Render replaces the instance only after `/healthz` passes. |
| 55 | Rollbacks | ➕ added | Step-by-step for Render, GitHub Pages, Firestore rules and the Cloud Function in `docs/RUNBOOK.md`. |
| 56 | Health Checks | ✅ had | `/healthz`, Docker `HEALTHCHECK`, Render `healthCheckPath`. |
| 57 | Liveness & Readiness Probes | ➕ added | `/healthz` = alive, new `/readyz` = ready (503 while draining or when the data folder is not writable). |
| 58 | Monitoring | ➕ added | `/metrics` + the Uptime workflow (every 15 min). |
| 59 | Logging | ➕ added | One JSON log line per API call with request id, status, duration; errors include the stack. Query strings are never logged. |
| 60 | Distributed Tracing | 🔶 partly | Request id follows a call browser -> server -> log (`X-Request-Id`, shown to users as "ref ..."). Full span tracing is pointless with one service. |
| 61 | Metrics | ➕ added | Request counts by class, latency histogram, in-flight, rate-limited, shed, uptime, memory. |
| 62 | Alerts | ➕ added | Uptime workflow emails you on failure; alert rules (what wakes you vs. what waits) in `docs/SLO.md`. |
| 63 | SLOs | ➕ added | `docs/SLO.md`. |
| 64 | SLIs | ➕ added | `docs/SLO.md`, each tied to a metric. |
| 65 | Error Budgets | ➕ added | `docs/SLO.md` including what to do when it is spent. |
| 66 | Observability | ➕ added | Logs + metrics + request ids together. |
| 67 | Secrets Management | ✅ had | GitHub / Render secret stores, keys in `.gitignore`. Rotation steps now in the runbook. |
| 68 | IAM | ✅ had | Roles user / org / moderator / admin enforced on the server and in `firestore.rules`. |
| 69 | OAuth | ✅ had | Firebase Authentication sign-in (Google and email). |
| 70 | JWT Rotation | ✅ had | ID tokens last 1 h; the server verifies against Google's rotating keys (cached, with a fallback during Google outages). |
| 71 | TLS | ✅ had | HTTPS redirect + HSTS in production; the host terminates TLS. |
| 72 | Encryption at Rest | 🔶 partly | Firestore and host disks are encrypted by the provider. Uploaded resumes/proofs are not additionally encrypted by the app (needs a key-management decision). |
| 73 | Encryption in Transit | ✅ had | HTTPS only; CSP limits connections to https hosts. |
| 74 | WAF | ➖ n/a | Not in the app. If attacked, put Cloudflare in front; rate limits and rules cover the basics. |
| 75 | DDoS Protection | 🔶 partly | Provider-level absorption (Render / GitHub / Google) plus rate limiting, load shedding and header/request timeouts. |
| 76 | CORS | ✅ had | `CORS_ORIGIN` setting; Bearer tokens, not cookies. |
| 77 | CSRF | ✅ had | Not exposed: login is an `Authorization` header, not a cookie a foreign page could ride on. |
| 78 | SQL Injection | ➖ n/a | There is no SQL database (JSON file + Firestore). |
| 79 | XSS | ✅ had | `esc()` / `safeUrl()` throughout. One open item: CSP still allows inline script (`SECURITY-AUDIT.md` item B). |
| 80 | SSRF | ✅ had | `server/jobs/net.js` refuses private addresses; phone.email URLs are allow-listed. |
| 81 | Database Migrations | ➕ added | `server/db/migrate.js`: numbered steps run once on start; a copy `data.json.pre-v<N>` is kept first. |
| 82 | Schema Versioning | ➕ added | `schemaVersion` in `data.json`; a file from a newer version is refused instead of damaged. |
| 83 | Disaster Recovery | ➕ added | Restore steps + targets (lose at most 24 h, back within 4 h) in the runbook; Firestore point-in-time recovery to switch on. |
| 84 | Backups | ➕ added | Rolling 10-min `.bak`, one per day (7 kept), one before each migration; never overwrites an unreadable file. |
| 85 | Failover | ➖ n/a | No standby by design; Render restarts a server that fails its health check; Firestore is multi-zone. |
| 86 | Multi-Region Deployment | ➖ n/a | Not needed. The Cloud Function runs in Mumbai (`asia-south1`), close to users. |
| 87 | Chaos Engineering | ➕ added | `CHAOS_ERROR_RATE` / `CHAOS_LATENCY_MS` fault injection (off in production) + a game-day checklist. |
| 88 | Cost Optimization | ✅ had | Caching, gzip, throttled admin refresh, daily sweep; what to watch in Firestore usage is in the runbook. |
| 89 | Cold Starts | 🔶 partly | Render paid plans do not sleep. The first phone check after idle may take a few seconds (function cold start); the 20 s timeout covers it. |
| 90 | Serverless Limits | ✅ had | Function: 40 s timeout, max 5 instances. Firestore 1 MB document limit handled by chunked files and rule size caps. |
| 91 | Latency | ➕ added | Measured per request group in `/metrics`. |
| 92 | Throughput | ➕ added | Request counters (use rate() in any dashboard). |
| 93 | P99 Latency | ➕ added | `fyndr_http_latency_ms{quantile="0.99"}`, target in `docs/SLO.md`. |
| 94 | Tail Latency | ➕ added | Same gauges + a separate tail target; slow requests (over 1.5 s) are logged as warnings. |
| 95 | Network Partitions | ➕ added | Between app and server: timeouts, retries, breaker (items 10-13). |
| 96 | Clock Skew | ➕ added | Server stamps times; a wrong phone clock can no longer empty the listing list (`dropExpired`); the sweep uses the server clock. |
| 97 | DNS | ➖ n/a | Handled by the host / registrar. Keep the TTL low when you move a domain. |
| 98 | TCP vs UDP | ➖ n/a | HTTP runs over TCP; HTTP/3 (UDP) is provided by the edge. |
| 99 | HTTP/2 & HTTP/3 | ✅ had | GitHub Pages / Render edges speak them; `modulepreload` already flattens the script waterfall. |
| 100 | gRPC | ➖ n/a | Not used by the app (the Firestore SDK uses it internally). |
| 101 | Webhooks | ➖ n/a | None needed (the importer polls). If you add one: verify its signature and make the handler idempotent. |
| 102 | API Versioning | ➕ added | `/api/v1/...` works like `/api/...`; every response has `X-API-Version`. |
| 103 | Semantic Versioning | ➕ added | `package.json` 1.1.0, rules at the top of `CHANGELOG.md`, shown at `/readyz`. |
| 104 | Infrastructure as Code | ➕ added | `render.yaml`, `Dockerfile`, workflows, and now `firebase.json` + `.firebaserc`, so rules and the function deploy from files. |
| 105 | Terraform | ➖ n/a | A fifth tool for about three resources; `render.yaml` + `firebase.json` already cover it. |
| 106 | Helm Charts | ➖ n/a | No Kubernetes. |
| 107 | Build Caching | ✅ had | There is no build step; the CSS bundle is rebuilt only when a source file changed. |
| 108 | Dependency Hell | ✅ had | The server has zero runtime dependencies; only the function and the importer install `firebase-admin`; Dependabot watches both. |
| 109 | Production Incidents | ➕ added | `docs/RUNBOOK.md`: first 10 minutes, where to look. |
| 110 | On-Call | ➕ added | Runbook section + the Uptime workflow as the pager. |
| 111 | Postmortems | ➕ added | `docs/POSTMORTEM_TEMPLATE.md`. |

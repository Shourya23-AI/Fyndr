# Changelog

Versions follow [Semantic Versioning](https://semver.org): MAJOR.MINOR.PATCH. MAJOR = a change that breaks existing data or API callers
(then a new `/api/v2` is added and `/api/v1` keeps working), MINOR = new features, PATCH = fixes. Change `version` in `package.json`; `/readyz` shows it.

## 1.2.0 (production hardening, in progress)
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

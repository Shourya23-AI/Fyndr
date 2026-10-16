# Changelog

Versions follow [Semantic Versioning](https://semver.org): MAJOR.MINOR.PATCH. MAJOR = a change that breaks existing data or API callers
(then a new `/api/v2` is added and `/api/v1` keeps working), MINOR = new features, PATCH = fixes. Change `version` in `package.json`; `/readyz` shows it.

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

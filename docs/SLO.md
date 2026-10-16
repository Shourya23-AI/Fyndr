# Service levels

An **SLI** is something you measure, an **SLO** is the target for it, the **error budget** is how much failure the target allows.
Targets are deliberately modest for a small team: promising 99.99 % you cannot deliver is worse than promising 99.5 % you can.

| Area | SLI (how it is measured) | SLO (30 days) | Error budget |
|---|---|---|---|
| Availability | Uptime workflow: share of checks where `/healthz` and the site answered | 99.5 % | ~3 h 36 min of downtime per month |
| Correctness | `fyndr_http_requests_total{group="api",class="5xx"}` / all API requests | under 0.5 % server errors | 1 failed call in 200 |
| Speed | `fyndr_http_latency_ms{group="api",quantile="0.95"}` | p95 under 500 ms | |
| Tail speed | `fyndr_http_latency_ms{group="api",quantile="0.99"}` | p99 under 2.5 s | |
| Freshness | Sweep workflow succeeded in the last 26 h (expired listings closed, retention applied) | every day | 1 missed run per month |
| Durability | Newest `data.json.daily-*` is younger than 26 h | every day | 0 |

**Why percentiles, not averages:** an average of 80 ms hides that 1 request in 100 took 4 s. That slow 1 % is somebody's failed application. p99 / "tail latency" is the number to watch.

## How the budget is used
- Budget left: ship features normally.
- Budget more than half spent: only small, well-tested changes.
- Budget spent: **freeze features**, fix reliability (retries, indexes, caching) until it recovers. Write a postmortem for any outage over 30 minutes.

## Alerts (what wakes you up, and what does not)
- **Wake someone:** Uptime workflow fails twice in a row (30 minutes down); `/readyz` is 503 outside a deploy; 5xx share over 5 % for 10 minutes.
- **Look at it tomorrow:** p99 above target for a day; `fyndr_load_shed_total` rising; heap growing for days; Firestore reads above 70 % of the quota; a failed Sweep run.
- Alerts must be actionable. An alert nobody acts on twice is deleted or fixed, not ignored.

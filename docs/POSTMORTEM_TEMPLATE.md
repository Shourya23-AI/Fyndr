# Postmortem: <short title>   (date, author)

Blameless: describe what the system and process allowed, not who made a mistake.

**Summary** (2 sentences: what broke, for whom, for how long)

**Impact** (users affected, failed applications/logins/posts, data lost or not, how many support messages)

**Timeline** (IST, one line each)
- hh:mm  first sign (alert / user report)
- hh:mm  someone noticed
- hh:mm  cause found
- hh:mm  fix or rollback applied
- hh:mm  confirmed recovered

**Root cause** (the real reason, five whys deep: "a typo" is not a root cause, "nothing tested that path" is)

**What went well / what went badly / where we got lucky**

**Detection:** how long did it take to know, and what would have told us sooner? (a metric, an alert, a test)

**Action items** (each with an owner and a date; at least one must be a test or an alert, not "be more careful")
| Action | Owner | Due | Done |
|---|---|---|---|

**Error budget:** how much of the monthly budget (docs/SLO.md) did this use?

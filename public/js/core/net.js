// Resilient fetch for calls to the Node server. Phone networks drop, hosts restart and busy servers answer 503, so every call gets:
//   timeout   : a request that hangs is cancelled after 20 s instead of spinning forever;
//   retries   : up to 2 more tries with exponential backoff + random jitter (so a crowd of apps does not retry in lockstep).
//               Only when it is safe: reads (GET) and idempotent writes (PUT/DELETE) retry on network errors, timeouts and 429/502/503/504.
//               Creating things (POST/PATCH) retries ONLY on 429/503, which mean "the server did not process this", so nothing is ever done twice.
//               A Retry-After header from the server is respected.
//   breaker   : after 5 failures in a row the app stops hammering a server that is down and fails fast for 15 s, then tries one request again.
const IDEMPOTENT = new Set(['GET', 'HEAD', 'PUT', 'DELETE', 'OPTIONS']);
const SAFE_TO_REPEAT = new Set([429, 503]); // rejected before any work was done
const RETRY_STATUS = new Set([429, 502, 503, 504]);
const sleep = ms => new Promise(r => setTimeout(r, ms));
const fail = (message, code) => Object.assign(new Error(message), { code });

export function makeBreaker({ threshold = 5, cooldown = 15000, now = Date.now } = {}) {
    let fails = 0;
    let openUntil = 0;
    return {
        guard() {
            if (now() < openUntil) {
                throw fail('The server is busy right now. Please try again in a few seconds.', 'BREAKER_OPEN');
            }
        },
        ok() {
            fails = 0;
            openUntil = 0;
        },
        fail() { // after the cooldown one request is let through; if it fails too, the breaker opens again at once
            if (++fails >= threshold) {
                openUntil = now() + cooldown;
                fails = threshold - 1;
            }
        }
    };
}
const shared = makeBreaker();

export async function fetchRetry(url, init = {}, o = {}) {
    const { timeout = 20000, retries = 2, base = 400, wait = sleep, rand = Math.random, fetchFn = (...a) => fetch(...a), breaker = shared } = o;
    const method = String(init.method || 'GET').toUpperCase();
    const idem = IDEMPOTENT.has(method);
    breaker.guard();
    for (let i = 0; ; i++) {
        const ctl = new AbortController();
        const timer = setTimeout(() => ctl.abort(), timeout);
        let res;
        let error;
        try {
            res = await fetchFn(url, { ...init, signal: ctl.signal });
        } catch (e) {
            error = e;
        } finally {
            clearTimeout(timer);
        }
        const status = res && res.status;
        const retryable = error ? idem : (idem ? RETRY_STATUS : SAFE_TO_REPEAT).has(status);
        if (status && status < 500 && status !== 429) {
            breaker.ok();
        } else if (error || status >= 500) {
            breaker.fail();
        }
        if (res && !retryable) {
            return res;
        }
        if (!retryable || i >= retries) {
            if (res) {
                return res; // out of retries: let the caller read the server's own error message
            }
            throw error && error.name === 'AbortError'
                ? fail('The server took too long to answer. Please try again.', 'TIMEOUT')
                : fail('Network problem. Check your connection and try again.', 'NETWORK');
        }
        const asked = res && Number(res.headers && res.headers.get && res.headers.get('Retry-After'));
        if (asked > 10) {
            return res; // "come back in 30 s" (maintenance / read-only): waiting here would only freeze the screen, so show the server's message now
        }
        await wait(asked > 0 ? asked * 1000 : rand() * base * 2 ** i); // "full jitter": a random wait up to base * 2^attempt
        breaker.guard();
    }
}

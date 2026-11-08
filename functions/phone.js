// Server-side phone verification. The browser can no longer say "this is my verified number": it only hands over the phone.email
// token, and THIS code asks phone.email who the token belongs to, then records the number with admin rights.
const err = (status, message, code) => Object.assign(new Error(message), { status, code });

// Asks phone.email who a token belongs to. Returns '+<country><number>' or throws. One retry (their API is sometimes slow).
async function lookupPhone(token, clientId, fetchFn = fetch) {
    if (!clientId) {
        throw err(503, 'Phone verification is not set up yet.', 'NOT_CONFIGURED');
    }
    token = String(token || '').trim();
    if (!token || token.length > 4000) {
        throw err(400, 'Missing verification token', 'PHONE_FAILED');
    }
    const viaUrl = /^https:\/\/[a-z0-9.-]+\.phone\.email\//i.test(token);
    let d;
    for (let i = 0; i < 2 && !d; i++) {
        try {
            let r;
            if (viaUrl) {
                r = await fetchFn(token, { signal: AbortSignal.timeout(12000) });
            } else {
                const fd = new FormData();
                fd.append('access_token', token);
                fd.append('client_id', clientId);
                r = await fetchFn('https://eapi.phone.email/getuser', { method: 'POST', body: fd, signal: AbortSignal.timeout(12000) });
            }
            d = await r.json();
        } catch { /* try once more */ }
    }
    if (!d) {
        throw err(502, 'Could not reach the phone verification service. Please try again.', 'PHONE_UNREACHABLE');
    }
    const cc = String(d.country_code ?? d.user_country_code ?? '').replace(/\D/g, '');
    const no = String(d.phone_no ?? d.user_phone_number ?? d.phone_number ?? '').replace(/\D/g, '');
    const okStatus = d.status === undefined || Number(d.status) === 200;
    const phone = okStatus && no ? '+' + cc + no : '';
    if (!/^\+\d{8,15}$/.test(phone)) {
        throw err(400, 'Phone verification failed or expired. Please try again.', 'PHONE_FAILED');
    }
    return phone;
}

// How many accounts may share one verified number.
const MAX_ACCOUNTS = Math.max(1, parseInt(process.env.PHONE_MAX_ACCOUNTS, 10) || 5);
// A claim is { uids: [...], at }. Older claims were { uid, at }: still understood.
const holdersOf = snap => (!snap || !snap.exists ? [] : Array.isArray(snap.data().uids) ? snap.data().uids : snap.data().uid ? [snap.data().uid] : []);

// Gives the number to this account: up to MAX_ACCOUNTS accounts can share one number. Everything happens in one transaction.
async function claimPhone(db, uid, phone) {
    const digits = phone.replace(/\D/g, '');
    await db.runTransaction(async t => {
        const userRef = db.collection('users').doc(uid);
        const claimRef = db.collection('phones').doc(digits);
        const [u, claim] = await Promise.all([t.get(userRef), t.get(claimRef)]);
        const prev = u.exists ? String(u.data().phone || '').replace(/\D/g, '') : '';
        const oldRef = prev && prev !== digits ? db.collection('phones').doc(prev) : null;
        const oldClaim = oldRef ? await t.get(oldRef) : null; // all reads come before the writes
        if (!u.exists) {
            throw err(404, 'Create your profile first.', 'NO_PROFILE');
        }
        if (!['user', 'org'].includes(u.data().role)) {
            throw err(403, 'Forbidden', 'FORBIDDEN');
        }
        const holders = holdersOf(claim);
        if (!holders.includes(uid) && holders.length >= MAX_ACCOUNTS) {
            throw err(409, 'This phone number is already used by ' + MAX_ACCOUNTS + ' accounts, the maximum. Use a different number.', 'PHONE_LIMIT');
        }
        if (oldRef) { // a changed number frees this account's place on the old one
            const rest = holdersOf(oldClaim).filter(x => x !== uid);
            rest.length ? t.set(oldRef, { uids: rest, at: new Date().toISOString() }) : t.delete(oldRef);
        }
        const at = new Date().toISOString();
        t.set(claimRef, { uids: [...holders.filter(x => x !== uid), uid], at });
        t.update(userRef, { phone, phoneId: digits, phoneAt: at });
    });
    return phone;
}

module.exports = { lookupPhone, claimPhone, err };

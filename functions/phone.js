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

// Gives the number to this account: one number = one account. Everything happens in one transaction.
async function claimPhone(db, uid, phone) {
    const digits = phone.replace(/\D/g, '');
    await db.runTransaction(async t => {
        const userRef = db.collection('users').doc(uid);
        const claimRef = db.collection('phones').doc(digits);
        const [u, claim] = await Promise.all([t.get(userRef), t.get(claimRef)]);
        if (!u.exists) {
            throw err(404, 'Create your profile first.', 'NO_PROFILE');
        }
        if (!['user', 'org'].includes(u.data().role)) {
            throw err(403, 'Forbidden', 'FORBIDDEN');
        }
        if (claim.exists && claim.data().uid !== uid) {
            throw err(409, 'This phone number is already used by another account', 'PHONE_TAKEN');
        }
        const old = String(u.data().phone || '').replace(/\D/g, '');
        if (old && old !== digits) {
            t.delete(db.collection('phones').doc(old)); // a changed number frees the old one
        }
        const at = new Date().toISOString();
        t.set(claimRef, { uid, at });
        t.update(userRef, { phone, phoneId: digits, phoneAt: at });
    });
    return phone;
}

module.exports = { lookupPhone, claimPhone, err };

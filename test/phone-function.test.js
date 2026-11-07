// Checks for the server-side phone verification (functions/phone.js).  Run:  node test/phone-function.test.js
const { lookupPhone, claimPhone } = require('../functions/phone.js');

let pass = 0, fail = 0;
const ok = (c, n) => { c ? pass++ : (fail++, console.log('  FAIL', n)); };
const rejects = async (p, code) => { try { await p; return false; } catch (e) { return e.code === code; } };
const reply = body => async () => ({ json: async () => body });

(async () => {
    // ---- asking phone.email
    ok(await lookupPhone('tok', 'cid', reply({ status: 200, country_code: '+91', phone_no: '98765 43210' })) === '+919876543210', 'a good token gives the number');
    ok(await rejects(lookupPhone('tok', 'cid', reply({ status: 401, message: 'expired' })), 'PHONE_FAILED'), 'a rejected token is refused');
    ok(await rejects(lookupPhone('tok', 'cid', reply({ status: 200, country_code: '91', phone_no: '12' })), 'PHONE_FAILED'), 'a too-short number is refused');
    ok(await rejects(lookupPhone('', 'cid', reply({})), 'PHONE_FAILED'), 'a missing token is refused');
    ok(await rejects(lookupPhone('tok', '', reply({})), 'NOT_CONFIGURED'), 'no Client ID set -> not configured');
    ok(await rejects(lookupPhone('tok', 'cid', async () => { throw new Error('down'); }), 'PHONE_UNREACHABLE'), 'service down -> unreachable');
    let calls = 0;
    ok(await lookupPhone('tok', 'cid', async () => { if (!calls++) throw new Error('slow'); return { json: async () => ({ phone_no: '9876543210', country_code: '91' }) }; }) === '+919876543210' && calls === 2, 'retries once');
    let url;
    await lookupPhone('https://user.phone.email/x.json', 'cid', async u => { url = u; return { json: async () => ({ phone_no: '9876543210', country_code: '91' }) }; });
    ok(url === 'https://user.phone.email/x.json', 'a phone.email result link is followed');
    let evil = null;
    await lookupPhone('https://evil.com/?https://a.phone.email/', 'cid', async u => { evil = u; return { json: async () => ({ phone_no: '9876543210', country_code: '91' }) }; });
    ok(evil === 'https://eapi.phone.email/getuser', 'a link that is not on phone.email is never fetched');

    // ---- claiming the number (tiny in-memory Firestore with transactions)
    const data = { users: { u1: { role: 'user' }, u2: { role: 'org' }, staff1: { role: 'admin' } }, phones: {} };
    const db = {
        collection: c => ({ doc: id => ({ c, id }) }),
        runTransaction: async fn => {
            const writes = [];
            await fn({
                get: async r => ({ exists: r.id in data[r.c], data: () => data[r.c][r.id] }),
                set: (r, v) => writes.push(() => { data[r.c][r.id] = v; }),
                update: (r, v) => writes.push(() => Object.assign(data[r.c][r.id], v)),
                delete: r => writes.push(() => delete data[r.c][r.id])
            });
            writes.forEach(w => w());
        }
    };
    await claimPhone(db, 'u1', '+919876543210');
    ok(data.users.u1.phone === '+919876543210' && data.users.u1.phoneId === '919876543210', 'the number is saved on the account');
    ok(data.phones['919876543210'].uid === 'u1', 'and claimed for it');
    ok(await rejects(claimPhone(db, 'u2', '+919876543210'), 'PHONE_TAKEN'), 'a second account cannot take the same number');
    await claimPhone(db, 'u1', '+919876543210');
    ok(true, 'the same person can verify again');
    await claimPhone(db, 'u1', '+911234567890');
    ok(!data.phones['919876543210'] && data.phones['911234567890'].uid === 'u1', 'changing number frees the old one');
    ok(await rejects(claimPhone(db, 'nobody', '+911111111111'), 'NO_PROFILE'), 'no profile -> refused');
    ok(await rejects(claimPhone(db, 'staff1', '+912222222222'), 'FORBIDDEN'), 'staff accounts are not candidates or organizations');

    console.log('\n' + pass + ' passed, ' + fail + ' failed');
    process.exit(fail ? 1 : 0);
})();

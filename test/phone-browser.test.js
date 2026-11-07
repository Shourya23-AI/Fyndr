// Checks for the browser-side phone lookup (no-server mode).  Run:  node test/phone-browser.test.js
let pass = 0, fail = 0;
const ok = (c, n) => { c ? pass++ : (fail++, console.log('  FAIL', n)); };

(async () => {
    global.location = { href: 'https://fyndr.test/', origin: 'https://fyndr.test', hash: '', search: '', pathname: '/' };
    global.navigator = { userAgent: 'node' };
    global.document = { querySelector: () => null };
    const { parsePhone, lookupPhone } = await import('../public/js/services/phone-email/phone-email.js');

    ok(parsePhone({ status: 200, country_code: '+91', phone_no: '98765 43210' }) === '+919876543210', 'normal answer');
    ok(parsePhone({ country_code: '91', user_phone_number: '9876543210' }) === '+919876543210', 'alternative field names, no status');
    ok(parsePhone({ status: 401, phone_no: '9876543210', country_code: '91' }) === null, 'explicit refusal');
    ok(parsePhone({ status: 200, country_code: '91', phone_no: '12' }) === null, 'too short');
    ok(parsePhone(null) === null, 'nothing');

    const reply = body => async () => ({ json: async () => body });
    global.fetch = reply({ status: 200, country_code: '91', phone_no: '9876543210' });
    ok(await lookupPhone('tok', 'cid') === '+919876543210', 'access token is looked up');
    let url = '';
    global.fetch = async u => { url = u; return { json: async () => ({ phone_no: '9876543210', country_code: '91' }) }; };
    ok(await lookupPhone('https://user.phone.email/x.json', 'cid') === '+919876543210' && url === 'https://user.phone.email/x.json', 'a phone.email result link is followed');
    global.fetch = async u => { url = u; return { json: async () => ({ phone_no: '9876543210', country_code: '91' }) }; };
    await lookupPhone('https://evil.com/?https://a.phone.email/', 'cid');
    ok(url === 'https://eapi.phone.email/getuser', 'a link outside phone.email is never fetched');
    let n = 0;
    global.fetch = async () => { if (!n++) throw new Error('slow'); return { json: async () => ({ phone_no: '9876543210', country_code: '91' }) }; };
    ok(await lookupPhone('tok', 'cid') === '+919876543210', 'one network failure is retried');
    global.fetch = async () => { throw new Error('down'); };
    let threw = false;
    try { await lookupPhone('tok', 'cid'); } catch { threw = true; }
    ok(threw, 'service down throws');
    global.fetch = reply({ status: 401 });
    ok(await lookupPhone('tok', 'cid') === null, 'a refused token gives null');
    console.log(`phone-browser: ${pass} passed, ${fail} failed`);
    process.exit(fail ? 1 : 0);
})();

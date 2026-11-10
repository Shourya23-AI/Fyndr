// Friendly messages for phone.email failures.  Run:  node test/phone-errors.test.js
let pass = 0, fail = 0;
const ok = (c, n) => { c ? pass++ : (fail++, console.log('  FAIL', n)); };
const { phoneMsg } = await import('../public/js/features/phone/phone.errors.js');
ok(/expired/.test(phoneMsg({ code: 'PHONE_FAILED' })) && /Try again/.test(phoneMsg({ code: 'PHONE_FAILED' })), 'a refused token says the code may have expired and what to press');
ok(/internet/.test(phoneMsg({ code: 'PHONE_UNREACHABLE' })), 'unreachable -> check your connection');
ok(/Too many/.test(phoneMsg({ code: 'PHONE_RATE' })), 'rate limit explained');
ok(/not set up/.test(phoneMsg({ code: 'NOT_CONFIGURED' })), 'not configured explained');
ok(phoneMsg({ message: 'This phone number is already used by 5 accounts, the maximum.', code: 'PHONE_LIMIT' }).includes('5 accounts'), 'the 5-account message from the server is kept');
ok(typeof phoneMsg(null) === 'string' && typeof phoneMsg(undefined) === 'string', 'never throws on odd input');
ok(!/PHONE_|Firebase|auth\//.test(['PHONE_FAILED', 'PHONE_UNREACHABLE', 'PHONE_RATE', 'NOT_CONFIGURED'].map(c => phoneMsg({ code: c })).join(' ')), 'no codes or technical words shown to people');
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);

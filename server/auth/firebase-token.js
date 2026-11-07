const crypto = require('crypto');
const { cfg } = require('../config');
// Verify Firebase ID tokens with Google's public certs (no firebase-admin / service account needed)
let certs = {};
let certsExp = 0;
let inflight = null;
async function loadCerts() {
    const r = await fetch('https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com', { signal: AbortSignal.timeout(8000) });
    if (!r.ok) {
        throw new Error('certs http ' + r.status);
    }
    const m = (r.headers.get('cache-control') || '').match(/max-age=(\d+)/);
    certs = await r.json();
    certsExp = Date.now() + (m ? m[1] * 1000 : 36e5);
}
// Everyone waiting shares ONE download. If Google cannot be reached, the certificates we already have keep working
// (they stay valid for hours), so a short outage does not log every user out. Retry again in 30 seconds.
async function getCerts() {
    if (Date.now() < certsExp) {
        return certs;
    }
    inflight = inflight || loadCerts().catch(e => {
        console.warn('Could not refresh Google certificates:', e.message);
        certsExp = Date.now() + 30e3;
    }).finally(() => {
        inflight = null;
    });
    await inflight;
    return certs;
}
async function verifyFb(tok) {
    try {
        const [h, p, s] = tok.split('.');
        if (!s) {
            return null;
        }
        const head = JSON.parse(Buffer.from(h, 'base64url'));
        const pay = JSON.parse(Buffer.from(p, 'base64url'));
        const now = Date.now() / 1000;
        if (head.alg !== 'RS256' || pay.aud !== cfg.projectId || pay.iss !== 'https://securetoken.google.com/' + cfg.projectId || !pay.sub || pay.exp < now || pay.iat > now + 300 || pay.auth_time > now + 300) {
            return null;
        }
        const cert = (await getCerts())[head.kid];
        if (!cert) {
            return null;
        }
        return crypto.createVerify('RSA-SHA256').update(h + '.' + p).verify(cert, Buffer.from(s, 'base64url')) ? pay : null;
    } catch {
        return null;
    }
}
module.exports = { verifyFb };

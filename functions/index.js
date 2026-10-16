// Cloud Function: POST  .../verifyPhone   headers: Authorization: Bearer <Firebase ID token>   body: { access_token }
// Deploy:  firebase deploy --only functions      (needs the Blaze plan; the free allowance is far more than Fyndr uses)
// Set PHONE_EMAIL_CLIENT_ID in functions/.env (same value as config/phone-email.json), and ALLOWED_ORIGINS=https://you.github.io (comma separated).
const { onRequest } = require('firebase-functions/v2/https');
const admin = require('firebase-admin');
const { lookupPhone, claimPhone } = require('./phone');

admin.initializeApp();
const origins = (process.env.ALLOWED_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean);

exports.verifyPhone = onRequest({ region: 'asia-south1', cors: origins.length ? origins : true, maxInstances: 5, timeoutSeconds: 40 }, async (req, res) => {
    try {
        if (req.method !== 'POST') {
            return res.status(405).json({ error: 'POST only' });
        }
        const idToken = (req.headers.authorization || '').slice(7);
        const claims = idToken ? await admin.auth().verifyIdToken(idToken).catch(() => null) : null;
        if (!claims) {
            return res.status(401).json({ error: 'Please log in' });
        }
        if (claims.email_verified !== true) {
            return res.status(403).json({ error: 'Please verify your email' });
        }
        const phone = await lookupPhone(req.body && req.body.access_token, process.env.PHONE_EMAIL_CLIENT_ID);
        await claimPhone(admin.firestore(), claims.uid, phone);
        return res.json({ phone });
    } catch (e) {
        if (!e.status) {
            console.error('verifyPhone failed:', e);
        }
        return res.status(e.status || 500).json({ error: e.status ? e.message : 'Server error', code: e.code });
    }
});

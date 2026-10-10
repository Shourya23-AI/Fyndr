// Paths, port and Firebase web config. Everything environment-specific lives here.
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || '0.0.0.0';
const PUB = path.join(ROOT, 'public');
const PROD = process.env.NODE_ENV === 'production';
// Demo listings are only seeded outside production (or when SEED_DEMO=1), so a live site never shows fake "verified" postings.
const SEED_DEMO = process.env.SEED_DEMO === '1' || (!PROD && process.env.SEED_DEMO !== '0');
// Runtime data (database + uploaded files) lives in data/.
// DATA_DIR can point at a persistent disk/volume (e.g. /data) so the database and uploads survive redeploys.
const DATA_DIR = process.env.DATA_DIR ? path.resolve(process.env.DATA_DIR) : path.join(ROOT, 'data');
const DB_FILE = path.join(DATA_DIR, 'data.json');
const UP_DIR = path.join(DATA_DIR, 'uploads');
fs.mkdirSync(DATA_DIR, { recursive: true });
fs.mkdirSync(UP_DIR, { recursive: true });
// One-time move from the old flat layout (data.json and uploads/ next to server.js) so existing data is kept.
try {
    const oldDb = path.join(ROOT, 'data.json');
    const oldUp = path.join(ROOT, 'uploads');
    if (!fs.existsSync(DB_FILE) && fs.existsSync(oldDb)) {
        fs.renameSync(oldDb, DB_FILE);
    }
    if (!fs.existsSync(UP_DIR) && fs.existsSync(oldUp)) {
        fs.renameSync(oldUp, UP_DIR);
    }
} catch (e) {
    console.warn('Could not migrate old data files:', e.message);
}
// Firebase web config: config/firebase-config.json (falls back to the old root location)
let cfg = {};
for (const f of [path.join(ROOT, 'config', 'firebase-config.json'), path.join(ROOT, 'firebase-config.json')]) {
    try {
        cfg = JSON.parse(fs.readFileSync(f));
        break;
    } catch { }
}
// phone.email Client ID (admin.phone.email > Profile Details). The PHONE_EMAIL_CLIENT_ID env var wins, else config/phone-email.json.
let pe = {};
for (const f of [path.join(ROOT, 'config', 'phone-email.json')]) {
    try {
        pe = JSON.parse(fs.readFileSync(f));
        break;
    } catch { }
}
const PHONE_EMAIL_CLIENT_ID = [process.env.PHONE_EMAIL_CLIENT_ID, pe.clientId].map(x => String(x || '').trim()).find(x => x && !/^YOUR/i.test(x)) || '';
// Built-in admin account (sign up with this email, confirm it, and the account becomes admin). More can be added with ADMIN_EMAILS.
const DEFAULT_ADMINS = 'admin.fyndr@gmail.com';
const MAIN_ADMIN = DEFAULT_ADMINS;
const isAdminEmail = e => (DEFAULT_ADMINS + ',' + (process.env.ADMIN_EMAILS || '')).toLowerCase().split(',').map(x => x.trim()).filter(Boolean).includes((e || '').toLowerCase());
module.exports = {
    ROOT, PORT, HOST, PROD, SEED_DEMO, PUB, DATA_DIR, DB_FILE, UP_DIR, cfg, isAdminEmail, MAIN_ADMIN, PHONE_EMAIL_CLIENT_ID
};

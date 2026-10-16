const { R, bad, need } = require('../lib/router');
const { db, save } = require('../db/store');
const fs = require('fs');
const path = require('path');
const { sniff, meOf } = require('../lib/helpers');
const { UP_DIR: UP } = require('../config');
// Verification proof: organizations (required to post) and candidates (optional).
R('POST', '/api/proof', ['user', 'org'], ({ user, body: b }) => {
    const buf = Buffer.from(String(b.data || ''), 'base64');
    if (!buf.length || buf.length > 2 * 1024 * 1024) {
        bad(413, 'File must be under 2 MB');
    }
    const mime = sniff(buf);
    if (!mime) {
        bad(400, 'Upload a clear photo (JPG, PNG, WebP) or a PDF');
    }
    let portal = '';
    if (user.role === 'org') {
        portal = String(b.portal || '').trim().slice(0, 200);
        if (!/^https:\/\/[^\s]+\.[^\s]+$/i.test(portal)) {
            bad(400, 'Enter your careers page link starting with https://');
        }
    }
    fs.mkdirSync(UP, { recursive: true });
    fs.writeFileSync(path.join(UP, 'proof-' + user.id), buf);
    user.proof = {
        portal, mime, name: String(b.name || 'proof').replace(/[^\w.\- ]/g, '').slice(0, 80), size: buf.length, status: 'pending', at: new Date().toISOString()
    };
    save();
    return meOf(user);
});
R('GET', '/api/proof/file/:id', ['user', 'org', 'moderator', 'admin'], ({ user, p }) => {
    const u = db.users.find(x => x.id === p[0]);
    if (!u?.proof || (u.id !== user.id && (user.role !== 'admin' && user.role !== 'moderator'))) {
        bad(404, 'Not found');
    }
    let data;
    try {
        data = fs.readFileSync(path.join(UP, 'proof-' + u.id)).toString('base64');
    } catch {
        bad(404, 'The file is missing');
    }
    if (u.id !== user.id) {
        // who looked at whose document, newest 2000 entries only (the log must not grow forever)
        db.adminLog = [...(db.adminLog || []), {
            admin: user.id, target: u.id, at: new Date().toISOString()
        }].slice(-2000);
        save();
    }
    return { mime: u.proof.mime, data };
});

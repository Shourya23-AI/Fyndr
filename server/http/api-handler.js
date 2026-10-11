const { routes, bad } = require('../lib/router');
const { verifyFb } = require('../auth/firebase-token');
const { db, save } = require('../db/store');
const { isAdminEmail } = require('../config');
const { applyStaff } = require('../lib/helpers');
// Finds the route, checks the Firebase token + role, parses the JSON body, runs the handler.
module.exports = async function handleApi(req, res, u) {
    const send = (c, d) => {
        // Public config rarely changes: let browsers keep it for an hour. Everything else is per-user, never cached by the browser (the app keeps its own short client cache).
        const cache = c === 200 && req.method === 'GET' && (u.pathname === '/api/firebase-config' || u.pathname === '/api/phone-config') ? 'public, max-age=3600, stale-while-revalidate=86400' : 'no-store';
        res.writeHead(c, { 'Content-Type': 'application/json', 'Cache-Control': cache });
        res.end(JSON.stringify(d));
    };
    try {
        const r = routes.find(x => x.m === req.method && x.re.test(u.pathname));
        if (!r) {
            return send(404, { error: 'Not found' });
        }
        const tok = (req.headers.authorization || '').slice(7);
        const fb = tok ? await verifyFb(tok) : null;
        const user = fb && db.users.find(x => x.id === fb.sub);
        if (r.roles === 'fb') {
            if (!fb) {
                return send(401, { error: 'Please log in' });
            }
        } else if (r.roles) {
            if (!fb) {
                return send(401, { error: 'Please log in' });
            }
            if (!user) {
                return send(404, { error: 'no profile' });
            }
            if (!fb.email_verified) {
                return send(403, { error: 'Please verify your email' });
            }
            // A role granted by email before sign-up is applied now (the email is confirmed at this point).
            const inv = (db.staffInvites || []).find(i => i.email === (fb.email || '').toLowerCase());
            if (inv && !isAdminEmail(fb.email)) {
                user.staff = inv.role;
                db.staffInvites = db.staffInvites.filter(i => i !== inv);
                save();
            }
            // Staff roles: the main admin is always admin; others get what an admin granted them (or lose it when demoted).
            if (applyStaff(user) || (isAdminEmail(fb.email) && !user.verified)) {
                if (isAdminEmail(fb.email)) {
                    user.verified = true;
                }
                save();
            }
            if (!r.roles.includes(user.role)) {
                return send(403, { error: 'Forbidden' });
            }
        }
        let raw = '';
        for await (const c of req) {
            raw += c;
            if (raw.length > 3.2e6) {
                bad(413, 'Upload too large');
            }
        }
        let body = {};
        try {
            body = raw ? JSON.parse(raw) : {};
        } catch {
            bad(400, 'Invalid JSON');
        }
        send(200, await r.fn({
            user, fb, body, p: u.pathname.match(r.re).slice(1), q: u.searchParams
        }));
    } catch (e) {
        if (!e.c) {
            console.error('API error:', req.method, u.pathname, e);
        }
        send(e.c || 500, { error: e.m || 'Server error', code: e.k });
    }
};

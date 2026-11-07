const { R, bad, need } = require('../lib/router');
const { ask } = require('../lib/assistant');
const { log } = require('../lib/observe');
// Fyndr Assistant: any signed-in person may ask. A small per-person limit keeps one user from tying up your Llama.
const hits = new Map(); // uid -> [timestamps]
const LIMIT = Number(process.env.ASSISTANT_LIMIT) || 10; // messages ...
const WINDOW = 10 * 60e3; // ... per 10 minutes
R('POST', '/api/assistant', 'fb', async ({ fb, user, body }) => {
    if (process.env.ASSISTANT === 'off') {
        bad(503, 'The assistant is turned off.');
    }
    need(body, 'message');
    const now = Date.now();
    const mine = (hits.get(fb.sub) || []).filter(t => now - t < WINDOW);
    if (mine.length >= LIMIT) {
        bad(429, 'You are asking very fast. Please wait a few minutes.');
    }
    hits.set(fb.sub, [...mine, now]);
    const message = String(body.message).trim().slice(0, 600);
    // Only the last few turns, only user/assistant roles, each cut short: the browser cannot smuggle in a system message.
    const history = (Array.isArray(body.history) ? body.history : []).slice(-6)
        .filter(m => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string')
        .map(m => ({ role: m.role, content: m.content.slice(0, 800) }));
    try {
        return await ask(message, history, user && { name: user.name, skills: user.skills, location: user.location }, body.guide);
    } catch (e) {
        if (e && e.busy) {
            bad(503, 'The guide is busy right now. Please try again in a little while.');
        }
        log('warn', { msg: 'assistant unavailable', err: String(e && e.message || e) });
        bad(503, 'The guide is offline right now. Please try again later.');
    }
});

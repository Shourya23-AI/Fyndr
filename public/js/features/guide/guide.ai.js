// "Ask the guide": sends one typed question, plus the job being checked and the skill gaps, to the Fyndr server, which asks the AI.
// No name, email or contact details are sent.
import { fb } from '../../services/firebase/firebase-init.js';
import { API_BASE } from '../../core/api-base.js';

const labels = (g, have) => ((g.a && g.a.items) || []).filter(i => (i.status === 'have') === have).map(i => i.label).slice(0, 15);
const history = [];
export async function askGuide(question, g) {
    const guide = g.role ? {
        role: g.role.title, level: g.a && g.a.level, qualification: g.p && g.p.qualification, experience: g.p && g.p.experience,
        have: labels(g, true), missing: labels(g, false)
    } : undefined;
    const r = await fetch(API_BASE + '/api/assistant', {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + await fb.token() },
        body: JSON.stringify({ message: question, history: history.slice(-6), guide })
    });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) {
        throw new Error(d.error || 'The guide could not answer right now.');
    }
    d.blocked || history.push({ role: 'user', content: question }, { role: 'assistant', content: d.reply }); // a refused question is not part of the conversation
    return d.reply;
}
export const resetAsk = () => { history.length = 0; };

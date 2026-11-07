import { pick, send, restart, jump, startWith } from './guide.view.js';
import { S } from '../../core/state.js';
// Click and submit handlers for the career guide (wired in core/events.js).
export const actions = {
    'guide-pick': (b, id, s) => (s === 'reset' ? restart() : pick(b.textContent.trim(), id, s)),
    'guide-reset': () => restart(),
    'guide-jump': () => jump(),
    'guide-start': (b, id) => startWith(id),
    // opens the jobs page already searching for the dream job
    'guide-openings': (b, id) => {
        S.f.q = String(id || '').slice(0, 80);
        location.hash = '#/jobs';
    }
};
export const forms = {
    dream: d => startWith(d.job),
    guide: async d => {
        await send(d.msg);
        const i = document.getElementById('gd-in');
        i && (i.value = '');
    }
};

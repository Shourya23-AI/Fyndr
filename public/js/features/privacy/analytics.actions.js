import { $ } from '../../core/dom.js';
import { setChoice, choice } from '../../services/analytics/analytics.js';
import { S } from '../../core/state.js';
// The one-time question and the on/off switch in Privacy & data.
export const actions = {
    anyes() {
        setChoice(true);
        $('.an-bar')?.remove();
    },
    anno() {
        setChoice(false);
        $('.an-bar')?.remove();
    },
    antoggle(b) {
        setChoice(choice() !== 'yes');
        b.textContent = choice() === 'yes' ? 'Turn off' : 'Turn on';
    }
};
export function askAnalytics() {
    if (!S.me || choice() !== null || $('.an-bar') || !S.me.role || S.me.needsConsent) {
        return;
    }
    const el = document.createElement('div');
    el.className = 'an-bar';
    el.setAttribute('role', 'region');
    el.setAttribute('aria-label', 'Usage counts');
    el.innerHTML = '<p>Help us improve Fyndr? We count what people view and search for (daily totals, never who). <a href="#/privacy">Details</a></p><div><button class="button button-small" data-act="anno">No thanks</button> <button class="button button-dark button-small" data-act="anyes">Yes, count it</button></div>';
    document.body.append(el);
}

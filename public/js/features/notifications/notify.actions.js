import { S } from '../../core/state.js';
import { toast } from '../../core/dom.js';
import { loadBox, saveBox } from './notify.rules.js';
import { checkNow } from './notify.service.js';
import { draw } from './notify.view.js';
import { refreshBell } from './notify.bell.js';
const uid = () => (S.me && (S.me.id || S.me.email)) || 'me';
const edit = fn => {
    const box = loadBox(localStorage, uid());
    if (box) {
        saveBox(localStorage, uid(), fn(box));
    }
    draw();
    refreshBell();
};
export const actions = {
    'nt-open'(b, id) {
        const x = (loadBox(localStorage, uid())?.items || []).find(i => i.id === id);
        S.dtab = x && x.go === 'foryou' ? 'foryou' : 'apps';
        location.hash = '#/dashboard';
    },
    'nt-clear'() {
        edit(box => ({ ...box, items: [] }));
    },
    'nt-match'() {
        edit(box => ({ ...box, prefs: { ...box.prefs, match: !box.prefs.match } }));
    },
    async 'nt-check'(b) {
        b.disabled = true;
        const ok = await checkNow({ force: true });
        draw(true);
        toast(ok ? 'Checked just now.' : 'Could not check right now. Try again in a moment.');
    }
};

import { S } from '../../core/state.js';
import { toast } from '../../core/dom.js';
import { load, save, add, setStage, setNote, setRemind, remove } from './tracker.js';
import { uidOf } from './tracker.view.js';
import { dashboard } from '../dashboard/dashboard.js';
const mutate = fn => {
    const next = fn(load(uidOf()));
    if (!save(uidOf(), next)) {
        toast('Could not save here (browser storage is blocked).');
        return false;
    }
    return true;
};
// Called from the details popup: puts the opened listing on the board.
export function trackListing(id, stage = 'saved') {
    const l = S.lmap[id];
    if (!l) {
        return false;
    }
    const url = l.search ? '' : l.applyUrl;
    return mutate(list => add(list, { id: l.id, title: l.title, org: l.search ? '' : l.orgName, type: l.type, url }, stage));
}
export const actions = {
    trkadd(b, id, s) {
        if (!S.me || S.me.role !== 'user') {
            return toast('Sign in as a candidate to use the tracker');
        }
        trackListing(id, s || 'saved') && toast('Added to your tracker');
    },
    trkdel(b, id) {
        mutate(l => remove(l, id)) && dashboard();
    },
    trkadopt(b, id) {
        const l = S.lmap[id];
        mutate(list => add(list, { id, title: (l && l.title) || b.closest('.tk-card').querySelector('h4').textContent, org: (l && l.orgName) || '', type: l && l.type, url: l && !l.search ? l.applyUrl : '' }, 'saved')) && dashboard();
    }
};
export const forms = {
    trkadd(d) {
        const ok = mutate(list => add(list, { title: d.title, org: d.org, url: d.url }, d.stage || 'applied'));
        if (ok) {
            toast('Added');
            dashboard();
        }
    }
};
export const bind = () => {
    document.addEventListener('change', e => {
        const el = e.target.closest && e.target.closest('[data-trk]');
        if (!el) {
            return;
        }
        const k = el.dataset.trk, id = el.dataset.id;
        if (mutate(l => (k === 'stage' ? setStage(l, id, el.value) : k === 'remind' ? setRemind(l, id, el.value) : setNote(l, id, el.value)))) {
            if (k !== 'note') {
                dashboard();
            }
        }
    });
};

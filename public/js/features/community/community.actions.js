import { $, toast } from '../../core/dom.js';
import { S } from '../../core/state.js';
import { createCommunity, joinCommunity, leaveCommunity, removeMember, deleteCommunity } from './community.data.js';
import { communityView, drawList, redrawPeople } from './community.view.js';
// data-act / data-form handlers for the Community pages (names start with "cm").
// The chat inside a community (messages, photos, polls, reactions, replies) uses the same "gp..." handlers as a group: see features/groups/groups.actions.js.
const link = id => (typeof location.origin === 'string' ? location.origin + (location.pathname || '/') : '') + '#/community/' + id;
export const actions = {
    cmnew() {
        const f = $('#cm-new');
        if (f) {
            f.hidden = !f.hidden;
            if (!f.hidden) {
                const i = f.querySelector('input');
                i && i.focus();
            }
        }
    },
    async cmjoin(b, id) {
        b.disabled = true;
        try {
            await joinCommunity(id);
        } catch (e) {
            b.disabled = false;
            throw e;
        }
        toast('You joined the community');
        await communityView();
    },
    async cmleave(b, id) {
        if (!confirm('Leave this community? You can join again any time.')) {
            return;
        }
        await leaveCommunity(id);
        toast('You left the community');
        location.hash = '#/community';
    },
    async cmdelete(b, id) {
        if (!confirm('Delete this community for everyone? All its messages are removed. This cannot be undone.')) {
            return;
        }
        await deleteCommunity(id);
        toast('Community deleted');
        location.hash = '#/community';
    },
    async cmrm(b, uid) {
        if (!confirm('Remove this person from the community? They can join again.')) {
            return;
        }
        await removeMember(S.gp.cur.id, uid);
        await redrawPeople();
    },
    async cminvite(b, id) {
        const url = link(id);
        try {
            await navigator.clipboard.writeText(url);
            toast('Invite link copied');
        } catch {
            prompt('Copy this link and send it to people:', url);
        }
    },
    cmretry() {
        return communityView();
    }
};
export const forms = {
    cmsearch(d) {
        S.cm = { ...(S.cm || {}), q: String(d.q || '').trim().slice(0, 80) };
        drawList();
    },
    async cmcreate(d) {
        const id = await createCommunity(d);
        toast('Community created');
        location.hash = '#/community/' + id;
    }
};

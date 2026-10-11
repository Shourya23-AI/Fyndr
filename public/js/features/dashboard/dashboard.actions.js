import { api } from '../../core/api.js';
import { toast } from '../../core/dom.js';
import { ferr } from '../../core/errors.js';
import { dashboard } from './dashboard.js';
export const actions = {
    async dellist(b, id) {
        if (confirm('Delete this listing?')) {
            await api('/listings/' + id, 'DELETE');
            dashboard();
        }
    },
    async lstat(b, id, s) {
        await api('/admin/listings/' + id, 'PATCH', { status: s });
        dashboard();
    },
    async verify(b, id, s) {
        await api('/admin/users/' + id, 'PATCH', { verified: !!s });
        dashboard();
    },
    async deluser(b, id) {
        if (confirm('Delete this account?')) {
            await api('/admin/users/' + id, 'DELETE');
            dashboard();
        }
    },
    async revokeinvite(b, id) {
        await api('/admin/staff-invite/revoke', 'POST', { email: id });
        toast('Invite cancelled');
        dashboard();
    },
    async pstat(b, id, s) {
        await api('/admin/proof/' + id, 'PATCH', { status: s });
        toast('Updated');
        dashboard();
    }
};
export const forms = {
    async invite(d) {
        const r = await api('/admin/staff-invite', 'POST', d);
        toast(r.applied ? 'Role updated' : 'Saved. It applies when they sign up.');
        dashboard();
    },
    async post(d) {
        await api('/listings', 'POST', d);
        toast('Submitted for review');
        dashboard();
    }
};
// Selects in tables: organization changes an applicant's status; admin changes an organization's size or Gmail-posting rule.
export const onChange = async (e) => {
    const t = e.target.dataset;
    const v = e.target.value;
    try {
        if (t.appid) {
            await api('/applications/' + t.appid, 'PATCH', { status: v });
            toast('Updated');
        } else if (t.staff) {
            const name = e.target.options[e.target.selectedIndex].text;
            if (!confirm('Change this account to: ' + name + '?')) {
                return dashboard();
            }
            await api('/admin/staff/' + t.staff, 'PATCH', { role: v });
            toast('Role updated');
            dashboard();
        } else if (t.orgtype) {
            await api('/admin/orgs/' + t.orgtype, 'PATCH', { orgType: v });
            toast('Organization size updated');
            dashboard();
        } else if (t.orggm) {
            await api('/admin/orgs/' + t.orggm, 'PATCH', { gmailOk: {
                    allow: true, block: false, default: null
                }[v] });
            toast('Gmail posting updated');
            dashboard();
        }
    } catch (x) {
        toast(ferr(x));
    }
};
import { S as ST } from '../../core/state.js';
import { printResume, resumeDoc, pdfUrl } from './resume.js';
Object.assign(actions, {
    dtab(b, id) {
        ST.dtab = id;
        dashboard();
    },
    atab(b, id) {
        ST.atab = id;
        dashboard();
    },
    afilt(b, id) {
        ST.afilt = id;
        dashboard();
    },
    rsel(b, id) {
        ST.rsel = id;
        dashboard();
    },
    async oresume(b, id) {
        const w = window.open('', '_blank');
        if (!w) {
            return toast('Allow popups to view the resume');
        }
        try {
            const r = await api('/org/applications/' + id + '/resume');
            if (r.type === 'own') {
                w.location = await pdfUrl(r.data);
            } else {
                w.document.write(resumeDoc(r));
                w.document.close();
            }
        } catch (x) {
            w.close();
            throw x;
        }
    },
    printresume() {
        const { d, me } = ST.dd;
        printResume({
            ...d, ...me, profile: d.profile
        });
    }
});
// Live search in the Team tab.
document.addEventListener('input', e => {
    if (e.target.id === 'tq') {
        ST.tq = e.target.value;
        clearTimeout(onChange.t);
        onChange.t = setTimeout(dashboard, 200);
    }
});

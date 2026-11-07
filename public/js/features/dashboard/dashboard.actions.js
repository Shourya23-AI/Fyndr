import { api } from '../../core/api.js';
import { $, toast, esc } from '../../core/dom.js';
import { shrinkImage } from '../../core/image.js';
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
    async rpclose(b, id, s) { // close every open report about a listing
        await api('/admin/reports/' + encodeURIComponent(id), 'PATCH', { status: s });
        toast('Done');
        dashboard();
    },
    async rphide(b, id) { // reject the listing (it leaves the public list), then close its reports
        await api('/admin/listings/' + encodeURIComponent(id), 'PATCH', { status: 'rejected' });
        await api('/admin/reports/' + encodeURIComponent(id), 'PATCH', { status: 'actioned' });
        toast('Listing hidden');
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
        if (!d.image) {
            throw new Error('Add a cover image for your listing');
        }
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
            await api('/admin/staff/' + t.staff, 'PATCH', { role: v, email: t.email });
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
    fymore() {
        ST.fyn = (ST.fyn || 6) + 6;
        dashboard();
    },
    async atab(b, id) {
        ST.atab = id;
        await dashboard();
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
    async oform(b, id) {
        const list = await api('/org/applications');
        const a = list.find(x => x.id === id);
        if (!a?.form) {
            return toast('No form details for this application');
        }
        const f = a.form;
        const row = (k, v) => v ? `<div class="info-row"><span>${k}</span><b style="white-space:pre-wrap">${esc(Array.isArray(v) ? v.join(', ') : v)}</b></div>` : '';
        const el = document.createElement('div');
        el.className = 'ap-back';
        el.innerHTML = `<div class="ap-box" role="dialog" aria-label="Application details"><h3>${esc(f.fullName)}</h3><p class="desc">Applied for ${esc(a.title)}</p>${row('Email', f.email)}${row('Phone', f.phone)}${row('City', f.city)}${row('Education', f.education)}${row('Skills', f.skills)}${row('Experience', f.experience)}${row('LinkedIn', f.linkedin)}${row('Portfolio', f.portfolio)}${row('Cover note', f.note)}<div class="ap-acts"><button class="button button-small" data-x>Close</button></div></div>`;
        el.addEventListener('click', e => (e.target === el || e.target.closest('[data-x]')) && el.remove());
        document.body.append(el);
    },
    async copyrep() {
        try {
            await navigator.clipboard.writeText(document.getElementById('weekrep').textContent);
            toast('Copied');
        } catch {
            toast('Select the text and copy it');
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
// Cover image / logo pickers in the post form: shrink in the browser, show a preview, keep the result in a hidden field.
export const bind = () => {
    document.addEventListener('change', async (e) => {
        if (e.target.id !== 'impfile' || !e.target.files[0]) {
            return;
        }
        const out = document.getElementById('impout');
        try {
            const items = JSON.parse(await e.target.files[0].text());
            if (!Array.isArray(items)) {
                throw new Error('That file is not a list of jobs');
            }
            const t = { published: 0, review: 0, skipped: 0, duplicates: 0, invalid: 0 };
            for (let i = 0; i < items.length; i += 100) {
                out.textContent = `Importing ${Math.min(i + 100, items.length)} of ${items.length}...`;
                const r = await api('/admin/import', 'POST', { items: items.slice(i, i + 100) });
                Object.keys(t).forEach(k => t[k] += r[k] || 0);
            }
            toast(`Imported: ${t.published} published, ${t.review} to review`);
            ST.impResult = `Last import: ${t.published} published, ${t.review} sent to review, ${t.skipped} skipped as unsafe, ${t.duplicates} already there, ${t.invalid} invalid.`;
            dashboard();
        } catch (x) {
            e.target.value = '';
            out.textContent = ferr(x);
        }
    });
    document.addEventListener('change', async (e) => {
        const kind = { 'cover-in': 'cover', 'logo-in': 'logo' }[e.target.id];
        const f = kind && e.target.files[0];
        if (!f) {
            return;
        }
        try {
            const data = await shrinkImage(f, kind);
            const drop = $('#' + kind + '-drop');
            $('#' + kind + '-val').value = data;
            drop.querySelector('img')?.remove();
            drop.classList.add('has');
            drop.insertAdjacentHTML('afterbegin', `<img src="${data}" alt="">`);
            drop.querySelector('span').textContent = 'Change';
        } catch (x) {
            e.target.value = '';
            toast(x.message);
        }
    });
};

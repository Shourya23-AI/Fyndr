import { S } from '../../core/state.js';
import { esc, toast } from '../../core/dom.js';
import { api, forgetDeviceCache } from '../../core/api.js';
import { ferr } from '../../core/errors.js';
import { fb } from '../../services/firebase/firebase-init.js';
import { route } from '../../core/router.js';
import { dashboard } from '../dashboard/dashboard.js';
// Privacy controls: download my data, withdraw an application, delete my account (+ the Terms/Privacy consent form and the admin cleanup button).
const save = (name, blob) => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
};
const today = () => new Date().toISOString().slice(0, 10);

function confirmDelete() {
    const org = S.me.role === 'org';
    const el = document.createElement('div');
    el.className = 'ap-back';
    el.innerHTML = `<div class="ap-box" role="dialog" aria-label="Delete account"><h3>Delete your account?</h3>
<p class="desc">${org ? 'Your organization account, all of your listings and every application you received will be deleted.' : 'Your account, profile, resume and applications will be deleted, and organizations lose access to anything you shared.'} This cannot be undone. Download your data first if you want a copy.</p>
${fb.hasPassword() ? '<label class="fld" style="margin-top:12px"><span class="desc">Enter your password to confirm</span><input type="password" id="delpw" autocomplete="current-password"></label>' : '<p class="desc">You will be asked to confirm with Google once more.</p>'}
<label class="agree" style="margin-top:12px"><input type="checkbox" id="delok"> <span>I understand this cannot be undone.</span></label><p class="err" id="delerr" role="alert"></p>
<div class="ap-acts"><button class="button button-small" data-c>Cancel</button><button class="button button-small btn-danger" data-go>Delete everything</button></div></div>`;
    const close = () => {
        removeEventListener('keydown', onKey);
        el.remove();
    };
    const onKey = e => {
        if (e.key === 'Escape') {
            close();
        }
    };
    el.addEventListener('click', async (e) => {
        if (e.target === el || e.target.closest('[data-c]')) {
            return close();
        }
        const go = e.target.closest('[data-go]');
        if (!go) {
            return;
        }
        const err = el.querySelector('#delerr');
        err.textContent = '';
        if (!el.querySelector('#delok').checked) {
            err.textContent = 'Tick the box to confirm';
            return;
        }
        go.disabled = true;
        try {
            await fb.reauth(el.querySelector('#delpw')?.value);
            await api('/account', 'DELETE'); // data first, while the person is still signed in
            let note = 'Your account and data were deleted';
            try {
                await fb.removeUser();
            } catch {
                await fb.out();
                note = 'Your data was deleted, but the sign-in could not be removed. Contact us and we will finish it.';
            }
            forgetDeviceCache();
            S.me = null;
            close();
            location.hash = '#/';
            route();
            toast(note);
        } catch (x) {
            err.textContent = ferr(x);
            go.disabled = false;
        }
    });
    addEventListener('keydown', onKey);
    document.body.append(el);
}

export const actions = {
    async exportdata() {
        const d = await api('/account/export');
        save(`fyndr-my-data-${today()}.json`, new Blob([JSON.stringify(d, null, 2)], { type: 'application/json' }));
        toast('Your data was downloaded');
    },
    async dlresume() {
        const r = await api('/resume/file');
        save(`fyndr-resume-${today()}.pdf`, new Blob([Uint8Array.from(atob(r.data), c => c.charCodeAt(0))], { type: 'application/pdf' }));
    },
    async withdraw(b, id) {
        if (!confirm('Withdraw this application? The organization will no longer be able to see your resume.')) {
            return;
        }
        await api('/applications/' + id, 'DELETE');
        toast('Application withdrawn');
        dashboard();
    },
    deleteacct: confirmDelete,
    async cleanup() {
        const r = await api('/admin/cleanup', 'POST');
        toast(r.removed ? `${r.removed} expired application(s) removed` : 'Nothing to clean up');
        dashboard();
    }
};
export const forms = {
    async consent(d) {
        await api('/consent', 'POST', d);
        route();
    }
};

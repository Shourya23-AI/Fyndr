import { S } from '../../core/state.js';
import { esc, toast } from '../../core/dom.js';
import { api } from '../../core/api.js';
import { buildResume } from '../dashboard/resume.js';
// Popup shown when you press Apply: send the website-built resume or your own PDF. Resolves {resume:'site'|'own', consent:true} or null (cancelled).
// Pressing Apply is the person's consent to share, so the line above the button names who will see the resume.
export function applyPopup(orgName) {
    return new Promise(async (res) => {
        let d;
        try {
            d = await api('/profile');
        } catch (x) {
            toast(x.message);
            return res(null);
        }
        let pick = 'site';
        let pending = null;
        const el = document.createElement('div');
        el.className = 'ap-back';
        const done = v => {
            removeEventListener('keydown', esc_);
            el.remove();
            res(v);
        };
        const esc_ = e => {
            if (e.key === 'Escape') {
                done(null);
            }
        };
        const draw = () => {
            el.innerHTML = `<div class="ap-box" role="dialog" aria-label="Choose resume"><h3>Choose a resume to apply with</h3><p class="desc">Pick one. The employer sees only this.</p>
<button class="rs-opt ${pick === 'site' ? 'on' : ''}" data-p="site"><b>Fyndr website resume</b><span>Built from your profile details</span></button>
<button class="rs-opt ${pick === 'own' ? 'on' : ''}" data-p="own"><b>My own resume</b><span>${pending ? esc(pending.name) : d.resume ? esc(d.resume.name) : 'Upload a PDF (max 2 MB)'}</span></button>
${pick === 'site' ? `<div class="ap-prev">${buildResume({ ...d, profile: d.profile })}</div>` : `<label class="fld" style="margin-top:12px"><span class="desc">${d.resume || pending ? 'Replace with another PDF' : 'Choose your PDF'}</span><input type="file" id="apfile" accept="application/pdf"></label>`}
<p class="ap-consent">Your resume will be shared with <b>${esc(orgName || 'this organization')}</b> and Fyndr admins. <a href="#/privacy" target="_blank" rel="noopener">Privacy Policy</a></p>
<div class="ap-acts"><button class="button button-small" data-c>Cancel</button><button class="button button-dark button-small" data-go>Apply</button></div></div>`;
        };
        el.addEventListener('click', async (e) => {
            if (e.target === el || e.target.closest('[data-c]')) {
                return done(null);
            }
            const p = e.target.closest('[data-p]');
            if (p) {
                pick = p.dataset.p;
                return draw();
            }
            if (e.target.closest('[data-go]')) {
                if (pick === 'own' && !d.resume && !pending) {
                    return toast('Choose a PDF first');
                }
                if (pick === 'own' && pending) {
                    try {
                        await api('/resume', 'POST', pending);
                    } catch (x) {
                        return toast(x.message);
                    }
                }
                done({ resume: pick, consent: true });
            }
        });
        el.addEventListener('change', e => {
            if (e.target.id !== 'apfile') {
                return;
            }
            const f = e.target.files[0];
            if (!f) {
                return;
            }
            if (f.type !== 'application/pdf' || f.size > 2 * 1024 * 1024) {
                e.target.value = '';
                return toast('Resume must be a PDF under 2 MB');
            }
            const rd = new FileReader();
            rd.onload = () => {
                pending = { name: f.name, data: rd.result.split(',')[1] };
                draw();
            };
            rd.readAsDataURL(f);
        });
        addEventListener('keydown', esc_);
        draw();
        document.body.append(el);
    });
}

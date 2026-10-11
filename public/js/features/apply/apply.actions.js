import { S } from '../../core/state.js';
import { toast } from '../../core/dom.js';
import { api } from '../../core/api.js';
import { drawRes } from './apply.view.js';
export const actions = {
    aprs(b, id) {
        S.apply.resume = id;
        drawRes();
    }
};
export const forms = {
    async applyfull(d) {
        const a = S.apply;
        if (a.resume === 'own' && !a.has && !a.pending) {
            throw new Error('Choose a PDF, or pick the Fyndr website resume');
        }
        if (a.pending) {
            await api('/resume', 'POST', a.pending);
            a.has = true;
        }
        const form = { ...d, skills: String(d.skills || '').split(',').map(x => x.trim()).filter(Boolean) };
        await api('/apply/' + a.id, 'POST', { resume: a.resume, consent: true, form });
        toast('Application sent!');
        location.hash = '#/dashboard';
    }
};
export const bind = () => {
    document.addEventListener('change', e => {
        if (e.target.id !== 'apfile2') {
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
            S.apply.pending = { name: f.name, data: rd.result.split(',')[1] };
            drawRes();
        };
        rd.readAsDataURL(f);
    });
};

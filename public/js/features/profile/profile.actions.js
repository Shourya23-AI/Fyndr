import { S } from '../../core/state.js';
import { $, toast } from '../../core/dom.js';
import { api } from '../../core/api.js';
import { route } from '../../core/router.js';
import { chips, addSkill, resumeUI, photoUI, REP } from './profile.view.js';
import { nav } from '../layout/nav.js';
const shrinkPhoto = f => new Promise((ok, no) => {
    const im = new Image();
    const u = URL.createObjectURL(f);
    im.onload = () => {
        const s = 256;
        const m = Math.min(im.width, im.height);
        const c = document.createElement('canvas');
        c.width = c.height = s;
        c.getContext('2d').drawImage(im, (im.width - m) / 2, (im.height - m) / 2, m, m, 0, 0, s, s);
        URL.revokeObjectURL(u);
        ok(c.toDataURL('image/jpeg', .82));
    };
    im.onerror = () => no(new Error('Could not read that image'));
    im.src = u;
});
// Skills input (Enter or comma adds a chip) and resume file picker.
export const bind = () => {
    document.addEventListener('keydown', e => {
        if (e.target.id === 'skillin' && (e.key === 'Enter' || e.key === ',')) {
            e.preventDefault();
            addSkill(e.target.value.replace(',', ''));
            e.target.value = '';
        }
    });
    document.addEventListener('change', e => {
        const i = e.target.dataset?.skl;
        if (i !== undefined) {
            S.skillLv[S.skills[+i]] = +e.target.value;
        }
    });
    document.addEventListener('change', async (e) => {
        if (e.target.id !== 'photoin') {
            return;
        }
        const f = e.target.files[0];
        if (!f) {
            return;
        }
        if (!/^image\//.test(f.type)) {
            e.target.value = '';
            return toast('Choose an image file');
        }
        try {
            const r = await api('/photo', 'POST', { data: await shrinkPhoto(f) });
            S.me.photo = r.photo;
            photoUI(r.photo);
            nav();
            toast('Photo updated');
        } catch (x) {
            toast(x.message);
        }
    });
    document.addEventListener('change', e => {
        if (e.target.id !== 'resumein') {
            return;
        }
        const file = e.target.files[0];
        if (!file) {
            return;
        }
        if (file.type !== 'application/pdf' || file.size > 2 * 1024 * 1024) {
            e.target.value = '';
            return toast('Resume must be a PDF under 2 MB');
        }
        const rd = new FileReader();
        rd.onload = async () => {
            try {
                resumeUI(await api('/resume', 'POST', { name: file.name, data: rd.result.split(',')[1] }));
                toast('Resume uploaded');
            } catch (x) {
                toast(x.message);
            }
        };
        rd.readAsDataURL(file);
    });
};
export const actions = {
    rmskill(b, id) {
        S.skillLv && delete S.skillLv[S.skills[+id]];
        S.skills.splice(+id, 1);
        chips();
    },
    addrep(b, id) {
        const box = {
            job: '#jobs', edu: '#edus', lang: '#langs'
        }[id];
        $(box).insertAdjacentHTML('beforeend', REP[id]({ level: 3 }));
        $(box).lastElementChild.querySelector('input').focus();
    },
    rmrep(b) {
        b.closest('.rep').remove();
    },
    async rmphoto() {
        await api('/photo', 'DELETE');
        delete S.me.photo;
        photoUI(null);
        nav();
    },
    async rmresume() {
        await api('/resume', 'DELETE');
        resumeUI(null);
    }
};
// Reads one repeating group: every block has the same inputs, so the Nth value of each name belongs to the Nth block.
const group = (fd, map) => {
    const ks = Object.keys(map);
    const n = (fd.getAll(ks[0]).length);
    return Array.from({ length: n }, (_, i) => Object.fromEntries(ks.map(k => [map[k], fd.getAll(k)[i]])));
};
export const forms = {
    async profile(d, e) {
        const fd = new FormData(e.target);
        const pend = $('#skillin').value.trim();
        if (pend) {
            addSkill(pend);
        }
        const body = {
            ...d, jobTypes: fd.getAll('jobTypes'), skills: S.skills, skillLevels: S.skillLv,
            hobbies: String(d.hobbies || '').split(','),
            reference: {
                name: d.ref_name, role: d.ref_role, phone: d.ref_phone, email: d.ref_email
            },
            jobs: group(fd, {
                job_role: 'role', job_org: 'org', job_place: 'place', job_from: 'from', job_to: 'to', job_points: 'points'
            }),
            education: group(fd, {
                edu_degree: 'degree', edu_inst: 'institution', edu_place: 'place', edu_year: 'year', edu_points: 'points'
            }),
            languages: group(fd, { lang_name: 'name', lang_level: 'level' })
        };
        await api('/profile', 'PUT', body);
        toast('Profile saved');
        location.hash = '#/dashboard';
        route();
    }
};

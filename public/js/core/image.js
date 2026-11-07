import { API_BASE } from './api-base.js';
// Shrinks a picture the organization chose, in the browser, so it can be stored inside the listing (no paid file storage needed).
//   cover: 480x270 (16:9), cropped to fill   -> WebP (JPEG if the browser cannot write WebP), kept under ~30 KB
//   logo : 96x96 square, whole logo shown on white -> WebP (JPEG fallback), kept under ~8 KB
// (The limits in firestore.rules / the server are higher on purpose: they are only the ceiling.)
const SPEC = {
    cover: { w: 480, h: 270, fit: 'cover', max: 30000 },
    logo: { w: 96, h: 96, fit: 'contain', max: 8000 }
};
const load = file => new Promise((ok, no) => {
    const url = URL.createObjectURL(file);
    const im = new Image();
    im.onload = () => {
        URL.revokeObjectURL(url);
        ok(im);
    };
    im.onerror = () => {
        URL.revokeObjectURL(url);
        no(new Error('Could not read that image. Try a JPG, PNG or WebP.'));
    };
    im.src = url;
});
export async function shrinkImage(file, kind) {
    if (!file || !/^image\/(jpeg|png|webp|gif)$/.test(file.type)) {
        throw new Error('Choose a JPG, PNG or WebP picture');
    }
    if (file.size > 12 * 1024 * 1024) {
        throw new Error('That picture is too large (max 12 MB)');
    }
    const { w, h, fit, max } = SPEC[kind];
    const im = await load(file);
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    const g = c.getContext('2d');
    g.fillStyle = '#fff';
    g.fillRect(0, 0, w, h);
    g.imageSmoothingQuality = 'high';
    const k = (fit === 'cover' ? Math.max : Math.min)(w / im.width, h / im.height);
    const dw = im.width * k;
    const dh = im.height * k;
    g.drawImage(im, (w - dw) / 2, (h - dh) / 2, dw, dh);
    for (const type of ['image/webp', 'image/jpeg']) {
        for (const q of [.75, .65, .55, .45, .35, .25]) {
            const d = c.toDataURL(type, q);
            if (d.startsWith('data:' + type) && d.length <= max) {
                return d;
            }
        }
    }
    throw new Error('That picture is too detailed. Try a simpler one.');
}
// Only ever put one of two kinds of address into an <img src>: our own data URL (a picture an organization uploaded), or a company picture the
// server found by itself (/api/brand/<id>/logo|cover, served from the Fyndr server; see server/jobs/brand.js). Anything else becomes ''.
const BRAND = /^\/api\/brand\/[a-z0-9-]{1,60}\/(logo|cover)$/;
export const safeImg = s => {
    if (typeof s !== 'string') {
        return '';
    }
    if (s.startsWith('data:image/')) {
        return !/["'<>\s]/.test(s) ? s : '';
    }
    return BRAND.test(s) && !/["'<>\s]/.test(API_BASE) ? API_BASE + s : '';
};

// A chat photo: longest side 960 px, WebP/JPEG, under ~200 KB so it fits inside one Firestore message (limit 1 MB per document).
export async function shrinkChat(file, max = 200000) {
    if (!file || !/^image\/(jpeg|png|webp|gif)$/.test(file.type)) {
        throw new Error('Choose a JPG, PNG or WebP picture');
    }
    if (file.size > 20 * 1024 * 1024) {
        throw new Error('That picture is too large (max 20 MB)');
    }
    const im = await load(file);
    for (const edge of [960, 760, 600, 460]) {
        const k = Math.min(1, edge / Math.max(im.width, im.height));
        const c = document.createElement('canvas');
        c.width = Math.max(1, Math.round(im.width * k));
        c.height = Math.max(1, Math.round(im.height * k));
        const g = c.getContext('2d');
        g.fillStyle = '#fff';
        g.fillRect(0, 0, c.width, c.height);
        g.imageSmoothingQuality = 'high';
        g.drawImage(im, 0, 0, c.width, c.height);
        for (const type of ['image/webp', 'image/jpeg']) {
            for (const q of [.8, .7, .6, .5, .4]) {
                const d = c.toDataURL(type, q);
                if (d.startsWith('data:' + type) && d.length <= max) {
                    return d;
                }
            }
        }
    }
    throw new Error('That picture is too detailed. Try another one.');
}

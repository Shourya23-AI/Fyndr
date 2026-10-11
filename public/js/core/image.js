// Shrinks a picture the organization chose, in the browser, so it can be stored inside the listing (no paid file storage needed).
//   cover: 640x360 (16:9), cropped to fill   -> JPEG, kept under ~150 KB
//   logo : 128x128 square, whole logo shown on white -> JPEG, kept under ~40 KB
const SPEC = {
    cover: { w: 640, h: 360, fit: 'cover', max: 150000 },
    logo: { w: 128, h: 128, fit: 'contain', max: 40000 }
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
    for (const q of [.82, .72, .62, .5, .4]) {
        const d = c.toDataURL('image/jpeg', q);
        if (d.length <= max) {
            return d;
        }
    }
    throw new Error('That picture is too detailed. Try a simpler one.');
}
// Only ever put our own kind of data URL into an <img src>.
export const safeImg = s => typeof s === 'string' && s.startsWith('data:image/') && !/["'<>\s]/.test(s) ? s : '';

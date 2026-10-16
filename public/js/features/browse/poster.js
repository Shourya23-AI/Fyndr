// Poster covers: every listing without its own uploaded picture gets a flyer drawn in the browser.
//   - the company's REAL logo (looked up from its website address, with a coloured-letter fallback if it cannot load)
//   - the company's brand colour
//   - the role/topic as the headline, the kind of work as a small label and a big faint icon
// Four layouts and five background patterns are picked from the listing itself, so two cards never look the same
// (even 20 cards from the same website differ by headline, kind-of-work colour, layout and pattern).
// Nothing is downloaded except the logo itself, so this works with no storage and no image licences to manage.
import { esc } from '../../core/dom.js';
import { safeImg } from '../../core/image.js';
import { catOf, monogram } from './banner.js';
import { COMPANIES } from './careers.js';

// name -> [website, brand colour]. Names match the providers/job boards in catalog/meta.js exactly.
export const BRANDS = {
    'Coursera': ['coursera.org', '#0056d2'], 'edX': ['edx.org', '#02539a'], 'Udemy': ['udemy.com', '#a435f0'],
    'YouTube': ['youtube.com', '#e62117'], 'freeCodeCamp': ['freecodecamp.org', '#2a2a40'], 'Codecademy': ['codecademy.com', '#1f2547'],
    'Microsoft Learn': ['learn.microsoft.com', '#0078d4'], 'MIT OpenCourseWare': ['ocw.mit.edu', '#a31f34'], 'SWAYAM / NPTEL': ['swayam.gov.in', '#d9531e'],
    'LinkedIn Learning': ['linkedin.com', '#0a66c2'], 'Alison': ['alison.com', '#1a73a8'], 'FutureLearn': ['futurelearn.com', '#de00a5'],
    'Skillshare': ['skillshare.com', '#00a86b'], 'Khan Academy': ['khanacademy.org', '#14a085'], 'Google Cloud Skills Boost': ['cloudskillsboost.google', '#4285f4'],
    'DataCamp': ['datacamp.com', '#05a35a'], 'Class Central': ['classcentral.com', '#e8541e'], 'Udacity': ['udacity.com', '#02a9d6'],
    'Pluralsight': ['pluralsight.com', '#f15b2a'], 'Stanford Online': ['online.stanford.edu', '#8c1515'], 'Harvard Online': ['pll.harvard.edu', '#a51c30'],
    'Google': ['google.com', '#4285f4'], 'Great Learning Academy': ['mygreatlearning.com', '#1a8fd1'], 'upGrad': ['upgrad.com', '#e5382f'],
    'Simplilearn': ['simplilearn.com', '#e9742b'], 'GeeksforGeeks': ['geeksforgeeks.org', '#2f8d46'], 'Kaggle Learn': ['kaggle.com', '#1a9fd9'],
    'Coding Ninjas': ['codingninjas.com', '#e8751a'], 'Physics Wallah': ['pw.live', '#3b3dc8'], 'Unacademy': ['unacademy.com', '#08a06c'],
    'HubSpot Academy': ['hubspot.com', '#f2603b'], 'Brilliant': ['brilliant.org', '#3c9a3d'], 'Infosys Springboard': ['infosys.com', '#007cc3'],
    'IBM SkillsBuild': ['ibm.com', '#0f62fe'], 'Cisco Networking Academy': ['netacad.com', '#049fd9'], 'AWS Skill Builder': ['aws.amazon.com', '#2b3a4f'],
    'Oracle University': ['oracle.com', '#c74634'], 'Saylor Academy': ['saylor.org', '#1b5e9b'], 'OpenLearn (Open University)': ['open.edu', '#1c4f8c'],
    'Harvard CS50': ['cs50.harvard.edu', '#a51c30'], 'Spoken Tutorial (IIT Bombay)': ['spoken-tutorial.org', '#3b7bbf'], 'Internshala Trainings': ['internshala.com', '#0a8bd6'],
    'TED-Ed and YouTube Edu': ['ed.ted.com', '#d9261c'], 'Google Digital Garage and Skillshop': ['skillshop.withgoogle.com', '#34a853'],
    'LinkedIn Jobs': ['linkedin.com', '#0a66c2'], 'Indeed India': ['indeed.com', '#2164f3'], 'Naukri': ['naukri.com', '#275df5'],
    'Internshala': ['internshala.com', '#0a8bd6'], 'Glassdoor': ['glassdoor.com', '#0caa41'], 'Foundit (Monster)': ['foundit.in', '#6a3fd1'],
    'TimesJobs': ['timesjobs.com', '#d9232d'], 'Shine': ['shine.com', '#e8860c'], 'Freshersworld': ['freshersworld.com', '#e0501b'],
    'Jooble': ['jooble.org', '#2c6dff'], 'Apna': ['apna.co', '#1b9a8a'], 'Hirist (tech)': ['hirist.tech', '#1b4f9c'],
    'Wellfound (startups)': ['wellfound.com', '#2a2a2a'], 'Instahyre': ['instahyre.com', '#3a4a8a'], 'Cutshort': ['cutshort.io', '#2f6fe0'], 'Unstop': ['unstop.com', '#1c4980']
};
const norm = s => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '');
// Big employers from the careers list: website taken from their careers link.
const BY_NAME = new Map();
for (const [name, , url] of COMPANIES) {
    try {
        const h = new URL(url).hostname.replace(/^(www|careers|jobs)\./, '');
        const parts = h.split('.');
        const dom = parts[parts.length - 1] === 'jobs' ? norm(name) + '.com' : parts.slice(-2).join('.');
        BY_NAME.set(norm(name), dom);
    } catch { }
}
const NORM_BRANDS = new Map(Object.entries(BRANDS).map(([k, v]) => [norm(k), v]));
const h32 = s => {
    let h = 2166136261;
    for (const c of String(s)) {
        h = Math.imul(h ^ c.charCodeAt(0), 16777619) >>> 0;
    }
    // final mixing, so listings with almost the same text still get unrelated looks
    h ^= h >>> 16; h = Math.imul(h, 0x85ebca6b) >>> 0; h ^= h >>> 13; h = Math.imul(h, 0xc2b2ae35) >>> 0; h ^= h >>> 16;
    return h >>> 0;
};
const HEX = /^#[0-9a-f]{6}$/i;
const DOM = /^[a-z0-9.-]{3,80}$/i;

// Website of the organization: our own table first, then the careers list, then a website the listing itself carries.
export function siteOf(l) {
    const b = NORM_BRANDS.get(norm(l?.orgName));
    if (b) {
        return b[0];
    }
    if (BY_NAME.has(norm(l?.orgName))) {
        return BY_NAME.get(norm(l.orgName));
    }
    try {
        const h = new URL(l?.website || '').hostname.replace(/^www\./, '');
        return DOM.test(h) ? h : '';
    } catch {
        return '';
    }
}
// Real logo from the web (two services tried one after the other; the letter logo is the last fallback).
const logoUrls = d => [
    `https://t3.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&url=${encodeURIComponent('https://' + d)}&size=128`,
    `https://icons.duckduckgo.com/ip3/${d}.ico`
];
export const webLogo = (l, cls = '') => {
    const d = siteOf(l);
    if (!d) {
        return monogram(l?.orgName);
    }
    const [a, b] = logoUrls(d);
    return `<img class="${cls}" src="${esc(a)}" data-fb="${esc(b)}" data-n="${esc(l.orgName)}" alt="" loading="lazy" decoding="async" referrerpolicy="no-referrer">`;
};
// A logo that cannot load: try the second service, then show the coloured letter instead.
export function bindLogoFallback() {
    addEventListener('error', e => {
        const im = e.target;
        if (!im || im.tagName !== 'IMG' || !('n' in im.dataset)) {
            return;
        }
        if (im.dataset.fb) {
            im.src = im.dataset.fb;
            delete im.dataset.fb;
            return;
        }
        im.outerHTML = monogram(im.dataset.n);
    }, true);
    // A favicon service sometimes answers with a tiny placeholder instead of an error: treat very small images as "no logo" (letter shown).
    addEventListener('load', e => {
        const im = e.target;
        if (im && im.tagName === 'IMG' && 'n' in im.dataset && im.naturalWidth && im.naturalWidth < 24) {
            im.dispatchEvent(new Event('error'));
        }
    }, true);
}
const ICON = {
    code: '<path d="m8 8-5 4 5 4M16 8l5 4-5 4M14 5l-4 14"/>', data: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
    ai: '<rect x="6" y="6" width="12" height="12" rx="3"/><path d="M9 2v4M15 2v4M9 18v4M15 18v4M2 9h4M2 15h4M18 9h4M18 15h4"/>',
    design: '<path d="M12 3 3 8l9 5 9-5zM3 13l9 5 9-5"/>', mkt: '<path d="M3 11v3a1 1 0 0 0 1 1h2l5 4V6L6 10H4a1 1 0 0 0-1 1zM15 9a4 4 0 0 1 0 6"/>',
    fin: '<circle cx="12" cy="12" r="9"/><path d="M12 6v12M9 9.5c0-1 1.3-1.8 3-1.8s3 .8 3 1.8-1.3 1.7-3 2.2-3 1.2-3 2.3 1.3 1.8 3 1.8 3-.8 3-1.8"/>',
    biz: '<rect x="3" y="7" width="18" height="13" rx="2"/><path d="M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2M3 13h18"/>',
    eng: '<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1"/>',
    health: '<path d="M9 3h6v6h6v6h-6v6H9v-6H3V9h6z"/>', sci: '<path d="M9 3h6M10 3v6L4.5 19a1.5 1.5 0 0 0 1.3 2.2h12.4a1.5 1.5 0 0 0 1.3-2.2L14 9V3M7.5 15h9"/>',
    law: '<path d="M12 3v18M6 21h12M5 7h14M5 7l-3 7a3 3 0 0 0 6 0zM19 7l-3 7a3 3 0 0 0 6 0z"/>', sec: '<path d="M12 3 4 6v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V6z"/><path d="m9 12 2.2 2.2L15.5 10"/>',
    cloud: '<path d="M7 18a4.5 4.5 0 0 1-.6-8.96A6 6 0 0 1 18 9a4 4 0 0 1 0 9z"/>', write: '<path d="M4 20h4L19 9l-4-4L4 16zM13.5 6.5l4 4"/>',
    people: '<circle cx="9" cy="8" r="3.2"/><path d="M3 20a6 6 0 0 1 12 0M16 5.2a3.2 3.2 0 0 1 0 5.6M18 14.5a6 6 0 0 1 3 5.5"/>', cap: '<path d="M3 9.5 12 5l9 4.5-9 4.5z"/><path d="M7 12v4.2c0 1 2.2 2.3 5 2.3s5-1.3 5-2.3V12"/>'
};
const HUES = [152, 205, 262, 330, 18, 42, 188, 292, 120, 350];

export function posterOf(l) {
    const [, label, accent, , ic] = catOf(l);
    const seed = h32((l.id || '') + '|' + (l.title || ''));
    const b = NORM_BRANDS.get(norm(l.orgName));
    let color = HEX.test(l.brandColor || '') ? l.brandColor : b ? b[1] : '';
    if (!color) {
        color = `hsl(${HUES[h32(l.orgName || '?') % HUES.length]} 55% 38%)`;
    }
    const layout = (seed >>> 4) % 4;
    const pattern = (seed >>> 11) % 5;
    const kind = l.type === 'Course' ? 'Course' : l.type || 'Opening';
    return `<span class="lc-img lc-poster" data-v="${layout}" data-p="${pattern}" style="--pc:${color};--ac:${HEX.test(accent) ? accent : '#4f8a6f'}">
<span class="pz-art" aria-hidden="true"><svg viewBox="0 0 24 24">${ICON[ic] || ICON.cap}</svg></span>
<span class="pz-kick">${esc(kind)} · ${esc(label)}</span>
<span class="pz-head">${esc(l.title)}</span>
<span class="pz-brand"><span class="pz-logo">${logoHtml(l)}</span><span class="pz-org">${esc(l.orgName)}</span></span></span>`;
}
// The organization's own uploaded logo (a stored picture) if there is one, else the real logo from its website, else the letter logo.
const logoHtml = l => safeImg(l.logo) ? `<img src="${safeImg(l.logo)}" alt="">` : webLogo(l);

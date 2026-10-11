// Banners and logos for listings that have no picture of their own.
// Everything is drawn in the browser (no downloads, no copyright problems, works offline):
//   - a banner whose colour and icon follow the KIND of work (software, data, design, finance ...)
//   - a coloured letter logo for providers without a logo
// A picture the organization uploaded, or one the server found (brand.js), is always preferred (see card.js).
const I = {
    code: '<path d="m8 8-5 4 5 4M16 8l5 4-5 4M14 5l-4 14"/>',
    data: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
    ai: '<rect x="6" y="6" width="12" height="12" rx="3"/><path d="M9 2v4M15 2v4M9 18v4M15 18v4M2 9h4M2 15h4M18 9h4M18 15h4"/><circle cx="12" cy="12" r="1.8"/>',
    design: '<path d="M12 3 3 8l9 5 9-5zM3 13l9 5 9-5"/>',
    mkt: '<path d="M3 11v3a1 1 0 0 0 1 1h2l5 4V6L6 10H4a1 1 0 0 0-1 1zM15 9a4 4 0 0 1 0 6M18 6a8 8 0 0 1 0 12"/>',
    fin: '<circle cx="12" cy="12" r="9"/><path d="M14.5 9.2c-.5-.8-1.4-1.2-2.5-1.2-1.4 0-2.5.8-2.5 2s1.1 1.7 2.5 2 2.5.8 2.5 2-1.1 2-2.5 2c-1.1 0-2-.4-2.5-1.2M12 6v2M12 16v2"/>',
    biz: '<rect x="3" y="7" width="18" height="13" rx="2"/><path d="M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2M3 13h18"/>',
    eng: '<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1"/>',
    health: '<path d="M9 3h6v6h6v6h-6v6H9v-6H3V9h6z"/>',
    sci: '<path d="M9 3h6M10 3v6L4.5 19a1.5 1.5 0 0 0 1.3 2.2h12.4a1.5 1.5 0 0 0 1.3-2.2L14 9V3M7.5 15h9"/>',
    law: '<path d="M12 3v18M6 21h12M5 7h14M5 7l-3 7a3 3 0 0 0 6 0zM19 7l-3 7a3 3 0 0 0 6 0z"/>',
    sec: '<path d="M12 3 4 6v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V6z"/><path d="m9 12 2.2 2.2L15.5 10"/>',
    cloud: '<path d="M7 18a4.5 4.5 0 0 1-.6-8.96A6 6 0 0 1 18 9a4 4 0 0 1 0 9z"/>',
    write: '<path d="M4 20h4L19 9l-4-4L4 16zM13.5 6.5l4 4"/>',
    people: '<circle cx="9" cy="8" r="3.2"/><path d="M3 20a6 6 0 0 1 12 0M16 5.2a3.2 3.2 0 0 1 0 5.6M18 14.5a6 6 0 0 1 3 5.5"/>',
    cap: '<path d="M3 9.5 12 5l9 4.5-9 4.5z"/><path d="M7 12v4.2c0 1 2.2 2.3 5 2.3s5-1.3 5-2.3V12"/>'
};
// [key, label, colour 1, colour 2, icon, words that put a listing in this group]. The first group that matches wins.
export const CATS = [
    ['ai', 'AI & ML', '#6d4aff', '#2b1d7a', 'ai', /\b(machine learning|deep learning|artificial intelligence|ai|ml|llm|nlp|generative|neural|computer vision|prompt engineering|mlops)\b/i],
    ['data', 'Data', '#0f9d8a', '#074d52', 'data', /\b(data (science|scien|analy|engineer|visual)|analytics?|sql|power ?bi|tableau|statistics|excel|big data|etl|business intelligence|data)\b/i],
    ['sec', 'Security', '#d6455d', '#6b1330', 'sec', /\b(cyber ?security|security|ethical hacking|penetration|infosec|soc analyst|network security)\b/i],
    ['cloud', 'Cloud & DevOps', '#2f7fd1', '#133a73', 'cloud', /\b(cloud|aws|azure|gcp|devops|kubernetes|docker|sre|site reliability|terraform|linux|ci\/cd|infrastructure)\b/i],
    ['code', 'Software', '#3d5af1', '#1a2670', 'code', /\b(software|developer|programming|python|java|javascript|typescript|react|node|angular|vue|backend|frontend|front-end|back-end|full ?stack|web dev|android|ios|flutter|kotlin|swift|c\+\+|golang|rust|sde|coding|computer science|qa|testing|automation|app dev|mobile)\b/i],
    ['mkt', 'Marketing', '#f08a24', '#8a3a05', 'mkt', /\b(marketing|seo|social media|digital marketing|brand|advertis|growth|campaign|influencer|public relations|pr\b)\b/i],
    ['fin', 'Finance', '#1f9d6b', '#0b4d34', 'fin', /\b(financ|account|audit|tax|banking|investment|equity|trading|cfa|ca\b|fintech|economics|insurance|actuar)\w*/i],
    ['health', 'Healthcare', '#13a5a5', '#0a5656', 'health', /\b(health|medical|clinical|pharma|nursing|biotech|bioinformatics|hospital|public health|life science)\w*/i],
    ['sci', 'Science', '#7a56c9', '#37236e', 'sci', /\b(research|science|chemistry|physics|biology|lab\b|laborator|material|environment|sustainab|climate)\w*/i],
    ['eng', 'Engineering', '#e5613b', '#7a2610', 'eng', /\b(mechanical|civil|electrical|electronics|embedded|vlsi|robotics|iot|cad|autocad|manufactur|industrial|aerospace|automobile|chemical engineer|production|supply chain|logistics)\w*/i],
    ['design', 'Design', '#e0569f', '#7a1d52', 'design', /\b(design|ux|ui\/ux|figma|graphic|illustrat|animation|video edit|photoshop|creative|branding)\b/i],
    ['law', 'Law & Policy', '#8a6a3a', '#3f2e12', 'law', /\b(law|legal|compliance|policy|governance|paralegal|contract|ipr|intellectual property)\w*/i],
    ['write', 'Content', '#c9548a', '#6e1f47', 'write', /\b(content|writer|writing|editor|journalis|copywrit|blog|translation|communication)\w*/i],
    ['people', 'People & Ops', '#d98a00', '#6b4400', 'people', /\b(hr\b|human resource|recruit|talent|operations|customer (success|support)|sales|business development|bdr|community|admin|project manage|product manage|management|consult|entrepreneur|startup)\w*/i],
    ['biz', 'Business', '#4a6fa5', '#1d3050', 'biz', /\b(business|mba|strategy|analyst|leadership|career|soft skills|interview)\w*/i]
];
const DEFAULT = ['gen', 'Learning', '#4f8a6f', '#24473a', 'cap'];
// Sorted list for the filter chips: [key, label]
export const CAT_CHIPS = CATS.map(c => [c[0], c[1]]);
export const catOf = l => {
    if (l && l._cat) {
        return l._cat;
    }
    const t = [l?.cat, l?.title, (l?.skills || []).join(' '), l?.field, String(l?.description || '').slice(0, 240)].filter(Boolean).join(' ');
    const hit = (l?.cat && CATS.find(c => c[0] === l.cat)) || CATS.find(c => c[5].test(String(l?.title || ''))) || CATS.find(c => c[5].test(t));
    const r = hit ? hit : DEFAULT;
    if (l && typeof l === 'object') {
        try {
            Object.defineProperty(l, '_cat', { value: r, enumerable: false, configurable: true });
        } catch { }
    }
    return r;
};
export const catKey = l => catOf(l)[0];
const icon = k => `<svg viewBox="0 0 24 24" aria-hidden="true">${I[k] || I.cap}</svg>`;
// The banner (replaces the plain green box).
export const bannerOf = l => {
    const [, label, a, b, ic] = catOf(l);
    return `<span class="lc-img lc-bn" style="--b1:${a};--b2:${b}" data-t="${label}"><span class="bn-ic">${icon(ic)}</span><span class="bn-tag">${label}</span></span>`;
};
// Coloured letter logo (colour comes from the provider's name, so the same provider always looks the same).
const HUES = [152, 205, 262, 330, 18, 42, 188, 292, 120, 350];
export const monogram = name => {
    const n = String(name || '?').trim();
    let h = 0;
    for (const ch of n) {
        h = (h * 31 + ch.charCodeAt(0)) >>> 0;
    }
    const hue = HUES[h % HUES.length];
    const words = n.split(/\s+/).filter(Boolean);
    const txt = (words.length > 1 && words[0].length <= 12 ? words[0][0] + words[1][0] : n.slice(0, 1)).toUpperCase().replace(/[^A-Z0-9]/g, '') || '?';
    return `<b class="mono" style="background:hsl(${hue} 55% 42%)">${txt}</b>`;
};

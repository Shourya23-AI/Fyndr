// Skeleton placeholders: grey shimmering shapes in the layout of the page that is about to appear.
const L = (w = '', extra = '') => `<span class="sk-line ${w}" ${extra ? `style="${extra}"` : ''}></span>`;
const CARD = `<div class="sk-card"><span class="sk-circle"></span><div>${L('w30')}${L('w70')}${L('w50', 'margin:0')}</div><span class="sk-block" style="height:40px"></span></div>`;
const KINDS = {
    // Landing / search hero
    home: () => `<div class="container sk-page"><div class="sk-hero"><div>${L('lg w70')}${L('lg w50')}${L('w90', 'margin-top:18px')}${L('w70')}${L('lg', 'margin-top:22px;max-width:520px;height:56px;border-radius:999px')}</div><div class="sk-block tall"></div></div>${CARD}${CARD}</div>`,
    // Listing pages
    list: () => `<div class="container sk-page">${L('lg w50')}${L('w70', 'margin-bottom:22px')}${L('lg', 'max-width:560px;height:56px;border-radius:999px;margin-bottom:34px')}${CARD}${CARD}${CARD}</div>`,
    // Dashboards: sidebar + panels
    dash: () => `<div class="sk-dash"><div><div class="sk-block" style="height:240px;border-radius:16px"></div></div><div>${L('lg w30')}${L('w50', 'margin-bottom:22px')}<div class="sk-block" style="height:96px;margin-bottom:14px"></div><div class="sk-block" style="height:200px;margin-bottom:14px"></div><div class="sk-block" style="height:160px"></div></div></div>`,
    // Single centred card (phone, verify, setup...)
    center: () => `<div class="sk-center" aria-busy="true"><div><span class="sk-circle" style="margin-bottom:18px"></span>${L('lg w70')}${L('w90')}${L('w70', 'margin-bottom:22px')}${L('lg', 'height:46px')}</div></div>`
};
export const skeleton = kind => (KINDS[kind] || KINDS.center)();
// Which placeholder fits a route (used while a page is still loading).
export const skeletonFor = (route, signedIn) => {
    const r = (route || '').split('?')[0];
    if (['jobs', 'courses', 'library', 'community', 'groups', 'liked'].includes(r.split('/')[0]) || (r === '' && signedIn)) {
        return 'list';
    }
    if (r === 'dashboard') {
        return 'dash';
    }
    if (['phone', 'verify', 'setup', 'forgot', 'reset', 'proof', 'profile', 'apply'].includes(r.split('/')[0])) {
        return 'center';
    }
    return 'home';
};

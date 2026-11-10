// The ONE address of the live site. Everything that must match the address people use (phone.email, Firebase) is checked against it.
// Keep in sync with: public/boot.js, vercel.json (redirects) and docs/DEPLOY.md. test/domain.test.js fails if they drift apart.
export const SITE_ORIGIN = 'https://fyndr-bmsit.vercel.app';
export const RETIRED_HOSTS = ['fyndr-2rjv.vercel.app'];

// True on a *.vercel.app address that is not the real site (an old address or a preview build). Phone verification cannot work there,
// because phone.email only sends people back to the one address saved in its dashboard.
export const onWrongHost = (loc = location) => {
    const h = loc.hostname || '';
    return h.endsWith('.vercel.app') && h !== new URL(SITE_ORIGIN).hostname;
};

// Where a listing really comes from, in words a student can trust. Shown as a small badge on every card and in the details popup.
//
//   search   a course topic or job role that opens the provider's or job board's own search page (Fyndr's built-in catalog).
//            Not one posting: Fyndr has not checked any page behind it, so it gets NO legitimacy score and is never called "verified".
//   direct   an opening read from the company's own careers system (Greenhouse, Lever, Ashby, SmartRecruiters or its careers page).
//            Applied for on the company's own page. Closed automatically once the company stops showing it (see expiry.js).
//   partner  an opening found through a job search service (Adzuna). Applied for on the employer's page behind it.
//   picked   a single course or learning path hand-picked by Fyndr, with a link to that exact page.
//   posted   a listing an organization posted on Fyndr itself. Reviewed by our team before it went live.
export const isSearch = l => !!l && (l.search === true || (typeof l.id === 'string' && l.id.startsWith('cat_')));
const DIRECT = ['greenhouse', 'lever', 'ashby', 'smartrecruiters', 'page'];
export function originOf(l) {
    if (isSearch(l)) {
        return {
            k: 'search', label: 'Search links',
            note: l.type === 'Course' ? 'Opens each learning site\'s own search for this topic. Fyndr has not checked the courses you will find there.' : 'Opens each job board\'s own live search for this role. Fyndr has not checked the openings you will find there.'
        };
    }
    if (l && l.source === 'import') {
        if (DIRECT.includes(l.origin)) {
            return { k: 'direct', label: 'Direct from company', note: 'Read from the company\'s own careers page. You apply on their page. It closes here by itself once the company stops listing it.' };
        }
        if (l.origin === 'adzuna') {
            return { k: 'partner', label: 'Via Adzuna', note: 'Found through the Adzuna job search service. You apply on the employer\'s page behind it.' };
        }
        return { k: 'picked', label: 'Picked by Fyndr', note: 'A single course or learning path chosen by the Fyndr team, with a link to that exact page.' };
    }
    return { k: 'posted', label: 'Posted on Fyndr', note: 'Posted by an organization on Fyndr and reviewed by our team before it went live.' };
}
// How long ago the importer last saw this opening on the company's page: "today", "3 days ago". '' when unknown.
export function seenAgo(l, nowMs = Date.now()) {
    const t = Date.parse(l && l.lastSeen);
    if (!Number.isFinite(t)) {
        return '';
    }
    const d = Math.max(0, Math.floor((nowMs - t) / 864e5));
    return d === 0 ? 'today' : d === 1 ? 'yesterday' : d + ' days ago';
}
// Days since the importer last saw a direct opening on the company's page. 3 or more means the check is overdue and the opening may already be gone.
export const staleDays = (l, nowMs = Date.now()) => {
    const t = Date.parse(l && l.lastSeen);
    return Number.isFinite(t) ? Math.max(0, Math.floor((nowMs - t) / 864e5)) : 0;
};

// Shared, mutable app state. Every module imports `S` instead of using loose globals.
//   S.me     signed-in user's profile (null when signed out)
//   S.lmap   listings drawn so far, by id (the "View details" popup reads from it)
//   S.scope  which listing page is open: 'jobs' (jobs + internships) or 'courses'
//   S.f      current search filters on the browse page
//   S.mine   the candidate's saved listings + applications
//   S.match  suggestion info by listing id (score, reasons) for the listings drawn as suggestions; the details popup reads it
//   S.skills skill chips being edited on the profile form
//   S.ph     phone.email verification state (cid = Client ID, busy = popup open)
export const S = {
    pf: { place: 'any', fit: false }, // jobs page place filter (any | near | remote) and "Suitable for me"
    rf: { src: '', pay: '', dur: '', price: '', cert: false, remote: false }, // stipend / duration / price / certificate / source filters (listings/refine.js)
    me: null, lmap: {}, scope: 'jobs', f: {
        type: '', q: '', loc: ''
    }, mine: { saved: [], applications: [] }, match: {}, skills: [], skillLv: {}, ph: {
        busy: false, cancel: null, cid: undefined
    }
};

// Staff = admins and moderators (they see the admin dashboard instead of the candidate / organization pages).
export const isStaff = m => !!m && (m.role === 'admin' || m.role === 'moderator');

// Shared, mutable app state. Every module imports `S` instead of using loose globals.
//   S.me     signed-in user's profile (null when signed out)
//   S.scope  which listing page is open: 'jobs' (jobs + internships) or 'courses'
//   S.f      current search filters on the browse page
//   S.mine   the candidate's saved listings + applications
//   S.skills skill chips being edited on the profile form
//   S.ph     phone.email verification state (cid = Client ID, busy = popup open)
export const S = {
    me: null, scope: 'jobs', f: {
        type: '', q: '', loc: ''
    }, mine: { saved: [], applications: [] }, skills: [], skillLv: {}, ph: {
        busy: false, cancel: null, cid: undefined
    }
};

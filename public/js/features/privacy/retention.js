// How long Fyndr keeps applications. ONE place: the Privacy Policy text and the cleanup code both read these numbers,
// so what the policy promises and what the code does can never drift apart.
export const RETENTION = {
    closedListingDays: 30, // an application (and the resume copy shared with the organization) is deleted this many days after its listing is closed
    maxApplicationDays: 365 // ... and in any case this many days after the candidate applied
};

import { fmt } from '../../core/dom.js';
import { RETENTION } from './retention.js';
import { choice } from '../../services/analytics/analytics.js';
// The "Privacy & data" panel: what is shared, download my data, delete my account. Used by the candidate and organization dashboards.
const row = (title, text, btn) => `<div class="priv-row"><div><b>${title}</b><span class="desc">${text}</span></div>${btn || ''}</div>`;
export const privacyPanel = (me, hasResume) => {
    const org = me.role === 'org';
    const intro = org
        ? `Applicant details are for hiring decisions on your listings only. Applications are deleted automatically ${RETENTION.closedListingDays} days after a listing is closed, and in any case ${RETENTION.maxApplicationDays} days after the candidate applied.`
        : `Your resume is shared with an organization only when you apply, as a copy of what you chose. Withdraw an application and that organization loses access straight away. Applications are also deleted automatically ${RETENTION.closedListingDays} days after a listing is closed, and in any case ${RETENTION.maxApplicationDays} days after you applied.`;
    return `<div class="panel priv"><h3>Privacy &amp; data</h3><p class="desc">${intro}</p>
${row('Anonymous usage counts', 'Daily totals of views and searches, never who. Off unless you said yes.', `<button class="button button-small" data-act="antoggle">${choice() === 'yes' ? 'Turn off' : 'Turn on'}</button>`)}
${row('Terms and Privacy Policy', `${me.consentAt ? 'You accepted them on ' + fmt(me.consentAt) + '. ' : ''}<a class="link" href="#/privacy">Read the Privacy Policy</a>`)}
${row('Download my data', org ? 'A file with your account, your listings and the applications you received.' : 'A file with your account, profile, applications and uploaded resume.', '<button class="button button-small" data-act="exportdata">Download</button>')}
${hasResume ? row('Download my uploaded resume', 'Your PDF, exactly as you uploaded it.', '<button class="button button-small" data-act="dlresume">Download PDF</button>') : ''}
${row('Delete my account', org ? 'Permanently deletes your organization account, your listings and every application you received.' : 'Permanently deletes your account, profile, resume and applications. Organizations lose access to what you shared.', '<button class="button button-small btn-danger" data-act="deleteacct">Delete account</button>')}</div>`;
};

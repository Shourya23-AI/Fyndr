// "Not listed here" card. When someone searches for a well-known company that has no openings on Fyndr
// (Google, Microsoft, TCS ...), the top of the results shows a card that says so and links to that company's OWN careers page.
// Pure data + matching, no network. The card disappears by itself the moment real openings from that company are listed on Fyndr
// (the importer or a verified organization adds them), so this list never needs to be kept in sync by hand.
//
// To add a company: one row = [name, other ways people write it, official careers page (https only), kind, ambiguous?]
//   ambiguous = true for names that are also ordinary words (Meta, Apple, Oracle, Intel): the card then shows only when the search is
//   exactly the name, or the name plus a word like "jobs" / "careers" / "internship" ("meta jobs", "apple careers").
// Run  node scripts/check-careers-links.js  now and then to see that every link still opens.
export const COMPANIES = [
    // global technology
    ['Google', ['alphabet', 'google india', 'google inc'], 'https://www.google.com/about/careers/applications/', 'tech'],
    ['Microsoft', ['microsoft india', 'msft'], 'https://careers.microsoft.com/', 'tech'],
    ['Amazon', ['amazon india', 'aws jobs', 'amazon web services'], 'https://www.amazon.jobs/', 'tech'],
    ['Apple', [], 'https://jobs.apple.com/', 'tech', true],
    ['Meta', ['facebook', 'instagram', 'whatsapp'], 'https://www.metacareers.com/', 'tech', true],
    ['Netflix', [], 'https://jobs.netflix.com/', 'tech'],
    ['Tesla', [], 'https://www.tesla.com/careers', 'tech'],
    ['NVIDIA', ['nvidia india'], 'https://www.nvidia.com/en-us/about-nvidia/careers/', 'tech'],
    ['Adobe', ['adobe india'], 'https://careers.adobe.com/', 'tech'],
    ['Salesforce', [], 'https://careers.salesforce.com/', 'tech'],
    ['Oracle', ['oracle india'], 'https://careers.oracle.com/', 'tech', true],
    ['IBM', ['ibm india'], 'https://www.ibm.com/careers', 'tech'],
    ['Intel', ['intel india'], 'https://jobs.intel.com/', 'tech', true],
    ['Cisco', [], 'https://jobs.cisco.com/', 'tech'],
    ['SAP', ['sap labs', 'sap india'], 'https://jobs.sap.com/', 'tech', true],
    ['Qualcomm', [], 'https://www.qualcomm.com/company/careers', 'tech'],
    ['AMD', ['advanced micro devices'], 'https://careers.amd.com/', 'tech', true],
    ['Atlassian', [], 'https://www.atlassian.com/company/careers', 'tech'],
    ['ServiceNow', ['service now'], 'https://careers.servicenow.com/', 'tech'],
    ['Dell', ['dell technologies'], 'https://jobs.dell.com/', 'tech', true],
    ['HP', ['hewlett packard', 'hp inc'], 'https://careers.hp.com/', 'tech', true],
    ['Uber', [], 'https://www.uber.com/us/en/careers/', 'tech'],
    ['PayPal', ['paypal india'], 'https://careers.pypl.com/', 'tech'],
    ['Walmart Global Tech', ['walmart', 'walmart labs'], 'https://careers.walmart.com/', 'tech'],
    // Indian IT services and product companies
    ['TCS', ['tata consultancy services', 'tata consultancy', 'tcs ninja', 'tcs digital'], 'https://www.tcs.com/careers', 'it'],
    ['Infosys', ['infosys limited', 'infosys springboard'], 'https://www.infosys.com/careers/', 'it'],
    ['Wipro', ['wipro limited', 'wipro turbo', 'wipro elite'], 'https://careers.wipro.com/', 'it'],
    ['HCLTech', ['hcl', 'hcl technologies', 'hcl tech'], 'https://www.hcltech.com/careers', 'it'],
    ['Tech Mahindra', ['techm', 'tech m'], 'https://careers.techmahindra.com/', 'it'],
    ['Cognizant', ['cts'], 'https://careers.cognizant.com/', 'it'],
    ['Accenture', ['accenture india'], 'https://www.accenture.com/in-en/careers', 'it'],
    ['Capgemini', ['capgemini india'], 'https://www.capgemini.com/careers/', 'it'],
    ['LTIMindtree', ['ltim', 'lti mindtree', 'mindtree', 'l&t infotech', 'lti'], 'https://www.ltimindtree.com/careers/', 'it'],
    ['Mphasis', [], 'https://careers.mphasis.com/', 'it'],
    ['Hexaware', [], 'https://hexaware.com/careers/', 'it'],
    ['Zoho', ['zoho corporation', 'zoho corp'], 'https://www.zoho.com/careers/', 'it'],
    ['Flipkart', ['flipkart internet'], 'https://www.flipkartcareers.com/', 'it'],
    ['Zomato', [], 'https://www.zomato.com/careers', 'it'],
    ['Ola', ['ola cabs', 'ola electric'], 'https://www.olacabs.com/careers', 'it', true],
    // finance and consulting
    ['Goldman Sachs', ['goldman'], 'https://www.goldmansachs.com/careers/', 'finance'],
    ['JPMorgan Chase', ['jpmorgan', 'jp morgan', 'jpmc', 'jpm'], 'https://careers.jpmorgan.com/', 'finance'],
    ['Morgan Stanley', [], 'https://www.morganstanley.com/careers', 'finance'],
    ['McKinsey', ['mckinsey & company', 'mckinsey and company'], 'https://www.mckinsey.com/careers', 'consulting'],
    ['BCG', ['boston consulting group', 'boston consulting'], 'https://careers.bcg.com/', 'consulting'],
    ['Bain', ['bain & company', 'bain and company'], 'https://www.bain.com/careers/', 'consulting', true]
];

// ---------- matching ----------
const FILLER = new Set(['job', 'jobs', 'career', 'careers', 'hiring', 'opening', 'openings', 'vacancy', 'vacancies', 'internship', 'internships', 'intern', 'interns', 'fresher', 'freshers', 'recruitment', 'recruiting', 'apply', 'official', 'at', 'in', 'for', 'work', 'working', 'with', 'india', 'the', 'a', 'of', 'to', '2025', '2026', '2027', 'off', 'campus', 'drive', 'walkin', 'walk']);
const norm = s => String(s ?? '').toLowerCase().replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, ' ').trim().replace(/\s+/g, ' ');
// Edit distance with a cutoff of 1 (covers one typo: "gogle", "microsft", "infosis").
const near = (a, b) => {
    if (a === b) {
        return true;
    }
    if (Math.abs(a.length - b.length) > 1) {
        return false;
    }
    let i = 0, j = 0, edits = 0;
    while (i < a.length && j < b.length) {
        if (a[i] === b[j]) {
            i++;
            j++;
        } else {
            if (++edits > 1) {
                return false;
            }
            if (a.length > b.length) {
                i++;
            } else if (a.length < b.length) {
                j++;
            } else {
                i++;
                j++;
            }
        }
    }
    return edits + (a.length - i) + (b.length - j) <= 1;
};
const INDEX = COMPANIES.map(([name, aliases, url, kind, ambiguous]) => ({
    name, url, kind, ambiguous: !!ambiguous, names: [name, ...aliases].map(norm).filter(Boolean)
}));
const MAX_EXTRA = 3; // extra words allowed after the company name ("google software engineer intern")

export function companyFor(query) {
    const words = norm(query).split(' ').filter(Boolean);
    if (!words.length || words.length > 8) {
        return null;
    }
    const kept = words.filter(w => !FILLER.has(w));
    const hadFiller = kept.length < words.length;
    const rest = kept.join(' ');
    if (!rest) {
        return null;
    }
    let best = null;
    for (const c of INDEX) {
        for (const n of c.names) {
            const nw = n.split(' ');
            const head = kept.slice(0, nw.length).join(' ');
            const exact = rest === n;
            const prefix = !exact && head === n && kept.length - nw.length <= MAX_EXTRA;
            // one typo, only for a single long word on its own ("microsft"); short names would clash with real words
            const typo = !exact && !prefix && nw.length === 1 && n.length >= 6 && kept.length === 1 && near(rest, n);
            if (!(exact || prefix || typo)) {
                continue;
            }
            if (c.ambiguous && !(exact || hadFiller)) {
                continue; // "apple pie recipes", "oracle database developer" must not trigger it
            }
            const score = (exact ? 3 : prefix ? 2 : 1) * 100 + n.length;
            if (!best || score > best.score) {
                best = { c, score };
            }
        }
    }
    return best ? best.c : null;
}

// Does Fyndr already list real openings from this company? Course providers and job-board search links (orgId 'catalog') do not count.
const sameOrg = (c, orgName) => {
    const o = norm(orgName);
    return !!o && c.names.some(n => o === n || o.startsWith(n + ' '));
};
export const isListed = (c, rows) => (rows || []).some(l => l && l.type !== 'Course' && l.orgId !== 'catalog' && sameOrg(c, l.orgName));

// Only ever link to an https address from the list above.
const safe = u => (/^https:\/\/[a-z0-9.-]+\.[a-z]{2,}(\/[^\s"'<>]*)?$/i.test(u) ? u : '');
const host = u => {
    try {
        return new URL(u).hostname.replace(/^www\./, '');
    } catch {
        return '';
    }
};
const OUT = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14 5h5v5M19 5l-8 8M18 14v4a1.5 1.5 0 0 1-1.5 1.5h-9A1.5 1.5 0 0 1 6 18V9.5A1.5 1.5 0 0 1 7.5 8H10"/></svg>';
const KIND = {
    tech: 'Big tech companies list every opening on their own site.',
    it: 'Large IT companies hire through their own portal, including campus and fresher drives.',
    finance: 'Banks and financial firms take applications only on their own careers site.',
    consulting: 'Consulting firms take applications only on their own careers site.'
};
const esc = s => String(s ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));

// The card, drawn as the first item of the results ("opening post"). `mono` is the coloured letter logo from banner.js.
export function careersCard(c, mono) {
    const url = safe(c.url);
    if (!url) {
        return '';
    }
    return `<article class="careers-card" aria-label="${esc(c.name)} jobs are not listed on Fyndr">
<div class="cc-logo">${mono ? mono(c.name) : ''}</div>
<div class="cc-body">
<p class="cc-tag">Not listed on Fyndr</p>
<h3>${esc(c.name)} jobs are not posted here</h3>
<p class="cc-text">${esc(c.name)} does not post openings on Fyndr. Its current jobs and internships are on its own careers page. ${KIND[c.kind] || ''}</p>
<div class="cc-acts"><a class="button button-dark button-small" href="${esc(url)}" target="_blank" rel="noopener noreferrer nofollow">See ${esc(c.name)} careers<span class="cc-ico">${OUT}</span></a><span class="cc-host">Opens ${esc(host(url))} in a new tab</span></div>
<p class="cc-safe">Apply only on the company's own site. A real employer never asks for a fee, an OTP or your ID to apply.</p>
</div></article>`;
}

// Whole thing for the results list: '' when there is nothing to say.
export function careersNotice(query, rows, mono) {
    const c = companyFor(query);
    return c && !isListed(c, rows) ? careersCard(c, mono) : '';
}

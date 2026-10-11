// Trust score for a listing (0-100) from simple, visible rules. No AI, nothing leaves the device/script.
// 50 or more: published automatically. Under 50: waits in the admin review queue. A "scam" hit is never published or queued.
export const TRUST_MIN = 50;
const T = v => String(v || '');
const RULES = [
    // [test, points, reason, scam?]
    [t => /(registration|processing|training|security|joining|application|refundable)\s*(fee|deposit|charges?)|pay\s+(a\s+)?(fee|deposit)|send\s+(us\s+)?money|deposit\s+required/i.test(t), -70, 'Asks the applicant to pay money', true],
    [t => /(aadhaar|aadhar|pan\s*card|passport|bank\s*(account|details)|card\s*number|otp|cvv|ssn)\b.{0,40}(send|share|submit|required|provide)|(send|share|submit|provide).{0,40}(aadhaar|aadhar|pan\s*card|passport|bank\s*(account|details)|card\s*number|otp|cvv|ssn)/i.test(t), -70, 'Asks for ID, bank or OTP details up front', true],
    [t => /whatsapp|telegram|wa\.me|t\.me\//i.test(t), -30, 'Hiring through WhatsApp or Telegram'],
    [t => /earn\s+(rs\.?|inr|\$)?\s*\d[\d,]*\s*(per|a|\/)\s*(day|week)|guaranteed\s+(income|job|placement)|no\s+experience\s+needed.{0,40}(earn|income)|work\s+from\s+home.{0,30}(earn|income)/i.test(t), -25, 'Unrealistic earnings promise'],
    [t => /@(gmail|yahoo|outlook|hotmail|rediffmail)\./i.test(t), -15, 'Contact is a free email address'],
    [t => !/^https:\/\//i.test(t), 0, '']
];
export function trustScore(l) {
    const text = [l.title, l.description, l.pay, l.location, l.orgName].map(T).join(' \n ');
    let score = 60;
    const reasons = [];
    let scam = false;
    for (const [test, pts, why, isScam] of RULES.slice(0, 5)) {
        if (test(text)) {
            score += pts;
            reasons.push(why);
            scam = scam || !!isScam;
        }
    }
    const org = T(l.orgName).trim();
    if (!org || /^(confidential|hidden|company|private|anonymous|n\/a)$/i.test(org)) {
        score -= 25;
        reasons.push('Employer name is hidden');
    }
    const d = T(l.description).trim();
    if (d.length < 80) {
        score -= 15;
        reasons.push('Very little description');
    } else if (d.length > 400) {
        score += 8;
    }
    if (l.applyUrl) {
        if (/^https:\/\//i.test(l.applyUrl)) {
            score += 10;
        } else {
            score -= 25;
            reasons.push('Apply link is not secure (https)');
        }
        try {
            const h = new URL(l.applyUrl).hostname.replace(/^www\./, '');
            const tok = org.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 5);
            const known = /(greenhouse\.io|lever\.co|ashbyhq\.com|workable\.com|smartrecruiters\.com)$/.test(h);
            if (known || (tok && h.replace(/[^a-z0-9]/g, '').includes(tok))) {
                score += 12;
            } else {
                reasons.push('Apply link does not match the employer name');
                score -= 8;
            }
        } catch {
            score -= 25;
            reasons.push('Apply link is not a valid address');
        }
    }
    if (['api', 'greenhouse', 'lever', 'catalog'].includes(l.origin || l.source)) {
        score += 8;
    }
    score = Math.max(0, Math.min(100, Math.round(score)));
    return { score, reasons, scam };
}
// 'approved' (publish), 'pending' (admin review) or 'hidden' (obvious scam, not stored in the queue).
export const decide = r => r.scam ? 'hidden' : r.score >= TRUST_MIN ? 'approved' : 'pending';

// The legitimacy rating shown to everyone: the stored score (imports) or one worked out from the listing's own text, and a plain word for it.
export function rating(l) {
    const t = l && l.trust != null ? { score: Number(l.trust) || 0, reasons: l.trustReasons || [] } : trustScore(l || {});
    const band = t.score >= 75 ? 'strong' : t.score >= TRUST_MIN ? 'good' : 'low';
    return { score: t.score, band, label: { strong: 'Looks legit', good: 'Probably legit', low: 'Check carefully' }[band], reasons: t.reasons };
}

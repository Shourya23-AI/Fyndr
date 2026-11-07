// "Where do I stand?" for ONE candidate, built from what the suggestions engine already found (engine.js suggestFor()).
// Pure functions: no DOM, no network, no AI. The aim is honest confidence: say what is already strong, how close the best roles are,
// and the single most useful thing to learn next. It never invents a skill and never flatters: a weak match is called weak.
const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;
const list = a => (a.length < 2 ? a.join('') : a.slice(0, -1).join(', ') + ' and ' + a[a.length - 1]);

// Profile details that make matching better (only the ones that are missing are returned).
export function profileTips(p = {}) {
    const tips = [];
    const skills = Array.isArray(p.skills) ? p.skills : [];
    if (skills.length < 5) {
        tips.push(`Add more skills (you have ${skills.length}). Each skill you add can unlock more matches.`);
    }
    if (!String(p.locations || '').trim()) {
        tips.push('Add the cities you would work in, or "Remote", so places match too.');
    }
    if (!Array.isArray(p.jobTypes) || !p.jobTypes.length) {
        tips.push('Say whether you want jobs, internships or both.');
    }
    if (!String(p.projects || '').trim()) {
        tips.push('Describe a project or two. Skills mentioned there count towards your matches as well.');
    }
    if (!String(p.headline || '').trim()) {
        tips.push('Write a one-line headline, for example "Final-year CS student interested in data".');
    }
    return tips;
}

// r = suggestFor(profile, listings, { limit: 200 ... }). Returns everything the "For you" page shows.
export function confidenceOf(profile, r) {
    const out = { ready: !!(r && r.ready), counts: { strong: 0, good: 0, possible: 0 }, level: 'building', headline: '', sub: '', strengths: [], closest: null, next: null, steps: [], tips: profileTips(profile) };
    const picks = r && r.picks ? r.picks : [];
    picks.forEach(x => out.counts[x.m.band]++);
    const { strong, good, possible } = out.counts;
    if (strong) {
        out.level = 'strong';
        out.headline = `You are a strong match for ${plural(strong, 'open role', 'open roles')} right now.`;
        out.sub = 'That means you already have most of the skills they ask for and the level fits. Apply with confidence.';
    } else if (good) {
        out.level = 'good';
        out.headline = `You are a good match for ${plural(good, 'open role', 'open roles')}, and close to strong.`;
        out.sub = 'You have a solid base. A few more skills would move these up. Your next steps are below.';
    } else if (possible) {
        out.level = 'building';
        out.headline = `${plural(possible, 'role', 'roles')} could work for you today.`;
        out.sub = 'You are building up. The skills below are what would open better matches the fastest.';
    } else {
        out.headline = 'Let us build your matches.';
        out.sub = 'Nothing fits strongly yet. Add skills and projects to your profile and follow the learning steps below.';
    }
    // Strengths: skills the person HAS that the best-matching roles keep asking for.
    const top = picks.filter(x => x.m.score >= 50);
    const count = new Map();
    (top.length ? top : picks).forEach(x => x.m.matched.forEach(s => count.set(s, (count.get(s) || 0) + 1)));
    out.strengths = [...count].map(([label, n]) => ({ label, count: n })).sort((a, b) => b.count - a.count || a.label.localeCompare(b.label)).slice(0, 6);
    // Closest to ready: a good-or-better role where only a few skills are missing (none missing = ready now).
    const near = picks.filter(x => x.m.score >= 45 && x.m.band !== 'possible')
        .sort((a, b) => a.m.missing.length - b.m.missing.length || b.m.score - a.m.score)[0];
    if (near) {
        const n = near.m.missing.length;
        out.closest = {
            l: near.l, m: near.m, missing: near.m.missing.slice(0, 3),
            text: n === 0 ? 'You already have every skill this one lists. This is the one to apply for first.' : `You only need ${list(near.m.missing.slice(0, 3))} to be ready for this one.`
        };
    }
    // Learning steps: asked for by the most of their closest matches first; among equals, the ones that already have a course come first.
    out.steps = [...((r && r.unlock) || [])].sort((a, b) => b.count - a.count || (b.courses.length > 0) - (a.courses.length > 0));
    const u = out.steps[0];
    if (u) {
        out.next = { label: u.label, count: u.count, text: `Learn ${u.label}: ${u.count === 1 ? 'one' : u.count} of your closest matches ask${u.count === 1 ? 's' : ''} for it.`, courses: u.courses || [] };
    }
    return out;
}

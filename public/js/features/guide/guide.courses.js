// Part 2 of the career guide: turns the skills a person still needs into an ordered course plan.
// Courses come from the built-in catalog (features/catalog), matched by skill (the catalog topic's title and skill tags are read with the
// same skill dictionary the rest of Fyndr uses, so "Node.js" finds "Node.js" and "REST API Design" finds REST APIs).
// HONEST NOTE: catalog courses are search links. Each button opens that learning site's own search for the topic, and Fyndr has not
// checked the individual courses there. The plan says so on screen.
import { extractSkills, skillLabel } from '../suggestions/engine.js';
import { providerLinks } from '../catalog/meta.js';
import { learnOrder } from './guide.engine.js';

export const MAX_STEPS = 6; // a plan longer than this stops being a plan
// listings from the catalog -> the courses only, each with the skills its title and tags mention
export const indexCourses = list => (list || []).filter(l => l && l.type === 'Course').map(c => ({
    c, title: String(c.title).toLowerCase(), keys: new Set(extractSkills(c.title + ' ' + (c.skills || []).join(' ')))
}));

// The best courses for one skill (an item from assess()), most useful first. `used` holds ids already put in the plan, so one broad
// course ("Full Stack Web Development") is not repeated under every step.
export function pickCourses(index, item, used = new Set(), n = 2) {
    const keys = [item.key, ...item.keys.filter(k => k !== item.key)];
    const name = skillLabel(item.key).toLowerCase();
    const scored = index.map(x => {
        const at = keys.findIndex(k => x.keys.has(k));
        if (at < 0) {
            return null;
        }
        let s = 10 - at;
        if (x.title === name || x.title.startsWith(name)) {
            s += 6; // the course is about this skill, not just mentioning it
        }
        s += (x.c.allFree ? 3 : x.c.free ? 2 : 0) - (x.c.level === 'p' ? 3 : 0) - (used.has(x.c.id) ? 8 : 0);
        return { c: x.c, s };
    }).filter(Boolean).sort((a, b) => b.s - a.s);
    return scored.slice(0, n).map(x => x.c);
}

// No catalog topic for a skill: still give the person somewhere to start, as links to the learning sites' own searches (free ones first).
const ORDER = { free: 0, 'free to start': 1, paid: 2 };
export const searchLinks = label => providerLinks(label + ' course').sort((a, b) => ORDER[a[1]] - ORDER[b[1]]).slice(0, 4).map(([n, kind, u]) => ({ n, u, kind }));

// assessment -> { steps: [{ item, courses: [], search: [] }], more } (core skills first, foundations first, at most MAX_STEPS)
export function buildPlan(index, a) {
    const todo = learnOrder(a);
    const used = new Set();
    const steps = todo.slice(0, MAX_STEPS).map(item => {
        const courses = pickCourses(index, item, used);
        courses.forEach(c => used.add(c.id));
        return { item, courses, search: courses.length ? [] : searchLinks(skillLabel(item.key)) };
    });
    return { steps, more: Math.max(0, todo.length - steps.length) };
}

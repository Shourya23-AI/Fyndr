// Browser-only database: one JSON blob in localStorage (testing only, nothing is shared between users or devices).
export const KEY = 'fyndr-db';
export const uid = () => Math.random().toString(36).slice(2, 14);
export const now = () => new Date().toISOString();
export const bad = (m, code) => {
    throw Object.assign(new Error(m), { code });
};
function seed() {
    const L = (title, type, location, pay, description) => ({
        id: uid(), orgId: 'seed-org', orgName: 'Linear', title, type, location, pay, description, status: 'approved', created: now()
    });
    return {
        users: [{
                id: 'seed-org', name: 'Linear HR', email: '', role: 'org', orgName: 'Linear', verified: true, created: now()
            }], applications: [], saved: [], listings: [
            L('Product Design Intern', 'Internship', 'Remote · Worldwide', '$2,000–$3,000 / month', 'Work with our design team on real product features.'),
            L('Junior Frontend Developer', 'Job', 'New York, NY · Hybrid', '$75K–$95K / year', 'Build and ship UI with React and TypeScript.'),
            L('Data Analytics Certificate', 'Course', 'Online · Self-paced', '$14 / month', 'Learn SQL, spreadsheets and dashboards.')
        ]
    };
}
export const db = JSON.parse(localStorage.getItem(KEY) || 'null') || seed();
export const save = () => localStorage.setItem(KEY, JSON.stringify(db));

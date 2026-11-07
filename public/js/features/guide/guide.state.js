// What the career guide remembers for this browser tab (sessionStorage: gone when the tab closes, never sent anywhere).
// Part 2 (courses) and Part 3 (books and the plan) read the same record, so they know the dream job and the answers without asking again.
//   { roleId, answers: { qualification, field, experience, skills: [] } | null, at }
// answers is only kept for visitors who answered in the chat. For signed-in students the guide reads the profile itself.
const KEY = 'fyGuide';
export function readGuide() {
    try {
        const v = JSON.parse(sessionStorage.getItem(KEY) || 'null');
        return v && typeof v === 'object' ? v : {};
    } catch {
        return {};
    }
}
export function saveGuide(patch) {
    try {
        sessionStorage.setItem(KEY, JSON.stringify({ ...readGuide(), ...patch, at: Date.now() }));
    } catch { }
}
export function clearGuide() {
    try {
        sessionStorage.removeItem(KEY);
    } catch { }
}

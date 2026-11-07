// "Edit your profile": what the Basic info card may save (name, headline, about). Pure functions, no DOM and no network.
// Shared by the browser (profile.actions.js, fire-api.js) and the Node server (server/routes/profile.routes.js loads this file).
export const NAME_MIN = 2;
export const NAME_MAX = 80;
export const HEADLINE_MAX = 100;
export const ABOUT_MAX = 500;
// One line: control characters and < > become spaces, runs of spaces collapse.
const line = (v, n, strip = /[\u0000-\u001f\u007f]+/g) => String(v ?? '').replace(strip, ' ').replace(/\s+/g, ' ').trim().slice(0, n);
// Several lines allowed (the "about" box): keeps single line breaks, drops other control characters.
const para = (v, n) => String(v ?? '').replace(/\r\n?/g, '\n').replace(/[\u0000-\u0009\u000b-\u001f\u007f]+/g, ' ').replace(/[ \t]+/g, ' ').replace(/ ?\n ?/g, '\n').replace(/\n{3,}/g, '\n\n').trim().slice(0, n);
// -> { ok: true, name, headline, about } or { ok: false, error } (the error is written for the person to read).
export function cleanBasics(b) {
    b = b && typeof b === 'object' ? b : {};
    const name = line(b.name, NAME_MAX, /[\u0000-\u001f\u007f<>]+/g);
    if (name.length < NAME_MIN || !/\p{L}/u.test(name)) {
        return { ok: false, error: `Enter your name (at least ${NAME_MIN} characters, with letters)` };
    }
    return { ok: true, name, headline: line(b.headline, HEADLINE_MAX), about: para(b.summary ?? b.about, ABOUT_MAX) };
}

import { openSide, closeSide, sideOpen } from './sidebar.js';
// Click actions for the page chrome (header / footer / phone sidebar).
export const actions = {
    theme() {
        const t = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
        document.documentElement.dataset.theme = t;
        localStorage.theme = t;
    },
    menu() {
        sideOpen() ? closeSide(true) : openSide();
    },
    sideclose() {
        closeSide(false);
    }
};
export function bind() {
    addEventListener('keydown', e => {
        if (e.key === 'Escape' && sideOpen()) {
            closeSide(true);
        }
    });
    addEventListener('hashchange', () => closeSide(false));
    addEventListener('resize', () => innerWidth > 800 && closeSide(false));
}

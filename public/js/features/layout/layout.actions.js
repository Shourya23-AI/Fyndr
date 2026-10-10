// Click actions for the page chrome (header / footer).
export const actions = {
    theme() {
        const t = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
        document.documentElement.dataset.theme = t;
        localStorage.theme = t;
    }
};

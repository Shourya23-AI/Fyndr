import { openCard, closeCard } from './account-menu.view.js';
// Click your name -> details card. Closes on outside click, Esc, page change, or any link inside it.
export const bind = () => {
    document.addEventListener('click', e => {
        if (!e.target.closest('.me-wrap')) {
            closeCard();
        }
    });
    addEventListener('keydown', e => {
        if (e.key === 'Escape') {
            closeCard();
        }
    });
    addEventListener('hashchange', closeCard);
};
export const actions = {
    me(b) {
        document.getElementById('mecard') ? closeCard() : openCard(b);
    },
    mecloseonly() {
        closeCard();
    }
};

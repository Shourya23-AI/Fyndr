import { S } from '../../core/state.js';
import { toast } from '../../core/dom.js';
import { openAuth } from '../auth/auth-modal.js';
import { toggleBook, syncBookHearts } from './liked.data.js';
import { likedView, drawLiked } from './liked.view.js';
// data-act handlers for hearts on books and for the Liked page.
export const actions = {
    async booklike(b, id) {
        if (!S.me) {
            return openAuth('signin');
        }
        const book = S.books && S.books[id];
        if (!book) {
            return;
        }
        b.disabled = true;
        try {
            const r = await toggleBook(book);
            toast(r.liked ? 'Added to Liked' : 'Removed from Liked');
        } finally {
            b.disabled = false;
        }
        syncBookHearts();
        if (location.hash.startsWith('#/liked')) {
            drawLiked();
        }
    },
    likedtab(b, id) {
        S.lk.tab = id;
        drawLiked();
    },
    likedretry() {
        return likedView();
    }
};

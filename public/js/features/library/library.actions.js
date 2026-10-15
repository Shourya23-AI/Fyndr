import { libraryView, go, current, more, rerun, live, warm, openReader, closeReader, readerOpen, openDetails, closeSheet, sheetOpen } from './library.js';
// data-act handlers for the Library page. (No inline onerror/onclick anywhere: the page's security policy may one day forbid inline script.)
export const actions = {
    readbook(b, id) {
        openReader(id);
    },
    bookinfo(b, id) {
        openDetails(id);
    },
    closesheet() {
        closeSheet();
    },
    closereader() {
        closeReader();
    },
    libmore() {
        more();
    },
    libcat(b, id) {
        const { cat, free } = current();
        go({ cat: cat === id ? '' : id, free }); // a topic replaces the typed search
    },
    libfree(b) {
        const { q, cat } = current();
        go({ q, cat, free: b.checked });
    },
    libdym(b, id) {
        go({ q: String(id || ''), free: current().free });
    },
    libretry() {
        rerun();
    }
};
export const forms = {
    libsearch(d) {
        go({ q: String(d.q || '').trim().slice(0, 120), free: current().free });
    }
};
let typing;
export function bind() {
    // Type in the Library search box and the books follow after a short pause (no need to press Search).
    document.addEventListener('input', e => {
        const t = e.target;
        if (t && t.matches && t.matches('[data-form=libsearch] input[name=q]')) {
            clearTimeout(typing);
            typing = setTimeout(() => live(t.value), 180);
        }
    });
    // Hovering or touching the Library link starts loading the popular shelf, so the page opens already full.
    let warmed = false;
    const early = e => {
        if (!warmed && e.target.closest && e.target.closest('a[data-r=library]')) {
            warmed = true;
            warm();
        }
    };
    document.addEventListener('pointerover', early);
    document.addEventListener('touchstart', early, { passive: true });
    // Esc closes the reader, or the book details.
    addEventListener('keydown', e => {
        if (e.key === 'Escape' && readerOpen()) {
            closeReader();
        } else if (e.key === 'Escape' && sheetOpen()) {
            closeSheet();
        }
    });
    // A book cover that cannot load is removed, which shows the coloured title tile that sits behind it.
    document.addEventListener('error', e => {
        const t = e.target;
        if (t && t.tagName === 'IMG' && t.closest && t.closest('.bk-cover')) {
            t.remove();
        }
    }, true);
}
export { libraryView };

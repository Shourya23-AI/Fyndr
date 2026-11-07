// "Show more" buttons press themselves when they scroll near the screen, so jobs, courses and books keep coming as you scroll.
// The button stays on the page as a fallback (and for people who prefer to press it).
const MORE = '.more > button[data-act="more"], .more > button[data-act="libmore"]';
export function initAutoload() {
    if (typeof IntersectionObserver === 'undefined') {
        return;
    }
    const seen = new WeakSet();
    const io = new IntersectionObserver(entries => {
        for (const e of entries) {
            if (e.isIntersecting && e.target.isConnected) {
                io.unobserve(e.target);
                e.target.click();
            }
        }
    }, { rootMargin: '900px 0px' });
    const scan = () => document.querySelectorAll(MORE).forEach(b => {
        if (!seen.has(b)) {
            seen.add(b);
            io.observe(b);
        }
    });
    const app = document.getElementById('app');
    if (app) {
        new MutationObserver(scan).observe(app, { childList: true, subtree: true });
    }
    scan();
}

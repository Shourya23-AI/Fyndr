// Scroll reveal: cards, panels and headings fade and rise into place as they scroll into view.
// Elements get the .rv class from here (so with JavaScript off, or reduced motion on, nothing is ever hidden).
// Dashboards are skipped: they redraw themselves every minute and must not flicker.
const SEL = '.lcard,.panel,.benefits>div,.how h2,.how .row,.stat,.specimen,.org-hero>*,.hero h1,.hero .lead,.hero .search-box,.hero .cta,.sugg,.page>h2,.page>.desc,.tabs,.legal>*,.privacy>*,.empty';
const SKIP = '.sk-page,.sk-dash,.sk-center,.sk,#authModal,.dash-layout,.phone-page';
export function initReveal() {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches || !('IntersectionObserver' in window)) {
        return;
    }
    const done = el => setTimeout(() => {
        el.classList.remove('rv', 'rv-in');
        el.style.removeProperty('--rv-d');
    }, 1100); // afterwards the element's normal hover/transition styles apply again
    const io = new IntersectionObserver(es => es.forEach(e => {
        if (e.isIntersecting) {
            e.target.classList.add('rv-in');
            io.unobserve(e.target);
            done(e.target);
        }
    }), { threshold: 0.06, rootMargin: '0px 0px -5% 0px' });
    const app = document.getElementById('app');
    const scan = () => {
        if (location.hash.startsWith('#/dashboard')) {
            return;
        }
        app.querySelectorAll(SEL).forEach(el => {
            if (el.dataset.rv || el.closest(SKIP)) {
                return;
            }
            el.dataset.rv = '1';
            el.style.setProperty('--rv-d', Math.min([...el.parentElement.children].indexOf(el), 8) * 60 + 'ms');
            el.classList.add('rv');
            io.observe(el);
        });
        // safety net: never leave anything hidden if the observer does not fire
        setTimeout(() => app.querySelectorAll('.rv:not(.rv-in)').forEach(el => {
            if (el.getBoundingClientRect().top < innerHeight) {
                el.classList.add('rv-in');
                done(el);
            }
        }), 2500);
    };
    let t;
    new MutationObserver(() => {
        clearTimeout(t);
        t = setTimeout(scan, 30);
    }).observe(app, { childList: true, subtree: true });
    scan();
}

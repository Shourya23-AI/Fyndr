// Motion helpers: header on scroll, scroll progress, press feedback, landing counters + hero parallax.
// Everything respects "reduce motion" and only animates transform/opacity.
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
let started = false;
export function initMotion() {
    if (started) { return; }
    started = true;
    const hdr = document.querySelector('.site-header');
    const bar = document.createElement('div');
    bar.className = 'fy-progress';
    bar.setAttribute('aria-hidden', 'true');
    document.body.appendChild(bar);
    let tick = false;
    const onScroll = () => {
        if (tick) { return; }
        tick = true;
        requestAnimationFrame(() => {
            const y = scrollY, h = document.documentElement.scrollHeight - innerHeight;
            hdr && hdr.classList.toggle('is-scrolled', y > 8);
            bar.style.transform = `scaleX(${h > 0 ? Math.min(1, y / h) : 0})`;
            tick = false;
        });
    };
    addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    // Tactile press feedback on any button-like element
    document.addEventListener('pointerdown', e => {
        const b = e.target.closest('.button,.btn-primary,.btn-line,.gbtn,.lp-cats button,.icon-btn');
        if (!b || reduce) { return; }
        b.classList.add('is-pressed');
        setTimeout(() => b.classList.remove('is-pressed'), 180);
    }, { passive: true });
    // Page-change motion: re-trigger the entrance on every route
    // Instant jump to the top (a smooth scroll over a long list feels like lag), then the new page fades in once.
    const app = document.getElementById('app');
    let fresh = false;
    addEventListener('hashchange', () => { scrollTo({ top: 0, behavior: 'auto' }); fresh = true; });
    if (app && !reduce) {
        new MutationObserver(() => {
            if (!fresh) { return; }
            fresh = false; // the first thing drawn for a new page (placeholder or content) fades in; later redraws of the same page do not
            app.classList.remove('fy-enter');
            void app.offsetWidth;
            app.classList.add('fy-enter');
        }).observe(app, { childList: true });
        app.addEventListener('animationend', e => { e.target === app && app.classList.remove('fy-enter'); });
    }
}
export function landingMotion() {
    initMotion();
    const root = document.querySelector('.lp');
    if (!root) { return; }
    requestAnimationFrame(() => root.classList.add('lp-ready'));
    if (reduce) { return; }
    // Count-up numbers when they scroll into view
    const io = new IntersectionObserver(es => es.forEach(e => {
        if (!e.isIntersecting) { return; }
        io.unobserve(e.target);
        const el = e.target, to = +el.dataset.count, suf = el.dataset.suf || '', t0 = performance.now(), dur = 1400;
        const step = t => {
            const p = Math.min(1, (t - t0) / dur), v = Math.round(to * (1 - Math.pow(1 - p, 3)));
            el.textContent = v.toLocaleString('en-US') + (p === 1 ? suf : '');
            p < 1 && requestAnimationFrame(step);
        };
        requestAnimationFrame(step);
    }), { threshold: 0.6 });
    root.querySelectorAll('[data-count]').forEach(el => io.observe(el));
    // Gentle hero parallax (desktop pointers only)
    const vis = root.querySelector('.lp-visual');
    if (vis && matchMedia('(hover:hover) and (pointer:fine)').matches) {
        vis.addEventListener('pointermove', e => {
            const r = vis.getBoundingClientRect(), x = (e.clientX - r.left) / r.width - .5, y = (e.clientY - r.top) / r.height - .5;
            vis.style.setProperty('--px', (x * 14).toFixed(1) + 'px');
            vis.style.setProperty('--py', (y * 10).toFixed(1) + 'px');
        });
        vis.addEventListener('pointerleave', () => { vis.style.setProperty('--px', '0px'); vis.style.setProperty('--py', '0px'); });
    }
}

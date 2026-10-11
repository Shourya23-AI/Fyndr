// Joins every stylesheet into ONE file (public/css/app.css): 1 request instead of ~28.
// Runs automatically when the server starts (only rewrites the file if a source changed).
// Manual run after editing CSS in Live Server mode:  node scripts/bundle-css.js
const fs = require('fs');
const path = require('path');
const CSS = path.join(__dirname, '..', 'public', 'css');
// Order matters (later files win). dark.css must stay last.
const ORDER = [
    'base/theme.css', 'base/reset.css',
    'components/logo.css', 'components/buttons.css', 'components/forms.css', 'components/panel.css', 'components/table.css', 'components/tags.css', 'components/hero.css', 'components/how-it-works.css', 'components/toast.css', 'components/install.css', 'components/skeleton.css', 'components/reveal.css',
    'layout/header.css', 'layout/footer.css', 'layout/account-menu.css',
    'pages/home.css', 'pages/browse.css', 'pages/organizations.css', 'pages/dashboard.css', 'pages/profile.css', 'pages/proof.css', 'pages/phone.css', 'pages/auth.css', 'pages/legal.css', 'pages/privacy.css', 'pages/apply.css',
    'components/banner.css',
    'base/dark.css'
];
const mini = s => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\s+/g, ' ').replace(/\s*([{};,>])\s*/g, '$1').replace(/;}/g, '}').trim();
module.exports = function bundle() {
    const out = path.join(CSS, 'app.css');
    const srcs = ORDER.map(f => path.join(CSS, f));
    const newest = Math.max(...srcs.map(f => fs.statSync(f).mtimeMs));
    if (fs.existsSync(out) && fs.statSync(out).mtimeMs >= newest) {
        return false;
    }
    fs.writeFileSync(out, srcs.map(f => mini(fs.readFileSync(f, 'utf8'))).join('\n'));
    return true;
};
if (require.main === module) {
    // force rebuild when run by hand
    try {
        fs.unlinkSync(path.join(CSS, 'app.css'));
    } catch { }
    module.exports();
    console.log('public/css/app.css written');
}

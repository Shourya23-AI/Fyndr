// The automatic legitimacy check (0-100) is the same file the browser uses (public/js/features/trust/trust.js).
// It is an ES module, so the server loads it once with a dynamic import.
const path = require('path');
const { pathToFileURL } = require('url');
let mod;
module.exports = async function score(listing) {
    mod = mod || await import(pathToFileURL(path.join(__dirname, '..', '..', 'public', 'js', 'features', 'trust', 'trust.js')).href);
    const t = mod.trustScore(listing);
    return { trust: t.score, trustReasons: t.reasons };
};

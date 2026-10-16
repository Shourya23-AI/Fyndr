// Same expiry rule as the browser (public/js/features/listings/expiry.js): an ES module, so it is loaded once with a dynamic import.
const path = require('path');
const { pathToFileURL } = require('url');
let mod;
module.exports = async function isExpiredFn() {
    mod = mod || await import(pathToFileURL(path.join(__dirname, '..', '..', 'public', 'js', 'features', 'listings', 'expiry.js')).href);
    return mod.isExpired;
};

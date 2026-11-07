// Tiny route table: R(method, path, allowedRoles, handler). roles: null = public, 'fb' = any signed-in Firebase user, [..] = app roles.
const bad = (c, m, k) => {
    throw {
        c, m, k
    };
};
const routes = [];
const R = (m, p, roles, fn) => routes.push({
    m, roles, fn, re: new RegExp('^' + p.replace(/:\w+/g, '([^/]+)') + '$')
});
const need = (b, ...k) => k.forEach(x => {
    if (!String(b[x] || '').trim()) {
        bad(400, `${x} is required`);
    }
});
module.exports = {
    routes, R, bad, need
};

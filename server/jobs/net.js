// Safe downloader used by the brand finder (logos and cover pictures).
// The addresses it fetches come from OTHER people's web pages (an og:image tag, a favicon link, a redirect), so it must never be
// tricked into calling something inside your own network (SSRF). Rules, all enforced here:
//   - https only, default port only, no user:password in the address
//   - the address is checked when the connection is made (not only before), so DNS tricks cannot swap in a private address
//   - private, loopback, link-local and other internal addresses are refused (IPv4 and IPv6)
//   - redirects are followed by hand (max 4) and every hop is checked again
//   - size limit (also after decompression), time limit, no cookies
const https = require('https');
const dns = require('dns');
const net = require('net');
const zlib = require('zlib');

const UA = 'FyndrBot/1.0 (+job listing aggregator; respects robots.txt)';

const isPrivateIp = raw => {
    const ip = String(raw || '').toLowerCase();
    if (net.isIPv4(ip)) {
        const [a, b, c] = ip.split('.').map(Number);
        return a === 0 || a === 10 || a === 127 || (a === 100 && b >= 64 && b <= 127) || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31)
            || (a === 192 && b === 0 && c === 0) || (a === 192 && b === 168) || (a === 198 && (b === 18 || b === 19)) || a >= 224;
    }
    if (net.isIPv6(ip)) {
        const dotted = ip.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
        if (dotted) {
            return isPrivateIp(dotted[1]);
        }
        const hex = ip.match(/^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/);
        if (hex) {
            const x = parseInt(hex[1], 16);
            const y = parseInt(hex[2], 16);
            return isPrivateIp([x >> 8, x & 255, y >> 8, y & 255].join('.'));
        }
        return ip === '::' || ip === '::1' || /^f[cd]/.test(ip) || /^fe[89ab]/.test(ip) || /^ff/.test(ip) || /^64:ff9b:/.test(ip);
    }
    return true; // not an IP address at all: refuse
};

// Used by https.request as `lookup`: resolves the name, drops internal addresses, refuses when nothing public is left.
const safeLookup = (host, opts, cb) => {
    dns.lookup(host, { ...(typeof opts === 'object' ? opts : {}), all: true }, (err, addrs) => {
        if (err) {
            return cb(err);
        }
        const ok = addrs.filter(a => !isPrivateIp(a.address));
        if (!ok.length) {
            return cb(new Error('blocked address'));
        }
        if (opts && opts.all) {
            return cb(null, ok);
        }
        cb(null, ok[0].address, ok[0].family);
    });
};

function once(url, { maxBytes, accept, timeout }) {
    return new Promise((resolve, reject) => {
        let u;
        try {
            u = new URL(url);
        } catch {
            return reject(new Error('bad address'));
        }
        if (u.protocol !== 'https:' || (u.port && u.port !== '443') || u.username || u.password) {
            return reject(new Error('blocked address'));
        }
        const host = u.hostname.replace(/^\[|\]$/g, '');
        if (net.isIP(host) && isPrivateIp(host)) {
            return reject(new Error('blocked address'));
        }
        let done = false;
        const finish = (fn, v) => {
            if (!done) {
                done = true;
                clearTimeout(deadline);
                fn(v);
            }
        };
        const req = https.request({
            host, port: 443, path: u.pathname + u.search, method: 'GET', lookup: safeLookup, timeout,
            servername: net.isIP(host) ? undefined : host,
            headers: { 'User-Agent': UA, Accept: accept || '*/*', 'Accept-Encoding': 'gzip, deflate, br' }
        }, res => {
            const st = res.statusCode;
            if (st >= 300 && st < 400 && res.headers.location) {
                res.resume();
                let next;
                try {
                    next = new URL(res.headers.location, u).href;
                } catch {
                    return finish(reject, new Error('bad redirect'));
                }
                return finish(resolve, { status: st, redirect: next });
            }
            if (Number(res.headers['content-length']) > maxBytes && !res.headers['content-encoding']) {
                req.destroy();
                return finish(reject, new Error('too large'));
            }
            const enc = String(res.headers['content-encoding'] || '').toLowerCase();
            let stream = res;
            if (enc === 'gzip' || enc === 'x-gzip') {
                stream = res.pipe(zlib.createGunzip());
            } else if (enc === 'deflate') {
                stream = res.pipe(zlib.createInflate());
            } else if (enc === 'br') {
                stream = res.pipe(zlib.createBrotliDecompress());
            }
            const parts = [];
            let n = 0;
            stream.on('data', c => {
                n += c.length;
                if (n > maxBytes) {
                    req.destroy();
                    return finish(reject, new Error('too large'));
                }
                parts.push(c);
            });
            stream.on('end', () => finish(resolve, { status: st, headers: res.headers, body: Buffer.concat(parts) }));
            stream.on('error', e => finish(reject, e));
            res.on('error', e => finish(reject, e));
        });
        const deadline = setTimeout(() => {
            req.destroy();
            finish(reject, new Error('timeout'));
        }, timeout * 2);
        req.on('timeout', () => {
            req.destroy();
            finish(reject, new Error('timeout'));
        });
        req.on('error', e => finish(reject, e));
        req.end();
    });
}

// get(url, { maxBytes, accept, timeout }) -> { url (final address), status, headers, body (Buffer) }
async function get(url, opts = {}) {
    const o = { maxBytes: opts.maxBytes || 1.5e6, accept: opts.accept, timeout: opts.timeout || 10000 };
    let cur = url;
    for (let hop = 0; hop < 5; hop++) {
        const r = await once(cur, o);
        if (!r.redirect) {
            return { url: cur, status: r.status, headers: r.headers, body: r.body };
        }
        cur = r.redirect;
    }
    throw new Error('too many redirects');
}

module.exports = { get, isPrivateIp, UA };

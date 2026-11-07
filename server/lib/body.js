// Reads a request body into one string. Chunks are joined as raw bytes and decoded ONCE: decoding each chunk separately
// breaks characters that straddle a chunk boundary (Hindi, Tamil, emoji...) and silently corrupts them.
module.exports = async function readBody(req, limit, tooBig) {
    const parts = [];
    let size = 0;
    for await (const c of req) {
        size += c.length;
        if (size > limit) {
            tooBig();
        }
        parts.push(c);
    }
    return Buffer.concat(parts).toString('utf8');
};

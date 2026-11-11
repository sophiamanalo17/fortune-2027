const crypto = require('crypto');
const { FORTUNES, redis, visitorKey, json } = require('./_store');

module.exports = async (req, res) => {
  if (req.method !== 'POST') return json(res, 405, { error: 'method not allowed' });
  const key = visitorKey(req);
  const spin = { fortune: FORTUNES[crypto.randomInt(FORTUNES.length)], at: new Date().toISOString() };

  // NX = only set if this visitor has no spin yet, so two quick taps can't both win.
  const created = await redis.set(key, spin, { nx: true });
  if (!created) {
    const prev = await redis.get(key);
    return json(res, 409, { mode: 'ip', already: true, fortune: prev.fortune, at: prev.at });
  }
  json(res, 200, { mode: 'ip', ...spin });
};

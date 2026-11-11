const { redis, visitorKey, json } = require('./_store');

module.exports = async (req, res) => {
  if (req.method !== 'GET') return json(res, 405, { error: 'method not allowed' });
  const spin = await redis.get(visitorKey(req));
  json(res, 200, { mode: 'ip', fortune: spin ? spin.fortune : null, at: spin ? spin.at : null });
};

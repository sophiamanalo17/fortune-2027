// Shared helpers for the Vercel functions. Files starting with "_" are not routes.
// Spins live in Upstash Redis (one key per hashed visitor IP), replacing data/spins.json.
const crypto = require('crypto');
const { Redis } = require('@upstash/redis');

const FORTUNES = ['krill', 'squid', 'seastar', 'fish'];

const redis = new Redis({
  url: process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN,
});

// IPs are stored hashed, never in the clear. Vercel sets x-forwarded-for itself.
function visitorKey(req) {
  const ip = String(req.headers['x-real-ip'] || req.headers['x-forwarded-for'] || '')
    .split(',')[0]
    .trim();
  return 'spin:' + crypto.createHash('sha256').update('fortune-2027:' + ip).digest('hex');
}

function json(res, status, body) {
  res.setHeader('Cache-Control', 'no-store');
  res.status(status).json(body);
}

module.exports = { FORTUNES, redis, visitorKey, json };

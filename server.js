// 2027 fortune — tiny zero-dependency server.
// Serves ./public and remembers one spin per visitor IP in ./data/spins.json.
//
//   node server.js            start on http://localhost:4027
//   PORT=8080 node server.js  use another port
//   TRUST_PROXY=1             read the visitor IP from X-Forwarded-For (set this when hosted behind a proxy)
//   LIMIT_BY=browser          limit once per browser instead of once per IP (no IPs stored)

const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const PORT = Number(process.env.PORT) || 4027;
const PUBLIC_DIR = path.join(__dirname, 'public');
const DATA_DIR = path.join(__dirname, 'data');
const DATA_FILE = path.join(DATA_DIR, 'spins.json');
const LIMIT_BY = process.env.LIMIT_BY === 'browser' ? 'browser' : 'ip';
const TRUST_PROXY = process.env.TRUST_PROXY === '1';
const FORTUNES = ['krill', 'squid', 'seastar', 'fish'];

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.otf': 'font/otf',
  '.ico': 'image/x-icon',
};

function loadSpins() {
  try {
    return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  } catch {
    return {};
  }
}

function saveSpins(spins) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  const tmp = DATA_FILE + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(spins, null, 2));
  fs.renameSync(tmp, DATA_FILE);
}

// IPs are stored hashed, never in the clear.
function visitorKey(req) {
  let ip = req.socket.remoteAddress || '';
  if (TRUST_PROXY && req.headers['x-forwarded-for']) {
    ip = String(req.headers['x-forwarded-for']).split(',')[0].trim();
  }
  ip = ip.replace(/^::ffff:/, '');
  return crypto.createHash('sha256').update('fortune-2027:' + ip).digest('hex');
}

function json(res, status, body) {
  res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(body));
}

function handleApi(req, res, pathname) {
  if (pathname === '/api/fortune' && req.method === 'GET') {
    if (LIMIT_BY === 'browser') return json(res, 200, { mode: 'browser', fortune: null });
    const spin = loadSpins()[visitorKey(req)];
    return json(res, 200, { mode: 'ip', fortune: spin ? spin.fortune : null, at: spin ? spin.at : null });
  }

  if (pathname === '/api/spin' && req.method === 'POST') {
    const fortune = FORTUNES[crypto.randomInt(FORTUNES.length)];
    const at = new Date().toISOString();
    if (LIMIT_BY === 'browser') return json(res, 200, { mode: 'browser', fortune, at });

    const spins = loadSpins();
    const key = visitorKey(req);
    if (spins[key]) {
      return json(res, 409, { mode: 'ip', already: true, fortune: spins[key].fortune, at: spins[key].at });
    }
    spins[key] = { fortune, at };
    saveSpins(spins);
    return json(res, 200, { mode: 'ip', fortune, at });
  }

  json(res, 404, { error: 'not found' });
}

function handleStatic(req, res, pathname) {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.writeHead(405);
    return res.end();
  }
  let rel;
  try {
    rel = decodeURIComponent(pathname);
  } catch {
    res.writeHead(400);
    return res.end();
  }
  if (rel.endsWith('/')) rel += 'index.html';
  const file = path.join(PUBLIC_DIR, rel);
  if (!file.startsWith(PUBLIC_DIR + path.sep)) {
    res.writeHead(403);
    return res.end();
  }
  fs.readFile(file, (err, buf) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      return res.end('not found');
    }
    res.writeHead(200, {
      'Content-Type': TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream',
      'Cache-Control': 'no-cache',
    });
    res.end(req.method === 'HEAD' ? undefined : buf);
  });
}

http
  .createServer((req, res) => {
    const { pathname } = new URL(req.url, 'http://localhost');
    if (pathname.startsWith('/api/')) return handleApi(req, res, pathname);
    handleStatic(req, res, pathname);
  })
  .listen(PORT, () => {
    console.log(`2027 fortune running at http://localhost:${PORT} (one spin per ${LIMIT_BY})`);
  });

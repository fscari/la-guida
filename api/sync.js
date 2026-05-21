const BASE  = () => process.env.UPSTASH_REDIS_REST_URL;
const TOKEN = () => process.env.UPSTASH_REDIS_REST_TOKEN;
const TTL   = 60 * 60 * 24 * 730;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function redis(...args) {
  const res = await fetch(BASE(), {
    method: 'POST',
    headers: { Authorization: `Bearer ${TOKEN()}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(args),
  });
  return res.json();
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

if (req.query.debug) {
  const testKey = `test_${Date.now()}`;
  let setRes = null, getRes = null;
  try {
    setRes = await redis('SET', testKey, 'hello', 'EX', '60');
    getRes = await redis('GET', testKey);
  } catch (e) {
    return res.status(200).json({ error: e.message });
  }
  return res.status(200).json({
    version: '4',
    hasUrl:   !!process.env.UPSTASH_REDIS_REST_URL,
    hasToken: !!process.env.UPSTASH_REDIS_REST_TOKEN,
    urlStart: (process.env.UPSTASH_REDIS_REST_URL || '').slice(0, 30),
    set: setRes,
    get: getRes,
  });
}

  const { id } = req.query;
  if (!id || !UUID_RE.test(id)) return res.status(400).json({ error: 'Invalid ID' });
  if (!BASE() || !TOKEN())     return res.status(503).json({ error: 'Upstash not configured' });

  const key = `guide_${id}`;

  try {
    if (req.method === 'GET') {
      const { result } = await redis('GET', key);
      const entries = result ? JSON.parse(result) : [];
      return res.status(200).json({ entries });
    }

    if (req.method === 'POST') {
      let body = req.body;
      if (typeof body === 'string') { try { body = JSON.parse(body); } catch { body = {}; } }
      const { entries } = body ?? {};
      if (!Array.isArray(entries)) return res.status(400).json({ error: 'entries must be array' });
      const stripped = entries.map(({ photo, ...rest }) => rest);
      await redis('SET', key, JSON.stringify(stripped), 'EX', String(TTL));
      return res.status(200).json({ ok: true, saved: stripped.length });
    }

    res.status(405).end();
  } catch (err) {
    console.error('[sync]', err);
    res.status(500).json({ error: err.message });
  }
}

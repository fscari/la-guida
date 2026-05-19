// api/sync.js
// Uses Upstash REST API directly — no npm packages required.
// Env vars are injected automatically by Vercel after you connect Upstash
// via Vercel Dashboard → Storage → Connect to Project.
//
// To verify setup, visit: https://your-app.vercel.app/api/sync?debug=1
// You should see: { "hasUrl": true, "hasToken": true }

const TTL     = 60 * 60 * 24 * 730; // 2 years
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function authHeaders() {
  return {
    Authorization: `Bearer ${process.env.UPSTASH_REDIS_REST_TOKEN}`,
    'Content-Type': 'application/json',
  };
}

async function kvGet(key) {
  const res = await fetch(
    `${process.env.UPSTASH_REDIS_REST_URL}/get/${encodeURIComponent(key)}`,
    { headers: authHeaders() }
  );
  const { result } = await res.json();
  return result ? JSON.parse(result) : null;
}

async function kvSet(key, value, ttl) {
  await fetch(`${process.env.UPSTASH_REDIS_REST_URL}/pipeline`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify([
      ['SET',    key, JSON.stringify(value)],
      ['EXPIRE', key, ttl],
    ]),
  });
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin',  '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  // Debug endpoint — visit /api/sync?debug=1 in browser
  if (req.query.debug) {
    return res.status(200).json({
      hasUrl:   !!process.env.UPSTASH_REDIS_REST_URL,
      hasToken: !!process.env.UPSTASH_REDIS_REST_TOKEN,
    });
  }

  const { id } = req.query;
  if (!id || !UUID_RE.test(id)) {
    return res.status(400).json({ error: 'Invalid sync ID — must be a UUID' });
  }

  if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
    return res.status(503).json({
      error: 'Upstash not configured. Connect it via Vercel → Storage and redeploy.',
    });
  }

  const key = `guide:${id}`;

  try {
    if (req.method === 'GET') {
      const entries = await kvGet(key);
      return res.status(200).json({ entries: entries ?? [] });
    }

    if (req.method === 'POST') {
      let body = req.body;
      if (typeof body === 'string') { try { body = JSON.parse(body); } catch { body = {}; } }
      const { entries } = body ?? {};
      if (!Array.isArray(entries)) {
        return res.status(400).json({ error: `entries must be an array, got: ${typeof entries}` });
      }
      // Strip photos before storing — photos stay device-local only
      const stripped = entries.map(({ photo, ...rest }) => rest);
      await kvSet(key, stripped, TTL);
      return res.status(200).json({ ok: true, saved: stripped.length });
    }

    res.status(405).end();
  } catch (err) {
    console.error('[sync]', err);
    return res.status(500).json({ error: err.message ?? 'Unknown error' });
  }
}

// api/sync.js — Vercel Serverless Function
// Requires Vercel KV to be enabled in your project dashboard.
// See README for setup instructions (takes ~2 minutes).

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const TTL_SECONDS = 60 * 60 * 24 * 730; // 2 years

export default async function handler(req, res) {
  // Allow CORS for same-origin (Vercel handles this, but just in case)
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  // Validate sync ID
  const { id } = req.query;
  if (!id || !UUID_RE.test(id)) {
    return res.status(400).json({ error: 'Invalid sync ID' });
  }

  // Try to load @vercel/kv — fails gracefully if KV isn't set up
  let kv;
  try {
    const { Redis } = await import('@upstash/redis');
    kv = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL,
    token: process.env.UPSTASH_REDIS_REST_TOKEN,
  });
  } catch {
    return res.status(503).json({ error: 'Sync storage not configured. See README to enable Vercel KV.' });
  }

  const key = `guide:${id}`;

  try {
    if (req.method === 'GET') {
      const entries = await kv.get(key);
      return res.status(200).json({ entries: entries ?? [] });
    }

    if (req.method === 'POST') {
      const { entries } = req.body;
      if (!Array.isArray(entries)) return res.status(400).json({ error: 'entries must be an array' });
      // Strip photos before storing to keep payload small — photos stay local
      const stripped = entries.map(({ photo, ...rest }) => rest);
      await kv.set(key, stripped, { ex: TTL_SECONDS });
      return res.status(200).json({ ok: true });
    }

    res.status(405).end();
  } catch (err) {
    console.error('KV error:', err);
    res.status(500).json({ error: 'Storage error' });
  }
}

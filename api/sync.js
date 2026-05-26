// api/sync.js

const TTL     = 60 * 60 * 24 * 730;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function base()  { return (process.env.UPSTASH_REDIS_REST_URL  || '').replace(/\/$/, ''); }
function token() { return  process.env.UPSTASH_REDIS_REST_TOKEN || ''; }
function auth()  { return { Authorization: `Bearer ${token()}`, 'Content-Type': 'application/json' }; }

async function kvSet(key, value) {
  const res  = await fetch(`${base()}/pipeline`, {
    method:  'POST',
    headers: auth(),
    body:    JSON.stringify([
      ['SET', key, JSON.stringify(value), 'EX', TTL]
    ]),
  });
  const data = await res.json();
  console.log('[kvSet]', key, 'http:', res.status, 'redis:', JSON.stringify(data));
  return data;
}

async function kvGet(key) {
  const res  = await fetch(`${base()}/get/${key}`, { headers: auth() });
  const data = await res.json();
  console.log('[kvGet]', key, 'http:', res.status, 'result_length:', data?.result?.length ?? 0);
  if (!data?.result) return null;
  try { return JSON.parse(data.result); } catch { return null; }
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin',  '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.query.debug) {
    return res.status(200).json({
      hasUrl:      !!process.env.UPSTASH_REDIS_REST_URL,
      hasToken:    !!process.env.UPSTASH_REDIS_REST_TOKEN,
      url_preview: (process.env.UPSTASH_REDIS_REST_URL || '').slice(0, 40),
    });
  }

  const { id } = req.query;
  if (!id || !UUID_RE.test(id)) return res.status(400).json({ error: 'Invalid sync ID' });
  if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
    return res.status(503).json({ error: 'Upstash not configured' });
  }

  const key = `guide_${id}`;

  try {
    // ── GET ────────────────────────────────────────────────────────────────
    if (req.method === 'GET') {
      const stored = await kvGet(key);
      // Support both old format (bare array) and new format ({ entries, wishlist })
      if (Array.isArray(stored)) {
        return res.status(200).json({ entries: stored, wishlist: [], deletedIds: [] });
      }
      return res.status(200).json({
        entries:    Array.isArray(stored?.entries)    ? stored.entries    : [],
        wishlist:   Array.isArray(stored?.wishlist)   ? stored.wishlist   : [],
        deletedIds: Array.isArray(stored?.deletedIds) ? stored.deletedIds : [],
      });
    }

    // ── POST ───────────────────────────────────────────────────────────────
    if (req.method === 'POST') {
      let body = req.body;
      if (typeof body === 'string') { try { body = JSON.parse(body); } catch { body = {}; } }

      const { entries, wishlist, deletedIds } = body ?? {};
      if (!Array.isArray(entries)) {
        return res.status(400).json({ error: `entries must be array, got ${typeof entries}` });
      }

      const strippedEntries  = entries.map(({ photo, ...rest }) => rest);
      const strippedWishlist = Array.isArray(wishlist) ? wishlist.map(({ photo, ...rest }) => rest) : [];
      const storedDeletedIds = Array.isArray(deletedIds) ? deletedIds : [];

      const payload   = { entries: strippedEntries, wishlist: strippedWishlist, deletedIds: storedDeletedIds };
      const setResult = await kvSet(key, payload);

      const verify = await kvGet(key);
      console.log('[POST] verify entries:', verify?.entries?.length ?? 'null', 'wishlist:', verify?.wishlist?.length ?? 'null');

      return res.status(200).json({
        ok:             true,
        savedEntries:   strippedEntries.length,
        savedWishlist:  strippedWishlist.length,
        verifyEntries:  verify?.entries?.length  ?? 0,
        verifyWishlist: verify?.wishlist?.length ?? 0,
        redis:          setResult,
      });
    }

    res.status(405).end();
  } catch (err) {
    console.error('[sync error]', err);
    return res.status(500).json({ error: err.message });
  }
}

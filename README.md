# 🍕 La Guida — Personal Pizza Guide

Mobile-first personal Michelin guide with weighted scoring, interactive map, photo upload, PDF export, and cross-device sync.

---

## Deploy

### 1 — Push to GitHub
Upload this folder to a GitHub repository.

### 2 — Deploy on Vercel
- Go to vercel.com → Add New Project → select your repo → Deploy
- Vercel auto-detects Vite, no config needed

### 3 — Enable cross-device sync (2 min)
- Vercel dashboard → **Storage** → Add **Upstash Redis** → Connect to project → Redeploy
- Verify it works: visit `https://your-app.vercel.app/api/sync?debug=1`
- You should see: `{ "hasUrl": true, "hasToken": true }`

### 4 — Add to phone home screen
- iOS Safari: Share → Add to Home Screen
- Android Chrome: Menu → Add to Home Screen

---

## Scoring weights

| Criterion        | Weight |
|------------------|--------|
| Dough & Crust    | 25%    |
| Toppings         | 21%    |
| Value for Money  | 18%    |
| Tiramisu         | 16%    |
| Ambiance         | 12%    |
| Drinks           | 8%     |

To change: edit `WEIGHTS` and `CRITERIA` at the top of `src/App.jsx`. Weights must sum to 1.0.

---

## Tiers

◈ Leggendaria (9+) · ◆ Eccellente (8+) · ◇ Buona (7+) · ◻ Nella media (6+) · ✕ Evita (<6)

---

## Notes

- Photos are stored locally on each device and are not synced
- Sync uses Upstash Redis via Vercel — no extra accounts needed beyond Vercel
- The deprecation warning about `url.parse()` is harmless — it comes from leaflet internals

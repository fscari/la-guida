# 🍕 La Guida v2 — Personal Pizza Guide

Personal Michelin-style guide with weighted scoring, map, photos, PDF export, and cross-device sync.

---

## What's new in v2

- **New criteria** — Dough (25%), Toppings (21%), Value (18%), Tiramisu (16%), Ambiance (12%), Drinks (8%)
- **Photo upload** — Add a photo to each entry, compressed automatically
- **€€€€ price tier** — Full range from € to €€€€
- **PDF export** — Tap "Export PDF" → browser prints a clean structured report
- **Cross-device sync** — Share a link, open it on any device, see the same guide in real time

---

## Deploy in 5 minutes

### Step 1 — GitHub
Upload this folder to a new GitHub repository (drag & drop works on github.com).

### Step 2 — Vercel
1. Go to [vercel.com](https://vercel.com) → Log in with GitHub
2. **Add New → Project** → select your `la-guida` repo
3. Click **Deploy** — Vercel auto-detects Vite

### Step 3 — Enable cross-device sync (2 minutes extra)
1. In your Vercel project dashboard → **Storage** tab
2. Click **Create Database** → choose **KV** → name it `la-guida-kv`
3. Click **Connect to project** → select your project → **Connect**
4. Go back to **Deployments** → click the three dots on your latest deploy → **Redeploy**

That's it. Vercel auto-injects the KV credentials. The sync indicator in the app will turn green.

> If you skip this step, the app works fine — it just stores data locally and the share link won't auto-sync (you can still use Export/Import manually).

### Step 4 — Add to phone home screen
- **iOS Safari**: Share → Add to Home Screen
- **Android Chrome**: Menu (⋮) → Add to Home Screen

---

## Cross-device sync: how it works

1. Every device has a **sync ID** (a secret UUID, auto-generated on first use)
2. Every save pushes data to Vercel KV under that ID
3. Your **Share link** looks like: `yourapp.vercel.app?sync=abc-123-xyz`
4. Any device that opens that link adopts your sync ID and pulls your data instantly
5. From then on, both devices stay in sync — any changes on either device propagate

> **Note:** Photos are stored locally only (not synced) to keep the payload light.

---

## Local development

```bash
npm install
npm run dev
# → http://localhost:5173
# Sync will fail locally (no KV env vars) but everything else works
```

---

## Customizing criteria and weights

Edit the top of `src/App.jsx`:

```js
// Weights must sum to exactly 1.0
const WEIGHTS = {
  dough:    0.25,
  toppings: 0.21,
  value:    0.18,
  tiramisu: 0.16,
  ambiance: 0.12,
  drinks:   0.08,
};

const CRITERIA = [
  { key: "dough", label: "Dough & Crust", sub: "texture · char · structure", weight: "25%" },
  // ...add or remove entries here
];
```

To add a criterion: add it to both `WEIGHTS` and `CRITERIA`, re-balance so total = 1.0.

---

## Tier thresholds

| Score | Tier |
|---|---|
| 9.0 – 10 | ◈ Leggendaria |
| 8.0 – 8.9 | ◆ Eccellente |
| 7.0 – 7.9 | ◇ Buona |
| 6.0 – 6.9 | ◻ Nella media |
| < 6.0 | ✕ Evita |

---

## Extending to other cuisines

To add a **Pasta** guide:
1. Duplicate `src/App.jsx` → `src/AppPasta.jsx`
2. Update `WEIGHTS`, `CRITERIA` for pasta-specific scoring
3. Change `STORAGE_KEY` to `"la-guida-pasta-v2"` and `SYNC_ID_KEY` to `"la-guida-pasta-syncid"`
4. Add a cuisine selector in the header to switch between guides

---

## Tech stack

| Tool | Purpose |
|---|---|
| React 18 + Vite | Frontend |
| react-leaflet + Leaflet | Interactive map |
| CartoDB Dark Matter | Dark map tiles (no API key) |
| Nominatim / OpenStreetMap | Geocoding (no API key) |
| @vercel/kv | Cross-device sync (Redis) |
| localStorage | Local data persistence + photo storage |
| Browser print API | PDF export (no dependencies) |

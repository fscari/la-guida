import { useState, useEffect, useRef } from "react";
import { MapContainer, TileLayer, CircleMarker, Popup, useMap } from "react-leaflet";

// ─── Criteria & Weights ───────────────────────────────────────────────────────
// Must sum to exactly 1.0

const WEIGHTS = {
  dough:    0.25,
  toppings: 0.21,
  value:    0.18,
  tiramisu: 0.16,
  ambiance: 0.12,
  drinks:   0.08,
};

const CRITERIA = [
  { key: "dough",    label: "Dough & Crust",      sub: "texture · char · structure",   weight: "25%" },
  { key: "toppings", label: "Toppings",            sub: "quality · origin · balance",   weight: "21%" },
  { key: "value",    label: "Value for Money",     sub: "price vs experience",          weight: "18%" },
  { key: "tiramisu", label: "Tiramisu",            sub: "texture · cream · bitterness", weight: "16%" },
  { key: "ambiance", label: "Ambiance & Service",  sub: "atmosphere · speed · care",    weight: "12%" },
  { key: "drinks",   label: "Drinks",              sub: "wine · cocktails · selection", weight: "8%"  },
];

const PIZZA_STYLES  = ["Neapolitan", "Roman", "Milanese", "Panzerotto", "Other"];
const PRICE_RANGES  = ["€", "€€", "€€€", "€€€€"];
const STORAGE_KEY   = "la-guida-v2";
const SYNC_ID_KEY   = "la-guida-syncid";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function handlePrint() {
  const win = window.open('', '_blank', 'width=1000,height=750');
  if (!win) return;

  const rows = entries.map((e, idx) => {
    const tier  = getTier(e.weightedScore);
    const cells = CRITERIA.map(c => `
      <td style="padding:9px 10px;border-bottom:1px solid #f0f0f0;font-size:13px;
                 color:${scoreColor(e.scores[c.key] || 5)};font-weight:600;text-align:center;">
        ${e.scores[c.key] || '—'}
      </td>`).join('');

    return `
      <tr>
        <td style="padding:9px 10px;border-bottom:1px solid #f0f0f0;color:#bbb;font-weight:600;text-align:center;">${idx + 1}</td>
        <td style="padding:9px 10px;border-bottom:1px solid #f0f0f0;">
          <div style="font-family:Georgia,serif;font-size:15px;font-weight:700;">${e.name}</div>
          ${e.location ? `<div style="font-size:11px;color:#888;margin-top:2px;">📍 ${e.location}</div>` : ''}
          ${e.dish     ? `<div style="font-size:11px;color:#aaa;">${e.style} · ${e.dish} · ${e.priceRange}</div>` : ''}
          ${e.notes    ? `<div style="font-size:11px;color:#bbb;font-style:italic;margin-top:3px;">"${e.notes}"</div>` : ''}
        </td>
        <td style="padding:9px 10px;border-bottom:1px solid #f0f0f0;text-align:center;">
          <span style="font-family:Georgia,serif;font-size:22px;font-weight:700;color:${scoreColor(e.weightedScore)};">${e.weightedScore.toFixed(1)}</span>
          <div style="font-size:9px;color:#bbb;">/10</div>
        </td>
        <td style="padding:9px 10px;border-bottom:1px solid #f0f0f0;font-size:10px;font-weight:600;
                   color:${tier.color};letter-spacing:1px;text-transform:uppercase;white-space:nowrap;">
          ${tier.icon} ${tier.label}
        </td>
        ${cells}
        <td style="padding:9px 10px;border-bottom:1px solid #f0f0f0;font-size:12px;text-align:center;
                   color:${e.wouldReturn === 'Yes' ? '#5B8A5B' : e.wouldReturn === 'No' ? '#8B4040' : '#888'};">
          ${e.wouldReturn}
        </td>
      </tr>`;
  }).join('');

  const headers = CRITERIA.map(c => `
    <th style="text-align:center;padding:8px 10px;border-bottom:2px solid #ddd;
               font-size:10px;letter-spacing:1.5px;text-transform:uppercase;color:#888;
               font-weight:600;white-space:nowrap;">
      ${c.label}<br><span style="font-weight:400;color:#bbb;">${c.weight}</span>
    </th>`).join('');

  const date = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' });

  win.document.write(`<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>La Guida — Pizzerie</title>
  <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;700&family=DM+Sans:wght@400;500&display=swap" rel="stylesheet">
  <style>
    * { box-sizing: border-box; }
    body { font-family: 'DM Sans', sans-serif; padding: 40px; color: #111; background: #fff; margin: 0; }
    @media print { @page { margin: 15mm; size: landscape; } body { padding: 0; } }
  </style>
</head>
<body>
  <div style="border-bottom:2px solid #C4622D;padding-bottom:14px;margin-bottom:24px;display:flex;justify-content:space-between;align-items:flex-end;">
    <div>
      <div style="font-size:10px;letter-spacing:3px;color:#C4622D;text-transform:uppercase;margin-bottom:6px;font-weight:600;">Personal Restaurant Guide</div>
      <div style="font-family:'Playfair Display',Georgia,serif;font-size:26px;font-weight:700;margin:0 0 4px;">La Guida — Pizzerie</div>
      <div style="font-size:12px;color:#aaa;">Exported ${date} · ${entries.length} restaurant${entries.length !== 1 ? 's' : ''}</div>
    </div>
    <div style="text-align:right;font-size:11px;color:#ccc;line-height:1.6;">
      ${CRITERIA.map(c => `${c.label} ${c.weight}`).join('<br>')}
    </div>
  </div>

  <table style="width:100%;border-collapse:collapse;font-size:13px;">
    <thead>
      <tr>
        <th style="text-align:center;padding:8px 10px;border-bottom:2px solid #ddd;font-size:10px;letter-spacing:1.5px;text-transform:uppercase;color:#888;font-weight:600;">#</th>
        <th style="text-align:left;padding:8px 10px;border-bottom:2px solid #ddd;font-size:10px;letter-spacing:1.5px;text-transform:uppercase;color:#888;font-weight:600;">Restaurant</th>
        <th style="text-align:center;padding:8px 10px;border-bottom:2px solid #ddd;font-size:10px;letter-spacing:1.5px;text-transform:uppercase;color:#888;font-weight:600;">Score</th>
        <th style="text-align:left;padding:8px 10px;border-bottom:2px solid #ddd;font-size:10px;letter-spacing:1.5px;text-transform:uppercase;color:#888;font-weight:600;">Tier</th>
        ${headers}
        <th style="text-align:center;padding:8px 10px;border-bottom:2px solid #ddd;font-size:10px;letter-spacing:1.5px;text-transform:uppercase;color:#888;font-weight:600;">Return?</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>

  <div style="margin-top:32px;font-size:10px;color:#ccc;text-align:center;border-top:1px solid #eee;padding-top:12px;">
    La Guida · Personal Pizza Guide
  </div>
  <script>window.onload = () => { setTimeout(() => window.print(), 600); }</script>
</body>
</html>`);
  win.document.close();
}


function calcScore(scores) {
  return Object.entries(WEIGHTS).reduce((acc, [k, w]) => acc + (Number(scores[k]) || 5) * w, 0);
}

function getTier(s) {
  if (s >= 9)  return { label: "Leggendaria", icon: "◈", color: "#D4A853", bg: "rgba(212,168,83,0.14)" };
  if (s >= 8)  return { label: "Eccellente",  icon: "◆", color: "#C4622D", bg: "rgba(196,98,45,0.14)"  };
  if (s >= 7)  return { label: "Buona",        icon: "◇", color: "#5B8A5B", bg: "rgba(91,138,91,0.14)"  };
  if (s >= 6)  return { label: "Nella media",  icon: "◻", color: "#7A7470", bg: "rgba(122,116,112,0.14)" };
  return       { label: "Evita",       icon: "✕", color: "#8B4040", bg: "rgba(139,64,64,0.14)"  };
}

function scoreColor(v) {
  if (v >= 8.5) return "#D4A853";
  if (v >= 7)   return "#C4622D";
  if (v >= 5.5) return "#5B8A5B";
  return "#7A7470";
}

function generateUUID() {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, c => {
    const r = (Math.random() * 16) | 0;
    return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
  });
}

async function geocodeLocation(query) {
  if (!query?.trim()) return null;
  try {
    const res  = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=1`, { headers: { "User-Agent": "LaGuida/2.0" } });
    const data = await res.json();
    if (data.length > 0) return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
  } catch {}
  return null;
}

async function compressImage(file) {
  return new Promise(resolve => {
    const reader = new FileReader();
    reader.onload = e => {
      const img = new Image();
      img.onload = () => {
        const MAX = 600;
        const scale = Math.min(1, MAX / Math.max(img.width, img.height));
        const canvas = document.createElement("canvas");
        canvas.width  = img.width  * scale;
        canvas.height = img.height * scale;
        canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/jpeg", 0.65));
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });
}

async function pushToCloud(syncId, entries) {
  try {
    const res = await fetch(`/api/sync?id=${syncId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ entries }),
    });
    return res.ok;
  } catch { return false; }
}

async function pullFromCloud(syncId) {
  try {
    const res  = await fetch(`/api/sync?id=${syncId}`);
    const data = await res.json();
    return Array.isArray(data.entries) ? data.entries : null;
  } catch { return null; }
}

const freshForm = () => ({
  name: "", location: "", style: "Neapolitan",
  dateVisited: new Date().toISOString().split("T")[0],
  dish: "", priceRange: "€€",
  scores: { dough: 7, toppings: 7, value: 7, tiramisu: 7, ambiance: 7, drinks: 7 },
  notes: "", wouldReturn: "Yes", cuisine: "pizza",
  lat: null, lng: null, photo: null,
});

// ─── Sub-components ───────────────────────────────────────────────────────────

function Chip({ children, style }) {
  return (
    <span style={{ fontSize: 12, background: "#1C1814", borderRadius: 7, padding: "5px 12px", color: "#5A5450", border: "1px solid #2A2520", display: "inline-block", ...style }}>
      {children}
    </span>
  );
}

function ScoreSlider({ value, onChange }) {
  const fill = `${((value - 1) / 9) * 100}%`;
  const bg   = `linear-gradient(to right, ${scoreColor(value)} 0%, ${scoreColor(value)} ${fill}, #2A2520 ${fill}, #2A2520 100%)`;
  return (
    <input
      type="range" min={1} max={10} step={1} value={value}
      onChange={e => onChange(+e.target.value)}
      className="pg-slider" style={{ background: bg }}
    />
  );
}

function MapController({ center }) {
  const map = useMap();
  useEffect(() => { if (center) map.flyTo(center, map.getZoom(), { duration: 1 }); }, [center]);
  return null;
}

function BottomNav({ view, onList, onMap, onAdd }) {
  if (view === "add" || view === "detail") return null;
  return (
    <div style={{ position: "fixed", bottom: 0, left: "50%", transform: "translateX(-50%)", width: "100%", maxWidth: 430, background: "rgba(13,11,9,0.96)", borderTop: "1px solid #1C1814", display: "flex", alignItems: "center", justifyContent: "space-around", padding: "10px 16px 20px", zIndex: 1000, backdropFilter: "blur(12px)" }}>
      <button onClick={onList} style={{ background: "none", border: "none", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 4, padding: "4px 20px" }}>
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={view === "list" ? "#C4622D" : "#3A3530"} strokeWidth="2" strokeLinecap="round">
          <line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/>
          <line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/>
        </svg>
        <span style={{ fontSize: 9, letterSpacing: 1.5, textTransform: "uppercase", color: view === "list" ? "#C4622D" : "#3A3530", fontWeight: 600 }}>Lista</span>
      </button>

      <button onClick={onAdd} style={{ background: "#C4622D", border: "none", width: 52, height: 52, borderRadius: "50%", color: "#F0EBE1", fontSize: 26, cursor: "pointer", boxShadow: "0 4px 20px rgba(196,98,45,.6)", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 300, marginTop: -10 }}>
        +
      </button>

      <button onClick={onMap} style={{ background: "none", border: "none", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 4, padding: "4px 20px" }}>
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={view === "map" ? "#C4622D" : "#3A3530"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polygon points="3 6 9 3 15 6 21 3 21 18 15 21 9 18 3 21"/>
          <line x1="9" y1="3" x2="9" y2="18"/><line x1="15" y1="6" x2="15" y2="21"/>
        </svg>
        <span style={{ fontSize: 9, letterSpacing: 1.5, textTransform: "uppercase", color: view === "map" ? "#C4622D" : "#3A3530", fontWeight: 600 }}>Mappa</span>
      </button>
    </div>
  );
}

// ── Share Modal ───────────────────────────────────────────────────────────────
function ShareModal({ syncId, onClose }) {
  const [copied, setCopied] = useState(false);
  const url = `${window.location.origin}${window.location.pathname}?sync=${syncId}`;

  async function copy() {
    try { await navigator.clipboard.writeText(url); } catch { /* fallback */ }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)", zIndex: 2000, display: "flex", alignItems: "flex-end", justifyContent: "center" }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{ background: "#1C1814", borderRadius: "18px 18px 0 0", padding: "24px 24px 36px", width: "100%", maxWidth: 430, border: "1px solid #2A2520", borderBottom: "none" }}>
        <div style={{ width: 36, height: 4, background: "#2A2520", borderRadius: 2, margin: "0 auto 20px" }} />
        <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 20, fontWeight: 600, marginBottom: 8 }}>Share your guide</div>
        <div style={{ fontSize: 13, color: "#4A4440", lineHeight: 1.7, marginBottom: 20 }}>
          Anyone who opens this link will see your entries — and any device you open it on will stay in sync automatically.
        </div>

        {/* URL box */}
        <div style={{ background: "#0D0B09", border: "1px solid #2A2520", borderRadius: 10, padding: "12px 14px", fontSize: 12, color: "#4A4440", wordBreak: "break-all", marginBottom: 16, lineHeight: 1.6, fontFamily: "monospace" }}>
          {url}
        </div>

        <div style={{ fontSize: 11, color: "#2A2520", marginBottom: 20, lineHeight: 1.6 }}>
          ⚠️ Photos are stored locally and not included in the shared link.
        </div>

        <button
          onClick={copy}
          style={{ width: "100%", background: copied ? "#5B8A5B" : "#C4622D", border: "none", color: "#F0EBE1", borderRadius: 12, padding: "14px", fontSize: 15, cursor: "pointer", fontFamily: "'DM Sans', sans-serif", fontWeight: 600, transition: "background .2s", marginBottom: 10 }}
        >
          {copied ? "✓ Copied!" : "Copy link"}
        </button>
        <button onClick={onClose} style={{ width: "100%", background: "transparent", border: "1px solid #2A2520", color: "#4A4440", borderRadius: 12, padding: "13px", fontSize: 14, cursor: "pointer", fontFamily: "'DM Sans', sans-serif" }}>
          Done
        </button>
      </div>
    </div>
  );
}

// ─── Main App ─────────────────────────────────────────────────────────────────

export default function App() {
  const [view, setView]             = useState("list");
  const [entries, setEntries]       = useState([]);
  const [form, setForm]             = useState(freshForm());
  const [selectedId, setSelectedId] = useState(null);
  const [editingId, setEditingId]   = useState(null);
  const [confirmDel, setConfirmDel] = useState(false);
  const [saving, setSaving]         = useState(false);
  const [syncId, setSyncId]         = useState(null);
  const [syncStatus, setSyncStatus] = useState("idle"); // "idle" | "syncing" | "ok" | "error"
  const [showShare, setShowShare]   = useState(false);
  const [mapFocus, setMapFocus]     = useState(null);
  const fileRef                     = useRef();

  // ── Bootstrap: load syncId, handle ?sync= URL param, load entries ──────────
  useEffect(() => {
    const params     = new URLSearchParams(window.location.search);
    const urlSyncId  = params.get("sync");
    const localSyncId = localStorage.getItem(SYNC_ID_KEY);

    async function bootstrap() {
      let activeSyncId;

      if (urlSyncId) {
        // Adopt the shared sync ID — this device will now use this guide
        activeSyncId = urlSyncId;
        localStorage.setItem(SYNC_ID_KEY, urlSyncId);
        // Clean URL so it doesn't keep re-triggering on refresh
        window.history.replaceState({}, "", window.location.pathname);
      } else if (localSyncId) {
        activeSyncId = localSyncId;
      } else {
        activeSyncId = generateUUID();
        localStorage.setItem(SYNC_ID_KEY, activeSyncId);
      }

      setSyncId(activeSyncId);

      // Try to load from cloud first (if URL sync param was used or local may be stale)
      if (urlSyncId) {
        setSyncStatus("syncing");
        const cloudEntries = await pullFromCloud(urlSyncId);
        if (cloudEntries && cloudEntries.length > 0) {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(cloudEntries));
          setEntries(cloudEntries);
          setSyncStatus("ok");
          return;
        }
      }

      // Fall back to localStorage
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw) setEntries(JSON.parse(raw));
      } catch {}
      setSyncStatus("ok");
    }

    bootstrap();
  }, []);

  function persist(data, activeSyncId) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    if (activeSyncId) {
      setSyncStatus("syncing");
      pushToCloud(activeSyncId, data).then(ok => setSyncStatus(ok ? "ok" : "error"));
    }
  }

  function sortedEntries(arr) {
    return [...arr].sort((a, b) => b.weightedScore - a.weightedScore);
  }

  async function saveEntry() {
    setSaving(true);
    let lat = form.lat, lng = form.lng;
    if (form.location?.trim() && (!lat || !lng)) {
      const coords = await geocodeLocation(form.location);
      if (coords) { lat = coords.lat; lng = coords.lng; }
    }
    const score = parseFloat(calcScore(form.scores).toFixed(1));
    const entry = { ...form, id: editingId || String(Date.now()), weightedScore: score, lat, lng };
    const next  = sortedEntries(editingId ? entries.map(e => e.id === editingId ? entry : e) : [...entries, entry]);
    setEntries(next);
    persist(next, syncId);
    setSaving(false);
    setView("list");
    setEditingId(null);
    setForm(freshForm());
  }

  function deleteEntry(id) {
    const next = entries.filter(e => e.id !== id);
    setEntries(next);
    persist(next, syncId);
    setView("list");
    setSelectedId(null);
    setConfirmDel(false);
  }

  function openEdit(entry) {
    setForm({ ...entry, scores: { ...entry.scores } });
    setEditingId(entry.id);
    setView("add");
  }

  function openDetail(id) { setSelectedId(id); setConfirmDel(false); setView("detail"); }
  function openAdd()      { setForm(freshForm()); setEditingId(null); setView("add"); }

  async function handlePhotoChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const compressed = await compressImage(file);
    setForm(f => ({ ...f, photo: compressed }));
  }

  const selected     = entries.find(e => e.id === selectedId);
  const previewScore = parseFloat(calcScore(form.scores).toFixed(1));
  const previewTier  = getTier(previewScore);

  // ── Shared styles ──────────────────────────────────────────────────────────
  const appStyle    = { fontFamily: "'DM Sans', sans-serif", background: "#0D0B09", minHeight: "100vh", color: "#F0EBE1", maxWidth: 430, margin: "0 auto", position: "relative" };
  const sectionLbl  = { fontSize: 10, letterSpacing: 3, color: "#C4622D", textTransform: "uppercase", marginBottom: 14, fontWeight: 600 };
  const divider     = { borderBottom: "1px solid #1C1814" };
  const syncDot     = { idle: "#2A2520", syncing: "#C4622D", ok: "#5B8A5B", error: "#8B4040" }[syncStatus];

  // ╔══════════════════════════════════════════════╗
  // ║  LIST VIEW                                   ║
  // ╚══════════════════════════════════════════════╝
  if (view === "list") {
    const avg    = entries.length ? (entries.reduce((s, e) => s + e.weightedScore, 0) / entries.length).toFixed(1) : null;
    const topCnt = entries.filter(e => e.weightedScore >= 8).length;

    return (
      <div style={{ ...appStyle, paddingBottom: 90 }} className="pg-fade-in no-print">
        {/* Header */}
        <div style={{ padding: "36px 24px 16px", ...divider }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
            <div>
              <div style={{ fontSize: 10, letterSpacing: 4, color: "#C4622D", textTransform: "uppercase", marginBottom: 6, fontWeight: 600 }}>Personal Guide · Pizza</div>
              <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 36, fontWeight: 700, lineHeight: 1, letterSpacing: -1 }}>La Guida</div>
              <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 14, fontStyle: "italic", color: "#3A3530", marginTop: 4 }}>Pizzerie</div>
            </div>
            <div style={{ textAlign: "right" }}>
              {avg && <><div style={{ fontFamily: "'Playfair Display', serif", fontSize: 40, fontWeight: 700, color: scoreColor(+avg), lineHeight: 1 }}>{avg}</div><div style={{ fontSize: 10, color: "#3A3530", letterSpacing: 2, textTransform: "uppercase" }}>avg</div></>}
              {/* Sync indicator */}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 5, marginTop: 6 }}>
                <div style={{ width: 7, height: 7, borderRadius: "50%", background: syncDot, transition: "background .4s" }} />
                <span style={{ fontSize: 10, color: "#2A2520", letterSpacing: 1 }}>
                  {syncStatus === "syncing" ? "syncing…" : syncStatus === "ok" ? "synced" : syncStatus === "error" ? "offline" : "local"}
                </span>
              </div>
            </div>
          </div>

          {entries.length > 0 && (
            <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
              {[{ label: "Logged", value: entries.length }, { label: "Top rated", value: topCnt }, { label: "On map", value: entries.filter(e => e.lat).length }].map(s => (
                <div key={s.label} style={{ flex: 1, background: "#1C1814", borderRadius: 10, padding: "10px 12px", border: "1px solid #2A2520" }}>
                  <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 18, fontWeight: 600 }}>{s.value}</div>
                  <div style={{ fontSize: 9, color: "#3A3530", letterSpacing: 1.5, textTransform: "uppercase", marginTop: 2 }}>{s.label}</div>
                </div>
              ))}
            </div>
          )}

          {/* Action buttons */}
          {entries.length > 0 && (
            <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
              <button onClick={() => window.print()} style={{ flex: 1, background: "#1C1814", border: "1px solid #2A2520", color: "#7A7470", borderRadius: 9, padding: "9px", fontSize: 12, cursor: "pointer", fontFamily: "'DM Sans', sans-serif", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
                Export PDF
              </button>
              <button onClick={(handlePrint) => setShowShare(true)} style={{ flex: 1, background: "#1C1814", border: "1px solid #2A2520", color: "#7A7470", borderRadius: 9, padding: "9px", fontSize: 12, cursor: "pointer", fontFamily: "'DM Sans', sans-serif", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>
                Share & Sync
              </button>
            </div>
          )}
        </div>

        {/* Empty state */}
        {entries.length === 0 ? (
          <div style={{ textAlign: "center", padding: "80px 24px 40px" }}>
            <div style={{ fontSize: 56, marginBottom: 20 }}>🍕</div>
            <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 24, fontWeight: 600, marginBottom: 10 }}>Start your guide</div>
            <div style={{ fontSize: 14, color: "#3A3530", lineHeight: 1.8, fontWeight: 300 }}>Log your first pizza experience<br />and build your personal Michelin guide.</div>
          </div>
        ) : (
          entries.map((entry, idx) => {
            const tier = getTier(entry.weightedScore);
            return (
              <div key={entry.id} onClick={() => openDetail(entry.id)} style={{ display: "flex", alignItems: "center", padding: "16px 24px", ...divider, cursor: "pointer", gap: 14 }}>
                <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 22, fontWeight: 700, color: "#2A2520", width: 28, flexShrink: 0, textAlign: "center" }}>{idx + 1}</div>

                {/* Thumbnail */}
                {entry.photo
                  ? <img src={entry.photo} alt="" style={{ width: 44, height: 44, borderRadius: 8, objectFit: "cover", flexShrink: 0 }} />
                  : <div style={{ width: 44, height: 44, borderRadius: 8, background: "#1C1814", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>🍕</div>
                }

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 16, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginBottom: 3 }}>{entry.name}</div>
                  <div style={{ fontSize: 12, color: "#3A3530", display: "flex", gap: 5, alignItems: "center", flexWrap: "wrap" }}>
                    {entry.location && <><span>{entry.location}</span><span>·</span></>}
                    <span>{entry.style}</span><span>·</span><span>{entry.priceRange}</span>
                  </div>
                  <div style={{ display: "inline-flex", alignItems: "center", gap: 5, marginTop: 6, background: tier.bg, borderRadius: 5, padding: "2px 8px" }}>
                    <span style={{ fontSize: 10, color: tier.color, fontWeight: 600, letterSpacing: 1.5, textTransform: "uppercase" }}>{tier.icon} {tier.label}</span>
                  </div>
                </div>

                <div style={{ textAlign: "right", flexShrink: 0 }}>
                  <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 24, fontWeight: 700, color: scoreColor(entry.weightedScore), lineHeight: 1 }}>{entry.weightedScore.toFixed(1)}</div>
                  <div style={{ fontSize: 9, color: "#2A2520", letterSpacing: 1 }}>/10</div>
                </div>
              </div>
            );
          })
        )}

        <BottomNav view="list" onList={() => setView("list")} onMap={() => setView("map")} onAdd={openAdd} />
        {showShare && <ShareModal syncId={syncId} onClose={() => setShowShare(false)} />}
        <PrintView entries={entries} />
      </div>
    );
  }

  // ╔══════════════════════════════════════════════╗
  // ║  MAP VIEW                                    ║
  // ╚══════════════════════════════════════════════╝
  if (view === "map") {
    const located   = entries.filter(e => e.lat && e.lng);
    const unlocated = entries.filter(e => !e.lat);
    const mapCenter = located.length > 0 ? [located[0].lat, located[0].lng] : [41.9028, 12.4964];

    return (
      <div style={{ ...appStyle, height: "100vh", display: "flex", flexDirection: "column" }} className="pg-fade-in no-print">
        <div style={{ padding: "20px 24px 14px", ...divider, background: "#0D0B09", zIndex: 10, flexShrink: 0 }}>
          <div style={{ fontSize: 10, letterSpacing: 4, color: "#C4622D", textTransform: "uppercase", marginBottom: 4, fontWeight: 600 }}>Personal Guide · Pizza</div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
            <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 24, fontWeight: 700 }}>La Mappa</div>
            <div style={{ fontSize: 12, color: "#3A3530" }}>{located.length} of {entries.length} located</div>
          </div>
        </div>

        <div style={{ flex: 1, position: "relative", minHeight: 0 }}>
          {entries.length === 0 ? (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", color: "#3A3530" }}>
              <div style={{ fontSize: 48, marginBottom: 16 }}>🗺️</div>
              <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 20, color: "#4A4440" }}>No entries yet</div>
            </div>
          ) : (
            <MapContainer center={mapCenter} zoom={13} style={{ height: "100%", width: "100%" }} zoomControl={false}>
              <TileLayer url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png" attribution='© OpenStreetMap © CARTO' subdomains="abcd" maxZoom={19} />
              {mapFocus && <MapController center={mapFocus} />}
              {located.map(entry => (
                <CircleMarker key={entry.id} center={[entry.lat, entry.lng]} radius={13} pathOptions={{ color: "#0D0B09", weight: 2, fillColor: scoreColor(entry.weightedScore), fillOpacity: 0.92 }} eventHandlers={{ click: () => openDetail(entry.id) }}>
                  <Popup>
                    <div style={{ fontFamily: "'DM Sans', sans-serif", minWidth: 160 }}>
                      {entry.photo && <img src={entry.photo} alt="" style={{ width: "100%", height: 90, objectFit: "cover", borderRadius: 6, marginBottom: 10 }} />}
                      <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 15, fontWeight: 700, marginBottom: 6, color: "#F0EBE1" }}>{entry.name}</div>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                        <div style={{ fontSize: 10, background: getTier(entry.weightedScore).bg, borderRadius: 4, padding: "2px 8px", color: getTier(entry.weightedScore).color, fontWeight: 600, letterSpacing: 1, textTransform: "uppercase" }}>
                          {getTier(entry.weightedScore).icon} {getTier(entry.weightedScore).label}
                        </div>
                        <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 22, fontWeight: 700, color: scoreColor(entry.weightedScore) }}>{entry.weightedScore.toFixed(1)}</div>
                      </div>
                      {entry.location && <div style={{ fontSize: 11, color: "#4A4440", marginBottom: 8 }}>📍 {entry.location} · {entry.priceRange}</div>}
                      <button onClick={() => openDetail(entry.id)} style={{ width: "100%", background: "#C4622D", border: "none", color: "#F0EBE1", borderRadius: 7, padding: "7px", fontSize: 12, cursor: "pointer", fontFamily: "'DM Sans', sans-serif", fontWeight: 600 }}>
                        View details →
                      </button>
                    </div>
                  </Popup>
                </CircleMarker>
              ))}
            </MapContainer>
          )}
        </div>

        {unlocated.length > 0 && (
          <div style={{ background: "#1C1814", borderTop: "1px solid #2A2520", padding: "10px 24px", flexShrink: 0, zIndex: 10 }}>
            <div style={{ fontSize: 11, color: "#4A4440" }}><span style={{ color: "#C4622D", fontWeight: 600 }}>{unlocated.length}</span> not on map — add a location to pin them.</div>
          </div>
        )}

        <div style={{ background: "#0D0B09", borderTop: "1px solid #1C1814", padding: "10px 24px 80px", display: "flex", gap: 16, flexShrink: 0, zIndex: 10 }}>
          {[{ color: "#D4A853", label: "9+" }, { color: "#C4622D", label: "8+" }, { color: "#5B8A5B", label: "7+" }, { color: "#7A7470", label: "<7" }].map(l => (
            <div key={l.label} style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <div style={{ width: 10, height: 10, borderRadius: "50%", background: l.color }} />
              <span style={{ fontSize: 11, color: "#3A3530" }}>{l.label}</span>
            </div>
          ))}
        </div>

        <BottomNav view="map" onList={() => setView("list")} onMap={() => setView("map")} onAdd={openAdd} />
      </div>
    );
  }

  // ╔══════════════════════════════════════════════╗
  // ║  DETAIL VIEW                                 ║
  // ╚══════════════════════════════════════════════╝
  if (view === "detail" && selected) {
    const tier = getTier(selected.weightedScore);
    return (
      <div style={{ ...appStyle, paddingBottom: 40 }} className="pg-fade-in no-print">
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 20px", ...divider, position: "sticky", top: 0, background: "#0D0B09", zIndex: 10 }}>
          <button onClick={() => setView("list")} style={{ background: "none", border: "none", color: "#C4622D", fontSize: 14, cursor: "pointer", fontFamily: "'DM Sans', sans-serif" }}>← Back</button>
          <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
            {selected.lat && <button onClick={() => { setView("map"); setMapFocus([selected.lat, selected.lng]); }} style={{ background: "none", border: "none", color: "#4A4440", fontSize: 13, cursor: "pointer", fontFamily: "'DM Sans', sans-serif" }}>📍 Map</button>}
            <button onClick={() => openEdit(selected)} style={{ background: "none", border: "none", color: "#4A4440", fontSize: 13, cursor: "pointer", fontFamily: "'DM Sans', sans-serif" }}>Edit</button>
          </div>
        </div>

        {/* Photo hero */}
        {selected.photo && (
          <div style={{ height: 200, overflow: "hidden" }}>
            <img src={selected.photo} alt={selected.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          </div>
        )}

        {/* Hero info */}
        <div style={{ padding: "24px 24px 20px", ...divider }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
            <div style={{ flex: 1 }}>
              <div style={{ display: "inline-flex", alignItems: "center", gap: 6, background: tier.bg, borderRadius: 6, padding: "4px 12px", marginBottom: 12 }}>
                <span style={{ fontSize: 11, color: tier.color, fontWeight: 600, letterSpacing: 2, textTransform: "uppercase" }}>{tier.icon} {tier.label}</span>
              </div>
              <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 28, fontWeight: 700, lineHeight: 1.2, marginBottom: 6, letterSpacing: -.5 }}>{selected.name}</div>
              <div style={{ fontSize: 13, color: "#3A3530" }}>{[selected.location, selected.style, selected.priceRange].filter(Boolean).join(" · ")}</div>
            </div>
            <div style={{ textAlign: "right", flexShrink: 0 }}>
              <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 50, fontWeight: 700, color: scoreColor(selected.weightedScore), lineHeight: 1 }}>{selected.weightedScore.toFixed(1)}</div>
              <div style={{ fontSize: 11, color: "#2A2520", letterSpacing: 1 }}>/10</div>
            </div>
          </div>
          <div style={{ display: "flex", gap: 8, marginTop: 16, flexWrap: "wrap" }}>
            {selected.dish        && <Chip>{selected.dish}</Chip>}
            {selected.dateVisited && <Chip>📅 {selected.dateVisited}</Chip>}
            <Chip style={{ color: selected.wouldReturn === "Yes" ? "#5B8A5B" : selected.wouldReturn === "No" ? "#8B4040" : "#C4622D" }}>↩ {selected.wouldReturn}</Chip>
          </div>
        </div>

        {/* Score breakdown */}
        <div style={{ padding: "24px 24px 20px", ...divider }}>
          <div style={sectionLbl}>Score Breakdown</div>
          {CRITERIA.map(c => {
            const val = selected.scores[c.key] || 5;
            return (
              <div key={c.key} style={{ marginBottom: 18 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 8 }}>
                  <div><span style={{ fontSize: 14, fontWeight: 500 }}>{c.label}</span><span style={{ fontSize: 11, color: "#2A2520", marginLeft: 8 }}>{c.weight}</span></div>
                  <span style={{ fontFamily: "'Playfair Display', serif", fontSize: 22, fontWeight: 700, color: scoreColor(val) }}>{val}</span>
                </div>
                <div style={{ height: 3, background: "#1C1814", borderRadius: 2, overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${(val / 10) * 100}%`, background: scoreColor(val), borderRadius: 2 }} />
                </div>
                <div style={{ fontSize: 11, color: "#2A2520", marginTop: 4 }}>{c.sub}</div>
              </div>
            );
          })}
        </div>

        {selected.notes && (
          <div style={{ padding: "24px 24px", ...divider }}>
            <div style={sectionLbl}>Notes</div>
            <div style={{ fontFamily: "'Playfair Display', serif", fontStyle: "italic", fontSize: 16, color: "#7A7068", lineHeight: 1.9 }}>"{selected.notes}"</div>
          </div>
        )}

        <div style={{ padding: "24px 24px" }}>
          {!confirmDel ? (
            <button onClick={() => setConfirmDel(true)} style={{ width: "100%", background: "transparent", border: "1px solid #2A2520", color: "#3A3530", borderRadius: 10, padding: "12px", fontSize: 14, cursor: "pointer", fontFamily: "'DM Sans', sans-serif" }}>Remove from guide</button>
          ) : (
            <div style={{ background: "rgba(139,64,64,0.1)", border: "1px solid rgba(139,64,64,0.25)", borderRadius: 10, padding: "16px", textAlign: "center" }}>
              <div style={{ fontSize: 14, color: "#C47070", marginBottom: 14 }}>Remove "{selected.name}" from your guide?</div>
              <div style={{ display: "flex", gap: 10 }}>
                <button onClick={() => setConfirmDel(false)} style={{ flex: 1, background: "#1C1814", border: "1px solid #2A2520", color: "#F0EBE1", borderRadius: 8, padding: "10px", fontSize: 14, cursor: "pointer", fontFamily: "'DM Sans', sans-serif" }}>Cancel</button>
                <button onClick={() => deleteEntry(selected.id)} style={{ flex: 1, background: "#8B4040", border: "none", color: "#F0EBE1", borderRadius: 8, padding: "10px", fontSize: 14, cursor: "pointer", fontFamily: "'DM Sans', sans-serif", fontWeight: 500 }}>Delete</button>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ╔══════════════════════════════════════════════╗
  // ║  ADD / EDIT VIEW                             ║
  // ╚══════════════════════════════════════════════╝
  if (view === "add") {
    const canSave = form.name.trim().length > 0 && !saving;
    return (
      <div style={{ ...appStyle, paddingBottom: 60 }} className="pg-fade-in no-print">
        {/* Hidden file input */}
        <input ref={fileRef} type="file" accept="image/*" style={{ display: "none" }} onChange={handlePhotoChange} />

        {/* Sticky header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 20px", ...divider, position: "sticky", top: 0, background: "#0D0B09", zIndex: 10 }}>
          <button onClick={() => { setView(editingId ? "detail" : "list"); setEditingId(null); }} style={{ background: "none", border: "none", color: "#C4622D", fontSize: 14, cursor: "pointer", fontFamily: "'DM Sans', sans-serif" }}>Cancel</button>
          <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 17 }}>{editingId ? "Edit Entry" : "Nuova Voce"}</div>
          <button onClick={saveEntry} disabled={!canSave} style={{ background: canSave ? "#C4622D" : "#1C1814", border: "none", color: canSave ? "#F0EBE1" : "#3A3530", borderRadius: 8, padding: "8px 18px", fontSize: 14, cursor: canSave ? "pointer" : "default", fontFamily: "'DM Sans', sans-serif", fontWeight: 600, minWidth: 60 }}>
            {saving ? "…" : "Save"}
          </button>
        </div>

        {/* Live score */}
        <div style={{ margin: "16px 24px 8px", background: "#1C1814", borderRadius: 14, padding: "16px 20px", display: "flex", alignItems: "center", justifyContent: "space-between", border: `1px solid ${previewTier.bg}` }}>
          <div>
            <div style={{ fontSize: 10, color: "#3A3530", letterSpacing: 2, textTransform: "uppercase", marginBottom: 8 }}>Live Score</div>
            <div style={{ display: "inline-flex", alignItems: "center", gap: 6, background: previewTier.bg, borderRadius: 6, padding: "4px 12px" }}>
              <span style={{ fontSize: 11, color: previewTier.color, fontWeight: 600, letterSpacing: 2, textTransform: "uppercase" }}>{previewTier.icon} {previewTier.label}</span>
            </div>
          </div>
          <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 44, fontWeight: 700, color: scoreColor(previewScore), lineHeight: 1 }}>{previewScore.toFixed(1)}</div>
        </div>

        <div style={{ padding: "16px 24px 0" }}>

          {/* Photo */}
          <div style={{ ...sectionLbl, marginTop: 8 }}>Photo</div>
          {form.photo ? (
            <div style={{ position: "relative", marginBottom: 16 }}>
              <img src={form.photo} alt="" style={{ width: "100%", height: 160, objectFit: "cover", borderRadius: 12 }} />
              <button onClick={() => setForm(f => ({ ...f, photo: null }))} style={{ position: "absolute", top: 8, right: 8, background: "rgba(13,11,9,.8)", border: "none", color: "#F0EBE1", borderRadius: "50%", width: 28, height: 28, fontSize: 14, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>✕</button>
              <button onClick={() => fileRef.current?.click()} style={{ position: "absolute", bottom: 8, right: 8, background: "rgba(13,11,9,.8)", border: "none", color: "#F0EBE1", borderRadius: 8, padding: "5px 10px", fontSize: 11, cursor: "pointer", fontFamily: "'DM Sans', sans-serif" }}>Change</button>
            </div>
          ) : (
            <button onClick={() => fileRef.current?.click()} style={{ width: "100%", background: "#1C1814", border: "2px dashed #2A2520", borderRadius: 12, padding: "20px", fontSize: 13, cursor: "pointer", color: "#3A3530", fontFamily: "'DM Sans', sans-serif", marginBottom: 16, display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#3A3530" strokeWidth="1.5" strokeLinecap="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
              Add a photo
            </button>
          )}

          {/* Restaurant info */}
          <div style={sectionLbl}>Restaurant</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <input className="pg-input" placeholder="Name *" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
            <div style={{ position: "relative" }}>
              <input className="pg-input" placeholder="Location (used to pin on map)" value={form.location} onChange={e => setForm(f => ({ ...f, location: e.target.value, lat: null, lng: null }))} />
              <div style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", fontSize: 11, color: "#2A2520" }}>📍</div>
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <div style={{ flex: 1, position: "relative" }}>
                <select className="pg-select" value={form.style} onChange={e => setForm(f => ({ ...f, style: e.target.value }))}>
                  {PIZZA_STYLES.map(s => <option key={s}>{s}</option>)}
                </select>
                <span style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", color: "#4A4440", pointerEvents: "none", fontSize: 11 }}>▾</span>
              </div>
              <input className="pg-input" type="date" value={form.dateVisited} onChange={e => setForm(f => ({ ...f, dateVisited: e.target.value }))} style={{ flex: 1 }} />
            </div>
            <input className="pg-input" placeholder="Dish ordered (e.g. Margherita)" value={form.dish} onChange={e => setForm(f => ({ ...f, dish: e.target.value }))} />
          </div>

          {/* Price + Return */}
          <div style={{ display: "flex", gap: 12, marginTop: 20, marginBottom: 4 }}>
            <div style={{ flex: 1 }}>
              <div style={sectionLbl}>Price</div>
              <div style={{ display: "flex", gap: 5 }}>
                {PRICE_RANGES.map(p => (
                  <button key={p} onClick={() => setForm(f => ({ ...f, priceRange: p }))}
                    style={{ flex: 1, background: form.priceRange === p ? "#C4622D" : "#1C1814", border: `1px solid ${form.priceRange === p ? "#C4622D" : "#2A2520"}`, color: form.priceRange === p ? "#F0EBE1" : "#4A4440", borderRadius: 9, padding: "9px 0", fontSize: 11, cursor: "pointer", fontFamily: "'DM Sans', sans-serif" }}>
                    {p}
                  </button>
                ))}
              </div>
            </div>
            <div style={{ flex: 1 }}>
              <div style={sectionLbl}>Return?</div>
              <div style={{ display: "flex", gap: 6 }}>
                {["Yes", "Maybe", "No"].map(r => {
                  const rc = r === "Yes" ? "#5B8A5B" : r === "Maybe" ? "#C4622D" : "#8B4040";
                  return (
                    <button key={r} onClick={() => setForm(f => ({ ...f, wouldReturn: r }))}
                      style={{ flex: 1, background: form.wouldReturn === r ? rc : "#1C1814", border: `1px solid ${form.wouldReturn === r ? rc : "#2A2520"}`, color: form.wouldReturn === r ? "#F0EBE1" : "#4A4440", borderRadius: 9, padding: "9px 0", fontSize: 12, cursor: "pointer", fontFamily: "'DM Sans', sans-serif" }}>
                      {r}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Scores */}
          <div style={{ ...sectionLbl, marginTop: 24 }}>Scores</div>
          {CRITERIA.map(c => (
            <div key={c.key} style={{ marginBottom: 24 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 12 }}>
                <div>
                  <span style={{ fontSize: 15, fontWeight: 500 }}>{c.label}</span>
                  <span style={{ fontSize: 11, color: "#2A2520", marginLeft: 8 }}>{c.weight}</span>
                </div>
                <span style={{ fontFamily: "'Playfair Display', serif", fontSize: 26, fontWeight: 700, color: scoreColor(form.scores[c.key]) }}>{form.scores[c.key]}</span>
              </div>
              <ScoreSlider value={form.scores[c.key]} onChange={v => setForm(f => ({ ...f, scores: { ...f.scores, [c.key]: v } }))} />
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "#2A2520", marginTop: 6 }}>
                <span>1 · poor</span><span>5 · average</span><span>10 · perfect</span>
              </div>
              <div style={{ fontSize: 11, color: "#2A2520", marginTop: 4 }}>{c.sub}</div>
            </div>
          ))}

          {/* Notes */}
          <div style={sectionLbl}>Notes</div>
          <textarea className="pg-textarea" placeholder="What stood out? Any memorable detail about this visit…" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
          <div style={{ height: 24 }} />
        </div>
      </div>
    );
  }

  return <div style={appStyle} />;
}

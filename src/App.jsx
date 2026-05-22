import { useState, useEffect, useRef, useMemo } from "react";
import { MapContainer, TileLayer, CircleMarker, Popup, useMap } from "react-leaflet";

// ─── Cuisine Config ──────────────────────────────────────────────────────────
const CUISINE_CONFIGS = {
  pizza: {
    label: "Pizza", icon: "🍕", subtitle: "Pizzerie",
    styles: ["Neapolitan", "New York", "Roman", "Detroit", "Sicilian", "Other"],
    weights: { dough: 0.25, toppings: 0.21, value: 0.18, tiramisu: 0.16, ambiance: 0.12, drinks: 0.08 },
    criteria: [
      { key: "dough",    label: "Dough & Crust",     sub: "texture · char · structure",    weight: "25%" },
      { key: "toppings", label: "Toppings",           sub: "quality · origin · balance",    weight: "21%" },
      { key: "value",    label: "Value for Money",    sub: "price vs experience",           weight: "18%" },
      { key: "tiramisu", label: "Tiramisu",           sub: "texture · cream · bitterness",  weight: "16%" },
      { key: "ambiance", label: "Ambiance & Service", sub: "atmosphere · speed · care",     weight: "12%" },
      { key: "drinks",   label: "Drinks",             sub: "wine · cocktails · selection",  weight: "8%"  },
    ],
  },
  pasta: {
    label: "Pasta", icon: "🍝", subtitle: "Ristoranti",
    styles: ["Trattoria", "Osteria", "Ristorante", "Casual", "Other"],
    weights: { pasta: 0.30, sauce: 0.25, value: 0.20, ambiance: 0.15, drinks: 0.10 },
    criteria: [
      { key: "pasta",    label: "Pasta Quality",      sub: "texture · al dente · freshness",    weight: "30%" },
      { key: "sauce",    label: "Sauce",              sub: "depth · balance · aroma",            weight: "25%" },
      { key: "value",    label: "Value for Money",    sub: "price vs experience",                weight: "20%" },
      { key: "ambiance", label: "Ambiance & Service", sub: "atmosphere · speed · care",          weight: "15%" },
      { key: "drinks",   label: "Drinks",             sub: "wine · cocktails · selection",       weight: "10%" },
    ],
  },
  sushi: {
    label: "Sushi", icon: "🍣", subtitle: "Ristoranti Giapponesi",
    styles: ["Omakase", "Kaiten", "Izakaya", "Fusion", "Other"],
    weights: { fish: 0.30, rice: 0.25, value: 0.20, ambiance: 0.15, drinks: 0.10 },
    criteria: [
      { key: "fish",     label: "Fish Quality",       sub: "freshness · cut · variety",           weight: "30%" },
      { key: "rice",     label: "Rice",               sub: "seasoning · temperature · texture",   weight: "25%" },
      { key: "value",    label: "Value for Money",    sub: "price vs experience",                 weight: "20%" },
      { key: "ambiance", label: "Ambiance & Service", sub: "atmosphere · speed · care",           weight: "15%" },
      { key: "drinks",   label: "Drinks",             sub: "sake · beer · selection",             weight: "10%" },
    ],
  },
  burgers: {
    label: "Burgers", icon: "🍔", subtitle: "Burger Joints",
    styles: ["Smash", "Classic", "Gourmet", "Fast Food", "Other"],
    weights: { patty: 0.30, bun: 0.20, toppings: 0.18, value: 0.20, ambiance: 0.12 },
    criteria: [
      { key: "patty",    label: "Patty",              sub: "meat quality · cook · seasoning",    weight: "30%" },
      { key: "bun",      label: "Bun",                sub: "texture · toasting · freshness",     weight: "20%" },
      { key: "toppings", label: "Toppings & Sauce",   sub: "balance · freshness · creativity",   weight: "18%" },
      { key: "value",    label: "Value for Money",    sub: "price vs experience",                weight: "20%" },
      { key: "ambiance", label: "Ambiance & Service", sub: "atmosphere · speed · care",          weight: "12%" },
    ],
  },
};

const PRICE_RANGES  = ["€", "€€", "€€€", "€€€€"];
const STORAGE_KEY   = "la-guida-v3";
const WISHLIST_KEY  = "la-guida-wishlist-v3";
const SYNC_ID_KEY   = "la-guida-syncid-v3";
const THEME_KEY     = "la-guida-theme";
const INITIALS_KEY  = "la-guida-initials";
const CUISINE_KEY   = "la-guida-cuisine";

const TIERS = ["Leggendaria", "Eccellente", "Buona", "Nella media", "Evita"];

// ─── Helpers ─────────────────────────────────────────────────────────────────
function calcScore(scores, cuisine = "pizza") {
  const weights = CUISINE_CONFIGS[cuisine]?.weights || CUISINE_CONFIGS.pizza.weights;
  return Object.entries(weights).reduce((acc, [k, w]) => acc + (Number(scores[k]) || 5) * w, 0);
}

function getTier(s) {
  if (s >= 9) return { label: "Leggendaria", icon: "◈", color: "#D4A853", bg: "rgba(212,168,83,0.14)" };
  if (s >= 8) return { label: "Eccellente",  icon: "◆", color: "#C4622D", bg: "rgba(196,98,45,0.14)"  };
  if (s >= 7) return { label: "Buona",       icon: "◇", color: "#5B8A5B", bg: "rgba(91,138,91,0.14)"  };
  if (s >= 6) return { label: "Nella media", icon: "◻", color: "#7A7470", bg: "rgba(122,116,112,0.14)" };
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
    const res  = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=1`, { headers: { "User-Agent": "LaGuida/3.0" } });
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
      method: "POST", headers: { "Content-Type": "application/json" },
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

// ─── Print ────────────────────────────────────────────────────────────────────
function handlePrint(entries, cuisineKey = "pizza") {
  const config = CUISINE_CONFIGS[cuisineKey] || CUISINE_CONFIGS.pizza;
  const { criteria } = config;
  const win  = window.open("", "_blank", "width=1100,height=750");
  if (!win) return;
  const date = new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "long", year: "numeric" });
  const thStyle = `text-align:center;padding:8px 10px;border-bottom:2px solid #ddd;font-size:10px;letter-spacing:1.5px;text-transform:uppercase;color:#888;font-weight:600;white-space:nowrap;`;
  const thLeft  = thStyle.replace("text-align:center", "text-align:left");
  const criteriaHeaders = criteria.map(c =>
    `<th style="${thStyle}">${c.label}<br><span style="font-weight:400;color:#bbb;">${c.weight}</span></th>`
  ).join("");
  const rows = entries.map((e, idx) => {
    const tier  = getTier(e.weightedScore);
    const cells = criteria.map(c => {
      const val = e.scores?.[c.key] ?? 5;
      return `<td style="padding:9px 10px;border-bottom:1px solid #f0f0f0;font-size:13px;color:${scoreColor(val)};font-weight:600;text-align:center;">${e.scores?.[c.key] ?? "—"}</td>`;
    }).join("");
    return `<tr>
      <td style="padding:9px 10px;border-bottom:1px solid #f0f0f0;color:#bbb;font-weight:600;text-align:center;">${idx + 1}</td>
      <td style="padding:9px 10px;border-bottom:1px solid #f0f0f0;">
        <div style="font-family:Georgia,serif;font-size:15px;font-weight:700;">${e.name}</div>
        ${e.location ? `<div style="font-size:11px;color:#888;margin-top:2px;">📍 ${e.location}</div>` : ""}
        ${e.dish     ? `<div style="font-size:11px;color:#aaa;">${e.style} · ${e.dish} · ${e.priceRange}</div>` : ""}
        ${e.addedBy  ? `<div style="font-size:10px;color:#bbb;margin-top:2px;">By ${e.addedBy}</div>` : ""}
        ${e.notes    ? `<div style="font-size:11px;color:#bbb;font-style:italic;margin-top:3px;">"${e.notes}"</div>` : ""}
      </td>
      <td style="padding:9px 10px;border-bottom:1px solid #f0f0f0;text-align:center;">
        <span style="font-family:Georgia,serif;font-size:22px;font-weight:700;color:${scoreColor(e.weightedScore)};">${e.weightedScore.toFixed(1)}</span>
        <div style="font-size:9px;color:#bbb;">/10</div>
      </td>
      <td style="padding:9px 10px;border-bottom:1px solid #f0f0f0;font-size:10px;font-weight:600;color:${tier.color};letter-spacing:1px;text-transform:uppercase;white-space:nowrap;">${tier.icon} ${tier.label}</td>
      ${cells}
      <td style="padding:9px 10px;border-bottom:1px solid #f0f0f0;font-size:12px;text-align:center;color:${e.wouldReturn === "Yes" ? "#5B8A5B" : e.wouldReturn === "No" ? "#8B4040" : "#888"};">${e.wouldReturn}</td>
    </tr>`;
  }).join("");
  win.document.write(`<!DOCTYPE html><html><head>
  <meta charset="UTF-8"><title>La Guida — ${config.label}</title>
  <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;700&family=DM+Sans:wght@400;500&display=swap" rel="stylesheet">
  <style>*{box-sizing:border-box;}body{font-family:'DM Sans',sans-serif;padding:40px;color:#111;background:#fff;margin:0;}@media print{@page{margin:15mm;size:landscape;}body{padding:0;}}</style>
  </head><body>
  <div style="border-bottom:2px solid #C4622D;padding-bottom:14px;margin-bottom:24px;display:flex;justify-content:space-between;align-items:flex-end;">
    <div>
      <div style="font-size:10px;letter-spacing:3px;color:#C4622D;text-transform:uppercase;margin-bottom:6px;font-weight:600;">Personal Restaurant Guide</div>
      <div style="font-family:'Playfair Display',Georgia,serif;font-size:26px;font-weight:700;margin:0 0 4px;">La Guida — ${config.label}</div>
      <div style="font-size:12px;color:#aaa;">Exported ${date} · ${entries.length} restaurant${entries.length !== 1 ? "s" : ""}</div>
    </div>
    <div style="text-align:right;font-size:10px;color:#ccc;line-height:1.8;">${criteria.map(c => `${c.label} <strong>${c.weight}</strong>`).join("<br>")}</div>
  </div>
  <table style="width:100%;border-collapse:collapse;font-size:13px;">
    <thead><tr><th style="${thStyle}">#</th><th style="${thLeft}">Restaurant</th><th style="${thStyle}">Score</th><th style="${thLeft}">Tier</th>${criteriaHeaders}<th style="${thStyle}">Return?</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>
  <div style="margin-top:32px;font-size:10px;color:#ccc;text-align:center;border-top:1px solid #eee;padding-top:12px;">La Guida · Personal Restaurant Guide</div>
  <script>window.onload=()=>setTimeout(()=>window.print(),600);</script>
  </body></html>`);
  win.document.close();
}

// ─── Form defaults ────────────────────────────────────────────────────────────
function freshForm(cuisine = "pizza", initials = "") {
  const config = CUISINE_CONFIGS[cuisine] || CUISINE_CONFIGS.pizza;
  const scores = {};
  config.criteria.forEach(c => { scores[c.key] = 7; });
  return {
    name: "", location: "", style: config.styles[0],
    dateVisited: new Date().toISOString().split("T")[0],
    dish: "", priceRange: "€€", scores, notes: "", wouldReturn: "Yes",
    cuisine, lat: null, lng: null, photo: null, addedBy: initials,
  };
}

function freshWishForm(cuisine = "pizza") {
  return {
    name: "", location: "", style: "", notes: "", cuisine,
    lat: null, lng: null, photo: null,
    dateAdded: new Date().toISOString().split("T")[0],
  };
}

// ─── Small components ─────────────────────────────────────────────────────────
function Chip({ children, style }) {
  return (
    <span style={{ fontSize: 12, background: "var(--surface)", borderRadius: 7, padding: "5px 12px", color: "var(--muted)", border: "1px solid var(--border)", display: "inline-block", ...style }}>
      {children}
    </span>
  );
}

function ScoreSlider({ value, onChange }) {
  const fill = `${((value - 1) / 9) * 100}%`;
  const bg   = `linear-gradient(to right, ${scoreColor(value)} 0%, ${scoreColor(value)} ${fill}, var(--border) ${fill}, var(--border) 100%)`;
  return (
    <input type="range" min={1} max={10} step={1} value={value}
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

// ─── Bottom Nav (4 items) ─────────────────────────────────────────────────────
function BottomNav({ view, onList, onWish, onMap, onAdd }) {
  if (["add", "detail", "wishlist-add"].includes(view)) return null;
  const s = v => ({ fontSize: 9, letterSpacing: 1.5, textTransform: "uppercase", color: view === v ? "#C4622D" : "var(--dim)", fontWeight: 600, marginTop: 3 });
  const btnStyle = { background: "none", border: "none", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", padding: "4px 12px" };
  const ic = v => view === v ? "#C4622D" : "var(--dim)";
  return (
    <div style={{ position: "fixed", bottom: 0, left: "50%", transform: "translateX(-50%)", width: "100%", maxWidth: 430, background: "rgba(13,11,9,0.96)", borderTop: "1px solid var(--border2)", display: "flex", alignItems: "center", justifyContent: "space-around", padding: "10px 16px 20px", zIndex: 1000, backdropFilter: "blur(12px)" }}>
      <button onClick={onList} style={btnStyle}>
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={ic("list")} strokeWidth="2" strokeLinecap="round">
          <line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/>
          <line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/>
        </svg>
        <span style={s("list")}>Lista</span>
      </button>

      <button onClick={onWish} style={btnStyle}>
        <svg width="22" height="22" viewBox="0 0 24 24" fill={view === "wishlist" ? "#C4622D" : "none"} stroke={ic("wishlist")} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
        </svg>
        <span style={s("wishlist")}>Wishlist</span>
      </button>

      <button onClick={onAdd} style={{ background: "#C4622D", border: "none", width: 52, height: 52, borderRadius: "50%", color: "#F0EBE1", fontSize: 26, cursor: "pointer", boxShadow: "0 4px 20px rgba(196,98,45,.6)", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 300, marginTop: -10 }}>+</button>

      <button onClick={onMap} style={btnStyle}>
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={ic("map")} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polygon points="3 6 9 3 15 6 21 3 21 18 15 21 9 18 3 21"/>
          <line x1="9" y1="3" x2="9" y2="18"/><line x1="15" y1="6" x2="15" y2="21"/>
        </svg>
        <span style={s("map")}>Mappa</span>
      </button>
    </div>
  );
}

// ─── Share Modal (with QR code) ───────────────────────────────────────────────
function ShareModal({ syncId, onClose }) {
  const [copied, setCopied] = useState(false);
  const url = `${window.location.origin}${window.location.pathname}?sync=${syncId}`;
  async function copy() {
    try { await navigator.clipboard.writeText(url); } catch {}
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${encodeURIComponent(url)}&bgcolor=1C1814&color=F0EBE1&margin=8`;
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)", zIndex: 2000, display: "flex", alignItems: "flex-end", justifyContent: "center" }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{ background: "var(--surface)", borderRadius: "18px 18px 0 0", padding: "24px 24px 36px", width: "100%", maxWidth: 430, border: "1px solid var(--border)", borderBottom: "none" }}>
        <div style={{ width: 36, height: 4, background: "var(--border)", borderRadius: 2, margin: "0 auto 20px" }} />
        <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 20, fontWeight: 600, marginBottom: 8, color: "var(--text)" }}>Share your guide</div>
        <div style={{ fontSize: 13, color: "var(--muted)", lineHeight: 1.7, marginBottom: 20 }}>
          Anyone who opens this link will see your entries and stay in sync automatically.
        </div>
        <div style={{ display: "flex", gap: 16, alignItems: "flex-start", marginBottom: 16 }}>
          <div style={{ flex: 1 }}>
            <div style={{ background: "var(--bg)", border: "1px solid var(--border)", borderRadius: 10, padding: "12px 14px", fontSize: 11, color: "var(--muted)", wordBreak: "break-all", lineHeight: 1.6, fontFamily: "monospace", marginBottom: 8 }}>
              {url}
            </div>
            <div style={{ fontSize: 11, color: "var(--dim)" }}>⚠️ Photos are stored locally only.</div>
          </div>
          <div style={{ flexShrink: 0 }}>
            <img src={qrUrl} alt="QR Code" width={80} height={80} style={{ borderRadius: 8, display: "block" }} />
          </div>
        </div>
        <button onClick={copy} style={{ width: "100%", background: copied ? "#5B8A5B" : "#C4622D", border: "none", color: "#F0EBE1", borderRadius: 12, padding: "14px", fontSize: 15, cursor: "pointer", fontFamily: "'DM Sans', sans-serif", fontWeight: 600, transition: "background .2s", marginBottom: 10 }}>
          {copied ? "✓ Copied!" : "Copy link"}
        </button>
        <button onClick={onClose} style={{ width: "100%", background: "transparent", border: "1px solid var(--border)", color: "var(--muted)", borderRadius: 12, padding: "13px", fontSize: 14, cursor: "pointer", fontFamily: "'DM Sans', sans-serif" }}>Done</button>
      </div>
    </div>
  );
}

// ─── Filter Sheet ─────────────────────────────────────────────────────────────
function FilterSheet({ cuisineStyles, filterTiers, filterStyles, filterPrices, onToggleTier, onToggleStyle, onTogglePrice, onClear, onClose }) {
  const hasFilters = filterTiers.length + filterStyles.length + filterPrices.length > 0;
  const Section = ({ label, children }) => (
    <div style={{ marginBottom: 20 }}>
      <div style={{ fontSize: 10, letterSpacing: 2, color: "#C4622D", textTransform: "uppercase", fontWeight: 600, marginBottom: 12 }}>{label}</div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>{children}</div>
    </div>
  );
  const ChipBtn = ({ label, active, onClick }) => (
    <button onClick={onClick} style={{ background: active ? "#C4622D" : "var(--bg)", border: `1px solid ${active ? "#C4622D" : "var(--border)"}`, color: active ? "#F0EBE1" : "var(--muted)", borderRadius: 20, padding: "7px 14px", fontSize: 13, cursor: "pointer", fontFamily: "'DM Sans', sans-serif", transition: "all .15s" }}>
      {label}
    </button>
  );
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", zIndex: 2000, display: "flex", alignItems: "flex-end" }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{ background: "var(--surface)", borderRadius: "18px 18px 0 0", padding: "24px 24px 36px", width: "100%", maxWidth: 430, margin: "0 auto", border: "1px solid var(--border)", borderBottom: "none", maxHeight: "80vh", overflowY: "auto" }}>
        <div style={{ width: 36, height: 4, background: "var(--border)", borderRadius: 2, margin: "0 auto 24px" }} />
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 18, fontWeight: 600, color: "var(--text)" }}>Filters</div>
          {hasFilters && <button onClick={onClear} style={{ background: "none", border: "none", color: "#C4622D", fontSize: 13, cursor: "pointer", fontFamily: "'DM Sans', sans-serif" }}>Clear all</button>}
        </div>
        <Section label="Tier">
          {TIERS.map(t => <ChipBtn key={t} label={t} active={filterTiers.includes(t)} onClick={() => onToggleTier(t)} />)}
        </Section>
        <Section label="Price">
          {PRICE_RANGES.map(p => <ChipBtn key={p} label={p} active={filterPrices.includes(p)} onClick={() => onTogglePrice(p)} />)}
        </Section>
        {cuisineStyles.length > 0 && (
          <Section label="Style">
            {cuisineStyles.map(s => <ChipBtn key={s} label={s} active={filterStyles.includes(s)} onClick={() => onToggleStyle(s)} />)}
          </Section>
        )}
        <button onClick={onClose} style={{ width: "100%", background: "#C4622D", border: "none", color: "#F0EBE1", borderRadius: 12, padding: "14px", fontSize: 15, cursor: "pointer", fontFamily: "'DM Sans', sans-serif", fontWeight: 600 }}>Apply</button>
      </div>
    </div>
  );
}

// ─── Sort Sheet ───────────────────────────────────────────────────────────────
function SortSheet({ sortBy, onSort, criteria, onClose }) {
  const options = [
    { key: "score_desc", label: "Score: High → Low" },
    { key: "score_asc",  label: "Score: Low → High" },
    { key: "date_new",   label: "Date: Newest first" },
    { key: "date_old",   label: "Date: Oldest first" },
    { key: "az",         label: "Name: A → Z" },
    { key: "za",         label: "Name: Z → A" },
    ...criteria.map(c => ({ key: c.key, label: `Best ${c.label}` })),
  ];
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", zIndex: 2000, display: "flex", alignItems: "flex-end" }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{ background: "var(--surface)", borderRadius: "18px 18px 0 0", padding: "24px 24px 36px", width: "100%", maxWidth: 430, margin: "0 auto", border: "1px solid var(--border)", borderBottom: "none" }}>
        <div style={{ width: 36, height: 4, background: "var(--border)", borderRadius: 2, margin: "0 auto 24px" }} />
        <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 18, fontWeight: 600, marginBottom: 20, color: "var(--text)" }}>Sort by</div>
        {options.map(o => (
          <button key={o.key} onClick={() => { onSort(o.key); onClose(); }}
            style={{ display: "flex", width: "100%", alignItems: "center", justifyContent: "space-between", background: "none", border: "none", borderBottom: "1px solid var(--border2)", padding: "14px 4px", cursor: "pointer", fontFamily: "'DM Sans', sans-serif", fontSize: 14, color: sortBy === o.key ? "#C4622D" : "var(--text)", fontWeight: sortBy === o.key ? 600 : 400 }}>
            {o.label}
            {sortBy === o.key && <span style={{ fontSize: 16 }}>✓</span>}
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── Settings Panel ───────────────────────────────────────────────────────────
function SettingsPanel({ theme, onTheme, userInitials, onInitials, onClose }) {
  const [initials, setInitials] = useState(userInitials);
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", zIndex: 2000, display: "flex", alignItems: "flex-end" }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{ background: "var(--surface)", borderRadius: "18px 18px 0 0", padding: "24px 24px 40px", width: "100%", maxWidth: 430, margin: "0 auto", border: "1px solid var(--border)", borderBottom: "none" }}>
        <div style={{ width: 36, height: 4, background: "var(--border)", borderRadius: 2, margin: "0 auto 24px" }} />
        <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 18, fontWeight: 600, marginBottom: 24, color: "var(--text)" }}>Settings</div>

        <div style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 10, letterSpacing: 2, color: "#C4622D", textTransform: "uppercase", fontWeight: 600, marginBottom: 10 }}>Appearance</div>
          <div style={{ display: "flex", gap: 10 }}>
            {["dark", "light"].map(t => (
              <button key={t} onClick={() => onTheme(t)} style={{ flex: 1, background: theme === t ? "#C4622D" : "var(--bg)", border: `1px solid ${theme === t ? "#C4622D" : "var(--border)"}`, color: theme === t ? "#F0EBE1" : "var(--muted)", borderRadius: 10, padding: "11px", fontSize: 13, cursor: "pointer", fontFamily: "'DM Sans', sans-serif", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
                {t === "dark" ? "🌙 Dark" : "☀️ Light"}
              </button>
            ))}
          </div>
        </div>

        <div style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 10, letterSpacing: 2, color: "#C4622D", textTransform: "uppercase", fontWeight: 600, marginBottom: 10 }}>Your Initials</div>
          <div style={{ fontSize: 12, color: "var(--dim)", marginBottom: 10, lineHeight: 1.6 }}>
            Added to your entries to identify your contributions in a shared guide.
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <input
              className="pg-input"
              placeholder="e.g. GR"
              value={initials}
              maxLength={3}
              onChange={e => setInitials(e.target.value.toUpperCase())}
              style={{ flex: 1, textTransform: "uppercase", letterSpacing: 2, fontWeight: 600 }}
            />
            <button onClick={() => { onInitials(initials); onClose(); }} style={{ background: "#C4622D", border: "none", color: "#F0EBE1", borderRadius: 10, padding: "0 18px", fontSize: 14, cursor: "pointer", fontFamily: "'DM Sans', sans-serif", fontWeight: 600 }}>Save</button>
          </div>
        </div>

        <button onClick={onClose} style={{ width: "100%", background: "transparent", border: "1px solid var(--border)", color: "var(--muted)", borderRadius: 12, padding: "13px", fontSize: 14, cursor: "pointer", fontFamily: "'DM Sans', sans-serif" }}>Close</button>
      </div>
    </div>
  );
}

// ─── Cuisine Switcher ─────────────────────────────────────────────────────────
function CuisineSwitcher({ active, onChange }) {
  return (
    <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 2, WebkitOverflowScrolling: "touch", scrollbarWidth: "none" }}>
      {Object.entries(CUISINE_CONFIGS).map(([key, cfg]) => (
        <button key={key} onClick={() => onChange(key)}
          style={{ flexShrink: 0, background: active === key ? "#C4622D" : "var(--surface)", border: `1px solid ${active === key ? "#C4622D" : "var(--border)"}`, color: active === key ? "#F0EBE1" : "var(--muted)", borderRadius: 20, padding: "6px 14px", fontSize: 13, cursor: "pointer", fontFamily: "'DM Sans', sans-serif", fontWeight: active === key ? 600 : 400, display: "flex", alignItems: "center", gap: 5, transition: "all .15s", whiteSpace: "nowrap" }}>
          <span>{cfg.icon}</span> {cfg.label}
        </button>
      ))}
    </div>
  );
}

// ─── Main App ─────────────────────────────────────────────────────────────────
export default function App() {
  const [view, setView]               = useState("list");
  const [entries, setEntries]         = useState([]);
  const [wishlist, setWishlist]       = useState([]);
  const [form, setForm]               = useState(freshForm());
  const [wishForm, setWishForm]       = useState(freshWishForm());
  const [selectedId, setSelectedId]   = useState(null);
  const [editingId, setEditingId]     = useState(null);
  const [editingWishId, setEditingWishId] = useState(null);
  const [confirmDel, setConfirmDel]   = useState(false);
  const [saving, setSaving]           = useState(false);
  const [syncId, setSyncId]           = useState(null);
  const [syncStatus, setSyncStatus]   = useState("idle");
  const [showShare, setShowShare]     = useState(false);
  const [showFilter, setShowFilter]   = useState(false);
  const [showSort, setShowSort]       = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [mapFocus, setMapFocus]       = useState(null);
  const [activeCuisine, setActiveCuisine] = useState("pizza");
  const [theme, setTheme]             = useState("dark");
  const [userInitials, setUserInitials] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [filterTiers, setFilterTiers] = useState([]);
  const [filterStyles, setFilterStyles] = useState([]);
  const [filterPrices, setFilterPrices] = useState([]);
  const [sortBy, setSortBy]           = useState("score_desc");
  const fileRef                       = useRef();

  // ── Bootstrap ──────────────────────────────────────────────────────────────
  useEffect(() => {
    const params      = new URLSearchParams(window.location.search);
    const urlSyncId   = params.get("sync");
    const localSyncId = localStorage.getItem(SYNC_ID_KEY);
    const savedTheme  = localStorage.getItem(THEME_KEY);
    const savedInit   = localStorage.getItem(INITIALS_KEY);
    const savedCuisine = localStorage.getItem(CUISINE_KEY);

    if (savedTheme) setTheme(savedTheme);
    if (savedInit)  setUserInitials(savedInit);
    if (savedCuisine && CUISINE_CONFIGS[savedCuisine]) setActiveCuisine(savedCuisine);

    async function bootstrap() {
      let activeSyncId;
      if (urlSyncId) {
        activeSyncId = urlSyncId;
        localStorage.setItem(SYNC_ID_KEY, urlSyncId);
        window.history.replaceState({}, "", window.location.pathname);
      } else if (localSyncId) {
        activeSyncId = localSyncId;
      } else {
        activeSyncId = generateUUID();
        localStorage.setItem(SYNC_ID_KEY, activeSyncId);
      }
      setSyncId(activeSyncId);

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

      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw) setEntries(JSON.parse(raw));
      } catch {}
      try {
        const rawWish = localStorage.getItem(WISHLIST_KEY);
        if (rawWish) setWishlist(JSON.parse(rawWish));
      } catch {}
      setSyncStatus("ok");
    }
    bootstrap();
  }, []);

  // Apply theme to root element
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem(THEME_KEY, theme);
  }, [theme]);

  // Persist cuisine choice
  useEffect(() => {
    localStorage.setItem(CUISINE_KEY, activeCuisine);
    setFilterStyles([]);
    setFilterTiers([]);
    setFilterPrices([]);
    setSortBy("score_desc");
  }, [activeCuisine]);

  function persist(data, activeSyncId) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    if (activeSyncId) {
      setSyncStatus("syncing");
      pushToCloud(activeSyncId, data).then(ok => setSyncStatus(ok ? "ok" : "error"));
    }
  }

  function persistWish(data) {
    setWishlist(data);
    localStorage.setItem(WISHLIST_KEY, JSON.stringify(data));
  }

  function sorted(arr) { return [...arr].sort((a, b) => b.weightedScore - a.weightedScore); }

  async function saveEntry() {
    setSaving(true);
    let lat = form.lat, lng = form.lng;
    if (form.location?.trim() && !lat) {
      const coords = await geocodeLocation(form.location);
      if (coords) { lat = coords.lat; lng = coords.lng; }
    }
    const score = parseFloat(calcScore(form.scores, form.cuisine).toFixed(1));
    const entry = { ...form, id: editingId || String(Date.now()), weightedScore: score, lat, lng, addedBy: form.addedBy || userInitials };
    const next  = sorted(editingId ? entries.map(e => e.id === editingId ? entry : e) : [...entries, entry]);
    setEntries(next);
    persist(next, syncId);
    setSaving(false);
    setView(editingId ? "detail" : "list");
    setEditingId(null);
    setForm(freshForm(activeCuisine, userInitials));
  }

  async function saveWishEntry() {
    setSaving(true);
    let lat = wishForm.lat, lng = wishForm.lng;
    if (wishForm.location?.trim() && !lat) {
      const coords = await geocodeLocation(wishForm.location);
      if (coords) { lat = coords.lat; lng = coords.lng; }
    }
    const item = { ...wishForm, id: editingWishId || String(Date.now()), lat, lng };
    const next = editingWishId ? wishlist.map(w => w.id === editingWishId ? item : w) : [...wishlist, item];
    persistWish(next);
    setSaving(false);
    setView("wishlist");
    setEditingWishId(null);
    setWishForm(freshWishForm(activeCuisine));
  }

  function deleteEntry(id) {
    const next = entries.filter(e => e.id !== id);
    setEntries(next);
    persist(next, syncId);
    setView("list");
    setSelectedId(null);
    setConfirmDel(false);
  }

  function deleteWish(id) {
    persistWish(wishlist.filter(w => w.id !== id));
  }

  function rateNow(wishItem) {
    const cuisine = wishItem.cuisine || activeCuisine;
    const config  = CUISINE_CONFIGS[cuisine] || CUISINE_CONFIGS.pizza;
    const scores  = {};
    config.criteria.forEach(c => { scores[c.key] = 7; });
    setForm({
      name: wishItem.name, location: wishItem.location || "", style: config.styles[0],
      dateVisited: new Date().toISOString().split("T")[0], dish: "", priceRange: "€€",
      scores, notes: wishItem.notes || "", wouldReturn: "Yes", cuisine,
      lat: wishItem.lat || null, lng: wishItem.lng || null, photo: null, addedBy: userInitials,
    });
    setEditingId(null);
    setView("add");
    persistWish(wishlist.filter(w => w.id !== wishItem.id));
  }

  function openEdit(entry)  { setForm({ ...entry, scores: { ...entry.scores } }); setEditingId(entry.id); setView("add"); }
  function openDetail(id)   { setSelectedId(id); setConfirmDel(false); setView("detail"); }
  function openAdd()        {
    if (view === "wishlist") {
      setWishForm(freshWishForm(activeCuisine));
      setEditingWishId(null);
      setView("wishlist-add");
    } else {
      setForm(freshForm(activeCuisine, userInitials));
      setEditingId(null);
      setView("add");
    }
  }

  async function handlePhoto(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setForm(f => ({ ...f, photo: null }));
    const compressed = await compressImage(file);
    setForm(f => ({ ...f, photo: compressed }));
  }

  function handleInitials(val) {
    setUserInitials(val);
    localStorage.setItem(INITIALS_KEY, val);
  }

  function toggleFilter(arr, setArr, val) {
    setArr(arr.includes(val) ? arr.filter(x => x !== val) : [...arr, val]);
  }

  const cuisineConfig  = CUISINE_CONFIGS[activeCuisine] || CUISINE_CONFIGS.pizza;
  const selected       = entries.find(e => e.id === selectedId);
  const previewScore   = parseFloat(calcScore(form.scores, form.cuisine || activeCuisine).toFixed(1));
  const previewTier    = getTier(previewScore);
  const syncDot        = { idle: "var(--dimmer)", syncing: "#C4622D", ok: "#5B8A5B", error: "#8B4040" }[syncStatus];
  const hasFilters     = filterTiers.length + filterStyles.length + filterPrices.length > 0;

  const app    = { fontFamily: "'DM Sans', sans-serif", background: "var(--bg)", minHeight: "100vh", color: "var(--text)", maxWidth: 430, margin: "0 auto", position: "relative" };
  const secLbl = { fontSize: 10, letterSpacing: 3, color: "#C4622D", textTransform: "uppercase", marginBottom: 14, fontWeight: 600 };
  const divBdr = { borderBottom: "1px solid var(--border2)" };

  // Filtered + sorted entries for list view
  const visibleEntries = useMemo(() => {
    let filtered = entries.filter(e => (e.cuisine || "pizza") === activeCuisine);
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(e =>
        e.name.toLowerCase().includes(q) ||
        (e.location || "").toLowerCase().includes(q) ||
        (e.dish || "").toLowerCase().includes(q)
      );
    }
    if (filterTiers.length)  filtered = filtered.filter(e => filterTiers.includes(getTier(e.weightedScore).label));
    if (filterStyles.length) filtered = filtered.filter(e => filterStyles.includes(e.style));
    if (filterPrices.length) filtered = filtered.filter(e => filterPrices.includes(e.priceRange));

    return [...filtered].sort((a, b) => {
      switch (sortBy) {
        case "score_asc": return a.weightedScore - b.weightedScore;
        case "date_new":  return new Date(b.dateVisited || 0) - new Date(a.dateVisited || 0);
        case "date_old":  return new Date(a.dateVisited || 0) - new Date(b.dateVisited || 0);
        case "az":        return a.name.localeCompare(b.name);
        case "za":        return b.name.localeCompare(a.name);
        default:
          if (cuisineConfig.criteria.find(c => c.key === sortBy))
            return (b.scores?.[sortBy] || 5) - (a.scores?.[sortBy] || 5);
          return b.weightedScore - a.weightedScore;
      }
    });
  }, [entries, activeCuisine, searchQuery, filterTiers, filterStyles, filterPrices, sortBy]);

  // ╔══════════════════════════════════════════════╗
  // ║  LIST                                        ║
  // ╚══════════════════════════════════════════════╝
  if (view === "list") {
    const cuisineEntries = entries.filter(e => (e.cuisine || "pizza") === activeCuisine);
    const avg    = cuisineEntries.length ? (cuisineEntries.reduce((s, e) => s + e.weightedScore, 0) / cuisineEntries.length).toFixed(1) : null;
    const topCnt = cuisineEntries.filter(e => e.weightedScore >= 8).length;

    return (
      <div style={{ ...app, paddingBottom: 90 }} className="pg-fade-in">
        <div style={{ padding: "32px 24px 16px", ...divBdr }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div>
              <div style={{ fontSize: 10, letterSpacing: 4, color: "#C4622D", textTransform: "uppercase", marginBottom: 6, fontWeight: 600 }}>Personal Guide</div>
              <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 36, fontWeight: 700, lineHeight: 1, letterSpacing: -1, color: "var(--text)" }}>La Guida</div>
              <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 14, fontStyle: "italic", color: "var(--dim)", marginTop: 4 }}>{cuisineConfig.subtitle}</div>
            </div>
            <div style={{ textAlign: "right" }}>
              {avg && <><div style={{ fontFamily: "'Playfair Display', serif", fontSize: 40, fontWeight: 700, color: scoreColor(+avg), lineHeight: 1 }}>{avg}</div><div style={{ fontSize: 10, color: "var(--dim)", letterSpacing: 2, textTransform: "uppercase" }}>avg</div></>}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 5, marginTop: 6 }}>
                <div style={{ width: 7, height: 7, borderRadius: "50%", background: syncDot, transition: "background .4s" }} />
                <span style={{ fontSize: 10, color: "var(--dimmer)", letterSpacing: 1 }}>{{ idle: "local", syncing: "syncing…", ok: "synced", error: "offline" }[syncStatus]}</span>
                <button onClick={() => setShowSettings(true)} style={{ background: "none", border: "none", color: "var(--dim)", fontSize: 14, cursor: "pointer", padding: "0 0 0 4px" }}>⚙</button>
              </div>
            </div>
          </div>

          {/* Cuisine switcher */}
          <div style={{ marginTop: 16 }}>
            <CuisineSwitcher active={activeCuisine} onChange={c => { setActiveCuisine(c); setSearchQuery(""); }} />
          </div>

          {/* Stats row */}
          {cuisineEntries.length > 0 && (
            <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
              {[{ label: "Logged", value: cuisineEntries.length }, { label: "Top rated", value: topCnt }, { label: "On map", value: cuisineEntries.filter(e => e.lat).length }].map(s => (
                <div key={s.label} style={{ flex: 1, background: "var(--surface)", borderRadius: 10, padding: "10px 12px", border: "1px solid var(--border)" }}>
                  <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 18, fontWeight: 600, color: "var(--text)" }}>{s.value}</div>
                  <div style={{ fontSize: 9, color: "var(--dim)", letterSpacing: 1.5, textTransform: "uppercase", marginTop: 2 }}>{s.label}</div>
                </div>
              ))}
            </div>
          )}

          {/* Action buttons */}
          {cuisineEntries.length > 0 && (
            <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
              <button onClick={() => handlePrint(visibleEntries, activeCuisine)} style={{ flex: 1, background: "var(--surface)", border: "1px solid var(--border)", color: "var(--muted)", borderRadius: 9, padding: "9px", fontSize: 12, cursor: "pointer", fontFamily: "'DM Sans', sans-serif", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
                Export PDF
              </button>
              <button onClick={() => setShowShare(true)} style={{ flex: 1, background: "var(--surface)", border: "1px solid var(--border)", color: "var(--muted)", borderRadius: 9, padding: "9px", fontSize: 12, cursor: "pointer", fontFamily: "'DM Sans', sans-serif", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>
                Share & Sync
              </button>
            </div>
          )}
        </div>

        {/* Search + Filter/Sort bar */}
        {cuisineEntries.length > 0 && (
          <div style={{ padding: "12px 24px", ...divBdr, display: "flex", gap: 8, alignItems: "center" }}>
            <div style={{ flex: 1, position: "relative" }}>
              <svg style={{ position: "absolute", left: 11, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--dim)" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
              <input
                className="pg-input"
                placeholder="Search name, location, dish…"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                style={{ paddingLeft: 34, fontSize: 13 }}
              />
            </div>
            <button onClick={() => setShowFilter(true)} style={{ background: hasFilters ? "rgba(196,98,45,0.12)" : "var(--surface)", border: `1px solid ${hasFilters ? "#C4622D" : "var(--border)"}`, color: hasFilters ? "#C4622D" : "var(--muted)", borderRadius: 10, padding: "10px 12px", cursor: "pointer", fontSize: 13, fontFamily: "'DM Sans', sans-serif", display: "flex", alignItems: "center", gap: 4, flexShrink: 0 }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="4" y1="6" x2="20" y2="6"/><line x1="8" y1="12" x2="16" y2="12"/><line x1="11" y1="18" x2="13" y2="18"/></svg>
              {hasFilters ? `·${filterTiers.length + filterStyles.length + filterPrices.length}` : ""}
            </button>
            <button onClick={() => setShowSort(true)} style={{ background: sortBy !== "score_desc" ? "rgba(196,98,45,0.12)" : "var(--surface)", border: `1px solid ${sortBy !== "score_desc" ? "#C4622D" : "var(--border)"}`, color: sortBy !== "score_desc" ? "#C4622D" : "var(--muted)", borderRadius: 10, padding: "10px 12px", cursor: "pointer", fontSize: 13, fontFamily: "'DM Sans', sans-serif", flexShrink: 0 }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="3" y1="6" x2="21" y2="6"/><line x1="6" y1="12" x2="18" y2="12"/><line x1="9" y1="18" x2="15" y2="18"/></svg>
            </button>
          </div>
        )}

        {/* Entry list */}
        {cuisineEntries.length === 0 ? (
          <div style={{ textAlign: "center", padding: "80px 24px 40px" }}>
            <div style={{ fontSize: 56, marginBottom: 20 }}>{cuisineConfig.icon}</div>
            <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 24, fontWeight: 600, marginBottom: 10, color: "var(--text)" }}>Start your {cuisineConfig.label} guide</div>
            <div style={{ fontSize: 14, color: "var(--dim)", lineHeight: 1.8, fontWeight: 300 }}>Log your first experience<br />and build your personal Michelin guide.</div>
          </div>
        ) : visibleEntries.length === 0 ? (
          <div style={{ textAlign: "center", padding: "60px 24px" }}>
            <div style={{ fontSize: 32, marginBottom: 16 }}>🔍</div>
            <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 18, color: "var(--text)", marginBottom: 8 }}>No results</div>
            <div style={{ fontSize: 13, color: "var(--dim)" }}>Try adjusting your search or filters.</div>
          </div>
        ) : visibleEntries.map((entry, idx) => {
          const tier = getTier(entry.weightedScore);
          return (
            <div key={entry.id} onClick={() => openDetail(entry.id)} style={{ display: "flex", alignItems: "center", padding: "14px 24px", ...divBdr, cursor: "pointer", gap: 14 }}>
              <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 22, fontWeight: 700, color: "var(--dimmer)", width: 28, flexShrink: 0, textAlign: "center" }}>{idx + 1}</div>
              <div style={{ position: "relative", flexShrink: 0 }}>
                {entry.photo
                  ? <img src={entry.photo} alt="" style={{ width: 44, height: 44, borderRadius: 8, objectFit: "cover", display: "block" }} />
                  : <div style={{ width: 44, height: 44, borderRadius: 8, background: "var(--surface)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>{cuisineConfig.icon}</div>
                }
                {entry.addedBy && (
                  <div style={{ position: "absolute", bottom: -4, right: -4, width: 18, height: 18, borderRadius: "50%", background: "#C4622D", fontSize: 7, fontWeight: 700, color: "#F0EBE1", display: "flex", alignItems: "center", justifyContent: "center", border: "1.5px solid var(--bg)", letterSpacing: 0 }}>
                    {entry.addedBy.slice(0, 2)}
                  </div>
                )}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 16, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginBottom: 3, color: "var(--text)" }}>{entry.name}</div>
                <div style={{ fontSize: 12, color: "var(--dim)", display: "flex", gap: 5, alignItems: "center", flexWrap: "wrap" }}>
                  {entry.location && <><span>{entry.location}</span><span>·</span></>}
                  <span>{entry.style}</span><span>·</span><span>{entry.priceRange}</span>
                </div>
                <div style={{ display: "inline-flex", alignItems: "center", gap: 5, marginTop: 6, background: tier.bg, borderRadius: 5, padding: "2px 8px" }}>
                  <span style={{ fontSize: 10, color: tier.color, fontWeight: 600, letterSpacing: 1.5, textTransform: "uppercase" }}>{tier.icon} {tier.label}</span>
                </div>
              </div>
              <div style={{ textAlign: "right", flexShrink: 0 }}>
                <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 24, fontWeight: 700, color: scoreColor(entry.weightedScore), lineHeight: 1 }}>{entry.weightedScore.toFixed(1)}</div>
                <div style={{ fontSize: 9, color: "var(--dimmer)", letterSpacing: 1 }}>/10</div>
              </div>
            </div>
          );
        })}

        <BottomNav view="list" onList={() => setView("list")} onWish={() => setView("wishlist")} onMap={() => setView("map")} onAdd={openAdd} />
        {showShare    && <ShareModal syncId={syncId} onClose={() => setShowShare(false)} />}
        {showFilter   && <FilterSheet cuisineStyles={cuisineConfig.styles} filterTiers={filterTiers} filterStyles={filterStyles} filterPrices={filterPrices} onToggleTier={v => toggleFilter(filterTiers, setFilterTiers, v)} onToggleStyle={v => toggleFilter(filterStyles, setFilterStyles, v)} onTogglePrice={v => toggleFilter(filterPrices, setFilterPrices, v)} onClear={() => { setFilterTiers([]); setFilterStyles([]); setFilterPrices([]); }} onClose={() => setShowFilter(false)} />}
        {showSort     && <SortSheet sortBy={sortBy} onSort={setSortBy} criteria={cuisineConfig.criteria} onClose={() => setShowSort(false)} />}
        {showSettings && <SettingsPanel theme={theme} onTheme={t => setTheme(t)} userInitials={userInitials} onInitials={handleInitials} onClose={() => setShowSettings(false)} />}
      </div>
    );
  }

  // ╔══════════════════════════════════════════════╗
  // ║  WISHLIST                                    ║
  // ╚══════════════════════════════════════════════╝
  if (view === "wishlist") {
    const wishItems = wishlist.filter(w => (w.cuisine || "pizza") === activeCuisine);
    return (
      <div style={{ ...app, paddingBottom: 90 }} className="pg-fade-in">
        <div style={{ padding: "32px 24px 16px", ...divBdr }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div>
              <div style={{ fontSize: 10, letterSpacing: 4, color: "#C4622D", textTransform: "uppercase", marginBottom: 6, fontWeight: 600 }}>Da Provare</div>
              <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 36, fontWeight: 700, lineHeight: 1, letterSpacing: -1, color: "var(--text)" }}>Wishlist</div>
              <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 14, fontStyle: "italic", color: "var(--dim)", marginTop: 4 }}>{cuisineConfig.label}</div>
            </div>
            <div style={{ textAlign: "right", paddingTop: 8 }}>
              <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 32, fontWeight: 700, color: "#D4A853", lineHeight: 1 }}>{wishItems.length}</div>
              <div style={{ fontSize: 10, color: "var(--dim)", letterSpacing: 2, textTransform: "uppercase" }}>saved</div>
            </div>
          </div>
          <div style={{ marginTop: 16 }}>
            <CuisineSwitcher active={activeCuisine} onChange={setActiveCuisine} />
          </div>
        </div>

        {wishItems.length === 0 ? (
          <div style={{ textAlign: "center", padding: "80px 24px 40px" }}>
            <div style={{ fontSize: 56, marginBottom: 20 }}>♡</div>
            <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 22, fontWeight: 600, marginBottom: 10, color: "var(--text)" }}>Nothing saved yet</div>
            <div style={{ fontSize: 14, color: "var(--dim)", lineHeight: 1.8 }}>Save places you want to try.<br />Tap + to add your first wishlist entry.</div>
          </div>
        ) : wishItems.map(item => (
          <div key={item.id} style={{ padding: "16px 24px", ...divBdr, display: "flex", gap: 14, alignItems: "flex-start" }}>
            <div style={{ width: 40, height: 40, borderRadius: 8, background: "rgba(212,168,83,0.1)", border: "1px solid rgba(212,168,83,0.3)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, flexShrink: 0 }}>{cuisineConfig.icon}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 16, fontWeight: 600, color: "var(--text)", marginBottom: 3 }}>{item.name}</div>
              {item.location && <div style={{ fontSize: 12, color: "var(--dim)", marginBottom: 3 }}>📍 {item.location}</div>}
              {item.notes    && <div style={{ fontSize: 12, color: "var(--muted)", fontStyle: "italic" }}>{item.notes}</div>}
              <div style={{ fontSize: 10, color: "var(--dimmer)", marginTop: 6 }}>Added {item.dateAdded}</div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6, flexShrink: 0 }}>
              <button onClick={() => rateNow(item)} style={{ background: "#C4622D", border: "none", color: "#F0EBE1", borderRadius: 8, padding: "7px 10px", fontSize: 11, cursor: "pointer", fontFamily: "'DM Sans', sans-serif", fontWeight: 600, whiteSpace: "nowrap" }}>Rate now →</button>
              <button onClick={() => deleteWish(item.id)} style={{ background: "transparent", border: "1px solid var(--border)", color: "var(--dim)", borderRadius: 8, padding: "6px 10px", fontSize: 11, cursor: "pointer", fontFamily: "'DM Sans', sans-serif" }}>Remove</button>
            </div>
          </div>
        ))}

        <BottomNav view="wishlist" onList={() => setView("list")} onWish={() => setView("wishlist")} onMap={() => setView("map")} onAdd={openAdd} />
      </div>
    );
  }

  // ╔══════════════════════════════════════════════╗
  // ║  MAP                                         ║
  // ╚══════════════════════════════════════════════╝
  if (view === "map") {
    const allCuisineEntries = entries.filter(e => (e.cuisine || "pizza") === activeCuisine);
    const located    = allCuisineEntries.filter(e => e.lat && e.lng);
    const unlocated  = allCuisineEntries.filter(e => !e.lat);
    const wishLocated = wishlist.filter(w => (w.cuisine || "pizza") === activeCuisine && w.lat && w.lng);
    const center     = located.length > 0 ? [located[0].lat, located[0].lng] : [41.9028, 12.4964];
    const tileUrl    = theme === "light"
      ? "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
      : "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png";

    return (
      <div style={{ ...app, height: "100vh", display: "flex", flexDirection: "column" }} className="pg-fade-in">
        <div style={{ padding: "20px 24px 14px", ...divBdr, background: "var(--bg)", zIndex: 10, flexShrink: 0 }}>
          <div style={{ fontSize: 10, letterSpacing: 4, color: "#C4622D", textTransform: "uppercase", marginBottom: 4, fontWeight: 600 }}>Personal Guide · {cuisineConfig.label}</div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
            <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 24, fontWeight: 700, color: "var(--text)" }}>La Mappa</div>
            <div style={{ fontSize: 12, color: "var(--dim)" }}>{located.length} of {allCuisineEntries.length} located</div>
          </div>
        </div>

        <div style={{ flex: 1, position: "relative", minHeight: 0 }}>
          {allCuisineEntries.length === 0 ? (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", color: "var(--dim)" }}>
              <div style={{ fontSize: 48, marginBottom: 16 }}>🗺️</div>
              <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 20, color: "var(--muted)" }}>No entries yet</div>
            </div>
          ) : (
            <MapContainer center={center} zoom={13} style={{ height: "100%", width: "100%" }} zoomControl={false}>
              <TileLayer url={tileUrl} attribution="© OpenStreetMap © CARTO" subdomains="abcd" maxZoom={19} />
              {mapFocus && <MapController center={mapFocus} />}
              {located.map(entry => (
                <CircleMarker key={entry.id} center={[entry.lat, entry.lng]} radius={13}
                  pathOptions={{ color: "var(--bg)", weight: 2, fillColor: scoreColor(entry.weightedScore), fillOpacity: 0.92 }}
                  eventHandlers={{ click: () => openDetail(entry.id) }}
                >
                  <Popup>
                    <div style={{ fontFamily: "'DM Sans', sans-serif", minWidth: 160 }}>
                      {entry.photo && <img src={entry.photo} alt="" style={{ width: "100%", height: 90, objectFit: "cover", borderRadius: 6, marginBottom: 10 }} />}
                      <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 15, fontWeight: 700, marginBottom: 6, color: "var(--text)" }}>{entry.name}</div>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                        <div style={{ fontSize: 10, background: getTier(entry.weightedScore).bg, borderRadius: 4, padding: "2px 8px", color: getTier(entry.weightedScore).color, fontWeight: 600, letterSpacing: 1, textTransform: "uppercase" }}>
                          {getTier(entry.weightedScore).icon} {getTier(entry.weightedScore).label}
                        </div>
                        <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 22, fontWeight: 700, color: scoreColor(entry.weightedScore) }}>{entry.weightedScore.toFixed(1)}</div>
                      </div>
                      {entry.location && <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 8 }}>📍 {entry.location} · {entry.priceRange}</div>}
                      <button onClick={() => openDetail(entry.id)} style={{ width: "100%", background: "#C4622D", border: "none", color: "#F0EBE1", borderRadius: 7, padding: "7px", fontSize: 12, cursor: "pointer", fontFamily: "'DM Sans', sans-serif", fontWeight: 600 }}>View details →</button>
                    </div>
                  </Popup>
                </CircleMarker>
              ))}
              {wishLocated.map(item => (
                <CircleMarker key={`wish-${item.id}`} center={[item.lat, item.lng]} radius={9}
                  pathOptions={{ color: "#D4A853", weight: 2, fillColor: "#D4A853", fillOpacity: 0.12 }}
                >
                  <Popup>
                    <div style={{ fontFamily: "'DM Sans', sans-serif", minWidth: 140 }}>
                      <div style={{ fontSize: 10, color: "#D4A853", fontWeight: 600, letterSpacing: 1, textTransform: "uppercase", marginBottom: 6 }}>♡ Wishlist</div>
                      <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 15, fontWeight: 700, marginBottom: 8, color: "var(--text)" }}>{item.name}</div>
                      {item.location && <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 8 }}>📍 {item.location}</div>}
                      <button onClick={() => rateNow(item)} style={{ width: "100%", background: "#D4A853", border: "none", color: "#0D0B09", borderRadius: 7, padding: "7px", fontSize: 12, cursor: "pointer", fontFamily: "'DM Sans', sans-serif", fontWeight: 700 }}>Rate now →</button>
                    </div>
                  </Popup>
                </CircleMarker>
              ))}
            </MapContainer>
          )}
        </div>

        {unlocated.length > 0 && (
          <div style={{ background: "var(--surface)", borderTop: "1px solid var(--border)", padding: "10px 24px", flexShrink: 0, zIndex: 10 }}>
            <div style={{ fontSize: 11, color: "var(--muted)" }}><span style={{ color: "#C4622D", fontWeight: 600 }}>{unlocated.length}</span> not on map — add a location to pin them.</div>
          </div>
        )}

        <div style={{ background: "var(--bg)", borderTop: "1px solid var(--border2)", padding: "10px 24px 80px", display: "flex", gap: 16, flexShrink: 0, zIndex: 10, flexWrap: "wrap" }}>
          {[{ color: "#D4A853", label: "9+" }, { color: "#C4622D", label: "8+" }, { color: "#5B8A5B", label: "7+" }, { color: "#7A7470", label: "<7" }].map(l => (
            <div key={l.label} style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <div style={{ width: 10, height: 10, borderRadius: "50%", background: l.color }} />
              <span style={{ fontSize: 11, color: "var(--dim)" }}>{l.label}</span>
            </div>
          ))}
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <div style={{ width: 10, height: 10, borderRadius: "50%", border: "2px solid #D4A853", background: "transparent" }} />
            <span style={{ fontSize: 11, color: "var(--dim)" }}>Wishlist</span>
          </div>
        </div>

        <BottomNav view="map" onList={() => setView("list")} onWish={() => setView("wishlist")} onMap={() => setView("map")} onAdd={openAdd} />
      </div>
    );
  }

  // ╔══════════════════════════════════════════════╗
  // ║  DETAIL                                      ║
  // ╚══════════════════════════════════════════════╝
  if (view === "detail" && selected) {
    const tier = getTier(selected.weightedScore);
    const detailCuisine = selected.cuisine || "pizza";
    const detailConfig  = CUISINE_CONFIGS[detailCuisine] || CUISINE_CONFIGS.pizza;
    return (
      <div style={{ ...app, paddingBottom: 40 }} className="pg-fade-in">
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 20px", ...divBdr, position: "sticky", top: 0, background: "var(--bg)", zIndex: 10 }}>
          <button onClick={() => setView("list")} style={{ background: "none", border: "none", color: "#C4622D", fontSize: 14, cursor: "pointer", fontFamily: "'DM Sans', sans-serif" }}>← Back</button>
          <div style={{ display: "flex", gap: 16 }}>
            {selected.lat && <button onClick={() => { setView("map"); setMapFocus([selected.lat, selected.lng]); }} style={{ background: "none", border: "none", color: "var(--muted)", fontSize: 13, cursor: "pointer", fontFamily: "'DM Sans', sans-serif" }}>📍 Map</button>}
            <button onClick={() => openEdit(selected)} style={{ background: "none", border: "none", color: "var(--muted)", fontSize: 13, cursor: "pointer", fontFamily: "'DM Sans', sans-serif" }}>Edit</button>
          </div>
        </div>

        {selected.photo && <div style={{ height: 200, overflow: "hidden" }}><img src={selected.photo} alt={selected.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} /></div>}

        <div style={{ padding: "24px 24px 20px", ...divBdr }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
            <div style={{ flex: 1 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
                <div style={{ display: "inline-flex", alignItems: "center", gap: 6, background: tier.bg, borderRadius: 6, padding: "4px 12px" }}>
                  <span style={{ fontSize: 11, color: tier.color, fontWeight: 600, letterSpacing: 2, textTransform: "uppercase" }}>{tier.icon} {tier.label}</span>
                </div>
                {selected.addedBy && (
                  <div style={{ display: "inline-flex", alignItems: "center", gap: 5, background: "rgba(196,98,45,0.1)", borderRadius: 6, padding: "4px 10px" }}>
                    <span style={{ fontSize: 10, color: "#C4622D", fontWeight: 600, letterSpacing: 1 }}>By {selected.addedBy}</span>
                  </div>
                )}
              </div>
              <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 28, fontWeight: 700, lineHeight: 1.2, marginBottom: 6, letterSpacing: -.5, color: "var(--text)" }}>{selected.name}</div>
              <div style={{ fontSize: 13, color: "var(--dim)" }}>{[selected.location, selected.style, selected.priceRange].filter(Boolean).join(" · ")}</div>
            </div>
            <div style={{ textAlign: "right", flexShrink: 0 }}>
              <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 50, fontWeight: 700, color: scoreColor(selected.weightedScore), lineHeight: 1 }}>{selected.weightedScore.toFixed(1)}</div>
              <div style={{ fontSize: 11, color: "var(--dimmer)" }}>/10</div>
            </div>
          </div>
          <div style={{ display: "flex", gap: 8, marginTop: 16, flexWrap: "wrap" }}>
            <Chip>{detailConfig.icon} {detailConfig.label}</Chip>
            {selected.dish        && <Chip>{selected.dish}</Chip>}
            {selected.dateVisited && <Chip>📅 {selected.dateVisited}</Chip>}
            <Chip style={{ color: selected.wouldReturn === "Yes" ? "#5B8A5B" : selected.wouldReturn === "No" ? "#8B4040" : "#C4622D" }}>↩ {selected.wouldReturn}</Chip>
          </div>
        </div>

        <div style={{ padding: "24px 24px 20px", ...divBdr }}>
          <div style={secLbl}>Score Breakdown</div>
          {detailConfig.criteria.map(c => {
            const val = selected.scores?.[c.key] ?? 5;
            return (
              <div key={c.key} style={{ marginBottom: 18 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 8 }}>
                  <div><span style={{ fontSize: 14, fontWeight: 500, color: "var(--text)" }}>{c.label}</span><span style={{ fontSize: 11, color: "var(--dimmer)", marginLeft: 8 }}>{c.weight}</span></div>
                  <span style={{ fontFamily: "'Playfair Display', serif", fontSize: 22, fontWeight: 700, color: scoreColor(val) }}>{val}</span>
                </div>
                <div style={{ height: 3, background: "var(--surface)", borderRadius: 2, overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${(val / 10) * 100}%`, background: scoreColor(val), borderRadius: 2 }} />
                </div>
                <div style={{ fontSize: 11, color: "var(--dimmer)", marginTop: 4 }}>{c.sub}</div>
              </div>
            );
          })}
        </div>

        {selected.notes && (
          <div style={{ padding: "24px 24px", ...divBdr }}>
            <div style={secLbl}>Notes</div>
            <div style={{ fontFamily: "'Playfair Display', serif", fontStyle: "italic", fontSize: 16, color: "var(--muted)", lineHeight: 1.9 }}>"{selected.notes}"</div>
          </div>
        )}

        <div style={{ padding: "24px 24px" }}>
          {!confirmDel ? (
            <button onClick={() => setConfirmDel(true)} style={{ width: "100%", background: "transparent", border: "1px solid var(--border)", color: "var(--dim)", borderRadius: 10, padding: "12px", fontSize: 14, cursor: "pointer", fontFamily: "'DM Sans', sans-serif" }}>Remove from guide</button>
          ) : (
            <div style={{ background: "rgba(139,64,64,0.1)", border: "1px solid rgba(139,64,64,0.25)", borderRadius: 10, padding: "16px", textAlign: "center" }}>
              <div style={{ fontSize: 14, color: "#C47070", marginBottom: 14 }}>Remove "{selected.name}" from your guide?</div>
              <div style={{ display: "flex", gap: 10 }}>
                <button onClick={() => setConfirmDel(false)} style={{ flex: 1, background: "var(--surface)", border: "1px solid var(--border)", color: "var(--text)", borderRadius: 8, padding: "10px", fontSize: 14, cursor: "pointer", fontFamily: "'DM Sans', sans-serif" }}>Cancel</button>
                <button onClick={() => deleteEntry(selected.id)} style={{ flex: 1, background: "#8B4040", border: "none", color: "#F0EBE1", borderRadius: 8, padding: "10px", fontSize: 14, cursor: "pointer", fontFamily: "'DM Sans', sans-serif", fontWeight: 500 }}>Delete</button>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ╔══════════════════════════════════════════════╗
  // ║  ADD / EDIT RATED ENTRY                      ║
  // ╚══════════════════════════════════════════════╝
  if (view === "add") {
    const formCuisine = form.cuisine || activeCuisine;
    const formConfig  = CUISINE_CONFIGS[formCuisine] || CUISINE_CONFIGS.pizza;
    const canSave = form.name.trim().length > 0 && !saving;
    return (
      <div style={{ ...app, paddingBottom: 60 }} className="pg-fade-in">
        <input ref={fileRef} type="file" accept="image/*" style={{ display: "none" }} onChange={handlePhoto} />

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 20px", ...divBdr, position: "sticky", top: 0, background: "var(--bg)", zIndex: 10 }}>
          <button onClick={() => { setView(editingId ? "detail" : "list"); setEditingId(null); }} style={{ background: "none", border: "none", color: "#C4622D", fontSize: 14, cursor: "pointer", fontFamily: "'DM Sans', sans-serif" }}>Cancel</button>
          <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 17, color: "var(--text)" }}>{editingId ? "Edit Entry" : "Nuova Voce"}</div>
          <button onClick={saveEntry} disabled={!canSave} style={{ background: canSave ? "#C4622D" : "var(--surface)", border: "none", color: canSave ? "#F0EBE1" : "var(--dimmer)", borderRadius: 8, padding: "8px 18px", fontSize: 14, cursor: canSave ? "pointer" : "default", fontFamily: "'DM Sans', sans-serif", fontWeight: 600, minWidth: 60 }}>
            {saving ? "…" : "Save"}
          </button>
        </div>

        {/* Live score */}
        <div style={{ margin: "16px 24px 8px", background: "var(--surface)", borderRadius: 14, padding: "16px 20px", display: "flex", alignItems: "center", justifyContent: "space-between", border: `1px solid ${previewTier.bg}` }}>
          <div>
            <div style={{ fontSize: 10, color: "var(--dimmer)", letterSpacing: 2, textTransform: "uppercase", marginBottom: 8 }}>Live Score</div>
            <div style={{ display: "inline-flex", alignItems: "center", gap: 6, background: previewTier.bg, borderRadius: 6, padding: "4px 12px" }}>
              <span style={{ fontSize: 11, color: previewTier.color, fontWeight: 600, letterSpacing: 2, textTransform: "uppercase" }}>{previewTier.icon} {previewTier.label}</span>
            </div>
          </div>
          <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 44, fontWeight: 700, color: scoreColor(previewScore), lineHeight: 1 }}>{previewScore.toFixed(1)}</div>
        </div>

        <div style={{ padding: "16px 24px 0" }}>

          {/* Cuisine selector (only for new entries) */}
          {!editingId && (
            <>
              <div style={secLbl}>Cuisine</div>
              <div style={{ marginBottom: 16 }}>
                <CuisineSwitcher active={formCuisine} onChange={c => {
                  const cfg = CUISINE_CONFIGS[c];
                  const scores = {};
                  cfg.criteria.forEach(cr => { scores[cr.key] = 7; });
                  setForm(f => ({ ...freshForm(c, userInitials), name: f.name, location: f.location, notes: f.notes, photo: f.photo, priceRange: f.priceRange }));
                }} />
              </div>
            </>
          )}

          {/* Photo */}
          <div style={secLbl}>Photo</div>
          {form.photo ? (
            <div style={{ position: "relative", marginBottom: 16 }}>
              <img src={form.photo} alt="" style={{ width: "100%", height: 160, objectFit: "cover", borderRadius: 12 }} />
              <button onClick={() => setForm(f => ({ ...f, photo: null }))} style={{ position: "absolute", top: 8, right: 8, background: "rgba(13,11,9,.85)", border: "none", color: "#F0EBE1", borderRadius: "50%", width: 28, height: 28, fontSize: 14, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>✕</button>
              <button onClick={() => fileRef.current?.click()} style={{ position: "absolute", bottom: 8, right: 8, background: "rgba(13,11,9,.85)", border: "none", color: "#F0EBE1", borderRadius: 8, padding: "5px 10px", fontSize: 11, cursor: "pointer", fontFamily: "'DM Sans', sans-serif" }}>Change</button>
            </div>
          ) : (
            <button onClick={() => fileRef.current?.click()} style={{ width: "100%", background: "var(--surface)", border: "2px dashed var(--border)", borderRadius: 12, padding: "20px", fontSize: 13, cursor: "pointer", color: "var(--dim)", fontFamily: "'DM Sans', sans-serif", marginBottom: 16, display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--dim)" strokeWidth="1.5" strokeLinecap="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
              Add a photo
            </button>
          )}

          {/* Info */}
          <div style={secLbl}>Restaurant</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 16 }}>
            <input className="pg-input" placeholder="Name *" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
            <div style={{ position: "relative" }}>
              <input className="pg-input" placeholder="Location (used to pin on map)" value={form.location} onChange={e => setForm(f => ({ ...f, location: e.target.value, lat: null, lng: null }))} />
              <div style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", fontSize: 11, color: "var(--dimmer)" }}>📍</div>
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <div style={{ flex: 1, position: "relative" }}>
                <select className="pg-select" value={form.style} onChange={e => setForm(f => ({ ...f, style: e.target.value }))}>
                  {formConfig.styles.map(s => <option key={s}>{s}</option>)}
                </select>
                <span style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", color: "var(--muted)", pointerEvents: "none", fontSize: 11 }}>▾</span>
              </div>
              <input className="pg-input" type="date" value={form.dateVisited} onChange={e => setForm(f => ({ ...f, dateVisited: e.target.value }))} style={{ flex: 1 }} />
            </div>
            <input className="pg-input" placeholder="Dish ordered" value={form.dish} onChange={e => setForm(f => ({ ...f, dish: e.target.value }))} />
            <input className="pg-input" placeholder="Your initials (optional)" value={form.addedBy} onChange={e => setForm(f => ({ ...f, addedBy: e.target.value.toUpperCase().slice(0, 3) }))} style={{ letterSpacing: 2 }} />
          </div>

          {/* Price + Return */}
          <div style={{ display: "flex", gap: 12, marginBottom: 4 }}>
            <div style={{ flex: 1 }}>
              <div style={secLbl}>Price</div>
              <div style={{ display: "flex", gap: 4 }}>
                {PRICE_RANGES.map(p => (
                  <button key={p} onClick={() => setForm(f => ({ ...f, priceRange: p }))}
                    style={{ flex: 1, background: form.priceRange === p ? "#C4622D" : "var(--surface)", border: `1px solid ${form.priceRange === p ? "#C4622D" : "var(--border)"}`, color: form.priceRange === p ? "#F0EBE1" : "var(--muted)", borderRadius: 9, padding: "9px 0", fontSize: 10, cursor: "pointer", fontFamily: "'DM Sans', sans-serif" }}>
                    {p}
                  </button>
                ))}
              </div>
            </div>
            <div style={{ flex: 1 }}>
              <div style={secLbl}>Return?</div>
              <div style={{ display: "flex", gap: 6 }}>
                {["Yes", "Maybe", "No"].map(r => {
                  const rc = r === "Yes" ? "#5B8A5B" : r === "Maybe" ? "#C4622D" : "#8B4040";
                  return (
                    <button key={r} onClick={() => setForm(f => ({ ...f, wouldReturn: r }))}
                      style={{ flex: 1, background: form.wouldReturn === r ? rc : "var(--surface)", border: `1px solid ${form.wouldReturn === r ? rc : "var(--border)"}`, color: form.wouldReturn === r ? "#F0EBE1" : "var(--muted)", borderRadius: 9, padding: "9px 0", fontSize: 12, cursor: "pointer", fontFamily: "'DM Sans', sans-serif" }}>
                      {r}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Scores */}
          <div style={{ ...secLbl, marginTop: 24 }}>Scores</div>
          {formConfig.criteria.map(c => (
            <div key={c.key} style={{ marginBottom: 24 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 12 }}>
                <div><span style={{ fontSize: 15, fontWeight: 500, color: "var(--text)" }}>{c.label}</span><span style={{ fontSize: 11, color: "var(--dimmer)", marginLeft: 8 }}>{c.weight}</span></div>
                <span style={{ fontFamily: "'Playfair Display', serif", fontSize: 26, fontWeight: 700, color: scoreColor(form.scores[c.key] ?? 7) }}>{form.scores[c.key] ?? 7}</span>
              </div>
              <ScoreSlider value={form.scores[c.key] ?? 7} onChange={v => setForm(f => ({ ...f, scores: { ...f.scores, [c.key]: v } }))} />
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "var(--dimmer)", marginTop: 6 }}>
                <span>1 · poor</span><span>5 · average</span><span>10 · perfect</span>
              </div>
              <div style={{ fontSize: 11, color: "var(--dimmer)", marginTop: 4 }}>{c.sub}</div>
            </div>
          ))}

          <div style={secLbl}>Notes</div>
          <textarea className="pg-textarea" placeholder="What stood out? Any memorable detail about this visit…" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
          <div style={{ height: 24 }} />
        </div>
      </div>
    );
  }

  // ╔══════════════════════════════════════════════╗
  // ║  WISHLIST ADD FORM                           ║
  // ╚══════════════════════════════════════════════╝
  if (view === "wishlist-add") {
    const canSave = wishForm.name.trim().length > 0 && !saving;
    return (
      <div style={{ ...app, paddingBottom: 60 }} className="pg-fade-in">
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 20px", ...divBdr, position: "sticky", top: 0, background: "var(--bg)", zIndex: 10 }}>
          <button onClick={() => { setView("wishlist"); setEditingWishId(null); }} style={{ background: "none", border: "none", color: "#C4622D", fontSize: 14, cursor: "pointer", fontFamily: "'DM Sans', sans-serif" }}>Cancel</button>
          <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 17, color: "var(--text)" }}>Add to Wishlist</div>
          <button onClick={saveWishEntry} disabled={!canSave} style={{ background: canSave ? "#C4622D" : "var(--surface)", border: "none", color: canSave ? "#F0EBE1" : "var(--dimmer)", borderRadius: 8, padding: "8px 18px", fontSize: 14, cursor: canSave ? "pointer" : "default", fontFamily: "'DM Sans', sans-serif", fontWeight: 600 }}>
            {saving ? "…" : "Save"}
          </button>
        </div>

        <div style={{ padding: "24px 24px 0" }}>
          <div style={{ background: "rgba(212,168,83,0.08)", border: "1px solid rgba(212,168,83,0.2)", borderRadius: 14, padding: "14px 18px", marginBottom: 24, display: "flex", alignItems: "center", gap: 12 }}>
            <span style={{ fontSize: 24 }}>♡</span>
            <div style={{ fontSize: 13, color: "#D4A853", lineHeight: 1.6 }}>Save places you want to try. Rate them when you visit.</div>
          </div>

          <div style={secLbl}>Cuisine</div>
          <div style={{ marginBottom: 20 }}>
            <CuisineSwitcher active={wishForm.cuisine || activeCuisine} onChange={c => setWishForm(f => ({ ...f, cuisine: c }))} />
          </div>

          <div style={secLbl}>Place</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 20 }}>
            <input className="pg-input" placeholder="Restaurant name *" value={wishForm.name} onChange={e => setWishForm(f => ({ ...f, name: e.target.value }))} />
            <div style={{ position: "relative" }}>
              <input className="pg-input" placeholder="Location (optional)" value={wishForm.location} onChange={e => setWishForm(f => ({ ...f, location: e.target.value, lat: null, lng: null }))} />
              <div style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", fontSize: 11, color: "var(--dimmer)" }}>📍</div>
            </div>
          </div>

          <div style={secLbl}>Notes</div>
          <textarea className="pg-textarea" placeholder="Why you want to try this place…" value={wishForm.notes} onChange={e => setWishForm(f => ({ ...f, notes: e.target.value }))} />
          <div style={{ height: 24 }} />
        </div>
      </div>
    );
  }

  return <div style={app} />;
}

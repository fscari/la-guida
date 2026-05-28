import { useState, useEffect, useRef, useMemo } from "react";
import L from "leaflet";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";

// ─── Dynamic criteria for Asian ──────────────────────────────────────────────
const ASIAN_CRITERIA = {
  Sushi:      { weights: { fish:0.30, rice:0.25, value:0.20, ambiance:0.15, drinks:0.10 }, criteria: [
    { key:"fish",     label:"Fish Quality",       sub:"freshness · cut · variety",           weight:"30%" },
    { key:"rice",     label:"Rice",               sub:"seasoning · temperature · texture",   weight:"25%" },
    { key:"value",    label:"Value for Money",    sub:"price vs experience",                 weight:"20%" },
    { key:"ambiance", label:"Ambiance & Service", sub:"atmosphere · speed · care",           weight:"15%" },
    { key:"drinks",   label:"Drinks",             sub:"sake · beer · selection",             weight:"10%" },
  ]},
  Ramen:      { weights: { broth:0.30, noodles:0.25, toppings:0.20, value:0.15, ambiance:0.10 }, criteria: [
    { key:"broth",    label:"Broth",              sub:"depth · umami · clarity · balance",   weight:"30%" },
    { key:"noodles",  label:"Noodles",            sub:"texture · firmness · freshness",      weight:"25%" },
    { key:"toppings", label:"Toppings",           sub:"chashu · egg · nori · variety",       weight:"20%" },
    { key:"value",    label:"Value for Money",    sub:"price vs experience",                 weight:"15%" },
    { key:"ambiance", label:"Ambiance & Service", sub:"atmosphere · speed · care",           weight:"10%" },
  ]},
  Chinese:    { weights: { main:0.28, technique:0.22, variety:0.20, value:0.18, ambiance:0.12 }, criteria: [
    { key:"main",      label:"Main Dish",         sub:"flavour · technique · execution",     weight:"28%" },
    { key:"technique", label:"Wok Technique",     sub:"heat · aroma · char · texture",      weight:"22%" },
    { key:"variety",   label:"Menu Variety",      sub:"dim sum · sides · range",            weight:"20%" },
    { key:"value",     label:"Value for Money",   sub:"price vs experience",                weight:"18%" },
    { key:"ambiance",  label:"Ambiance & Service",sub:"atmosphere · speed · care",          weight:"12%" },
  ]},
  Thai:       { weights: { flavour:0.30, freshness:0.25, spice:0.20, value:0.15, ambiance:0.10 }, criteria: [
    { key:"flavour",   label:"Flavour Balance",   sub:"sweet · sour · salty · umami",       weight:"30%" },
    { key:"freshness", label:"Freshness",         sub:"herbs · vegetables · produce",       weight:"25%" },
    { key:"spice",     label:"Spice Control",     sub:"heat · complexity · nuance",         weight:"20%" },
    { key:"value",     label:"Value for Money",   sub:"price vs experience",                weight:"15%" },
    { key:"ambiance",  label:"Ambiance & Service",sub:"atmosphere · speed · care",          weight:"10%" },
  ]},
  Vietnamese: { weights: { freshness:0.30, broth:0.25, accompaniments:0.20, value:0.15, ambiance:0.10 }, criteria: [
    { key:"freshness",      label:"Freshness",         sub:"herbs · vegetables · brightness", weight:"30%" },
    { key:"broth",          label:"Broth / Base",      sub:"clarity · depth · balance",       weight:"25%" },
    { key:"accompaniments", label:"Accompaniments",    sub:"herbs · sprouts · sauces",        weight:"20%" },
    { key:"value",          label:"Value for Money",   sub:"price vs experience",             weight:"15%" },
    { key:"ambiance",       label:"Ambiance & Service",sub:"atmosphere · speed · care",       weight:"10%" },
  ]},
  Other:      { weights: { main:0.30, authenticity:0.25, value:0.20, ambiance:0.15, drinks:0.10 }, criteria: [
    { key:"main",         label:"Main Dish",         sub:"flavour · execution · quality",    weight:"30%" },
    { key:"authenticity", label:"Authenticity",      sub:"tradition · regional character",   weight:"25%" },
    { key:"value",        label:"Value for Money",   sub:"price vs experience",              weight:"20%" },
    { key:"ambiance",     label:"Ambiance & Service",sub:"atmosphere · speed · care",        weight:"15%" },
    { key:"drinks",       label:"Drinks",            sub:"tea · cocktails · selection",      weight:"10%" },
  ]},
};

// ─── Dynamic criteria for Ethnic ─────────────────────────────────────────────
const ETHNIC_CRITERIA = {
  Mexican:         { weights: { main:0.28, tortilla:0.20, salsa:0.20, value:0.18, ambiance:0.14 }, criteria: [
    { key:"main",     label:"Main Dish",         sub:"flavour · execution · filling",     weight:"28%" },
    { key:"tortilla", label:"Tortilla / Base",   sub:"freshness · texture · char",        weight:"20%" },
    { key:"salsa",    label:"Salsas & Sides",    sub:"heat · variety · freshness",        weight:"20%" },
    { key:"value",    label:"Value for Money",   sub:"price vs experience",               weight:"18%" },
    { key:"ambiance", label:"Ambiance & Service",sub:"atmosphere · speed · care",         weight:"14%" },
  ]},
  Indian:          { weights: { curry:0.30, bread:0.20, spices:0.20, value:0.18, ambiance:0.12 }, criteria: [
    { key:"curry",    label:"Curry / Main",      sub:"depth · complexity · balance",      weight:"30%" },
    { key:"bread",    label:"Bread / Rice",      sub:"naan · roti · biryani · texture",  weight:"20%" },
    { key:"spices",   label:"Spice Mastery",     sub:"layering · freshness · balance",   weight:"20%" },
    { key:"value",    label:"Value for Money",   sub:"price vs experience",              weight:"18%" },
    { key:"ambiance", label:"Ambiance & Service",sub:"atmosphere · speed · care",        weight:"12%" },
  ]},
  "Middle Eastern":{ weights: { main:0.28, mezze:0.22, freshness:0.20, value:0.18, ambiance:0.12 }, criteria: [
    { key:"main",      label:"Main Dish",        sub:"kebab · falafel · shawarma",        weight:"28%" },
    { key:"mezze",     label:"Mezze & Sides",    sub:"hummus · tabbouleh · variety",      weight:"22%" },
    { key:"freshness", label:"Freshness",        sub:"herbs · produce · quality",         weight:"20%" },
    { key:"value",     label:"Value for Money",  sub:"price vs experience",              weight:"18%" },
    { key:"ambiance",  label:"Ambiance & Service",sub:"atmosphere · speed · care",       weight:"12%" },
  ]},
  Greek:           { weights: { main:0.28, freshness:0.24, quality:0.20, value:0.18, ambiance:0.10 }, criteria: [
    { key:"main",      label:"Main Dish",        sub:"gyros · souvlaki · moussaka",       weight:"28%" },
    { key:"freshness", label:"Freshness",        sub:"salads · vegetables · olive oil",   weight:"24%" },
    { key:"quality",   label:"Ingredient Quality",sub:"feta · lamb · seafood · oil",      weight:"20%" },
    { key:"value",     label:"Value for Money",  sub:"price vs experience",              weight:"18%" },
    { key:"ambiance",  label:"Ambiance & Service",sub:"atmosphere · speed · care",       weight:"10%" },
  ]},
  African:         { weights: { main:0.30, spices:0.25, sides:0.20, value:0.15, ambiance:0.10 }, criteria: [
    { key:"main",     label:"Main Dish",         sub:"stew · grilled · braised · quality",weight:"30%" },
    { key:"spices",   label:"Spice Complexity",  sub:"layers · warmth · balance",         weight:"25%" },
    { key:"sides",    label:"Sides & Staples",   sub:"ugali · injera · rice · variety",  weight:"20%" },
    { key:"value",    label:"Value for Money",   sub:"price vs experience",              weight:"15%" },
    { key:"ambiance", label:"Ambiance & Service",sub:"atmosphere · speed · care",        weight:"10%" },
  ]},
  French:          { weights: { technique:0.28, main:0.26, sauce:0.20, value:0.16, ambiance:0.10 }, criteria: [
    { key:"technique",label:"Technique",         sub:"execution · classical skill",       weight:"28%" },
    { key:"main",     label:"Main Dish",         sub:"flavour · presentation · quality",  weight:"26%" },
    { key:"sauce",    label:"Sauce",             sub:"complexity · balance · texture",    weight:"20%" },
    { key:"value",    label:"Value for Money",   sub:"price vs experience",              weight:"16%" },
    { key:"ambiance", label:"Ambiance & Service",sub:"atmosphere · service · elegance",  weight:"10%" },
  ]},
  Other:           { weights: { main:0.30, authenticity:0.25, freshness:0.20, value:0.15, ambiance:0.10 }, criteria: [
    { key:"main",         label:"Main Dish",        sub:"flavour · execution · quality",   weight:"30%" },
    { key:"authenticity", label:"Authenticity",     sub:"tradition · regional character",  weight:"25%" },
    { key:"freshness",    label:"Freshness",        sub:"ingredients · quality · care",    weight:"20%" },
    { key:"value",        label:"Value for Money",  sub:"price vs experience",            weight:"15%" },
    { key:"ambiance",     label:"Ambiance & Service",sub:"atmosphere · speed · care",     weight:"10%" },
  ]},
};

// ─── Cuisine Config ───────────────────────────────────────────────────────────
const CUISINE_CONFIGS = {
  pizza: {
    label:"Pizza", icon:"🍕", subtitle:"Pizzerie", mapShape:"circle",
    styles:["Neapolitan","Roman","Milanese","Panzerotto","Piadina","Focaccia","Other"],
    weights:  { dough:0.25, toppings:0.21, value:0.18, tiramisu:0.16, ambiance:0.12, drinks:0.08 },
    criteria: [
      { key:"dough",    label:"Dough & Crust",     sub:"texture · char · structure",   weight:"25%" },
      { key:"toppings", label:"Toppings",           sub:"quality · origin · balance",   weight:"21%" },
      { key:"value",    label:"Value for Money",    sub:"price vs experience",          weight:"18%" },
      { key:"tiramisu", label:"Tiramisu",           sub:"texture · cream · bitterness", weight:"16%" },
      { key:"ambiance", label:"Ambiance & Service", sub:"atmosphere · speed · care",    weight:"12%" },
      { key:"drinks",   label:"Drinks",             sub:"wine · cocktails · selection", weight:"8%"  },
    ],
  },
  asian: {
    label:"Asian", icon:"🥢", subtitle:"Ristoranti Asiatici", mapShape:"square",
    styles:["Sushi","Ramen","Chinese","Thai","Vietnamese","Other"],
    criteriaByStyle: ASIAN_CRITERIA,
  },
  ethnic: {
    label:"Ethnic", icon:"🌍", subtitle:"Cucine del Mondo", mapShape:"triangle",
    styles:["Mexican","Indian","Middle Eastern","Greek","African","French","Other"],
    criteriaByStyle: ETHNIC_CRITERIA,
  },
  burgers: {
    label:"Burgers", icon:"🍔", subtitle:"Burger Joints", mapShape:"pentagon",
    styles:["Smash","Classic","Gourmet","Fast Food","Other"],
    weights:  { patty:0.30, bun:0.20, toppings:0.18, value:0.20, ambiance:0.12 },
    criteria: [
      { key:"patty",    label:"Patty",              sub:"meat quality · cook · seasoning",   weight:"30%" },
      { key:"bun",      label:"Bun",                sub:"texture · toasting · freshness",    weight:"20%" },
      { key:"toppings", label:"Toppings & Sauce",   sub:"balance · freshness · creativity",  weight:"18%" },
      { key:"value",    label:"Value for Money",    sub:"price vs experience",               weight:"20%" },
      { key:"ambiance", label:"Ambiance & Service", sub:"atmosphere · speed · care",         weight:"12%" },
    ],
  },
};

const CUISINE_KEYS = Object.keys(CUISINE_CONFIGS);
const PRICE_RANGES = ["€","€€","€€€","€€€€"];
const STORAGE_KEY  = "la-guida-v3";
const WISHLIST_KEY = "la-guida-wishlist-v3";
const SYNC_ID_KEY  = "la-guida-syncid-v3";
const THEME_KEY    = "la-guida-theme";
const INITIALS_KEY = "la-guida-initials";
const CUISINE_KEY  = "la-guida-cuisine";
const DELETED_KEY  = "la-guida-deleted-v3";
const TIERS        = ["Leggendaria","Eccellente","Buona","Nella media","Evita"];

// ─── Helpers ──────────────────────────────────────────────────────────────────
function migrateCuisine(c) {
  if (c === "pasta") return "ethnic";
  if (c === "sushi") return "asian";
  return c || "pizza";
}

function getStyleCriteria(cuisine, style) {
  const cfg = CUISINE_CONFIGS[cuisine];
  if (!cfg) return { weights: CUISINE_CONFIGS.pizza.weights, criteria: CUISINE_CONFIGS.pizza.criteria };
  if (cfg.criteriaByStyle) {
    const sc = cfg.criteriaByStyle[style] || cfg.criteriaByStyle["Other"] || Object.values(cfg.criteriaByStyle)[0];
    return sc;
  }
  return { weights: cfg.weights, criteria: cfg.criteria };
}

function calcScore(scores, cuisine = "pizza", style = "") {
  const { weights } = getStyleCriteria(cuisine, style);
  return Object.entries(weights).reduce((acc, [k, w]) => acc + (Number(scores[k]) || 5) * w, 0);
}

// Average weighted score across all raters
function calcAvgScore(ratings) {
  const vals = Object.values(ratings || {}).map(r => r.weightedScore).filter(n => typeof n === "number" && !isNaN(n));
  if (!vals.length) return 5;
  return parseFloat((vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(1));
}

// Seed a ratings map from legacy entry fields
function initRatings(entry) {
  if (entry.ratings && Object.keys(entry.ratings).length > 0) return entry.ratings;
  const key = entry.addedBy || "?";
  return { [key]: { scores: entry.scores || {}, weightedScore: entry.weightedScore || 5, dish: entry.dish || "", notes: entry.notes || "", wouldReturn: entry.wouldReturn || "Yes", dateVisited: entry.dateVisited || "", addedBy: key, updatedAt: entry.updatedAt || 0 } };
}

// Merge two ratings maps: per-rater last-updatedAt wins
function mergeRatings(a, b) {
  const result = {};
  for (const k of new Set([...Object.keys(a || {}), ...Object.keys(b || {})])) {
    const ra = a?.[k], rb = b?.[k];
    result[k] = !rb ? ra : !ra ? rb : (rb.updatedAt || 0) > (ra.updatedAt || 0) ? rb : ra;
  }
  return result;
}

// Is this URL a booking platform?
function isBookingUrl(url = "") {
  return /thefork|opentable|resy|sevenrooms|quandoo|fork\.it|restabook|tablecheck/i.test(url);
}

function getTier(s) {
  if (s >= 9) return { label:"Leggendaria", icon:"◈", color:"#D4A853", bg:"rgba(212,168,83,0.14)" };
  if (s >= 8) return { label:"Eccellente",  icon:"◆", color:"#C4622D", bg:"rgba(196,98,45,0.14)"  };
  if (s >= 7) return { label:"Buona",       icon:"◇", color:"#5B8A5B", bg:"rgba(91,138,91,0.14)"  };
  if (s >= 6) return { label:"Nella media", icon:"◻", color:"#7A7470", bg:"rgba(122,116,112,0.14)" };
  return       { label:"Evita",       icon:"✕", color:"#8B4040", bg:"rgba(139,64,64,0.14)"  };
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

async function lookupOSMPlace(name, lat, lng) {
  try {
    // 1. Nominatim search with viewbox bias — returns extratags (phone, opening_hours, website)
    const vb = `${lng-0.03},${lat+0.03},${lng+0.03},${lat-0.03}`;
    const nmRes = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(name)}&format=json&limit=8&extratags=1&addressdetails=0&viewbox=${vb}&bounded=0`,
      { headers: { "User-Agent": "LaGuida/3.0", "Accept-Language": "en" } }
    );
    const nmData = await nmRes.json();
    const best = nmData.find(e => e.extratags?.phone || e.extratags?.opening_hours || e.extratags?.["contact:phone"])
              || nmData.find(e => e.extratags)
              || nmData[0];
    if (best?.extratags) {
      const et = best.extratags;
      return {
        phone:        et.phone || et["contact:phone"] || et["contact:mobile"] || "",
        openingHours: et.opening_hours || "",
        website:      et.website || et["contact:website"] || "",
      };
    }
    // 2. Overpass fallback — direct tag lookup near coordinates
    const safe  = name.replace(/[\\/"[\](){}|.*+?^$]/g, " ").trim().slice(0, 50);
    const query = `[out:json][timeout:12];(node(around:300,${lat},${lng})["name"~"${safe}",i];way(around:300,${lat},${lng})["name"~"${safe}",i];);out body;`;
    const opRes = await fetch("https://overpass-api.de/api/interpreter", {
      method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: `data=${encodeURIComponent(query)}`,
    });
    const opData = await opRes.json();
    const el = opData.elements?.find(e => e.tags?.name?.toLowerCase() === name.toLowerCase()) || opData.elements?.[0];
    if (!el?.tags) return null;
    const t = el.tags;
    return {
      phone:        t.phone || t["contact:phone"] || t["contact:mobile"] || "",
      openingHours: t.opening_hours || "",
      website:      t.website || t["contact:website"] || "",
    };
  } catch { return null; }
}

async function compressImage(file) {
  return new Promise(resolve => {
    const reader = new FileReader();
    reader.onload = e => {
      const img = new Image();
      img.onload = () => {
        const MAX = 600, scale = Math.min(1, MAX / Math.max(img.width, img.height));
        const canvas = document.createElement("canvas");
        canvas.width = img.width * scale; canvas.height = img.height * scale;
        canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/jpeg", 0.65));
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });
}

async function pushToCloud(syncId, entries, wishlist = [], deletedIds = []) {
  try {
    const res = await fetch(`/api/sync?id=${syncId}`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ entries, wishlist, deletedIds }),
    });
    return res.ok;
  } catch { return false; }
}

async function pullFromCloud(syncId) {
  try {
    const res  = await fetch(`/api/sync?id=${syncId}`);
    const data = await res.json();
    return {
      entries:    Array.isArray(data.entries)    ? data.entries    : null,
      wishlist:   Array.isArray(data.wishlist)   ? data.wishlist   : [],
      deletedIds: Array.isArray(data.deletedIds) ? data.deletedIds : [],
    };
  } catch { return null; }
}

// ─── Custom marker icons ──────────────────────────────────────────────────────
function buildMarkerIcon(shape, fillColor, hollow = false) {
  const s    = hollow ? 20 : 24;
  const fill = hollow ? "rgba(212,168,83,0.12)" : fillColor;
  const stk  = hollow ? "#D4A853" : "rgba(0,0,0,0.32)";
  const sw   = hollow ? 2 : 2.5;
  const paths = {
    circle:   `<circle cx="10" cy="10" r="8"    fill="${fill}" stroke="${stk}" stroke-width="${sw}"/>`,
    square:   `<rect x="1" y="1" width="18" height="18" rx="3" fill="${fill}" stroke="${stk}" stroke-width="${sw}"/>`,
    triangle: `<polygon points="10,1 19,19 1,19" fill="${fill}" stroke="${stk}" stroke-width="${sw}"/>`,
    pentagon: `<polygon points="10,1 19,7 15,19 5,19 1,7" fill="${fill}" stroke="${stk}" stroke-width="${sw}"/>`,
  };
  return L.divIcon({
    html: `<svg width="${s}" height="${s}" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">${paths[shape] || paths.circle}</svg>`,
    className: "pg-map-icon",
    iconSize: [s, s], iconAnchor: [s/2, s/2], popupAnchor: [0, -(s/2)-2],
  });
}

// ─── Print ────────────────────────────────────────────────────────────────────
function handlePrint(entries, cuisineKey = "pizza") {
  const config = CUISINE_CONFIGS[cuisineKey];
  const { criteria } = config.criteriaByStyle
    ? (config.criteriaByStyle["Other"] || Object.values(config.criteriaByStyle)[0])
    : { criteria: config.criteria };
  const win = window.open("", "_blank", "width=1100,height=750");
  if (!win) return;
  const date = new Date().toLocaleDateString("en-GB", { day:"2-digit", month:"long", year:"numeric" });
  const thS = `text-align:center;padding:8px 10px;border-bottom:2px solid #ddd;font-size:10px;letter-spacing:1.5px;text-transform:uppercase;color:#888;font-weight:600;white-space:nowrap;`;
  const thL = thS.replace("text-align:center", "text-align:left");
  const cHeaders = criteria.map(c => `<th style="${thS}">${c.label}<br><span style="font-weight:400;color:#bbb;">${c.weight}</span></th>`).join("");
  const rows = entries.map((e, i) => {
    const tier = getTier(e.weightedScore);
    const cells = criteria.map(c => {
      const val = e.scores?.[c.key];
      return `<td style="padding:9px 10px;border-bottom:1px solid #f0f0f0;font-size:13px;color:${val!=null?scoreColor(val):"#ccc"};font-weight:600;text-align:center;">${val??"-"}</td>`;
    }).join("");
    return `<tr><td style="padding:9px 10px;border-bottom:1px solid #f0f0f0;color:#bbb;font-weight:600;text-align:center;">${i+1}</td>
    <td style="padding:9px 10px;border-bottom:1px solid #f0f0f0;">
      <div style="font-family:Georgia,serif;font-size:15px;font-weight:700;">${e.name}</div>
      ${e.location?`<div style="font-size:11px;color:#888;margin-top:2px;">📍 ${e.location}</div>`:""}
      ${e.style?`<div style="font-size:11px;color:#aaa;">${e.style}${e.dish?" · "+e.dish:""}${e.priceRange?" · "+e.priceRange:""}</div>`:""}
      ${e.addedBy?`<div style="font-size:10px;color:#C4622D;">By ${e.addedBy}</div>`:""}
      ${e.notes?`<div style="font-size:11px;color:#bbb;font-style:italic;">"${e.notes}"</div>`:""}
    </td>
    <td style="padding:9px 10px;border-bottom:1px solid #f0f0f0;text-align:center;">
      <span style="font-family:Georgia,serif;font-size:22px;font-weight:700;color:${scoreColor(e.weightedScore)};">${e.weightedScore.toFixed(1)}</span>
      <div style="font-size:9px;color:#bbb;">/10</div>
    </td>
    <td style="padding:9px 10px;border-bottom:1px solid #f0f0f0;font-size:10px;font-weight:600;color:${tier.color};letter-spacing:1px;text-transform:uppercase;white-space:nowrap;">${tier.icon} ${tier.label}</td>
    ${cells}
    <td style="padding:9px 10px;border-bottom:1px solid #f0f0f0;font-size:12px;text-align:center;color:${e.wouldReturn==="Yes"?"#5B8A5B":e.wouldReturn==="No"?"#8B4040":"#888"};">${e.wouldReturn}</td></tr>`;
  }).join("");
  win.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>La Guida — ${config.label}</title>
  <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;700&family=DM+Sans:wght@400;500&display=swap" rel="stylesheet">
  <style>*{box-sizing:border-box;}body{font-family:'DM Sans',sans-serif;padding:40px;color:#111;background:#fff;margin:0;}@media print{@page{margin:15mm;size:landscape;}body{padding:0;}}</style></head><body>
  <div style="border-bottom:2px solid #C4622D;padding-bottom:14px;margin-bottom:24px;display:flex;justify-content:space-between;align-items:flex-end;">
    <div><div style="font-size:10px;letter-spacing:3px;color:#C4622D;text-transform:uppercase;margin-bottom:6px;font-weight:600;">Personal Restaurant Guide</div>
    <div style="font-family:'Playfair Display',serif;font-size:26px;font-weight:700;">La Guida — ${config.label}</div>
    <div style="font-size:12px;color:#aaa;">Exported ${date} · ${entries.length} restaurant${entries.length!==1?"s":""}</div></div>
    <div style="text-align:right;font-size:10px;color:#ccc;line-height:1.8;">${criteria.map(c=>`${c.label} <strong>${c.weight}</strong>`).join("<br>")}</div>
  </div>
  <table style="width:100%;border-collapse:collapse;font-size:13px;">
  <thead><tr><th style="${thS}">#</th><th style="${thL}">Restaurant</th><th style="${thS}">Score</th><th style="${thL}">Tier</th>${cHeaders}<th style="${thS}">Return?</th></tr></thead>
  <tbody>${rows}</tbody></table>
  <div style="margin-top:32px;font-size:10px;color:#ccc;text-align:center;border-top:1px solid #eee;padding-top:12px;">La Guida · Personal Restaurant Guide</div>
  <script>window.onload=()=>setTimeout(()=>window.print(),600);</script></body></html>`);
  win.document.close();
}

// ─── Open Now parser ─────────────────────────────────────────────────────────
function isOpenNow(hoursStr) {
  if (!hoursStr?.trim()) return null;
  try {
    const now    = new Date();
    const day    = ["Su","Mo","Tu","We","Th","Fr","Sa"][now.getDay()];
    const mins   = now.getHours() * 60 + now.getMinutes();
    const DAYS   = ["Mo","Tu","We","Th","Fr","Sa","Su"];
    for (const seg of hoursStr.split(";")) {
      const m = seg.trim().match(/^([A-Za-z,\- ]+?)\s{1,3}(\d.+)/);
      if (!m) continue;
      const [, dayPart, timesPart] = m;
      let appliesToday = false;
      for (const grp of dayPart.split(",")) {
        const g = grp.trim();
        if (g.includes("-")) {
          const [s, e] = g.split("-").map(x => x.trim());
          const [si, ei, di] = [DAYS.indexOf(s), DAYS.indexOf(e), DAYS.indexOf(day)];
          if (si >= 0 && ei >= 0 && di >= 0) appliesToday = si <= ei ? di >= si && di <= ei : di >= si || di <= ei;
        } else if (g === day) appliesToday = true;
      }
      if (!appliesToday) continue;
      if (/off|closed/i.test(timesPart.trim())) return false;
      for (const range of timesPart.split(",")) {
        const t = range.trim().match(/(\d{1,2}):(\d{2})\s*[-–]\s*(\d{1,2}):(\d{2})/);
        if (!t) continue;
        const open = +t[1]*60 + +t[2], close = +t[3]*60 + +t[4];
        if (mins >= open && mins <= close) return true;
      }
      return false;
    }
    return null;
  } catch { return null; }
}

// ─── KML Export ──────────────────────────────────────────────────────────────
function escXML(s) { return String(s || "").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;"); }

function exportKML(entries) {
  const placemarks = entries.filter(e => e.lat && e.lng).map(e => {
    const tier = getTier(e.weightedScore);
    const desc = [
      `${tier.label} · ${e.weightedScore.toFixed(1)}/10`,
      e.style && `Style: ${e.style}`,
      e.priceRange && `Price: ${e.priceRange}`,
      e.location && `📍 ${e.location}`,
      e.phone && `📞 ${e.phone}`,
      e.openingHours && `🕐 ${e.openingHours}`,
      e.reservationUrl && `🔗 ${e.reservationUrl}`,
      e.notes && `"${e.notes}"`,
    ].filter(Boolean).join("\n");
    return `  <Placemark>\n    <name>${escXML(e.name)}</name>\n    <description>${escXML(desc)}</description>\n    <Point><coordinates>${e.lng},${e.lat},0</coordinates></Point>\n  </Placemark>`;
  }).join("\n");
  const kml = `<?xml version="1.0" encoding="UTF-8"?>\n<kml xmlns="http://www.opengis.net/kml/2.2">\n<Document>\n  <name>La Guida</name>\n${placemarks}\n</Document>\n</kml>`;
  const blob = new Blob([kml], { type: "application/vnd.google-earth.kml+xml" });
  const url  = URL.createObjectURL(blob);
  const a    = Object.assign(document.createElement("a"), { href: url, download: "la-guida.kml" });
  a.click(); URL.revokeObjectURL(url);
}
function freshForm(cuisine = "pizza", initials = "", styleOverride = null) {
  const config = CUISINE_CONFIGS[cuisine] || CUISINE_CONFIGS.pizza;
  const style  = styleOverride || config.styles[0];
  const { criteria } = getStyleCriteria(cuisine, style);
  const scores = {};
  criteria.forEach(c => { scores[c.key] = 7; });
  return { name:"", location:"", style, dateVisited: new Date().toISOString().split("T")[0], dish:"", priceRange:"€€", scores, notes:"", wouldReturn:"Yes", cuisine, lat:null, lng:null, photo:null, addedBy:initials, phone:"", openingHours:"", reservationUrl:"" };
}

function freshWishForm(cuisine = "pizza", initials = "") {
  return { name:"", location:"", style: CUISINE_CONFIGS[cuisine]?.styles[0] || "", notes:"", cuisine, lat:null, lng:null, dateAdded: new Date().toISOString().split("T")[0], addedBy:initials, phone:"", openingHours:"", reservationUrl:"" };
}

// ─── Small components ─────────────────────────────────────────────────────────
function Chip({ children, style }) {
  return <span style={{ fontSize:12, background:"var(--surface)", borderRadius:7, padding:"5px 12px", color:"var(--muted)", border:"1px solid var(--border)", display:"inline-block", ...style }}>{children}</span>;
}

function ScoreSlider({ value, onChange }) {
  const fill = `${((value-1)/9)*100}%`;
  const bg   = `linear-gradient(to right, ${scoreColor(value)} 0%, ${scoreColor(value)} ${fill}, var(--border) ${fill}, var(--border) 100%)`;
  return <input type="range" min={1} max={10} step={1} value={value} onChange={e => onChange(+e.target.value)} className="pg-slider" style={{ background: bg }} />;
}

function MapController({ center }) {
  const map = useMap();
  useEffect(() => { if (center) map.flyTo(center, map.getZoom(), { duration: 1 }); }, [center]);
  return null;
}

function ShapeIcon({ shape, size = 12, color = "currentColor" }) {
  const svgs = {
    circle:   <svg width={size} height={size} viewBox="0 0 20 20"><circle cx="10" cy="10" r="8" fill={color}/></svg>,
    square:   <svg width={size} height={size} viewBox="0 0 20 20"><rect x="2" y="2" width="16" height="16" rx="3" fill={color}/></svg>,
    triangle: <svg width={size} height={size} viewBox="0 0 20 20"><polygon points="10,2 18,18 2,18" fill={color}/></svg>,
    pentagon: <svg width={size} height={size} viewBox="0 0 20 20"><polygon points="10,2 18,8 15,18 5,18 2,8" fill={color}/></svg>,
  };
  return svgs[shape] || svgs.circle;
}

// ─── Bottom Nav ───────────────────────────────────────────────────────────────
function BottomNav({ view, onList, onWish, onMap, onAdd, onSettings }) {
  if (["add","detail","wishlist-add"].includes(view)) return null;
  const ic = v => view === v ? "#C4622D" : "var(--dim)";
  const NavBtn = ({ v, onClick, children, label }) => (
    <button onClick={onClick} style={{ background:"none", border:"none", cursor:"pointer", display:"flex", flexDirection:"column", alignItems:"center", padding:"4px 0", flex:1 }}>
      {children}
      <span style={{ fontSize:9, letterSpacing:1.5, textTransform:"uppercase", color:ic(v), fontWeight:600, marginTop:3 }}>{label}</span>
    </button>
  );
  return (
    <div style={{ background:"var(--bg)", borderTop:"1px solid var(--border2)", display:"flex", alignItems:"center", justifyContent:"space-around", padding:"10px 8px env(safe-area-inset-bottom, 16px)", flexShrink:0, zIndex:100 }}>
      <NavBtn v="list" onClick={onList} label="Lista">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={ic("list")} strokeWidth="2" strokeLinecap="round"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>
      </NavBtn>
      <NavBtn v="wishlist" onClick={onWish} label="Wishlist">
        <svg width="22" height="22" viewBox="0 0 24 24" fill={view==="wishlist"?"#C4622D":"none"} stroke={ic("wishlist")} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
      </NavBtn>
      <div style={{ flex:1, display:"flex", justifyContent:"center", alignItems:"center" }}>
        <button onClick={onAdd} style={{ background:"#C4622D", border:"none", width:52, height:52, borderRadius:"50%", color:"#F0EBE1", cursor:"pointer", boxShadow:"0 4px 20px rgba(196,98,45,.6)", display:"flex", alignItems:"center", justifyContent:"center", marginTop:-16 }}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#F0EBE1" strokeWidth="2.5" strokeLinecap="round">
            <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
        </button>
      </div>
      <NavBtn v="map" onClick={onMap} label="Mappa">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={ic("map")} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="3 6 9 3 15 6 21 3 21 18 15 21 9 18 3 21"/><line x1="9" y1="3" x2="9" y2="18"/><line x1="15" y1="6" x2="15" y2="21"/></svg>
      </NavBtn>
      <NavBtn v="settings" onClick={onSettings} label="Settings">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={ic("settings")} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
      </NavBtn>
    </div>
  );
}

// ─── Share Modal ──────────────────────────────────────────────────────────────
function ShareModal({ syncId, onClose, onExportPdf, onExportKml }) {
  const [copied, setCopied]       = useState(null); // "collab" | "view" | null
  const base      = `${window.location.origin}${window.location.pathname}`;
  const collabUrl = `${base}?sync=${syncId}`;
  const viewUrl   = `${base}?view=${syncId}`;

  async function copy(type) {
    const url = type === "collab" ? collabUrl : viewUrl;
    try { await navigator.clipboard.writeText(url); } catch {}
    setCopied(type);
    setTimeout(() => setCopied(null), 2000);
  }

  const qrCollab = `https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${encodeURIComponent(collabUrl)}&bgcolor=1C1814&color=F0EBE1&margin=8`;
  const qrView   = `https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${encodeURIComponent(viewUrl)}&bgcolor=1C1814&color=D4A853&margin=8`;

  const LinkRow = ({ type, label, desc, url, accent, qr }) => (
    <div style={{ background:"var(--bg)", border:`1px solid ${accent}33`, borderRadius:12, padding:"14px 16px", marginBottom:12 }}>
      <div style={{ display:"flex", alignItems:"flex-start", gap:12 }}>
        <div style={{ flex:1 }}>
          <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:8 }}>
            <div style={{ width:8, height:8, borderRadius:"50%", background:accent, flexShrink:0 }} />
            <span style={{ fontSize:11, fontWeight:700, letterSpacing:1.5, textTransform:"uppercase", color:accent }}>{label}</span>
          </div>
          <div style={{ fontSize:12, color:"var(--dim)", marginBottom:10, lineHeight:1.6 }}>{desc}</div>
          <div style={{ fontFamily:"monospace", fontSize:10, color:"var(--muted)", wordBreak:"break-all", background:"var(--surface)", borderRadius:7, padding:"8px 10px", marginBottom:10 }}>{url}</div>
          <button onClick={() => copy(type)} style={{ width:"100%", background:copied===type?"#5B8A5B":accent, border:"none", color:accent==="#D4A853"?"#0D0B09":"#F0EBE1", borderRadius:9, padding:"11px", fontSize:13, cursor:"pointer", fontFamily:"'DM Sans', sans-serif", fontWeight:600, transition:"background .2s" }}>
            {copied === type ? "✓ Copied!" : "Copy link"}
          </button>
        </div>
        <img src={qr} alt="QR" width={72} height={72} style={{ borderRadius:8, flexShrink:0, marginTop:2 }} />
      </div>
    </div>
  );

  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.75)", zIndex:2000, display:"flex", alignItems:"flex-end", justifyContent:"center" }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{ background:"var(--surface)", borderRadius:"18px 18px 0 0", padding:"24px 24px 36px", width:"100%", maxWidth:430, border:"1px solid var(--border)", borderBottom:"none", maxHeight:"90vh", overflowY:"auto" }}>
        <div style={{ width:36, height:4, background:"var(--border)", borderRadius:2, margin:"0 auto 20px" }} />
        <div style={{ display:"flex", alignItems:"flex-start", gap:14, marginBottom:16 }}>
          <div style={{ flex:1 }}>
            <div style={{ fontFamily:"'Playfair Display', serif", fontSize:20, fontWeight:600, marginBottom:6, color:"var(--text)" }}>Share your guide</div>
            <div style={{ fontSize:12, color:"var(--dim)", lineHeight:1.6 }}>Two links — choose who can edit.</div>
          </div>
        </div>

        {/* Export PDF */}
        <button onClick={() => { onExportPdf(); onClose(); }} style={{ width:"100%", background:"var(--bg)", border:"1px solid var(--border)", color:"var(--muted)", borderRadius:12, padding:"13px 16px", fontSize:14, cursor:"pointer", fontFamily:"'DM Sans', sans-serif", display:"flex", alignItems:"center", gap:10, marginBottom:10 }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
          <span style={{ fontWeight:500 }}>Export PDF</span>
          <span style={{ marginLeft:"auto", fontSize:11, color:"var(--dimmer)" }}>Opens print dialog</span>
        </button>
        {/* Export KML for Google Maps */}
        <button onClick={() => { onExportKml(); onClose(); }} style={{ width:"100%", background:"var(--bg)", border:"1px solid var(--border)", color:"var(--muted)", borderRadius:12, padding:"13px 16px", fontSize:14, cursor:"pointer", fontFamily:"'DM Sans', sans-serif", display:"flex", alignItems:"center", gap:10, marginBottom:16 }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="3 11 22 2 13 21 11 13 3 11"/></svg>
          <span style={{ fontWeight:500 }}>Export to Google Maps</span>
          <span style={{ marginLeft:"auto", fontSize:11, color:"var(--dimmer)" }}>Downloads .kml file</span>
        </button>
        <div style={{ height:1, background:"var(--border)", marginBottom:16 }} />

        <LinkRow type="collab" label="Collaborator" desc="Can browse AND add entries — their additions sync back to your guide." url={collabUrl} accent="#C4622D" qr={qrCollab} />
        <LinkRow type="view"   label="View only"    desc="Can browse your guide and add private local notes — nothing syncs back to you." url={viewUrl} accent="#D4A853" qr={qrView} />

        <div style={{ fontSize:11, color:"var(--dimmer)", marginBottom:16, lineHeight:1.6 }}>⚠️ Photos are stored locally on each device and are never synced.</div>
        <button onClick={onClose} style={{ width:"100%", background:"transparent", border:"1px solid var(--border)", color:"var(--muted)", borderRadius:12, padding:"13px", fontSize:14, cursor:"pointer", fontFamily:"'DM Sans', sans-serif" }}>Done</button>
      </div>
    </div>
  );
}

// ─── Filter Sheet ─────────────────────────────────────────────────────────────
function FilterSheet({ cuisineStyles, filterTiers, filterStyles, filterPrices, onToggleTier, onToggleStyle, onTogglePrice, onClear, onClose }) {
  const has = filterTiers.length + filterStyles.length + filterPrices.length > 0;
  const Sec = ({ lbl, kids }) => <div style={{ marginBottom:20 }}><div style={{ fontSize:10, letterSpacing:2, color:"#C4622D", textTransform:"uppercase", fontWeight:600, marginBottom:12 }}>{lbl}</div><div style={{ display:"flex", flexWrap:"wrap", gap:8 }}>{kids}</div></div>;
  const Pill = ({ label, active, onClick }) => <button onClick={onClick} style={{ background:active?"#C4622D":"var(--bg)", border:`1px solid ${active?"#C4622D":"var(--border)"}`, color:active?"#F0EBE1":"var(--muted)", borderRadius:20, padding:"7px 14px", fontSize:13, cursor:"pointer", fontFamily:"'DM Sans', sans-serif", transition:"all .15s" }}>{label}</button>;
  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.7)", zIndex:2000, display:"flex", alignItems:"flex-end" }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{ background:"var(--surface)", borderRadius:"18px 18px 0 0", padding:"24px 24px 36px", width:"100%", maxWidth:430, margin:"0 auto", border:"1px solid var(--border)", borderBottom:"none", maxHeight:"80vh", overflowY:"auto" }}>
        <div style={{ width:36, height:4, background:"var(--border)", borderRadius:2, margin:"0 auto 24px" }} />
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:20 }}>
          <div style={{ fontFamily:"'Playfair Display', serif", fontSize:18, fontWeight:600, color:"var(--text)" }}>Filters</div>
          {has && <button onClick={onClear} style={{ background:"none", border:"none", color:"#C4622D", fontSize:13, cursor:"pointer", fontFamily:"'DM Sans', sans-serif" }}>Clear all</button>}
        </div>
        <Sec lbl="Tier" kids={TIERS.map(t => <Pill key={t} label={t} active={filterTiers.includes(t)} onClick={() => onToggleTier(t)} />)} />
        <Sec lbl="Price" kids={PRICE_RANGES.map(p => <Pill key={p} label={p} active={filterPrices.includes(p)} onClick={() => onTogglePrice(p)} />)} />
        {cuisineStyles.length > 0 && <Sec lbl="Style" kids={cuisineStyles.map(s => <Pill key={s} label={s} active={filterStyles.includes(s)} onClick={() => onToggleStyle(s)} />)} />}
        <button onClick={onClose} style={{ width:"100%", background:"#C4622D", border:"none", color:"#F0EBE1", borderRadius:12, padding:"14px", fontSize:15, cursor:"pointer", fontFamily:"'DM Sans', sans-serif", fontWeight:600 }}>Apply</button>
      </div>
    </div>
  );
}

// ─── Sort Sheet ───────────────────────────────────────────────────────────────
function SortSheet({ sortBy, onSort, criteria, onClose }) {
  const opts = [
    { key:"score_desc", label:"Score: High → Low" },
    { key:"score_asc",  label:"Score: Low → High" },
    { key:"date_new",   label:"Date: Newest first" },
    { key:"date_old",   label:"Date: Oldest first" },
    { key:"az",         label:"Name: A → Z" },
    { key:"za",         label:"Name: Z → A" },
    ...criteria.map(c => ({ key: c.key, label: `Best ${c.label}` })),
  ];
  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.7)", zIndex:2000, display:"flex", alignItems:"flex-end" }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{ background:"var(--surface)", borderRadius:"18px 18px 0 0", padding:"24px 24px 36px", width:"100%", maxWidth:430, margin:"0 auto", border:"1px solid var(--border)", borderBottom:"none" }}>
        <div style={{ width:36, height:4, background:"var(--border)", borderRadius:2, margin:"0 auto 24px" }} />
        <div style={{ fontFamily:"'Playfair Display', serif", fontSize:18, fontWeight:600, marginBottom:20, color:"var(--text)" }}>Sort by</div>
        {opts.map(o => (
          <button key={o.key} onClick={() => { onSort(o.key); onClose(); }} style={{ display:"flex", width:"100%", alignItems:"center", justifyContent:"space-between", background:"none", border:"none", borderBottom:"1px solid var(--border2)", padding:"14px 4px", cursor:"pointer", fontFamily:"'DM Sans', sans-serif", fontSize:14, color:sortBy===o.key?"#C4622D":"var(--text)", fontWeight:sortBy===o.key?600:400 }}>
            {o.label}{sortBy === o.key && <span>✓</span>}
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── Settings Panel ───────────────────────────────────────────────────────────
function SettingsPanel({ theme, onTheme, userInitials, onInitials, onJoin, onClose }) {
  const [init, setInit]       = useState(userInitials);
  const [joinUrl, setJoinUrl] = useState("");
  const [joining, setJoining] = useState(false);
  const [joinMsg, setJoinMsg] = useState("");

  async function handleJoin() {
    const m = joinUrl.match(/[?&](sync|view)=([0-9a-f-]{36})/i);
    if (!m) { setJoinMsg("Couldn't find a sync ID in that URL."); return; }
    setJoining(true); setJoinMsg("");
    await onJoin(m[2], m[1].toLowerCase() === "view");
    setJoinMsg("Connected! The guide will sync shortly."); setJoining(false);
  }

  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.7)", zIndex:2000, display:"flex", alignItems:"flex-end" }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{ background:"var(--surface)", borderRadius:"18px 18px 0 0", padding:"24px 24px 40px", width:"100%", maxWidth:430, margin:"0 auto", border:"1px solid var(--border)", borderBottom:"none", maxHeight:"88vh", overflowY:"auto" }}>
        <div style={{ width:36, height:4, background:"var(--border)", borderRadius:2, margin:"0 auto 24px" }} />
        <div style={{ fontFamily:"'Playfair Display', serif", fontSize:18, fontWeight:600, marginBottom:24, color:"var(--text)" }}>Settings</div>
        <div style={{ marginBottom:24 }}>
          <div style={{ fontSize:10, letterSpacing:2, color:"#C4622D", textTransform:"uppercase", fontWeight:600, marginBottom:10 }}>Appearance</div>
          <div style={{ display:"flex", gap:10 }}>
            {["dark","light"].map(t => <button key={t} onClick={() => onTheme(t)} style={{ flex:1, background:theme===t?"#C4622D":"var(--bg)", border:`1px solid ${theme===t?"#C4622D":"var(--border)"}`, color:theme===t?"#F0EBE1":"var(--muted)", borderRadius:10, padding:"11px", fontSize:13, cursor:"pointer", fontFamily:"'DM Sans', sans-serif", display:"flex", alignItems:"center", justifyContent:"center", gap:6 }}>{t==="dark"?"🌙 Dark":"☀️ Light"}</button>)}
          </div>
        </div>
        <div style={{ marginBottom:24 }}>
          <div style={{ fontSize:10, letterSpacing:2, color:"#C4622D", textTransform:"uppercase", fontWeight:600, marginBottom:10 }}>Your Initials</div>
          <div style={{ fontSize:12, color:"var(--dim)", marginBottom:10, lineHeight:1.6 }}>Shows on entries as a badge in shared guides.</div>
          <div style={{ display:"flex", gap:10 }}>
            <input className="pg-input" placeholder="e.g. GR" value={init} maxLength={3} onChange={e => setInit(e.target.value.toUpperCase())} style={{ flex:1, textTransform:"uppercase", letterSpacing:2, fontWeight:600 }} />
            <button onClick={() => { onInitials(init); onClose(); }} style={{ background:"#C4622D", border:"none", color:"#F0EBE1", borderRadius:10, padding:"0 18px", fontSize:14, cursor:"pointer", fontFamily:"'DM Sans', sans-serif", fontWeight:600 }}>Save</button>
          </div>
        </div>
        <div style={{ marginBottom:24 }}>
          <div style={{ fontSize:10, letterSpacing:2, color:"#C4622D", textTransform:"uppercase", fontWeight:600, marginBottom:10 }}>Connect to a guide</div>
          <div style={{ fontSize:12, color:"var(--dim)", marginBottom:10, lineHeight:1.6 }}>If you opened a sync link in your browser but this app (installed to home screen or dock) isn't synced, paste the link here to connect.</div>
          <div style={{ display:"flex", gap:8, marginBottom:8 }}>
            <input className="pg-input" placeholder="Paste collaborator or view-only link…" value={joinUrl} onChange={e => setJoinUrl(e.target.value)} style={{ flex:1, fontSize:12 }} />
            <button onClick={handleJoin} disabled={!joinUrl.trim() || joining} style={{ background:joining?"var(--surface)":"#C4622D", border:"none", color:joining?"var(--dimmer)":"#F0EBE1", borderRadius:10, padding:"0 14px", fontSize:13, cursor:"pointer", fontFamily:"'DM Sans', sans-serif", fontWeight:600, flexShrink:0 }}>
              {joining ? "…" : "Connect"}
            </button>
          </div>
          {joinMsg && <div style={{ fontSize:11, color:joinMsg.includes("Connected")?"#5B8A5B":"#8B4040", lineHeight:1.5 }}>{joinMsg}</div>}
        </div>
        <button onClick={onClose} style={{ width:"100%", background:"transparent", border:"1px solid var(--border)", color:"var(--muted)", borderRadius:12, padding:"13px", fontSize:14, cursor:"pointer", fontFamily:"'DM Sans', sans-serif" }}>Close</button>
      </div>
    </div>
  );
}

// ─── Cuisine Switcher ─────────────────────────────────────────────────────────
function CuisineSwitcher({ active, onChange }) {
  return (
    <div style={{ display:"flex", gap:8, overflowX:"auto", paddingBottom:2, WebkitOverflowScrolling:"touch" }}>
      {CUISINE_KEYS.map(key => {
        const cfg = CUISINE_CONFIGS[key];
        const on  = active === key;
        return <button key={key} onClick={() => onChange(key)} style={{ flexShrink:0, background:on?"#C4622D":"var(--surface)", border:`1px solid ${on?"#C4622D":"var(--border)"}`, color:on?"#F0EBE1":"var(--muted)", borderRadius:20, padding:"6px 14px", fontSize:13, cursor:"pointer", fontFamily:"'DM Sans', sans-serif", fontWeight:on?600:400, display:"flex", alignItems:"center", gap:5, transition:"all .15s", whiteSpace:"nowrap" }}>{cfg.icon} {cfg.label}</button>;
      })}
    </div>
  );
}

// ─── Map Cuisine Filter ───────────────────────────────────────────────────────
function MapCuisineFilter({ active, onToggle }) {
  return (
    <div style={{ display:"flex", gap:8, overflowX:"auto", paddingBottom:2, WebkitOverflowScrolling:"touch" }}>
      {CUISINE_KEYS.map(key => {
        const cfg = CUISINE_CONFIGS[key];
        const on  = active.includes(key);
        return <button key={key} onClick={() => onToggle(key)} style={{ flexShrink:0, background:on?"rgba(196,98,45,0.15)":"var(--surface)", border:`1px solid ${on?"#C4622D":"var(--border)"}`, color:on?"#C4622D":"var(--dim)", borderRadius:20, padding:"5px 12px", fontSize:12, cursor:"pointer", fontFamily:"'DM Sans', sans-serif", fontWeight:on?600:400, display:"flex", alignItems:"center", gap:5, whiteSpace:"nowrap", transition:"all .15s" }}>
          {cfg.icon} {cfg.label}
          {on && <ShapeIcon shape={cfg.mapShape} size={9} color="#C4622D" />}
        </button>;
      })}
    </div>
  );
}

// ─── Help Sheet ───────────────────────────────────────────────────────────────
function HelpSheet({ onClose }) {
  const S = ({ children }) => <div style={{ marginBottom:20 }}>
    <div style={{ fontSize:10, letterSpacing:2, color:"#C4622D", textTransform:"uppercase", fontWeight:600, marginBottom:8 }}>{children[0]}</div>
    <div style={{ fontSize:13, color:"var(--muted)", lineHeight:1.8 }}>{children[1]}</div>
  </div>;
  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.75)", zIndex:2000, display:"flex", alignItems:"flex-end" }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{ background:"var(--surface)", borderRadius:"18px 18px 0 0", padding:"24px 24px 40px", width:"100%", maxWidth:430, margin:"0 auto", border:"1px solid var(--border)", borderBottom:"none", maxHeight:"88vh", overflowY:"auto" }}>
        <div style={{ width:36, height:4, background:"var(--border)", borderRadius:2, margin:"0 auto 20px" }} />
        <div style={{ fontFamily:"'Playfair Display', serif", fontSize:22, fontWeight:700, marginBottom:6, color:"var(--text)" }}>La Guida</div>
        <div style={{ fontFamily:"'Playfair Display', serif", fontStyle:"italic", fontSize:14, color:"var(--dim)", marginBottom:24 }}>Your personal Michelin guide</div>

        <S>{["Adding entries", <>Tap <strong style={{color:"var(--text)"}}>+</strong> to log a restaurant. Each entry gets a weighted score (1–10) calculated from criteria specific to the cuisine type. The score updates live as you move the sliders.</>]}</S>
        <S>{["Score tiers", <><span style={{color:"#D4A853"}}>◈ Leggendaria</span> 9+ · <span style={{color:"#C4622D"}}>◆ Eccellente</span> 8+ · <span style={{color:"#5B8A5B"}}>◇ Buona</span> 7+ · <span style={{color:"#7A7470"}}>◻ Nella media</span> 6+ · <span style={{color:"#8B4040"}}>✕ Evita</span> below 6</>]}</S>
        <S>{["Cuisines", "Pizza, Asian (Sushi, Ramen, Chinese, Thai, Vietnamese), Ethnic (Mexican, Indian, Middle Eastern, Greek, African, French), and Burgers. Each cuisine has its own weighted criteria — Asian and Ethnic criteria also adapt to the sub-type you select."]}</S>
        <S>{["Auto-fill", "When adding a place, tap Auto-fill to look up phone, opening hours and website from OpenStreetMap. Works best for places that already exist on the map with full details filled in."]}</S>
        <S>{["Open now", "A green dot next to a restaurant's name means it's open right now based on the stored opening hours. Red means closed."]}</S>
        <S>{["Visit history & ratings", "Tap 'Log another visit' on any entry to record a new score over time. If a collaborator uses 'Add my rating', both scores are stored and the displayed score becomes the average."]}</S>
        <S>{["Sharing", <>Open <strong style={{color:"var(--text)"}}>Share & Sync</strong> to get two links. The <strong style={{color:"#C4622D"}}>Collaborator</strong> link lets others add and rate — their entries sync back to you. The <strong style={{color:"#D4A853"}}>View only</strong> link shows your guide without syncing their additions back.</>]}</S>
        <S>{["PWA / App", "If you installed this as an app from your home screen or dock and it isn't syncing, open Settings → Connect to a guide and paste your collaborator link. Installed apps have separate storage from the browser."]}</S>
        <S>{["Wishlist", "Heart button in the nav. Save places you want to try — they show on the map as hollow markers. Tap 'Rate now' to promote a wishlist entry to a rated entry."]}</S>
        <S>{["Map", "Shows all cuisines at once. Pizza = circle, Asian = square, Ethnic = triangle, Burgers = pentagon. Colour shows the score. Use the cuisine pills to hide/show types. Wishlist spots appear as hollow markers."]}</S>

        <button onClick={onClose} style={{ width:"100%", background:"#C4622D", border:"none", color:"#F0EBE1", borderRadius:12, padding:"14px", fontSize:15, cursor:"pointer", fontFamily:"'DM Sans', sans-serif", fontWeight:600 }}>Got it</button>
      </div>
    </div>
  );
}

// ─── Main App ─────────────────────────────────────────────────────────────────
export default function App() {
  const [view, setView]             = useState("list");
  const [entries, setEntries]       = useState([]);
  const [wishlist, setWishlist]     = useState([]);
  const [form, setForm]             = useState(freshForm());
  const [wishForm, setWishForm]     = useState(freshWishForm());
  const [selectedId, setSelectedId] = useState(null);
  const [editingId, setEditingId]   = useState(null);
  const [editingWishId, setEditingWishId] = useState(null);
  const [confirmDel, setConfirmDel] = useState(false);
  const [saving, setSaving]         = useState(false);
  const [syncId, setSyncId]         = useState(null);
  const [syncStatus, setSyncStatus] = useState("idle");
  const [showShare, setShowShare]   = useState(false);
  const [showHelp, setShowHelp]     = useState(false);
  const [showFilter, setShowFilter] = useState(false);
  const [showSort, setShowSort]     = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [mapFocus, setMapFocus]     = useState(null);
  const [activeCuisine, setActiveCuisine] = useState("pizza");
  const [theme, setTheme]           = useState("dark");
  const [userInitials, setUserInitials] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [filterTiers, setFilterTiers]   = useState([]);
  const [filterStyles, setFilterStyles] = useState([]);
  const [filterPrices, setFilterPrices] = useState([]);
  const [sortBy, setSortBy]         = useState("score_desc");
  const [mapCuisineFilter, setMapCuisineFilter] = useState(CUISINE_KEYS);
  const [viewOnly, setViewOnly] = useState(false);
  const [pollId, setPollId]     = useState(null);
  const [showSearch, setShowSearch] = useState(false);
  const [deletedIds, setDeletedIds] = useState(() => {
    try { return new Set(JSON.parse(localStorage.getItem(DELETED_KEY) || "[]")); } catch { return new Set(); }
  });
  const [lookingUp, setLookingUp] = useState(false);
  const [lookingUpWish, setLookingUpWish] = useState(false);
  const [addingVisitTo, setAddingVisitTo] = useState(null); // entry ID when logging a re-visit
  const fileRef       = useRef();
  const entriesRef    = useRef([]);
  const wishlistRef   = useRef([]);
  const syncIdRef     = useRef(null);
  const viewOnlyRef   = useRef(false);
  const deletedIdsRef = useRef(new Set());

  // ── Bootstrap ──────────────────────────────────────────────────────────────
  useEffect(() => {
    const params      = new URLSearchParams(window.location.search);
    const urlSyncId   = params.get("sync");
    const localSyncId = localStorage.getItem(SYNC_ID_KEY);

    if (localStorage.getItem(THEME_KEY))   setTheme(localStorage.getItem(THEME_KEY));
    if (localStorage.getItem(INITIALS_KEY)) setUserInitials(localStorage.getItem(INITIALS_KEY));
    const savedCuisine = localStorage.getItem(CUISINE_KEY);
    if (savedCuisine && CUISINE_CONFIGS[savedCuisine]) setActiveCuisine(savedCuisine);

    async function bootstrap() {
      const urlViewId = params.get("view");
      let activeSyncId;

      if (urlViewId) {
        // View-only mode: load entries from cloud, never push back, never show owner's wishlist
        setViewOnly(true);
        viewOnlyRef.current = true;
        setSyncStatus("syncing");
        window.history.replaceState({}, "", window.location.pathname);
        const cloud = await pullFromCloud(urlViewId);
        if (cloud?.entries?.length > 0) {
          const me = cloud.entries.map(e => ({ ...e, cuisine: migrateCuisine(e.cuisine) }));
          setEntries(me); // wishlist intentionally NOT loaded for view-only users
        }
        setSyncStatus("ok");
        const existingId = localSyncId || generateUUID();
        if (!localSyncId) localStorage.setItem(SYNC_ID_KEY, existingId);
        setSyncId(existingId);
        setPollId(urlViewId);
        return;
      }

      if (urlSyncId) {
        activeSyncId = urlSyncId;
        localStorage.setItem(SYNC_ID_KEY, urlSyncId);
        window.history.replaceState({}, "", window.location.pathname);
      } else {
        activeSyncId = localSyncId || generateUUID();
        if (!localSyncId) localStorage.setItem(SYNC_ID_KEY, activeSyncId);
      }
      setSyncId(activeSyncId);
      setPollId(activeSyncId); // always poll own/shared sync ID

      if (urlSyncId) {
        setSyncStatus("syncing");
        const cloud = await pullFromCloud(urlSyncId);
        if (cloud?.entries?.length > 0) {
          const me = cloud.entries.map(e => ({ ...e, cuisine: migrateCuisine(e.cuisine) }));
          const mw = (cloud.wishlist || []).map(w => ({ ...w, cuisine: migrateCuisine(w.cuisine) }));
          // Merge tombstones from cloud
          const cloudDeleted = new Set(cloud.deletedIds || []);
          const merged = new Set([...deletedIdsRef.current, ...cloudDeleted]);
          setDeletedIds(merged);
          localStorage.setItem(DELETED_KEY, JSON.stringify([...merged]));
          const filteredEntries = me.filter(e => !merged.has(e.id));
          localStorage.setItem(STORAGE_KEY,  JSON.stringify(filteredEntries));
          localStorage.setItem(WISHLIST_KEY, JSON.stringify(mw));
          setEntries(filteredEntries); setWishlist(mw); setSyncStatus("ok"); return;
        }
      }
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw) setEntries(JSON.parse(raw).map(e => ({ ...e, cuisine: migrateCuisine(e.cuisine) })));
      } catch {}
      try {
        const rawW = localStorage.getItem(WISHLIST_KEY);
        if (rawW) setWishlist(JSON.parse(rawW).map(w => ({ ...w, cuisine: migrateCuisine(w.cuisine) })));
      } catch {}
      setSyncStatus("ok");
    }
    bootstrap();
  }, []);

  useEffect(() => { document.documentElement.setAttribute("data-theme", theme); localStorage.setItem(THEME_KEY, theme); }, [theme]);
  useEffect(() => { localStorage.setItem(CUISINE_KEY, activeCuisine); setFilterStyles([]); setFilterTiers([]); setFilterPrices([]); setSortBy("score_desc"); }, [activeCuisine]);

  // Keep refs current
  useEffect(() => { entriesRef.current  = entries;  }, [entries]);
  useEffect(() => { wishlistRef.current = wishlist; }, [wishlist]);
  useEffect(() => { syncIdRef.current   = syncId;   }, [syncId]);
  useEffect(() => { viewOnlyRef.current = viewOnly; }, [viewOnly]);
  useEffect(() => { deletedIdsRef.current = deletedIds; }, [deletedIds]);

  // ── Live sync polling ──────────────────────────────────────────────────────
  async function syncFromCloud() {
    const id = pollId;
    if (!id) return;
    setSyncStatus("syncing");
    const cloud = await pullFromCloud(id);
    if (!cloud?.entries) { setSyncStatus("ok"); return; }

    // Merge tombstones first — union of local + cloud deleted IDs
    const localDeleted = deletedIdsRef.current;
    const cloudDeleted = new Set(cloud.deletedIds || []);
    const allDeleted   = new Set([...localDeleted, ...cloudDeleted]);
    if (allDeleted.size > localDeleted.size) {
      setDeletedIds(allDeleted);
      localStorage.setItem(DELETED_KEY, JSON.stringify([...allDeleted]));
      deletedIdsRef.current = allDeleted;
    }

    // Merge entries, skipping any that are tombstoned
    const local      = entriesRef.current;
    const localById  = Object.fromEntries(local.map(e => [e.id, e]));
    const cloudById  = Object.fromEntries(
      cloud.entries
        .filter(e => !allDeleted.has(e.id))
        .map(e => [e.id, { ...e, cuisine: migrateCuisine(e.cuisine) }])
    );
    const allIds = new Set([...Object.keys(localById), ...Object.keys(cloudById)]);
    let changed  = false;
    const merged = [];

    for (const eid of allIds) {
      if (allDeleted.has(eid)) { changed = true; continue; }
      const l = localById[eid];
      const c = cloudById[eid];
      if (!c) { merged.push(l); }
      else if (!l) { merged.push(c); changed = true; }
      else {
        // Merge ratings maps first — union of all raters, per-rater last-write wins
        const mergedR = mergeRatings(initRatings(l), initRatings(c));
        const avgWs   = calcAvgScore(mergedR);
        // Base metadata from whichever device was updated more recently
        const base    = (c.updatedAt || 0) > (l.updatedAt || 0) ? { ...c, photo: l.photo ?? c.photo } : l;
        const result  = { ...base, ratings: mergedR, weightedScore: avgWs };
        if (JSON.stringify(result) !== JSON.stringify(l)) changed = true;
        merged.push(result);
      }
    }

    const sorted = merged.sort((a, b) => b.weightedScore - a.weightedScore);

    if (changed) {
      setEntries(sorted);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(sorted));
      if (!viewOnlyRef.current && syncIdRef.current) {
        pushToCloud(syncIdRef.current, sorted, wishlistRef.current, [...allDeleted]);
      }
    }

    // Merge wishlist (collaborators only — view-only users never see the owner's wishlist)
    if (!viewOnlyRef.current) {
      const wl      = wishlistRef.current;
      const wlIds   = new Set(wl.map(w => w.id));
      const newWish = (cloud.wishlist || [])
        .filter(w => !wlIds.has(w.id) && !allDeleted.has(w.id))
        .map(w => ({ ...w, cuisine: migrateCuisine(w.cuisine) }));
      if (newWish.length) {
        const mergedWish = [...wl, ...newWish];
        setWishlist(mergedWish);
        localStorage.setItem(WISHLIST_KEY, JSON.stringify(mergedWish));
      }
    }

    setSyncStatus("ok");
  }

  useEffect(() => {
    if (!pollId) return;
    const id = setInterval(syncFromCloud, 30_000);
    return () => clearInterval(id);
  }, [pollId]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Persistence ────────────────────────────────────────────────────────────
  function persist(newEntries, activeSyncId, newWishlist) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(newEntries));
    const wl  = newWishlist !== undefined ? newWishlist : wishlist;
    const del = [...deletedIdsRef.current];
    if (activeSyncId && !viewOnly) {
      setSyncStatus("syncing");
      pushToCloud(activeSyncId, newEntries, wl, del).then(ok => setSyncStatus(ok ? "ok" : "error"));
    }
  }

  function persistWish(newWishlist) {
    setWishlist(newWishlist);
    localStorage.setItem(WISHLIST_KEY, JSON.stringify(newWishlist));
    if (syncId && !viewOnly) {
      setSyncStatus("syncing");
      pushToCloud(syncId, entries, newWishlist, [...deletedIdsRef.current]).then(ok => setSyncStatus(ok ? "ok" : "error"));
    }
  }

  // ── Entry CRUD ─────────────────────────────────────────────────────────────
  async function saveEntry() {
    setSaving(true);
    const userKey = form.addedBy || userInitials || "?";

    // ── Re-visit / Add-rating mode ─────────────────────────────────────────────
    if (addingVisitTo) {
      const parent  = entries.find(e => e.id === addingVisitTo);
      if (!parent) { setSaving(false); return; }
      const cuisine = parent.cuisine;
      const score   = parseFloat(calcScore(form.scores, cuisine, parent.style).toFixed(1));
      const newVisit = { id: String(Date.now()), date: form.dateVisited, scores: { ...form.scores }, dish: form.dish, notes: form.notes, wouldReturn: form.wouldReturn, weightedScore: score, addedBy: userKey, updatedAt: Date.now() };
      const existingVisits = parent.visits?.length
        ? parent.visits
        : [{ id: parent.id + "-v0", date: parent.dateVisited, scores: { ...parent.scores }, dish: parent.dish, notes: parent.notes, wouldReturn: parent.wouldReturn, weightedScore: parent.weightedScore, addedBy: parent.addedBy }];
      // Merge rater's new score into ratings map
      const parentRatings = initRatings(parent);
      const newRating     = { scores: { ...form.scores }, weightedScore: score, dish: form.dish, notes: form.notes, wouldReturn: form.wouldReturn, dateVisited: form.dateVisited, addedBy: userKey, updatedAt: Date.now() };
      const updatedRatings = { ...parentRatings, [userKey]: newRating };
      const avgScore = calcAvgScore(updatedRatings);
      const updated = { ...parent, weightedScore: avgScore, scores: { ...form.scores }, dish: form.dish, notes: form.notes, wouldReturn: form.wouldReturn, updatedAt: Date.now(), ratings: updatedRatings, visits: [newVisit, ...existingVisits] };
      const next = entries.map(e => e.id === addingVisitTo ? updated : e).sort((a, b) => b.weightedScore - a.weightedScore);
      setEntries(next); persist(next, syncId); setSaving(false);
      setView("detail"); setAddingVisitTo(null); setSelectedId(addingVisitTo);
      return;
    }

    // ── Normal new/edit entry ─────────────────────────────────────────────────
    let lat = form.lat, lng = form.lng;
    if (form.location?.trim() && !lat) { const c = await geocodeLocation(form.location); if (c) { lat = c.lat; lng = c.lng; } }
    const cuisine = form.cuisine || activeCuisine;
    const score   = parseFloat(calcScore(form.scores, cuisine, form.style).toFixed(1));
    // Build ratings map: keep all existing raters, update/add current user
    const existingEntry  = editingId ? entries.find(e => e.id === editingId) : null;
    const existingRatings = existingEntry ? initRatings(existingEntry) : {};
    const myRating = { scores: { ...form.scores }, weightedScore: score, dish: form.dish, notes: form.notes, wouldReturn: form.wouldReturn, dateVisited: form.dateVisited, addedBy: userKey, updatedAt: Date.now() };
    const updatedRatings  = { ...existingRatings, [userKey]: myRating };
    const avgScore        = calcAvgScore(updatedRatings);
    const firstVisit = { id: String(Date.now()) + "-v0", date: form.dateVisited, scores: { ...form.scores }, dish: form.dish, notes: form.notes, wouldReturn: form.wouldReturn, weightedScore: score, addedBy: userKey };
    const entry = { ...form, id: editingId || String(Date.now()), weightedScore: avgScore, lat, lng, cuisine, addedBy: existingEntry?.addedBy || userKey, updatedAt: Date.now(), ratings: updatedRatings, visits: editingId ? (existingEntry?.visits || []) : [firstVisit] };
    const next  = [...(editingId ? entries.map(e => e.id === editingId ? entry : e) : [...entries, entry])].sort((a, b) => b.weightedScore - a.weightedScore);
    setEntries(next); persist(next, syncId); setSaving(false);
    setView(editingId ? "detail" : "list"); setEditingId(null); setForm(freshForm(activeCuisine, userInitials));
  }

  async function saveWishEntry() {
    setSaving(true);
    let lat = wishForm.lat, lng = wishForm.lng;
    if (wishForm.location?.trim() && !lat) { const c = await geocodeLocation(wishForm.location); if (c) { lat = c.lat; lng = c.lng; } }
    const item = { ...wishForm, id: editingWishId || String(Date.now()), lat, lng, addedBy: wishForm.addedBy || userInitials };
    const next = editingWishId ? wishlist.map(w => w.id === editingWishId ? item : w) : [...wishlist, item];
    persistWish(next); setSaving(false); setView("wishlist"); setEditingWishId(null); setWishForm(freshWishForm(activeCuisine, userInitials));
  }

  function deleteEntry(id) {
    const next = entries.filter(e => e.id !== id);
    setEntries(next);
    // Record tombstone so the entry never reappears after a sync
    const newDel = new Set([...deletedIdsRef.current, id]);
    setDeletedIds(newDel);
    deletedIdsRef.current = newDel;
    localStorage.setItem(DELETED_KEY, JSON.stringify([...newDel]));
    persist(next, syncId);
    setView("list"); setSelectedId(null); setConfirmDel(false);
  }

  function deleteWish(id) {
    const newDel = new Set([...deletedIdsRef.current, id]);
    setDeletedIds(newDel);
    deletedIdsRef.current = newDel;
    localStorage.setItem(DELETED_KEY, JSON.stringify([...newDel]));
    persistWish(wishlist.filter(w => w.id !== id));
  }

  function rateNow(item) {
    const cuisine = migrateCuisine(item.cuisine);
    setActiveCuisine(cuisine);
    const style0 = item.style || CUISINE_CONFIGS[cuisine]?.styles[0] || "";
    const { criteria } = getStyleCriteria(cuisine, style0);
    const scores = {};
    criteria.forEach(c => { scores[c.key] = 7; });
    setForm({ name:item.name, location:item.location||"", style:style0, dateVisited:new Date().toISOString().split("T")[0], dish:"", priceRange:"€€", scores, notes:item.notes||"", wouldReturn:"Yes", cuisine, lat:item.lat||null, lng:item.lng||null, photo:null, addedBy:userInitials });
    setEditingId(null); setView("add");
    persistWish(wishlist.filter(w => w.id !== item.id));
  }

  function openEdit(entry) { setForm({ ...entry, scores: { ...entry.scores } }); setEditingId(entry.id); setAddingVisitTo(null); setView("add"); }
  function openDetail(id) { setSelectedId(id); setConfirmDel(false); setView("detail"); }
  function openAdd() {
    if (view === "wishlist") { setWishForm(freshWishForm(activeCuisine, userInitials)); setEditingWishId(null); setView("wishlist-add"); }
    else { setForm(freshForm(activeCuisine, userInitials)); setEditingId(null); setAddingVisitTo(null); setView("add"); }
  }
  function startVisit(entry) {
    const cuisine = migrateCuisine(entry.cuisine);
    const { criteria } = getStyleCriteria(cuisine, entry.style);
    const scores = {}; criteria.forEach(c => { scores[c.key] = 7; });
    setForm({ ...freshForm(cuisine, userInitials), scores, style: entry.style, dish: "", notes: "", dateVisited: new Date().toISOString().split("T")[0], addedBy: userInitials });
    setAddingVisitTo(entry.id); setEditingId(null); setView("add");
  }

  async function handlePhoto(e) {
    const file = e.target.files?.[0]; if (!file) return;
    const compressed = await compressImage(file); setForm(f => ({ ...f, photo: compressed }));
  }

  function handleInitials(val) { setUserInitials(val); localStorage.setItem(INITIALS_KEY, val); }

  async function handleJoin(uuid, isViewOnly) {
    const cloud = await pullFromCloud(uuid);
    if (!cloud?.entries) return;
    const me = cloud.entries.map(e => ({ ...e, cuisine: migrateCuisine(e.cuisine) }));
    setEntries(me); localStorage.setItem(STORAGE_KEY, JSON.stringify(me));
    if (!isViewOnly) {
      const mw = (cloud.wishlist || []).map(w => ({ ...w, cuisine: migrateCuisine(w.cuisine) }));
      setWishlist(mw); localStorage.setItem(WISHLIST_KEY, JSON.stringify(mw));
      localStorage.setItem(SYNC_ID_KEY, uuid);
      setSyncId(uuid);
    }
    setViewOnly(isViewOnly);
    viewOnlyRef.current = isViewOnly;
    setPollId(uuid);
  }

  async function handleLookupPlace() {
    if (!form.name.trim()) return;
    setLookingUp(true);
    let lat = form.lat, lng = form.lng;
    if (!lat && form.location?.trim()) {
      const coords = await geocodeLocation(form.location || form.name);
      if (coords) { lat = coords.lat; lng = coords.lng; setForm(f => ({ ...f, lat, lng })); }
    }
    if (!lat) { setLookingUp(false); return; }
    const result = await lookupOSMPlace(form.name, lat, lng);
    if (result) {
      setForm(f => ({
        ...f,
        phone:          result.phone        || f.phone,
        openingHours:   result.openingHours || f.openingHours,
        // Use OSM website as reservation/website field if not already set
        reservationUrl: f.reservationUrl || result.website || "",
      }));
    }
    setLookingUp(false);
  }

  async function handleLookupWishPlace() {
    if (!wishForm.name.trim()) return;
    setLookingUpWish(true);
    let lat = wishForm.lat, lng = wishForm.lng;
    if (!lat && wishForm.location?.trim()) {
      const coords = await geocodeLocation(wishForm.location);
      if (coords) { lat = coords.lat; lng = coords.lng; setWishForm(f => ({ ...f, lat, lng })); }
    }
    if (!lat) { setLookingUpWish(false); return; }
    const result = await lookupOSMPlace(wishForm.name, lat, lng);
    if (result) {
      setWishForm(f => ({
        ...f,
        phone:          result.phone        || f.phone,
        openingHours:   result.openingHours || f.openingHours,
        reservationUrl: f.reservationUrl || result.website || "",
      }));
    }
    setLookingUpWish(false);
  }

  function toggleArr(arr, set, val) { set(arr.includes(val) ? arr.filter(x => x !== val) : [...arr, val]); }

  function handleFormStyleChange(newStyle) {
    const cuisine = form.cuisine || activeCuisine;
    if (CUISINE_CONFIGS[cuisine]?.criteriaByStyle) {
      const { criteria } = getStyleCriteria(cuisine, newStyle);
      const scores = {}; criteria.forEach(c => { scores[c.key] = 7; });
      setForm(f => ({ ...f, style: newStyle, scores }));
    } else {
      setForm(f => ({ ...f, style: newStyle }));
    }
  }

  function toggleMapCuisine(key) {
    setMapCuisineFilter(prev => prev.includes(key) ? (prev.length > 1 ? prev.filter(k => k !== key) : prev) : [...prev, key]);
  }

  // ── Derived ────────────────────────────────────────────────────────────────
  const selected        = entries.find(e => e.id === selectedId);
  const cuisineConfig   = CUISINE_CONFIGS[activeCuisine] || CUISINE_CONFIGS.pizza;
  const formCuisine     = form.cuisine || activeCuisine;
  const formConfig      = CUISINE_CONFIGS[formCuisine] || CUISINE_CONFIGS.pizza;
  const { criteria: formCriteria } = getStyleCriteria(formCuisine, form.style);
  const previewScore    = parseFloat(calcScore(form.scores, formCuisine, form.style).toFixed(1));
  const previewTier     = getTier(previewScore);
  const syncDot         = { idle:"var(--dimmer)", syncing:"#C4622D", ok:"#5B8A5B", error:"#8B4040" }[syncStatus];
  const hasFilters      = filterTiers.length + filterStyles.length + filterPrices.length > 0;

  const activeCriteria = useMemo(() => getStyleCriteria(activeCuisine, cuisineConfig.styles?.[0] || "").criteria, [activeCuisine]);

  const visibleEntries = useMemo(() => {
    let f = entries.filter(e => migrateCuisine(e.cuisine) === activeCuisine);
    if (searchQuery.trim()) { const q = searchQuery.toLowerCase(); f = f.filter(e => e.name.toLowerCase().includes(q) || (e.location||"").toLowerCase().includes(q) || (e.dish||"").toLowerCase().includes(q)); }
    if (filterTiers.length)  f = f.filter(e => filterTiers.includes(getTier(e.weightedScore).label));
    if (filterStyles.length) f = f.filter(e => filterStyles.includes(e.style));
    if (filterPrices.length) f = f.filter(e => filterPrices.includes(e.priceRange));
    return [...f].sort((a, b) => {
      if (sortBy === "score_asc")  return a.weightedScore - b.weightedScore;
      if (sortBy === "date_new")   return new Date(b.dateVisited||0) - new Date(a.dateVisited||0);
      if (sortBy === "date_old")   return new Date(a.dateVisited||0) - new Date(b.dateVisited||0);
      if (sortBy === "az")         return a.name.localeCompare(b.name);
      if (sortBy === "za")         return b.name.localeCompare(a.name);
      if (activeCriteria.find(c => c.key === sortBy)) return (b.scores?.[sortBy]||5) - (a.scores?.[sortBy]||5);
      return b.weightedScore - a.weightedScore;
    });
  }, [entries, activeCuisine, searchQuery, filterTiers, filterStyles, filterPrices, sortBy, activeCriteria]);

  const app    = { fontFamily:"'DM Sans', sans-serif", background:"var(--bg)", color:"var(--text)", maxWidth:430, margin:"0 auto", position:"relative" };
  const secLbl = { fontSize:10, letterSpacing:3, color:"#C4622D", textTransform:"uppercase", marginBottom:14, fontWeight:600 };
  const divBdr = { borderBottom:"1px solid var(--border2)" };

  // ╔══════════════════════════════════════════════╗
  // ║  LIST                                        ║
  // ╚══════════════════════════════════════════════╝
  if (view === "list") {
    const ce  = entries.filter(e => migrateCuisine(e.cuisine) === activeCuisine);
    const avg = ce.length ? (ce.reduce((s, e) => s + e.weightedScore, 0) / ce.length).toFixed(1) : null;
    return (
      <div style={{ ...app, display:"flex", flexDirection:"column", height:"100dvh" }} className="pg-fade-in">

        {/* ── Fixed header ── */}
        <div style={{ flexShrink:0 }}>
        <div style={{ padding:"28px 24px 14px", ...divBdr }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
            <div>
              <div style={{ fontSize:10, letterSpacing:4, color:"#C4622D", textTransform:"uppercase", marginBottom:6, fontWeight:600 }}>Personal Guide</div>
              <div style={{ fontFamily:"'Playfair Display', serif", fontSize:36, fontWeight:700, lineHeight:1, letterSpacing:-1, color:"var(--text)" }}>La Guida</div>
              <div style={{ fontFamily:"'Playfair Display', serif", fontSize:14, fontStyle:"italic", color:"var(--dim)", marginTop:4 }}>{cuisineConfig.subtitle}</div>
            </div>
            <div style={{ textAlign:"right" }}>
              {avg && <><div style={{ fontFamily:"'Playfair Display', serif", fontSize:40, fontWeight:700, color:scoreColor(+avg), lineHeight:1 }}>{avg}</div><div style={{ fontSize:10, color:"var(--dim)", letterSpacing:2, textTransform:"uppercase" }}>avg</div></>}
              <div style={{ display:"flex", alignItems:"center", justifyContent:"flex-end", gap:5, marginTop:6 }}>
                {viewOnly
                  ? <span style={{ fontSize:10, background:"rgba(212,168,83,0.15)", border:"1px solid rgba(212,168,83,0.35)", color:"#D4A853", borderRadius:6, padding:"2px 8px", fontWeight:600, letterSpacing:1, textTransform:"uppercase" }}>👁 View only</span>
                  : <><div style={{ width:7, height:7, borderRadius:"50%", background:syncDot, transition:"background .4s" }} />
                    <span style={{ fontSize:10, color:"var(--dimmer)", letterSpacing:1 }}>{{ idle:"local",syncing:"syncing…",ok:"synced",error:"offline" }[syncStatus]}</span></>
                }
              </div>
            </div>
          </div>
          <div style={{ marginTop:14 }}>
            <CuisineSwitcher active={activeCuisine} onChange={c => { setActiveCuisine(c); setSearchQuery(""); }} />
          </div>
          {ce.length > 0 && (
            <div style={{ padding:"8px 0 2px", display:"flex", gap:6, alignItems:"center" }}>
              {/* Compact stat pills */}
              {!showSearch && [{ label:"Logged", value:ce.length }, { label:"Top rated", value:ce.filter(e => e.weightedScore >= 8).length }].map(s => (
                <div key={s.label} style={{ background:"var(--surface)", borderRadius:7, padding:"5px 9px", border:"1px solid var(--border)", display:"flex", alignItems:"baseline", gap:4, whiteSpace:"nowrap" }}>
                  <span style={{ fontFamily:"'Playfair Display', serif", fontSize:14, fontWeight:700, color:"var(--text)" }}>{s.value}</span>
                  <span style={{ fontSize:8, color:"var(--dim)", letterSpacing:1.2, textTransform:"uppercase" }}>{s.label}</span>
                </div>
              ))}

              {/* Search: expands inline */}
              {showSearch ? (
                <>
                  <div style={{ flex:1, position:"relative" }}>
                    <svg style={{ position:"absolute", left:10, top:"50%", transform:"translateY(-50%)", pointerEvents:"none" }} width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--dim)" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                    <input className="pg-input" autoFocus placeholder="Search…" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} style={{ paddingLeft:30, fontSize:13, padding:"8px 10px 8px 30px" }} />
                  </div>
                  <button onClick={() => { setShowSearch(false); setSearchQuery(""); }} style={{ background:"var(--surface)", border:"1px solid var(--border)", color:"var(--dim)", borderRadius:8, padding:"8px 10px", cursor:"pointer", fontSize:13, flexShrink:0 }}>✕</button>
                </>
              ) : (
                <>
                  <div style={{ flex:1 }} />
                  {/* Search */}
                  <button onClick={() => setShowSearch(true)} style={{ background:searchQuery?"rgba(196,98,45,0.12)":"var(--surface)", border:`1px solid ${searchQuery?"#C4622D":"var(--border)"}`, color:searchQuery?"#C4622D":"var(--muted)", borderRadius:8, padding:"7px 9px", cursor:"pointer", display:"flex", alignItems:"center" }}>
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                  </button>
                  {/* Filter */}
                  <button onClick={() => setShowFilter(true)} style={{ background:hasFilters?"rgba(196,98,45,0.12)":"var(--surface)", border:`1px solid ${hasFilters?"#C4622D":"var(--border)"}`, color:hasFilters?"#C4622D":"var(--muted)", borderRadius:8, padding:"7px 9px", cursor:"pointer", display:"flex", alignItems:"center", gap:3 }}>
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><line x1="4" y1="6" x2="20" y2="6"/><line x1="8" y1="12" x2="16" y2="12"/><line x1="11" y1="18" x2="13" y2="18"/></svg>
                    {hasFilters && <span style={{ fontSize:10, fontWeight:700 }}>{filterTiers.length+filterStyles.length+filterPrices.length}</span>}
                  </button>
                  {/* Sort */}
                  <button onClick={() => setShowSort(true)} style={{ background:sortBy!=="score_desc"?"rgba(196,98,45,0.12)":"var(--surface)", border:`1px solid ${sortBy!=="score_desc"?"#C4622D":"var(--border)"}`, color:sortBy!=="score_desc"?"#C4622D":"var(--muted)", borderRadius:8, padding:"7px 9px", cursor:"pointer", display:"flex", alignItems:"center" }}>
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M7 16V4m0 0L3 8m4-4l4 4"/><path d="M17 8v12m0 0l4-4m-4 4l-4-4"/></svg>
                  </button>
                  {/* Share */}
                  <button onClick={() => setShowShare(true)} style={{ background:"var(--surface)", border:"1px solid var(--border)", color:"var(--muted)", borderRadius:8, padding:"7px 9px", cursor:"pointer", display:"flex", alignItems:"center" }}>
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/></svg>
                  </button>
                  {/* Help */}
                  <button onClick={() => setShowHelp(true)} style={{ background:"var(--surface)", border:"1px solid var(--border)", color:"var(--muted)", borderRadius:8, padding:"7px 9px", cursor:"pointer", fontFamily:"'DM Sans', sans-serif", fontSize:13, fontWeight:600, lineHeight:1 }}>?</button>
                </>
              )}
            </div>
          )}
        </div>
        </div>{/* end fixed header */}

        {/* ── Scrollable entries ── */}
        <div style={{ flex:1, overflowY:"auto", WebkitOverflowScrolling:"touch" }}>
        {ce.length === 0 ? (
          <div style={{ textAlign:"center", padding:"80px 24px 40px" }}>
            <div style={{ fontSize:56, marginBottom:20 }}>{cuisineConfig.icon}</div>
            <div style={{ fontFamily:"'Playfair Display', serif", fontSize:24, fontWeight:600, marginBottom:10, color:"var(--text)" }}>Start your {cuisineConfig.label} guide</div>
            <div style={{ fontSize:14, color:"var(--dim)", lineHeight:1.8, fontWeight:300 }}>Log your first experience and build your personal Michelin guide.</div>
          </div>
        ) : visibleEntries.length === 0 ? (
          <div style={{ textAlign:"center", padding:"60px 24px" }}>
            <div style={{ fontSize:32, marginBottom:16 }}>🔍</div>
            <div style={{ fontFamily:"'Playfair Display', serif", fontSize:18, color:"var(--text)", marginBottom:8 }}>No results</div>
            <div style={{ fontSize:13, color:"var(--dim)" }}>Try adjusting your search or filters.</div>
          </div>
        ) : visibleEntries.map((entry, idx) => {
          const tier = getTier(entry.weightedScore);
          return (
            <div key={entry.id} onClick={() => openDetail(entry.id)} style={{ display:"flex", alignItems:"center", padding:"14px 24px", ...divBdr, cursor:"pointer", gap:14 }}>
              <div style={{ fontFamily:"'Playfair Display', serif", fontSize:22, fontWeight:700, color:"var(--dimmer)", width:28, flexShrink:0, textAlign:"center" }}>{idx+1}</div>
              <div style={{ position:"relative", flexShrink:0 }}>
                {entry.photo
                  ? <img src={entry.photo} alt="" style={{ width:44, height:44, borderRadius:8, objectFit:"cover", display:"block" }} />
                  : <div style={{ width:44, height:44, borderRadius:8, background:"var(--surface)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:18 }}>{cuisineConfig.icon}</div>}
                {entry.addedBy && <div style={{ position:"absolute", bottom:-4, right:-4, width:18, height:18, borderRadius:"50%", background:"#C4622D", fontSize:7, fontWeight:700, color:"#F0EBE1", display:"flex", alignItems:"center", justifyContent:"center", border:"1.5px solid var(--bg)" }}>{entry.addedBy.slice(0,2)}</div>}
              </div>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ display:"flex", alignItems:"center", gap:6, marginBottom:3 }}>
                  <div style={{ fontFamily:"'Playfair Display', serif", fontSize:16, fontWeight:600, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", color:"var(--text)" }}>{entry.name}</div>
                  {(() => { const o = isOpenNow(entry.openingHours); return o === true ? <div title="Open now" style={{ width:7, height:7, borderRadius:"50%", background:"#5B8A5B", flexShrink:0 }} /> : o === false ? <div title="Closed now" style={{ width:7, height:7, borderRadius:"50%", background:"#8B4040", flexShrink:0 }} /> : null; })()}
                </div>
                <div style={{ fontSize:12, color:"var(--dim)", display:"flex", gap:5, alignItems:"center", flexWrap:"wrap" }}>
                  {entry.location && <><span>{entry.location}</span><span>·</span></>}
                  <span>{entry.style}</span><span>·</span><span>{entry.priceRange}</span>
                </div>
                <div style={{ display:"inline-flex", alignItems:"center", gap:5, marginTop:6, background:tier.bg, borderRadius:5, padding:"2px 8px" }}>
                  <span style={{ fontSize:10, color:tier.color, fontWeight:600, letterSpacing:1.5, textTransform:"uppercase" }}>{tier.icon} {tier.label}</span>
                </div>
              </div>
              <div style={{ textAlign:"right", flexShrink:0 }}>
                <div style={{ fontFamily:"'Playfair Display', serif", fontSize:24, fontWeight:700, color:scoreColor(entry.weightedScore), lineHeight:1 }}>{entry.weightedScore.toFixed(1)}</div>
                <div style={{ fontSize:9, color:"var(--dimmer)", letterSpacing:1 }}>/10</div>
              </div>
            </div>
          );
        })}
        </div>{/* end scrollable entries */}

        <BottomNav view="list" onList={() => setView("list")} onWish={() => setView("wishlist")} onMap={() => setView("map")} onAdd={openAdd} onSettings={() => setShowSettings(true)} />
        {showShare    && <ShareModal syncId={syncId} onExportPdf={() => handlePrint(visibleEntries, activeCuisine)} onExportKml={() => exportKML(entries.filter(e => migrateCuisine(e.cuisine) === activeCuisine))} onClose={() => setShowShare(false)} />}
        {showFilter   && <FilterSheet cuisineStyles={cuisineConfig.styles} filterTiers={filterTiers} filterStyles={filterStyles} filterPrices={filterPrices} onToggleTier={v => toggleArr(filterTiers, setFilterTiers, v)} onToggleStyle={v => toggleArr(filterStyles, setFilterStyles, v)} onTogglePrice={v => toggleArr(filterPrices, setFilterPrices, v)} onClear={() => { setFilterTiers([]); setFilterStyles([]); setFilterPrices([]); }} onClose={() => setShowFilter(false)} />}
        {showSort     && <SortSheet sortBy={sortBy} onSort={setSortBy} criteria={activeCriteria} onClose={() => setShowSort(false)} />}
        {showSettings && <SettingsPanel theme={theme} onTheme={t => setTheme(t)} userInitials={userInitials} onInitials={handleInitials} onJoin={handleJoin} onClose={() => setShowSettings(false)} /> }
        {showHelp && <HelpSheet onClose={() => setShowHelp(false)} />}
      </div>
    );
  }

  // ╔══════════════════════════════════════════════╗
  // ║  WISHLIST                                    ║
  // ╚══════════════════════════════════════════════╝
  if (view === "wishlist") {
    const wishItems = wishlist.filter(w => migrateCuisine(w.cuisine) === activeCuisine);
    return (
      <div style={{ ...app, display:"flex", flexDirection:"column", height:"100dvh" }} className="pg-fade-in">

        {/* ── Fixed header ── */}
        <div style={{ flexShrink:0, padding:"28px 24px 14px", ...divBdr }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
            <div>
              <div style={{ fontSize:10, letterSpacing:4, color:"#C4622D", textTransform:"uppercase", marginBottom:6, fontWeight:600 }}>Da Provare</div>
              <div style={{ fontFamily:"'Playfair Display', serif", fontSize:36, fontWeight:700, lineHeight:1, letterSpacing:-1, color:"var(--text)" }}>Wishlist</div>
              <div style={{ fontFamily:"'Playfair Display', serif", fontSize:14, fontStyle:"italic", color:"var(--dim)", marginTop:4 }}>{cuisineConfig.label}</div>
            </div>
            <div style={{ textAlign:"right", paddingTop:8 }}>
              <div style={{ fontFamily:"'Playfair Display', serif", fontSize:32, fontWeight:700, color:"#D4A853", lineHeight:1 }}>{wishItems.length}</div>
              <div style={{ fontSize:10, color:"var(--dim)", letterSpacing:2, textTransform:"uppercase" }}>saved</div>
              <div style={{ display:"flex", alignItems:"center", justifyContent:"flex-end", gap:5, marginTop:6 }}>
                {viewOnly
                  ? <span style={{ fontSize:10, background:"rgba(212,168,83,0.15)", border:"1px solid rgba(212,168,83,0.35)", color:"#D4A853", borderRadius:6, padding:"2px 8px", fontWeight:600, letterSpacing:1, textTransform:"uppercase" }}>👁 View only</span>
                  : <><div style={{ width:7, height:7, borderRadius:"50%", background:syncDot, transition:"background .4s" }} />
                    <span style={{ fontSize:10, color:"var(--dimmer)", letterSpacing:1 }}>{{ idle:"local",syncing:"syncing…",ok:"synced",error:"offline" }[syncStatus]}</span></>
                }
              </div>
            </div>
          </div>
          <div style={{ marginTop:14 }}><CuisineSwitcher active={activeCuisine} onChange={setActiveCuisine} /></div>
        </div>

        {/* ── Scrollable wishlist items ── */}
        <div style={{ flex:1, overflowY:"auto", WebkitOverflowScrolling:"touch" }}>
        {wishItems.length === 0 ? (
          <div style={{ textAlign:"center", padding:"80px 24px 40px" }}>
            <div style={{ fontSize:56, marginBottom:20 }}>♡</div>
            <div style={{ fontFamily:"'Playfair Display', serif", fontSize:22, fontWeight:600, marginBottom:10, color:"var(--text)" }}>Nothing saved yet</div>
            <div style={{ fontSize:14, color:"var(--dim)", lineHeight:1.8 }}>Save places you want to try.<br/>Tap + to add your first entry.</div>
          </div>
        ) : wishItems.map(item => (
          <div key={item.id} style={{ padding:"16px 24px", ...divBdr }}>
            <div style={{ display:"flex", gap:14, alignItems:"flex-start" }}>
              <div style={{ position:"relative", flexShrink:0 }}>
                <div style={{ width:44, height:44, borderRadius:8, background:"rgba(212,168,83,0.1)", border:"1px solid rgba(212,168,83,0.3)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:18 }}>{cuisineConfig.icon}</div>
                {item.addedBy && <div style={{ position:"absolute", bottom:-4, right:-4, width:18, height:18, borderRadius:"50%", background:"#D4A853", fontSize:7, fontWeight:700, color:"#0D0B09", display:"flex", alignItems:"center", justifyContent:"center", border:"1.5px solid var(--bg)" }}>{item.addedBy.slice(0,2)}</div>}
              </div>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ display:"flex", alignItems:"center", gap:6, marginBottom:3 }}>
                  <div style={{ fontFamily:"'Playfair Display', serif", fontSize:16, fontWeight:600, color:"var(--text)", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{item.name}</div>
                  {(() => { const o = isOpenNow(item.openingHours); return o === true ? <div title="Open now" style={{ width:7, height:7, borderRadius:"50%", background:"#5B8A5B", flexShrink:0 }} /> : o === false ? <div title="Closed now" style={{ width:7, height:7, borderRadius:"50%", background:"#8B4040", flexShrink:0 }} /> : null; })()}
                </div>
                {item.location && <div style={{ fontSize:12, color:"var(--dim)", marginBottom:2 }}>📍 {item.location}</div>}
                {item.phone && <div style={{ fontSize:12, color:"var(--dim)", marginBottom:2 }}>📞 {item.phone}</div>}
                {item.style && <div style={{ fontSize:12, color:"var(--muted)" }}>{item.style}</div>}
                {item.notes && <div style={{ fontSize:12, color:"var(--muted)", fontStyle:"italic", marginTop:2 }}>"{item.notes}"</div>}
                <div style={{ fontSize:10, color:"var(--dimmer)", marginTop:6 }}>Added {item.dateAdded}</div>
              </div>
              <div style={{ display:"flex", flexDirection:"column", gap:6, flexShrink:0 }}>
                <button onClick={() => rateNow(item)} style={{ background:"#C4622D", border:"none", color:"#F0EBE1", borderRadius:8, padding:"7px 10px", fontSize:11, cursor:"pointer", fontFamily:"'DM Sans', sans-serif", fontWeight:600, whiteSpace:"nowrap" }}>Rate now →</button>
                <button onClick={() => deleteWish(item.id)} style={{ background:"transparent", border:"1px solid var(--border)", color:"var(--dim)", borderRadius:8, padding:"6px 10px", fontSize:11, cursor:"pointer", fontFamily:"'DM Sans', sans-serif" }}>Remove</button>
              </div>
            </div>
            {/* Reservation URL */}
            {item.reservationUrl && (
              <a href={item.reservationUrl.startsWith("http") ? item.reservationUrl : "https://"+item.reservationUrl} target="_blank" rel="noopener noreferrer" style={{ display:"flex", alignItems:"center", gap:8, marginTop:10, background:"rgba(196,98,45,0.07)", border:"1px solid rgba(196,98,45,0.2)", borderRadius:8, padding:"8px 12px", textDecoration:"none" }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#C4622D" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
                <span style={{ fontSize:12, color:"#C4622D", fontWeight:600 }}>{isBookingUrl(item.reservationUrl) ? "Book a table" : "Visit website / Book a table"}</span>
              </a>
            )}
            {/* Find on */}
            <div style={{ display:"flex", gap:6, marginTop:8, flexWrap:"wrap" }}>
              {[
                { label:"TripAdvisor", color:"#00AA6C", url:`https://www.tripadvisor.com/Search?q=${encodeURIComponent((item.name||"")+" "+(item.location||""))}` },
                { label:"TheFork",     color:"#00B67A", url:`https://www.thefork.com/search#cityId=0&query=${encodeURIComponent((item.name||"")+" "+(item.location||""))}` },
                { label:"Maps",        color:"#4285F4", url:`https://www.google.com/maps/search/${encodeURIComponent((item.name||"")+" "+(item.location||""))}` },
              ].map(s => (
                <a key={s.label} href={s.url} target="_blank" rel="noopener noreferrer" style={{ textDecoration:"none", display:"inline-flex", alignItems:"center", gap:4, background:"var(--surface)", border:"1px solid var(--border)", borderRadius:6, padding:"4px 9px", fontSize:11, color:s.color, fontWeight:500 }}>{s.label} ↗</a>
              ))}
            </div>
          </div>
        ))}
        </div>{/* end scrollable items */}

        <BottomNav view="wishlist" onList={() => setView("list")} onWish={() => setView("wishlist")} onMap={() => setView("map")} onAdd={openAdd} onSettings={() => setShowSettings(true)} />
        {showSettings && <SettingsPanel theme={theme} onTheme={t => setTheme(t)} userInitials={userInitials} onInitials={handleInitials} onJoin={handleJoin} onClose={() => setShowSettings(false)} />}
      </div>
    );
  }

  // ╔══════════════════════════════════════════════╗
  // ║  MAP — All cuisines, shape per cuisine       ║
  // ╚══════════════════════════════════════════════╝
  if (view === "map") {
    const allLocated  = entries.filter(e => e.lat && e.lng && mapCuisineFilter.includes(migrateCuisine(e.cuisine)));
    const wishLocated = wishlist.filter(w => w.lat && w.lng && mapCuisineFilter.includes(migrateCuisine(w.cuisine)));
    const totalShown  = entries.filter(e => mapCuisineFilter.includes(migrateCuisine(e.cuisine))).length;
    const center      = allLocated.length > 0 ? [allLocated[0].lat, allLocated[0].lng] : [41.9028, 12.4964];
    const tileUrl     = theme === "light" ? "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png" : "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png";
    return (
      <div style={{ ...app, height:"100dvh", display:"flex", flexDirection:"column" }} className="pg-fade-in">
        <div style={{ padding:"20px 24px 12px", ...divBdr, background:"var(--bg)", zIndex:10, flexShrink:0 }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"baseline", marginBottom:10 }}>
            <div style={{ fontFamily:"'Playfair Display', serif", fontSize:24, fontWeight:700, color:"var(--text)" }}>La Mappa</div>
            <div style={{ fontSize:12, color:"var(--dim)" }}>{allLocated.length} of {totalShown} located</div>
          </div>
          <MapCuisineFilter active={mapCuisineFilter} onToggle={toggleMapCuisine} />
        </div>

        <div style={{ flex:1, position:"relative", minHeight:0 }}>
          {entries.length === 0 ? (
            <div style={{ display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", height:"100%", color:"var(--dim)" }}>
              <div style={{ fontSize:48, marginBottom:16 }}>🗺️</div>
              <div style={{ fontFamily:"'Playfair Display', serif", fontSize:20, color:"var(--muted)" }}>No entries yet</div>
            </div>
          ) : (
            <MapContainer center={center} zoom={13} style={{ height:"100%", width:"100%" }} zoomControl={false}>
              <TileLayer url={tileUrl} attribution="© OpenStreetMap © CARTO" subdomains="abcd" maxZoom={19} />
              {mapFocus && <MapController center={mapFocus} />}

              {allLocated.map(entry => {
                const cuisine = migrateCuisine(entry.cuisine);
                const cfg     = CUISINE_CONFIGS[cuisine] || CUISINE_CONFIGS.pizza;
                const icon    = buildMarkerIcon(cfg.mapShape, scoreColor(entry.weightedScore));
                const tier    = getTier(entry.weightedScore);
                return (
                  <Marker key={entry.id} position={[entry.lat, entry.lng]} icon={icon}>
                    <Popup>
                      <div style={{ fontFamily:"'DM Sans', sans-serif", minWidth:160 }}>
                        {entry.photo && <img src={entry.photo} alt="" style={{ width:"100%", height:90, objectFit:"cover", borderRadius:6, marginBottom:10 }} />}
                        <div style={{ display:"flex", alignItems:"center", gap:6, marginBottom:4 }}>
                          <ShapeIcon shape={cfg.mapShape} size={10} color="var(--dim)" />
                          <span style={{ fontSize:10, color:"var(--dim)" }}>{cfg.label} · {entry.style}</span>
                        </div>
                        <div style={{ fontFamily:"'Playfair Display', serif", fontSize:15, fontWeight:700, marginBottom:6, color:"var(--text)" }}>{entry.name}</div>
                        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:8 }}>
                          <div style={{ fontSize:10, background:tier.bg, borderRadius:4, padding:"2px 8px", color:tier.color, fontWeight:600, letterSpacing:1, textTransform:"uppercase" }}>{tier.icon} {tier.label}</div>
                          <div style={{ fontFamily:"'Playfair Display', serif", fontSize:22, fontWeight:700, color:scoreColor(entry.weightedScore) }}>{entry.weightedScore.toFixed(1)}</div>
                        </div>
                        {entry.location && <div style={{ fontSize:11, color:"var(--muted)", marginBottom:8 }}>📍 {entry.location} · {entry.priceRange}</div>}
                        {entry.addedBy && <div style={{ fontSize:10, color:"#C4622D", marginBottom:8 }}>By {entry.addedBy}</div>}
                        <button onClick={() => openDetail(entry.id)} style={{ width:"100%", background:"#C4622D", border:"none", color:"#F0EBE1", borderRadius:7, padding:"7px", fontSize:12, cursor:"pointer", fontFamily:"'DM Sans', sans-serif", fontWeight:600 }}>View details →</button>
                      </div>
                    </Popup>
                  </Marker>
                );
              })}

              {wishLocated.map(item => {
                const cuisine = migrateCuisine(item.cuisine);
                const cfg     = CUISINE_CONFIGS[cuisine] || CUISINE_CONFIGS.pizza;
                const icon    = buildMarkerIcon(cfg.mapShape, "#D4A853", true);
                return (
                  <Marker key={`wish-${item.id}`} position={[item.lat, item.lng]} icon={icon}>
                    <Popup>
                      <div style={{ fontFamily:"'DM Sans', sans-serif", minWidth:140 }}>
                        <div style={{ display:"flex", alignItems:"center", gap:6, marginBottom:6 }}>
                          <span style={{ fontSize:10, color:"#D4A853", fontWeight:600, letterSpacing:1, textTransform:"uppercase" }}>{cfg.icon} {cfg.label} · ♡ Wishlist</span>
                        </div>
                        <div style={{ fontFamily:"'Playfair Display', serif", fontSize:15, fontWeight:700, marginBottom:6, color:"var(--text)" }}>{item.name}</div>
                        {item.addedBy && <div style={{ fontSize:10, color:"#D4A853", marginBottom:6 }}>Saved by {item.addedBy}</div>}
                        {item.location && <div style={{ fontSize:11, color:"var(--muted)", marginBottom:8 }}>📍 {item.location}</div>}
                        <button onClick={() => rateNow(item)} style={{ width:"100%", background:"#D4A853", border:"none", color:"#0D0B09", borderRadius:7, padding:"7px", fontSize:12, cursor:"pointer", fontFamily:"'DM Sans', sans-serif", fontWeight:700 }}>Rate now →</button>
                      </div>
                    </Popup>
                  </Marker>
                );
              })}
            </MapContainer>
          )}
        </div>

        <div style={{ background:"var(--bg)", borderTop:"1px solid var(--border2)", padding:"10px 24px 12px", flexShrink:0, zIndex:10 }}>
          <div style={{ display:"flex", gap:14, flexWrap:"wrap" }}>
            {[{color:"#D4A853",label:"9+"},{color:"#C4622D",label:"8+"},{color:"#5B8A5B",label:"7+"},{color:"#7A7470",label:"<7"}].map(l => (
              <div key={l.label} style={{ display:"flex", alignItems:"center", gap:5 }}>
                <div style={{ width:10, height:10, borderRadius:"50%", background:l.color }} />
                <span style={{ fontSize:11, color:"var(--dim)" }}>{l.label}</span>
              </div>
            ))}
            <div style={{ width:1, background:"var(--border)", margin:"0 2px" }} />
            {CUISINE_KEYS.map(key => {
              const cfg = CUISINE_CONFIGS[key];
              return (
                <div key={key} style={{ display:"flex", alignItems:"center", gap:5 }}>
                  <ShapeIcon shape={cfg.mapShape} size={11} color="var(--muted)" />
                  <span style={{ fontSize:11, color:"var(--dim)" }}>{cfg.label}</span>
                </div>
              );
            })}
            <div style={{ display:"flex", alignItems:"center", gap:5 }}>
              <div style={{ width:9, height:9, borderRadius:"50%", border:"1.5px solid #D4A853" }} />
              <span style={{ fontSize:11, color:"var(--dim)" }}>Wishlist</span>
            </div>
          </div>
        </div>
        <BottomNav view="map" onList={() => setView("list")} onWish={() => setView("wishlist")} onMap={() => setView("map")} onAdd={openAdd} onSettings={() => setShowSettings(true)} />
        {showSettings && <SettingsPanel theme={theme} onTheme={t => setTheme(t)} userInitials={userInitials} onInitials={handleInitials} onJoin={handleJoin} onClose={() => setShowSettings(false)} />}
      </div>
    );
  }

  // ╔══════════════════════════════════════════════╗
  // ║  DETAIL                                      ║
  // ╚══════════════════════════════════════════════╝
  if (view === "detail" && selected) {
    const tier      = getTier(selected.weightedScore);
    const detCuisine = migrateCuisine(selected.cuisine);
    const detConfig = CUISINE_CONFIGS[detCuisine] || CUISINE_CONFIGS.pizza;
    const { criteria: detCriteria } = getStyleCriteria(detCuisine, selected.style);
    return (
      <div style={{ ...app, paddingBottom:40 }} className="pg-fade-in">
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"16px 20px", ...divBdr, position:"sticky", top:0, background:"var(--bg)", zIndex:10 }}>
          <button onClick={() => setView("list")} style={{ background:"none", border:"none", color:"#C4622D", fontSize:14, cursor:"pointer", fontFamily:"'DM Sans', sans-serif" }}>← Back</button>
          <div style={{ display:"flex", gap:16 }}>
            {selected.lat && <button onClick={() => { setActiveCuisine(detCuisine); setView("map"); setMapFocus([selected.lat, selected.lng]); }} style={{ background:"none", border:"none", color:"var(--muted)", fontSize:13, cursor:"pointer", fontFamily:"'DM Sans', sans-serif" }}>📍 Map</button>}
            <button onClick={() => openEdit(selected)} style={{ background:"none", border:"none", color:"var(--muted)", fontSize:13, cursor:"pointer", fontFamily:"'DM Sans', sans-serif" }}>Edit</button>
          </div>
        </div>

        {selected.photo && <div style={{ height:200, overflow:"hidden" }}><img src={selected.photo} alt={selected.name} style={{ width:"100%", height:"100%", objectFit:"cover" }} /></div>}

        <div style={{ padding:"24px 24px 20px", ...divBdr }}>
          {(() => {
            const entryRatings = initRatings(selected);
            const raterKeys    = Object.keys(entryRatings);
            const isMulti      = raterKeys.length > 1;
            return (
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", gap:12 }}>
                <div style={{ flex:1 }}>
                  <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:12, flexWrap:"wrap" }}>
                    <div style={{ display:"inline-flex", alignItems:"center", gap:6, background:tier.bg, borderRadius:6, padding:"4px 12px" }}>
                      <span style={{ fontSize:11, color:tier.color, fontWeight:600, letterSpacing:2, textTransform:"uppercase" }}>{tier.icon} {tier.label}</span>
                    </div>
                    {selected.addedBy && !isMulti && <div style={{ display:"inline-flex", alignItems:"center", background:"rgba(196,98,45,0.1)", borderRadius:6, padding:"4px 10px" }}><span style={{ fontSize:10, color:"#C4622D", fontWeight:600, letterSpacing:1 }}>By {selected.addedBy}</span></div>}
                  </div>
                  <div style={{ fontFamily:"'Playfair Display', serif", fontSize:28, fontWeight:700, lineHeight:1.2, marginBottom:6, letterSpacing:-.5, color:"var(--text)" }}>{selected.name}</div>
                  <div style={{ fontSize:13, color:"var(--dim)" }}>{[selected.location, selected.style, selected.priceRange].filter(Boolean).join(" · ")}</div>
                  {/* Per-rater mini scores */}
                  {isMulti && (
                    <div style={{ display:"flex", gap:8, marginTop:12, flexWrap:"wrap" }}>
                      {raterKeys.map(k => {
                        const r = entryRatings[k];
                        return (
                          <div key={k} style={{ background:"var(--surface)", border:"1px solid var(--border)", borderRadius:8, padding:"6px 12px", display:"flex", alignItems:"baseline", gap:6 }}>
                            <span style={{ fontFamily:"'Playfair Display', serif", fontSize:16, fontWeight:700, color:scoreColor(r.weightedScore) }}>{r.weightedScore.toFixed(1)}</span>
                            <span style={{ fontSize:10, color:"#C4622D", fontWeight:600 }}>{k}</span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
                <div style={{ textAlign:"right", flexShrink:0 }}>
                  <div style={{ fontFamily:"'Playfair Display', serif", fontSize:50, fontWeight:700, color:scoreColor(selected.weightedScore), lineHeight:1 }}>{selected.weightedScore.toFixed(1)}</div>
                  <div style={{ fontSize:11, color:"var(--dimmer)" }}>{isMulti ? `avg of ${raterKeys.length}` : "/10"}</div>
                </div>
              </div>
            );
          })()}
          <div style={{ display:"flex", gap:8, marginTop:16, flexWrap:"wrap", alignItems:"center" }}>
            <Chip>{detConfig.icon} {detConfig.label}</Chip>
            {selected.dish && <Chip>{selected.dish}</Chip>}
            {selected.dateVisited && <Chip>📅 {selected.dateVisited}</Chip>}
            <Chip style={{ color: selected.wouldReturn==="Yes"?"#5B8A5B":selected.wouldReturn==="No"?"#8B4040":"#C4622D" }}>↩ {selected.wouldReturn}</Chip>
            {selected.phone && <Chip>📞 {selected.phone}</Chip>}
            {(() => { const o = isOpenNow(selected.openingHours); return o === true ? <Chip style={{ color:"#5B8A5B", borderColor:"rgba(91,138,91,0.3)" }}>● Open now</Chip> : o === false ? <Chip style={{ color:"#8B4040", borderColor:"rgba(139,64,64,0.3)" }}>● Closed now</Chip> : null; })()}
          </div>

          {/* Website / Reservation URL — smart label */}
          {selected.reservationUrl && (
            <a href={selected.reservationUrl.startsWith("http") ? selected.reservationUrl : "https://"+selected.reservationUrl} target="_blank" rel="noopener noreferrer" style={{ display:"flex", alignItems:"center", gap:10, marginTop:14, background:"rgba(196,98,45,0.08)", border:"1px solid rgba(196,98,45,0.25)", borderRadius:10, padding:"11px 16px", textDecoration:"none" }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#C4622D" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
              <span style={{ fontSize:13, color:"#C4622D", fontWeight:600 }}>{isBookingUrl(selected.reservationUrl) ? "Book a table" : "Visit website / Book a table"}</span>
              <span style={{ marginLeft:"auto", fontSize:11, color:"var(--dimmer)" }}>{(selected.reservationUrl.replace(/^https?:\/\/(www\.)?/,"").split("/")[0])}</span>
            </a>
          )}

          {/* Find on — pre-filled search links for TripAdvisor, TheFork, Google Maps */}
          {(selected.name) && (
            <div style={{ marginTop:12 }}>
              <div style={{ fontSize:9, letterSpacing:2, color:"var(--dimmer)", textTransform:"uppercase", marginBottom:8, fontWeight:600 }}>Find on</div>
              <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
                {[
                  { label:"TripAdvisor", color:"#00AA6C", url:`https://www.tripadvisor.com/Search?q=${encodeURIComponent((selected.name||"")+" "+(selected.location||""))}` },
                  { label:"TheFork",     color:"#00B67A", url:`https://www.thefork.com/search#cityId=0&query=${encodeURIComponent((selected.name||"")+" "+(selected.location||""))}` },
                  { label:"Google Maps", color:"#4285F4", url:`https://www.google.com/maps/search/${encodeURIComponent((selected.name||"")+" "+(selected.location||""))}` },
                ].map(s => (
                  <a key={s.label} href={s.url} target="_blank" rel="noopener noreferrer" style={{ textDecoration:"none", display:"inline-flex", alignItems:"center", gap:5, background:"var(--surface)", border:"1px solid var(--border)", borderRadius:8, padding:"6px 12px", fontSize:12, color:`${s.color}`, fontWeight:500 }}>
                    {s.label} ↗
                  </a>
                ))}
              </div>
            </div>
          )}

          {selected.openingHours && (
            <div style={{ marginTop:12, background:"var(--surface)", borderRadius:10, padding:"12px 16px", border:"1px solid var(--border)" }}>
              <div style={{ fontSize:9, letterSpacing:2, color:"var(--dimmer)", textTransform:"uppercase", marginBottom:6, fontWeight:600 }}>Opening Hours</div>
              <div style={{ fontSize:12, color:"var(--muted)", whiteSpace:"pre-line", lineHeight:1.8 }}>{selected.openingHours}</div>
            </div>
          )}
        </div>

        {/* Visit history */}
        {(selected.visits?.length ?? 0) > 1 && (
          <div style={{ padding:"20px 24px", ...divBdr }}>
            <div style={secLbl}>Visit History <span style={{ color:"var(--dimmer)", fontWeight:400, textTransform:"none", letterSpacing:0 }}>({selected.visits.length})</span></div>
            {selected.visits.map((v, i) => (
              <div key={v.id} style={{ display:"flex", gap:12, alignItems:"flex-start", padding:"10px 0", borderBottom: i < selected.visits.length-1 ? "1px solid var(--border2)" : "none" }}>
                <div style={{ fontFamily:"'Playfair Display', serif", fontSize:22, fontWeight:700, color:scoreColor(v.weightedScore), minWidth:42, lineHeight:1.1 }}>{v.weightedScore.toFixed(1)}</div>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontSize:12, color:"var(--dim)", display:"flex", gap:6, flexWrap:"wrap" }}>
                    <span>{v.date}</span>
                    {v.dish && <><span>·</span><span>{v.dish}</span></>}
                    {v.addedBy && <><span>·</span><span style={{ color:"#C4622D" }}>{v.addedBy}</span></>}
                    {v.wouldReturn && <><span>·</span><span style={{ color: v.wouldReturn==="Yes"?"#5B8A5B":v.wouldReturn==="No"?"#8B4040":"var(--dim)" }}>↩ {v.wouldReturn}</span></>}
                  </div>
                  {v.notes && <div style={{ fontSize:12, color:"var(--muted)", fontStyle:"italic", marginTop:3 }}>"{v.notes}"</div>}
                </div>
                {i === 0 && <span style={{ fontSize:9, letterSpacing:1.5, color:"#C4622D", textTransform:"uppercase", fontWeight:600, paddingTop:2 }}>latest</span>}
              </div>
            ))}
          </div>
        )}

        <div style={{ padding:"24px 24px 20px", ...divBdr }}>
          {(() => {
            const entryRatings = initRatings(selected);
            const raterKeys    = Object.keys(entryRatings);
            const isMulti      = raterKeys.length > 1;
            // Compute per-criterion averages across all raters
            const avgScores = {};
            detCriteria.forEach(c => {
              const vals = raterKeys.map(k => entryRatings[k]?.scores?.[c.key]).filter(v => typeof v === "number");
              avgScores[c.key] = vals.length ? parseFloat((vals.reduce((a,b) => a+b, 0) / vals.length).toFixed(1)) : (selected.scores?.[c.key] ?? 5);
            });
            return (
              <>
                <div style={secLbl}>
                  Score Breakdown
                  {detConfig.criteriaByStyle && <span style={{ fontWeight:400, textTransform:"none", letterSpacing:1, marginLeft:8, color:"var(--dim)", fontSize:11 }}>— {selected.style}</span>}
                  {isMulti && <span style={{ fontWeight:400, textTransform:"none", letterSpacing:1, marginLeft:8, color:"var(--dim)", fontSize:11 }}>· avg of {raterKeys.length}</span>}
                </div>
                {detCriteria.map(c => {
                  const val = avgScores[c.key];
                  return (
                    <div key={c.key} style={{ marginBottom:18 }}>
                      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"baseline", marginBottom:8 }}>
                        <div><span style={{ fontSize:14, fontWeight:500, color:"var(--text)" }}>{c.label}</span><span style={{ fontSize:11, color:"var(--dimmer)", marginLeft:8 }}>{c.weight}</span></div>
                        <div style={{ display:"flex", alignItems:"baseline", gap:8 }}>
                          {isMulti && raterKeys.map(k => (
                            <span key={k} style={{ fontSize:12, color:"var(--dimmer)" }}>
                              {entryRatings[k]?.scores?.[c.key] ?? "–"}<span style={{ fontSize:9, color:"var(--dim)", marginLeft:2 }}>{k}</span>
                            </span>
                          ))}
                          <span style={{ fontFamily:"'Playfair Display', serif", fontSize:22, fontWeight:700, color:scoreColor(val) }}>{val}</span>
                        </div>
                      </div>
                      <div style={{ height:3, background:"var(--surface)", borderRadius:2, overflow:"hidden" }}>
                        <div style={{ height:"100%", width:`${(val/10)*100}%`, background:scoreColor(val), borderRadius:2 }} />
                      </div>
                      <div style={{ fontSize:11, color:"var(--dimmer)", marginTop:4 }}>{c.sub}</div>
                    </div>
                  );
                })}
              </>
            );
          })()}
        </div>

        {selected.notes && (
          <div style={{ padding:"24px 24px", ...divBdr }}>
            <div style={secLbl}>Notes</div>
            <div style={{ fontFamily:"'Playfair Display', serif", fontStyle:"italic", fontSize:16, color:"var(--muted)", lineHeight:1.9 }}>"{selected.notes}"</div>
          </div>
        )}

        <div style={{ padding:"20px 24px 24px" }}>
          {(() => {
            const entryRatings = initRatings(selected);
            const currentUserKey = userInitials || "?";
            const alreadyRated   = !!entryRatings[currentUserKey];
            return (
              <button onClick={() => startVisit(selected)} style={{ width:"100%", background:"rgba(196,98,45,0.08)", border:"1px solid rgba(196,98,45,0.25)", color:"#C4622D", borderRadius:10, padding:"12px", fontSize:14, cursor:"pointer", fontFamily:"'DM Sans', sans-serif", fontWeight:600, marginBottom:10 }}>
                {alreadyRated ? "＋ Log another visit" : "＋ Add my rating"}
              </button>
            );
          })()}
          {!confirmDel ? (
            <button onClick={() => setConfirmDel(true)} style={{ width:"100%", background:"transparent", border:"1px solid var(--border)", color:"var(--dim)", borderRadius:10, padding:"12px", fontSize:14, cursor:"pointer", fontFamily:"'DM Sans', sans-serif" }}>Remove from guide</button>
          ) : (
            <div style={{ background:"rgba(139,64,64,0.1)", border:"1px solid rgba(139,64,64,0.25)", borderRadius:10, padding:"16px", textAlign:"center" }}>
              <div style={{ fontSize:14, color:"#C47070", marginBottom:14 }}>Remove "{selected.name}" from your guide?</div>
              <div style={{ display:"flex", gap:10 }}>
                <button onClick={() => setConfirmDel(false)} style={{ flex:1, background:"var(--surface)", border:"1px solid var(--border)", color:"var(--text)", borderRadius:8, padding:"10px", fontSize:14, cursor:"pointer", fontFamily:"'DM Sans', sans-serif" }}>Cancel</button>
                <button onClick={() => deleteEntry(selected.id)} style={{ flex:1, background:"#8B4040", border:"none", color:"#F0EBE1", borderRadius:8, padding:"10px", fontSize:14, cursor:"pointer", fontFamily:"'DM Sans', sans-serif", fontWeight:500 }}>Delete</button>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ╔══════════════════════════════════════════════╗
  // ║  ADD / EDIT                                  ║
  // ╚══════════════════════════════════════════════╝
  if (view === "add") {
    const isDynamic = !!formConfig.criteriaByStyle;
    const canSave   = (addingVisitTo || form.name.trim().length > 0) && !saving;
    return (
      <div style={{ ...app, paddingBottom:60 }} className="pg-fade-in">
        <input ref={fileRef} type="file" accept="image/*" style={{ display:"none" }} onChange={handlePhoto} />
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"14px 20px", ...divBdr, position:"sticky", top:0, background:"var(--bg)", zIndex:10 }}>
          <button onClick={() => { setView(editingId?"detail":"list"); setEditingId(null); }} style={{ background:"none", border:"none", color:"#C4622D", fontSize:14, cursor:"pointer", fontFamily:"'DM Sans', sans-serif" }}>Cancel</button>
          <div style={{ fontFamily:"'Playfair Display', serif", fontSize:17, color:"var(--text)" }}>{addingVisitTo ? `Re-visit · ${entries.find(e => e.id === addingVisitTo)?.name || ""}` : editingId ? "Edit Entry" : "Nuova Voce"}</div>
          <button onClick={saveEntry} disabled={!canSave} style={{ background:canSave?"#C4622D":"var(--surface)", border:"none", color:canSave?"#F0EBE1":"var(--dimmer)", borderRadius:8, padding:"8px 18px", fontSize:14, cursor:canSave?"pointer":"default", fontFamily:"'DM Sans', sans-serif", fontWeight:600 }}>{saving?"…":"Save"}</button>
        </div>

        <div style={{ margin:"16px 24px 8px", background:"var(--surface)", borderRadius:14, padding:"16px 20px", display:"flex", alignItems:"center", justifyContent:"space-between", border:`1px solid ${previewTier.bg}` }}>
          <div>
            <div style={{ fontSize:10, color:"var(--dimmer)", letterSpacing:2, textTransform:"uppercase", marginBottom:8 }}>Live Score</div>
            <div style={{ display:"inline-flex", alignItems:"center", gap:6, background:previewTier.bg, borderRadius:6, padding:"4px 12px" }}>
              <span style={{ fontSize:11, color:previewTier.color, fontWeight:600, letterSpacing:2, textTransform:"uppercase" }}>{previewTier.icon} {previewTier.label}</span>
            </div>
          </div>
          <div style={{ fontFamily:"'Playfair Display', serif", fontSize:44, fontWeight:700, color:scoreColor(previewScore), lineHeight:1 }}>{previewScore.toFixed(1)}</div>
        </div>

        <div style={{ padding:"16px 24px 0" }}>
          {!editingId && !addingVisitTo && (
            <>
              <div style={secLbl}>Cuisine</div>
              <div style={{ marginBottom:16 }}>
                <CuisineSwitcher active={formCuisine} onChange={c => {
                  const cfg    = CUISINE_CONFIGS[c];
                  const style0 = cfg.styles[0];
                  const { criteria: nc } = getStyleCriteria(c, style0);
                  const scores = {}; nc.forEach(cr => { scores[cr.key] = 7; });
                  setForm(f => ({ ...freshForm(c, userInitials, style0), name:f.name, location:f.location, notes:f.notes, photo:f.photo, priceRange:f.priceRange }));
                }} />
              </div>
            </>
          )}

          {!addingVisitTo && (
            <>
          <div style={secLbl}>Photo</div>
          {form.photo ? (
            <div style={{ position:"relative", marginBottom:16 }}>
              <img src={form.photo} alt="" style={{ width:"100%", height:160, objectFit:"cover", borderRadius:12 }} />
              <button onClick={() => setForm(f => ({ ...f, photo:null }))} style={{ position:"absolute", top:8, right:8, background:"rgba(13,11,9,.85)", border:"none", color:"#F0EBE1", borderRadius:"50%", width:28, height:28, fontSize:14, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center" }}>✕</button>
              <button onClick={() => fileRef.current?.click()} style={{ position:"absolute", bottom:8, right:8, background:"rgba(13,11,9,.85)", border:"none", color:"#F0EBE1", borderRadius:8, padding:"5px 10px", fontSize:11, cursor:"pointer", fontFamily:"'DM Sans', sans-serif" }}>Change</button>
            </div>
          ) : (
            <button onClick={() => fileRef.current?.click()} style={{ width:"100%", background:"var(--surface)", border:"2px dashed var(--border)", borderRadius:12, padding:"20px", fontSize:13, cursor:"pointer", color:"var(--dim)", fontFamily:"'DM Sans', sans-serif", marginBottom:16, display:"flex", flexDirection:"column", alignItems:"center", gap:8 }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--dim)" strokeWidth="1.5" strokeLinecap="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
              Add a photo
            </button>
          )}

          <div style={secLbl}>Restaurant</div>
          <div style={{ display:"flex", flexDirection:"column", gap:10, marginBottom:16 }}>
            <input className="pg-input" placeholder="Name *" value={form.name} onChange={e => setForm(f => ({ ...f, name:e.target.value }))} />
            <div style={{ position:"relative" }}>
              <input className="pg-input" placeholder="Location (used to pin on map)" value={form.location} onChange={e => setForm(f => ({ ...f, location:e.target.value, lat:null, lng:null }))} />
              <div style={{ position:"absolute", right:12, top:"50%", transform:"translateY(-50%)", fontSize:11, color:"var(--dimmer)" }}>📍</div>
            </div>
            <div style={{ display:"flex", gap:10 }}>
              <div style={{ flex:1, position:"relative" }}>
                <select className="pg-select" value={form.style} onChange={e => handleFormStyleChange(e.target.value)}>
                  {formConfig.styles.map(s => <option key={s}>{s}</option>)}
                </select>
                <span style={{ position:"absolute", right:12, top:"50%", transform:"translateY(-50%)", color:"var(--muted)", pointerEvents:"none", fontSize:11 }}>▾</span>
              </div>
              <input className="pg-input" type="date" value={form.dateVisited} onChange={e => setForm(f => ({ ...f, dateVisited:e.target.value }))} style={{ flex:1 }} />
            </div>
            <input className="pg-input" placeholder="Your initials (badge on shared guides)" value={form.addedBy} onChange={e => setForm(f => ({ ...f, addedBy:e.target.value.toUpperCase().slice(0,3) }))} style={{ letterSpacing:2 }} />
          </div>

          {/* Phone + Hours */}
          <div style={{ display:"flex", gap:10, marginBottom:16 }}>
            <div style={{ flex:1 }}>
              <div style={{ fontSize:10, letterSpacing:2, color:"var(--dimmer)", textTransform:"uppercase", marginBottom:6 }}>Phone</div>
              <input className="pg-input" placeholder="+39 02 1234567" value={form.phone||""} onChange={e => setForm(f => ({ ...f, phone:e.target.value }))} />
            </div>
            {form.name.trim() && (
              <div style={{ display:"flex", alignItems:"flex-end" }}>
                <button onClick={handleLookupPlace} disabled={lookingUp} style={{ background:lookingUp?"var(--surface)":"rgba(91,138,91,0.12)", border:"1px solid rgba(91,138,91,0.3)", color:"#5B8A5B", borderRadius:10, padding:"10px 12px", fontSize:12, cursor:"pointer", fontFamily:"'DM Sans', sans-serif", fontWeight:600, whiteSpace:"nowrap", display:"flex", alignItems:"center", gap:5 }}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                  {lookingUp ? "Looking up…" : "Auto-fill"}
                </button>
              </div>
            )}
          </div>
          <div style={{ marginBottom:16 }}>
            <div style={{ fontSize:10, letterSpacing:2, color:"var(--dimmer)", textTransform:"uppercase", marginBottom:6 }}>Opening Hours <span style={{ fontWeight:400, textTransform:"none" }}>(optional)</span></div>
            <textarea className="pg-textarea" style={{ minHeight:64, fontSize:12 }} placeholder={"Mo-Fr 12:00-14:30,19:00-23:00\nSa-Su 12:00-23:00"} value={form.openingHours||""} onChange={e => setForm(f => ({ ...f, openingHours:e.target.value }))} />
          </div>
          <div style={{ marginBottom:16 }}>
            <div style={{ fontSize:10, letterSpacing:2, color:"var(--dimmer)", textTransform:"uppercase", marginBottom:6 }}>Website / Reservation URL</div>
            <input className="pg-input" placeholder="https://pizzeriadamichele.com or thefork link…" value={form.reservationUrl||""} onChange={e => setForm(f => ({ ...f, reservationUrl:e.target.value }))} style={{ fontSize:12 }} />
          </div>
            </>
          )}{/* end !addingVisitTo */}

          {addingVisitTo && (
            <div style={{ marginBottom:16 }}>
              <div style={{ display:"flex", gap:10 }}>
                <input className="pg-input" type="date" value={form.dateVisited} onChange={e => setForm(f => ({ ...f, dateVisited:e.target.value }))} style={{ flex:1 }} />
                <input className="pg-input" placeholder="Dish ordered" value={form.dish} onChange={e => setForm(f => ({ ...f, dish:e.target.value }))} style={{ flex:2 }} />
              </div>
            </div>
          )}

          <div style={{ display:"flex", gap:12, marginBottom:4 }}>
            <div style={{ flex:1 }}>
              <div style={secLbl}>Price</div>
              <div style={{ display:"flex", gap:4 }}>
                {PRICE_RANGES.map(p => <button key={p} onClick={() => setForm(f => ({ ...f, priceRange:p }))} style={{ flex:1, background:form.priceRange===p?"#C4622D":"var(--surface)", border:`1px solid ${form.priceRange===p?"#C4622D":"var(--border)"}`, color:form.priceRange===p?"#F0EBE1":"var(--muted)", borderRadius:9, padding:"9px 0", fontSize:10, cursor:"pointer", fontFamily:"'DM Sans', sans-serif" }}>{p}</button>)}
              </div>
            </div>
            <div style={{ flex:1 }}>
              <div style={secLbl}>Return?</div>
              <div style={{ display:"flex", gap:6 }}>
                {["Yes","Maybe","No"].map(r => { const rc=r==="Yes"?"#5B8A5B":r==="Maybe"?"#C4622D":"#8B4040"; return <button key={r} onClick={() => setForm(f => ({ ...f, wouldReturn:r }))} style={{ flex:1, background:form.wouldReturn===r?rc:"var(--surface)", border:`1px solid ${form.wouldReturn===r?rc:"var(--border)"}`, color:form.wouldReturn===r?"#F0EBE1":"var(--muted)", borderRadius:9, padding:"9px 0", fontSize:12, cursor:"pointer", fontFamily:"'DM Sans', sans-serif" }}>{r}</button>; })}
              </div>
            </div>
          </div>

          <div style={{ ...secLbl, marginTop:24 }}>
            Scores
            {isDynamic && <span style={{ fontWeight:400, textTransform:"none", letterSpacing:1, marginLeft:8, color:"var(--dim)", fontSize:11 }}>— {form.style}</span>}
          </div>
          {isDynamic && <div style={{ fontSize:12, color:"var(--dimmer)", marginBottom:16, background:"rgba(196,98,45,0.06)", borderRadius:8, padding:"8px 12px" }}>Criteria adapt to the selected type. Changing type resets scores.</div>}
          {formCriteria.map(c => (
            <div key={c.key} style={{ marginBottom:24 }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"baseline", marginBottom:12 }}>
                <div><span style={{ fontSize:15, fontWeight:500, color:"var(--text)" }}>{c.label}</span><span style={{ fontSize:11, color:"var(--dimmer)", marginLeft:8 }}>{c.weight}</span></div>
                <span style={{ fontFamily:"'Playfair Display', serif", fontSize:26, fontWeight:700, color:scoreColor(form.scores[c.key]??7) }}>{form.scores[c.key]??7}</span>
              </div>
              <ScoreSlider value={form.scores[c.key]??7} onChange={v => setForm(f => ({ ...f, scores:{ ...f.scores, [c.key]:v } }))} />
              <div style={{ display:"flex", justifyContent:"space-between", fontSize:10, color:"var(--dimmer)", marginTop:6 }}><span>1 · poor</span><span>5 · average</span><span>10 · perfect</span></div>
              <div style={{ fontSize:11, color:"var(--dimmer)", marginTop:4 }}>{c.sub}</div>
            </div>
          ))}

          <div style={secLbl}>Notes</div>
          <textarea className="pg-textarea" placeholder="What stood out? Any memorable detail about this visit…" value={form.notes} onChange={e => setForm(f => ({ ...f, notes:e.target.value }))} />
          <div style={{ height:24 }} />
        </div>
      </div>
    );
  }

  // ╔══════════════════════════════════════════════╗
  // ║  WISHLIST ADD                                ║
  // ╚══════════════════════════════════════════════╝
  if (view === "wishlist-add") {
    const canSave = wishForm.name.trim().length > 0 && !saving;
    return (
      <div style={{ ...app, paddingBottom:60 }} className="pg-fade-in">
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"14px 20px", ...divBdr, position:"sticky", top:0, background:"var(--bg)", zIndex:10 }}>
          <button onClick={() => { setView("wishlist"); setEditingWishId(null); }} style={{ background:"none", border:"none", color:"#C4622D", fontSize:14, cursor:"pointer", fontFamily:"'DM Sans', sans-serif" }}>Cancel</button>
          <div style={{ fontFamily:"'Playfair Display', serif", fontSize:17, color:"var(--text)" }}>Add to Wishlist</div>
          <button onClick={saveWishEntry} disabled={!canSave} style={{ background:canSave?"#C4622D":"var(--surface)", border:"none", color:canSave?"#F0EBE1":"var(--dimmer)", borderRadius:8, padding:"8px 18px", fontSize:14, cursor:canSave?"pointer":"default", fontFamily:"'DM Sans', sans-serif", fontWeight:600 }}>{saving?"…":"Save"}</button>
        </div>
        <div style={{ padding:"24px 24px 0" }}>
          <div style={{ background:"rgba(212,168,83,0.08)", border:"1px solid rgba(212,168,83,0.2)", borderRadius:14, padding:"14px 18px", marginBottom:24, display:"flex", alignItems:"center", gap:12 }}>
            <span style={{ fontSize:24 }}>♡</span>
            <div style={{ fontSize:13, color:"#D4A853", lineHeight:1.6 }}>Save places you want to try. Rate them when you visit.</div>
          </div>
          <div style={secLbl}>Cuisine</div>
          <div style={{ marginBottom:20 }}><CuisineSwitcher active={migrateCuisine(wishForm.cuisine)} onChange={c => setWishForm(f => ({ ...f, cuisine:c }))} /></div>
          <div style={secLbl}>Place</div>
          <div style={{ display:"flex", flexDirection:"column", gap:10, marginBottom:16 }}>
            <input className="pg-input" placeholder="Restaurant name *" value={wishForm.name} onChange={e => setWishForm(f => ({ ...f, name:e.target.value }))} />
            <div style={{ position:"relative" }}>
              <input className="pg-input" placeholder="Location (optional — pins on map)" value={wishForm.location} onChange={e => setWishForm(f => ({ ...f, location:e.target.value, lat:null, lng:null }))} />
              <div style={{ position:"absolute", right:12, top:"50%", transform:"translateY(-50%)", fontSize:11, color:"var(--dimmer)" }}>📍</div>
            </div>
            <input className="pg-input" placeholder="Your initials (badge on shared guides)" value={wishForm.addedBy||""} onChange={e => setWishForm(f => ({ ...f, addedBy:e.target.value.toUpperCase().slice(0,3) }))} style={{ letterSpacing:2 }} />
          </div>
          {/* Phone + auto-fill */}
          <div style={{ display:"flex", gap:10, marginBottom:12 }}>
            <div style={{ flex:1 }}>
              <div style={{ fontSize:10, letterSpacing:2, color:"var(--dimmer)", textTransform:"uppercase", marginBottom:6 }}>Phone</div>
              <input className="pg-input" placeholder="+31 20 123 4567" value={wishForm.phone||""} onChange={e => setWishForm(f => ({ ...f, phone:e.target.value }))} />
            </div>
            {wishForm.name.trim() && (
              <div style={{ display:"flex", alignItems:"flex-end" }}>
                <button onClick={handleLookupWishPlace} disabled={lookingUpWish} style={{ background:lookingUpWish?"var(--surface)":"rgba(91,138,91,0.12)", border:"1px solid rgba(91,138,91,0.3)", color:"#5B8A5B", borderRadius:10, padding:"10px 12px", fontSize:12, cursor:"pointer", fontFamily:"'DM Sans', sans-serif", fontWeight:600, whiteSpace:"nowrap", display:"flex", alignItems:"center", gap:5 }}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                  {lookingUpWish ? "Looking up…" : "Auto-fill"}
                </button>
              </div>
            )}
          </div>
          <div style={{ marginBottom:12 }}>
            <div style={{ fontSize:10, letterSpacing:2, color:"var(--dimmer)", textTransform:"uppercase", marginBottom:6 }}>Opening Hours</div>
            <input className="pg-input" placeholder="Mo-Fr 12:00-15:00,19:00-23:00" value={wishForm.openingHours||""} onChange={e => setWishForm(f => ({ ...f, openingHours:e.target.value }))} style={{ fontSize:12 }} />
          </div>
          <div style={{ marginBottom:20 }}>
            <div style={{ fontSize:10, letterSpacing:2, color:"var(--dimmer)", textTransform:"uppercase", marginBottom:6 }}>Website / Reservation URL</div>
            <input className="pg-input" placeholder="https://thefork.com/…" value={wishForm.reservationUrl||""} onChange={e => setWishForm(f => ({ ...f, reservationUrl:e.target.value }))} style={{ fontSize:12 }} />
          </div>
          <div style={secLbl}>Notes</div>
          <textarea className="pg-textarea" placeholder="Why you want to try this place…" value={wishForm.notes} onChange={e => setWishForm(f => ({ ...f, notes:e.target.value }))} />
          <div style={{ height:24 }} />
        </div>
      </div>
    );
  }

  return <div style={app} />;
}

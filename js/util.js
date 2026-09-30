// Small DOM and text helpers shared by every module.

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

// h('div', {class: 'x', onclick: fn}, child, 'text', [more])
export function h(tag, attrs = {}, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v === null || v === undefined || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'style' && typeof v === 'object') setStyle(el, v);
    else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
    else if (k === 'dataset') Object.assign(el.dataset, v);
    else if (v === true) el.setAttribute(k, '');
    else el.setAttribute(k, String(v));
  }
  append(el, children);
  return el;
}

// Custom properties (--x) need setProperty; Object.assign on style drops them silently.
export function setStyle(el, obj) {
  for (const [k, v] of Object.entries(obj)) {
    if (v === null || v === undefined) continue;
    if (k.startsWith('--')) el.style.setProperty(k, String(v));
    else el.style[k] = v;
  }
}

export function append(el, children) {
  for (const c of children.flat(Infinity)) {
    if (c === null || c === undefined || c === false) continue;
    el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  return el;
}

const SVG_NS = 'http://www.w3.org/2000/svg';
export function s(tag, attrs = {}, ...children) {
  const el = document.createElementNS(SVG_NS, tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v === null || v === undefined || v === false) continue;
    if (k === 'class') el.setAttribute('class', v);
    else if (k === 'style' && typeof v === 'object') setStyle(el, v);
    else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
    else el.setAttribute(k, String(v));
  }
  for (const c of children.flat(Infinity)) {
    if (c === null || c === undefined || c === false) continue;
    el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  return el;
}

export function clear(el) {
  while (el.firstChild) el.removeChild(el.firstChild);
  return el;
}

export const reducedMotion = () =>
  window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// Web storage, wrapped: private windows and blocked storage must not break the page.
function makeStore(kind) {
  const area = () => window[kind];
  return {
    get(key, fallback = null) {
      try {
        const raw = area().getItem(key);
        return raw === null ? fallback : JSON.parse(raw);
      } catch {
        return fallback;
      }
    },
    set(key, value) {
      try {
        area().setItem(key, JSON.stringify(value));
        return true;
      } catch {
        return false;
      }
    },
    remove(key) {
      try {
        area().removeItem(key);
        return true;
      } catch {
        return false;
      }
    },
  };
}
// localStorage: questionnaire answers, reflections, the viewer's replay choices (never interview text).
export const store = makeStore('localStorage');
// sessionStorage: only the draft of the user's own materials, cleared on delete (ARCHITECTURE 5.3).
export const sessionStore = makeStore('sessionStorage');

// The same interface, held in this page's memory only: gone on reload, readable by nothing else.
function makeMemoryStore() {
  const map = new Map();
  return {
    get(key, fallback = null) {
      if (!map.has(key)) return fallback;
      try { return JSON.parse(map.get(key)); } catch { return fallback; }
    },
    set(key, value) {
      try { map.set(key, JSON.stringify(value)); return true; } catch { return false; }
    },
    remove(key) { map.delete(key); return true; },
  };
}

// True when this page is served from this machine (npm run start:local), whose origin only this portal uses.
export const pageOnThisMachine = () => {
  try { return ['127.0.0.1', 'localhost', '[::1]', '::1'].includes(window.location.hostname); } catch { return false; }
};

// tabStore: what one tab keeps about the person's own work - the draft of their own materials, the id of a run of
// their own materials, the booklet code. Security review 2026-09-30: web storage belongs to the origin, and on
// GitHub Pages the origin (https://elad-refoua.github.io) is shared by every Pages site of the account, any of which,
// or any script it loads, could read what this page stored. So on this machine it is sessionStorage (a reload keeps
// it); on any other host it is memory only (a reload forgets it). Serving the portal from an origin of its own
// (docs/DEPLOY.md 4) would allow sessionStorage there too.
export const tabStore = pageOnThisMachine() ? sessionStore : makeMemoryStore();
export const tabStoreKind = pageOnThisMachine() ? 'sessionStorage' : 'memory';

// Save a Blob as a file on the viewer's computer.
export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.rel = 'noopener';
  document.body.append(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 4000);
}

export function downloadJson(obj, filename) {
  downloadBlob(new Blob([JSON.stringify(obj, null, 2)], { type: 'application/json' }), filename);
}

export const safeName = (s) => String(s || 'run').replace(/[^A-Za-z0-9_-]+/g, '-').slice(0, 60) || 'run';

export function announce(text) {
  const live = document.getElementById('live-region');
  if (!live) return;
  live.textContent = '';
  window.setTimeout(() => { live.textContent = text; }, 60);
}

export const sleep = (ms) => new Promise((r) => window.setTimeout(r, ms));

export function shortHash(hex, n = 12) {
  return typeof hex === 'string' && hex.length > n ? hex.slice(0, n) : (hex || '');
}

export function fmtMs(ms) {
  if (typeof ms !== 'number' || !Number.isFinite(ms)) return '';
  if (ms < 1000) return `${Math.round(ms)} אלפיות שנייה`;
  return `${(ms / 1000).toFixed(ms < 10000 ? 1 : 0)} שניות`;
}

// A count with its noun: plural(1, 'ציר שביר אחד', 'צירים שבירים') -> 'ציר שביר אחד';
// plural(3, ..., 'צירים שבירים') -> '3 צירים שבירים'. Hebrew puts "one" after the noun, so the singular
// is written out whole.
export function plural(n, one, many) {
  return Number(n) === 1 ? one : `${n} ${many}`;
}

export function fmtDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString('he-IL', { dateStyle: 'medium', timeStyle: 'short' });
}

// Quote matching rule from ARCHITECTURE 3.2: NFC, whitespace collapsed,
// double-quote variants and single-quote variants unified. Nothing else.
const DQ = '"״“”„';
const SQ = "'׳‘’";

export function normalizeWithMap(input) {
  const src = String(input || '').normalize('NFC');
  let out = '';
  const map = [];
  let prevSpace = true;
  for (let i = 0; i < src.length; i++) {
    let c = src[i];
    if (/\s/.test(c)) {
      if (!prevSpace) { out += ' '; map.push(i); prevSpace = true; }
      continue;
    }
    if (DQ.includes(c)) c = '"';
    else if (SQ.includes(c)) c = "'";
    out += c;
    map.push(i);
    prevSpace = false;
  }
  if (out.endsWith(' ')) { out = out.slice(0, -1); map.pop(); }
  return { out, map };
}

export const normalize = (t) => normalizeWithMap(t).out;

// Returns [start, end) in the ORIGINAL (NFC) string, or null.
export function findQuote(haystack, quote) {
  const hay = normalizeWithMap(haystack);
  const q = normalize(quote);
  if (!q) return null;
  const idx = hay.out.indexOf(q);
  if (idx < 0) return null;
  return [hay.map[idx], hay.map[idx + q.length - 1] + 1];
}

export function debounce(fn, ms) {
  let t;
  return (...args) => {
    window.clearTimeout(t);
    t = window.setTimeout(() => fn(...args), ms);
  };
}

// Probe an image once; resolves true when it loads.
export function probeImage(src) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(true);
    img.onerror = () => resolve(false);
    img.src = src;
  });
}

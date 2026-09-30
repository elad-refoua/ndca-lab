// Boot: load data/demo-run.json (or the fixture, see DATA_URL), then wire every section. No run content lives in HTML or JS.
import { $, $$, h, s, clear, reducedMotion } from './util.js';
import { hydrateIcons } from './icons.js';
import { createApp, refreshAxisNames } from './model.js';
import { initReader } from './reader.js';
import { initMethod, updateMatrix } from './method.js';
import { initSurvey } from './survey.js';
import { initCorpus } from './corpus.js';
import { initRun } from './replay.js';
import { initCheckpoints } from './checkpoints.js';
import { initFindings } from './findings.js';
import { initHood } from './hood.js';
import { initLive } from './live.js';
import { initMaterials } from './materials.js';
import { sightOf } from './views.js';
import { wireDisclosureLinks } from './disclose.js';
import { initBanner, bannerKind } from './banner.js';
import { mayCallApi, apiIsRemote } from './health.js';
import { promptLayersOf } from './model.js';

// The replay file is the recorded real run. `?data=fixture` loads the small hand-written fixture instead
// (for tests that need a short run); nothing else can be named, so the page never fetches an arbitrary URL.
const DATA_FILES = { demo: 'data/demo-run.json', fixture: 'data/fixture-run.json' };
const DATA_URL = (() => {
  try {
    const want = new URLSearchParams(window.location.search).get('data');
    return DATA_FILES[want] || DATA_FILES.demo;
  } catch { return DATA_FILES.demo; }
})();

async function loadData() {
  const res = await fetch(DATA_URL, { cache: 'no-cache' });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  if (!data || !data.corpus || !data.run) throw new Error('missing corpus or run');
  // Names and fingerprints only: a file exported before D17 still carried prompt texts, and the page keeps none.
  data.prompts = promptLayersOf(data.prompts);
  return data;
}

// ---------- top bar: the axis-progress motif ----------
function initProgress() {
  const sections = $$('main > section[data-nav]');
  const list = $('#progress-axis');
  const current = $('#progress-current');
  const cool = new Set(['method', 'run', 'hood']);
  const links = sections.map((sec) => {
    const a = h('a', { href: `#${sec.id}`, 'aria-label': sec.dataset.nav, title: sec.dataset.nav, 'data-kind': cool.has(sec.id) ? 'cool' : 'warm' });
    list.append(h('li', {}, a));
    return a;
  });
  const setActive = (idx) => {
    links.forEach((a, i) => {
      if (i === idx) a.setAttribute('aria-current', 'step'); else a.removeAttribute('aria-current');
      a.classList.toggle('is-past', i < idx);
    });
    current.textContent = sections[idx] ? sections[idx].dataset.nav : '';
  };
  const io = new IntersectionObserver((entries) => {
    entries.forEach((en) => { if (en.isIntersecting) setActive(sections.indexOf(en.target)); });
  }, { rootMargin: '-35% 0px -60% 0px' });
  sections.forEach((sec) => io.observe(sec));
  setActive(0);

  const bar = $('#topbar');
  let ticking = false;
  const onScroll = () => {
    if (ticking) return;
    ticking = true;
    window.requestAnimationFrame(() => {
      const max = document.documentElement.scrollHeight - window.innerHeight;
      bar.style.setProperty('--progress', max > 0 ? Math.min(1, window.scrollY / max).toFixed(3) : '0');
      ticking = false;
    });
  };
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();
}

// ---------- images: blend in when they load, a drawn fallback when they do not ----------
function drawHeroFallback() {
  const svg = clear($('#hero-fallback'));
  // an open book at the lower left, and nine circles rising to the upper right on one thin line
  svg.append(s('path', { class: 'fb-book', d: 'M40 372 L200 352 L360 372 L360 386 L200 368 L40 386 Z' }));
  svg.append(s('path', { class: 'fb-book', d: 'M200 352 C170 320 110 318 60 330 L40 372 M200 352 C230 320 290 318 340 330 L360 372' }));
  const pts = [[210, 330], [236, 292], [276, 266], [300, 232], [338, 196], [400, 194], [424, 150], [472, 118], [530, 88]];
  svg.append(s('path', { class: 'fb-line', d: `M ${pts.map((p) => p.join(' ')).join(' L ')}` }));
  pts.forEach(([x, y], i) => svg.append(s('circle', { class: i % 2 ? 'fb-cool' : 'fb-warm', cx: x, cy: y, r: [6, 7, 8, 7, 14, 10, 9, 13, 8][i] })));
}

function watchImage(img, box, onFail) {
  const ok = () => box.classList.add('is-ready');
  const fail = () => { box.classList.add('is-fallback'); if (onFail) onFail(); };
  if (img.complete) {
    if (img.naturalWidth > 0) ok(); else fail();
  } else {
    img.addEventListener('load', ok, { once: true });
    img.addEventListener('error', fail, { once: true });
  }
}

function showFatal(err) {
  const msg = window.location.protocol === 'file:'
    ? 'את האתר צריך להגיש משרת מקומי (למשל npm run start:local), כי הדפדפן לא טוען קבצי נתונים מתוך file://.'
    : `לא ניתן לטעון את קובץ ההרצה (${DATA_URL}).`;
  ['#run-panel', '#cpa-body', '#cpb-body', '#axis-map', '#corpus-docs'].forEach((sel) => {
    const el = $(sel);
    if (el) { clear(el); el.append(h('p', { class: 'callout callout-warm' }, msg)); }
  });
  console.warn('demo-run.json could not be loaded:', err && err.message);
}

async function boot() {
  hydrateIcons();
  // The demo banner (D16): the softer replay note at once when this page has no API or waits for a remote one;
  // a local server's answer comes within 2.5 s, so the local page waits for it instead of flashing a note.
  const banner = initBanner($('#demo-banner'));
  if (!mayCallApi() || apiIsRemote()) banner.set('replay');
  initProgress();
  if (reducedMotion()) document.documentElement.classList.add('reduced-motion');
  watchImage($('#hero-img'), $('#hero-art'), drawHeroFallback);
  watchImage($('#blind-img'), $('#blind-figure'));
  initMethod();
  wireDisclosureLinks();

  let file;
  try {
    file = await loadData();
  } catch (err) {
    showFatal(err);
    return;
  }

  const app = createApp(file);
  app.sightOf = (n) => sightOf(n, app);
  updateMatrix(app.replayModel);
  window.__mabat = app; // for inspection in the browser console and by the end-to-end test

  // The fixture note describes the recorded demo file only: it is hidden whenever a live run (the demo
  // or the person's own materials) is on screen, and comes back with the recorded run.
  const fixtureNote = $('#fixture-banner');
  if (app.fixture) {
    const n = ((app.file.corpus && app.file.corpus.interviews) || []).length;
    const count = n === 1 ? 'לראיון בדוי אחד' : (n === 2 ? 'לשני ראיונות בדויים' : `ל-${n} ראיונות בדויים`);
    fixtureNote.lastElementChild.textContent = `קובץ הדגמה: הפלט של הסוכנים כאן נכתב ביד, ${count}, והורץ דרך המנוע האמיתי. הקלטים של כל שלב, התיעוד ובדיקות האיכות אמיתיים; המודל לא. הרצה של מודל אמיתי תחליף את הקובץ בלי שינוי בקוד.`;
  }
  const syncFixtureNote = () => { fixtureNote.hidden = !(app.fixture && app.mode === 'replay'); };
  syncFixtureNote();
  app.on('mode', syncFixtureNote);
  // the demo banner follows the server's answer: public demo, replay only, or none (a local server)
  app.on('health', (hh) => banner.set(bannerKind(hh), hh));

  initReader(app);
  initSurvey(app);
  initCorpus(app);
  const run = initRun(app);
  initCheckpoints(app);
  initFindings(app);
  initHood(app);
  hydrateIcons();

  app.on('names', (id) => refreshAxisNames(app, id));
  app.on('names-all', () => refreshAxisNames(app));
  app.on('model', () => hydrateIcons());

  initMaterials(app);
  // A local server answers within 2.5 s, and the page is ready when it has. A remote one may be waking from a
  // cold start for up to half a minute: the page is ready (the recorded run plays) while it wakes, and live mode
  // appears when it answers (html[data-api] says where the check stands).
  const live = initLive(app, run);
  if (apiIsRemote()) await Promise.race([live, new Promise((r) => window.setTimeout(r, 3000))]);
  else await live;
  document.documentElement.dataset.ready = 'true';
}

boot();

// The booklet page (decision D17). The booklet (the method, the nine agents, every prompt exactly as the agents
// receive it) is served by the API behind a simple code, never by this site's files: a code checked in a static
// page would protect nothing, since its files are public. So:
//   - POST /api/booklet { code } returns engine/booklet/booklet.json (ARCHITECTURE 5.1), rendered here;
//   - GET /api/booklet/docx with the header X-Booklet-Code returns the Word file.
// The code is kept in memory and in util.tabStore only: sessionStorage (this tab, until it closes; every access in
// try/catch) on a page served from this machine, and memory alone on a public host, whose origin other sites share
// (security review 2026-09-30); it is never logged, never put in a URL. Wrong code: a calm message; after the
// server's limit of wrong codes, its 429 in plain words. View only: nothing here can change the booklet.
// Block contract (engine/booklet/README.md): p | h | note | list | prompt; runs are rendered as text, never as HTML.
import { $, h, clear, tabStore, tabStoreKind, downloadBlob, announce } from './util.js';
import { icon, hydrateIcons } from './icons.js';
import { emblem } from './emblems.js';
import { STAGES } from './stages.js';
import { API, mayCallApi, apiIsRemote, fetchHealth } from './health.js';
import { initBanner, bannerKind } from './banner.js';

const CODE_KEY = 'mabat-kaful:booklet-code';
let code = '';
let health = null;

const gate = $('#bk-gate');
const form = $('#bk-form');
const input = $('#bk-code');
const openBtn = $('#bk-open');
const statusEl = $('#bk-status');
const doc = $('#bk-doc');

function say(text, { error = false, spin = false } = {}) {
  clear(statusEl);
  statusEl.classList.toggle('is-error', error);
  if (spin) statusEl.append(h('span', { class: 'spinner', 'aria-hidden': 'true' }));
  statusEl.append(text || '');
}

const storedCode = () => { const v = tabStore.get(CODE_KEY, null); return typeof v === 'string' ? v : ''; };

// ---------- the API: two requests, each explained in plain Hebrew when it fails ----------
function bookletError(status, data) {
  const c = data && typeof data.code === 'string' ? data.code : '';
  if (c === 'booklet_code_invalid') return 'הקוד לא מתאים. בדקו אותו ונסו שוב.';
  if (c === 'booklet_code_required') return 'הזינו את קוד הגישה.';
  const minutes = (fallback) => {
    const s = Number(data && data.retryAfter);
    return Number.isFinite(s) && s > 0 ? Math.max(1, Math.ceil(s / 60)) : fallback;
  };
  if (c === 'booklet_attempts') {
    return `היו כמה ניסיונות עם קוד שגוי מהכתובת הזאת, ולכן השרת עוצר לזמן קצר. אפשר לנסות שוב בעוד כ-${minutes(15)} דקות.`;
  }
  // Added 2026-09-30 (security review): the server's limits on wrong codes from everyone, and on opens.
  if (c === 'booklet_attempts_global') {
    return `השרת קיבל לאחרונה הרבה ניסיונות עם קוד שגוי, ולכן החוברת נעצרת לזמן קצר לכולם. אפשר לנסות שוב בעוד כ-${minutes(15)} דקות.`;
  }
  if (c === 'booklet_opens') {
    return `החוברת נפתחה פעמים רבות מהכתובת הזאת בשעה האחרונה. אפשר לפתוח אותה שוב בעוד כ-${minutes(60)} דקות.`;
  }
  if (c === 'booklet_opens_daily') return 'החוברת נפתחה פעמים רבות היום, והשרת עוצר עד מחר. אפשר לנסות שוב מחר.';
  if (c === 'daily_egress_limit') return 'השרת של ההדגמה שלח היום את כל כמות הנתונים שמותרת לו, ולכן הוא נח עד מחר. אפשר לנסות שוב מחר.';
  if (status === 429) return 'השרת קיבל יותר מדי בקשות. חכו דקה ונסו שוב.';
  if (c === 'booklet_unavailable') return 'החוברת לא זמינה בשרת כרגע. נסו שוב מאוחר יותר.';
  if (status === 404) return 'החוברת לא זמינה בשרת הזה.';
  return `משהו השתבש בשרת (קוד ${status}).`;
}

async function call(path, { method = 'GET', body = null, headers = {}, as = 'json' } = {}) {
  const ctl = new AbortController();
  const t = window.setTimeout(() => ctl.abort(), 60000);
  let res;
  try {
    res = await fetch(API + path, {
      method,
      headers: { ...(body ? { 'Content-Type': 'application/json' } : {}), ...headers },
      body: body ? JSON.stringify(body) : undefined,
      cache: 'no-store',
      credentials: 'omit',
      signal: ctl.signal,
    });
  } catch (e) {
    const err = new Error(e.name === 'AbortError' ? 'השרת לא ענה בזמן. נסו שוב.' : (apiIsRemote() ? 'אין חיבור לשרת. בדקו את החיבור לאינטרנט ונסו שוב.' : 'אין חיבור לשרת המקומי. בדקו שהוא רץ.'));
    err.lost = true;
    throw err;
  } finally {
    window.clearTimeout(t);
  }
  if (!res.ok) {
    let data = null;
    try { data = await res.json(); } catch { data = null; }
    const err = new Error(bookletError(res.status, data));
    err.status = res.status;
    err.code = data && data.code;
    throw err;
  }
  return as === 'blob' ? { blob: await res.blob(), res } : res.json();
}

// ---------- rendering the booklet ----------
const runsOf = (block) => (Array.isArray(block.runs) && block.runs.length ? block.runs : [{ text: block.text || '' }]);
function inline(block) {
  return runsOf(block).map((r) => {
    const text = String((r && r.text) || '');
    if (r && r.code) return h('code', { dir: 'ltr' }, text);
    if (r && r.bold) return h('strong', {}, text);
    return text;
  });
}

const agentOf = (id) => { const m = /^agent-(\d)$/.exec(String(id || '')); return m ? STAGES[Number(m[1]) - 1] : null; };

function copyText(text) {
  if (navigator.clipboard && window.isSecureContext) return navigator.clipboard.writeText(text);
  return new Promise((resolve, reject) => {
    const ta = h('textarea', { 'aria-hidden': 'true', style: { position: 'fixed', top: '-1000px', opacity: '0' } });
    ta.value = text;
    document.body.append(ta);
    ta.select();
    let ok = false;
    try { ok = document.execCommand('copy'); } catch { ok = false; }
    ta.remove();
    if (ok) resolve(); else reject(new Error('copy failed'));
  });
}

function promptBlock(b, sectionTitle) {
  const name = String(b.name || 'prompt');
  const text = String(b.text || '');
  const preId = `bk-pre-${name}`;
  const label = h('span', {}, 'העתקה');
  const copy = h('button', { type: 'button', class: 'btn btn-ghost btn-sm bk-copy', 'data-prompt': name, 'aria-label': `העתקת ההנחיה: ${sectionTitle}` }, icon('copy'), label);
  copy.addEventListener('click', async () => {
    try {
      await copyText(text);
      label.textContent = 'הועתק';
      announce('ההנחיה הועתקה');
    } catch {
      label.textContent = 'ההעתקה לא הצליחה';
    }
    window.setTimeout(() => { label.textContent = 'העתקה'; }, 2500);
  });
  const fig = h('figure', { class: 'bk-prompt', id: `bk-prompt-${name}`, 'data-prompt': name });
  const expand = h('button', { type: 'button', class: 'btn btn-quiet btn-sm bk-expand', 'aria-controls': preId, 'aria-expanded': 'false' }, 'פריסה מלאה');
  expand.addEventListener('click', () => {
    const open = fig.classList.toggle('is-open');
    expand.setAttribute('aria-expanded', String(open));
    expand.textContent = open ? 'קיפול' : 'פריסה מלאה';
  });
  fig.append(
    h('figcaption', { class: 'bk-prompt-h' },
      h('div', { class: 'bk-prompt-meta' },
        h('span', { class: 'bk-prompt-title' }, 'ההנחיה המלאה, מילה במילה'),
        b.file ? h('code', { dir: 'ltr', class: 'bk-file' }, String(b.file)) : null,
        b.sha256 ? h('span', { class: 'bk-hash' }, 'טביעת אצבע (SHA-256): ', h('code', { dir: 'ltr' }, String(b.sha256))) : null),
      h('div', { class: 'bk-prompt-actions' }, copy, expand)),
    h('pre', { class: 'bk-pre', id: preId, dir: 'ltr', lang: 'en', tabindex: '0', 'aria-label': `ההנחיה המלאה: ${sectionTitle}` }, text));
  return fig;
}

function renderBlock(b, sectionTitle) {
  switch (b && b.type) {
    case 'h': return h(Number(b.level) >= 4 ? 'h4' : 'h3', { class: 'bk-h' }, inline(b));
    case 'note': return h('aside', { class: 'callout callout-warm bk-note' }, h('p', {}, inline(b)));
    case 'list': return h(b.ordered ? 'ol' : 'ul', { class: 'bk-list' }, (b.items || []).map((it) => h('li', {}, inline(it))));
    case 'prompt': return promptBlock(b, sectionTitle);
    case 'p': return h('p', {}, inline(b));
    default: return b && b.text ? h('p', {}, String(b.text)) : null;
  }
}

function renderBooklet(data) {
  const sections = Array.isArray(data && data.sections) ? data.sections : [];
  const body = clear($('#bk-body'));
  const toc = clear($('#bk-toc'));
  const tocList = h('ol', { class: 'bk-toc-list' });
  sections.forEach((s, i) => {
    const id = `bk-${String(s.id || `s${i}`)}`;
    const title = String(s.title || '');
    const blocks = (Array.isArray(s.blocks) ? s.blocks : []).map((b) => renderBlock(b, title));
    if (i === 0 && s.id === 'cover') {
      body.append(h('header', { class: 'bk-cover', id },
        h('p', { class: 'bk-kicker' }, 'חוברת ההסבר'),
        h('h1', { id: 'bk-title', tabindex: '-1' }, title),
        blocks,
        data.generated_at ? h('p', { class: 'bk-generated small muted' }, `נבנתה ${new Date(data.generated_at).toLocaleDateString('he-IL', { dateStyle: 'long' })} מתוך קובצי ההנחיות שהסוכנים מקבלים.`) : null));
      return;
    }
    const st = agentOf(s.id);
    const head = st
      ? h('div', { class: 'bk-agent-head', style: { '--hue': st.hue } },
        h('span', { class: 'bk-emblem' }, emblem(st.n, { labelled: true })),
        h('div', {}, h('p', { class: 'bk-agent-kicker' }, h('span', { class: 'stage-chip', style: { '--hue': st.hue } }, String(st.n)), h('bdi', { dir: 'ltr', class: 'persona' }, st.persona)),
          h('h2', { id: `${id}-h` }, title)))
      : h('h2', { id: `${id}-h` }, title);
    body.append(h('section', { class: `bk-section${st ? ' bk-agent' : ''}`, id, 'aria-labelledby': `${id}-h`, style: st ? { '--hue': st.hue } : null }, head, blocks));
    // an agent's entry: its Hebrew name and task ("הכורה: זיהוי..."), the stage number in the chip
    const short = st ? /\(([^)]+)\)\s*:\s*(.+)$/.exec(title) : null;
    tocList.append(h('li', { class: st ? 'is-agent' : '' },
      h('a', { href: `#${id}`, style: st ? { '--hue': st.hue } : null },
        st ? h('span', { class: 'stage-chip', 'aria-hidden': 'true', style: { '--hue': st.hue } }, String(st.n)) : null,
        h('span', {}, short ? [h('span', { class: 'sr-only' }, `שלב ${st.n}: `), `${short[1]}: ${short[2]}`] : title))));
  });
  const tocFold = h('details', { class: 'bk-toc-fold', open: true },
    h('summary', { id: 'bk-toc-title' }, 'תוכן העניינים'), tocList);
  toc.append(tocFold);
  // phones: the table of contents starts folded, so the booklet itself is on the first screen
  if (window.matchMedia && window.matchMedia('(max-width: 1023px)').matches) tocFold.open = false;
  hydrateIcons(body);
}

// ---------- open, lock, download ----------
function showDoc(data) {
  renderBooklet(data);
  gate.hidden = true;
  doc.hidden = false;
  $('#bk-docx').hidden = !(health && health.booklet_docx_available);
  document.documentElement.dataset.booklet = 'open';
  const target = window.location.hash && document.getElementById(decodeURIComponent(window.location.hash.slice(1)));
  if (target) target.scrollIntoView({ block: 'start' });
  else { window.scrollTo(0, 0); const t = document.getElementById('bk-title'); if (t) t.focus({ preventScroll: true }); }
}

function showGate(message = '', opts = {}) {
  doc.hidden = true;
  gate.hidden = false;
  clear($('#bk-body'));
  clear($('#bk-toc'));
  document.documentElement.dataset.booklet = 'closed';
  say(message, opts);
}

// auto: the code this tab stored earlier, sent on load; if the server no longer takes it, say so plainly.
async function open(candidate, { remember = true, auto = false } = {}) {
  openBtn.disabled = true;
  say('פותחים את החוברת...', { spin: true });
  try {
    const data = await call('/api/booklet', { method: 'POST', body: { code: candidate } });
    code = candidate;
    if (remember) tabStore.set(CODE_KEY, candidate);
    input.value = '';
    say('');
    showDoc(data);
  } catch (e) {
    if (e.status === 401) tabStore.remove(CODE_KEY);
    showGate(auto && e.status === 401 ? 'הקוד שנשמר בלשונית הזאת כבר לא מתקבל. הזינו אותו שוב.' : e.message, { error: true });
    if (e.status === 401) { input.value = ''; input.focus(); }
  } finally {
    openBtn.disabled = !(health && health.booklet_available);
  }
}

form.addEventListener('submit', (ev) => {
  ev.preventDefault();
  const candidate = input.value.trim();
  if (!candidate) { say('הזינו את קוד הגישה.', { error: true }); input.focus(); return; }
  open(candidate);
});

$('#bk-print').addEventListener('click', () => window.print());
// A folded table of contents (phones) prints open; it folds back afterwards.
window.addEventListener('beforeprint', () => {
  const f = document.querySelector('.bk-toc-fold');
  if (f) { f.dataset.wasOpen = String(f.open); f.open = true; }
});
window.addEventListener('afterprint', () => {
  const f = document.querySelector('.bk-toc-fold');
  if (f && f.dataset.wasOpen === 'false') f.open = false;
});

$('#bk-lock').addEventListener('click', () => {
  code = '';
  tabStore.remove(CODE_KEY);
  showGate('החוברת ננעלה בלשונית הזאת. כדי לפתוח אותה שוב, הזינו את הקוד.');
  input.focus();
});

$('#bk-docx').addEventListener('click', async () => {
  const st = $('#bk-tool-status');
  const btn = $('#bk-docx');
  btn.disabled = true;
  st.classList.remove('is-error');
  st.textContent = 'מכינים את קובץ ה-Word...';
  try {
    const { blob, res } = await call('/api/booklet/docx', { headers: { 'X-Booklet-Code': code }, as: 'blob' });
    const cd = res.headers.get('Content-Disposition') || '';
    const m = /filename="?([A-Za-z0-9._-]+)"?/.exec(cd);
    downloadBlob(blob, m ? m[1] : 'ndca-booklet.docx');
    st.textContent = 'הקובץ ירד למחשב שלכם.';
  } catch (e) {
    st.textContent = e.status === 401 ? 'הקוד כבר לא מתקבל. נעלו את החוברת והזינו אותו שוב.' : e.message;
    st.classList.add('is-error');
  } finally {
    btn.disabled = false;
  }
});

// ---------- boot ----------
async function boot() {
  hydrateIcons();
  // On a public host the code lives in this page's memory only (util.tabStore), so a reload asks for it again.
  if (tabStoreKind === 'memory') {
    const note = $('#bk-code-note');
    if (note) note.textContent = 'הקוד נשמר רק בדף הזה, עד שתרעננו או תסגרו אותו. החוברת לקריאה, להדפסה ולהורדה בלבד.';
  }
  const banner = initBanner($('#demo-banner'));
  if (!mayCallApi() || apiIsRemote()) banner.set('replay');
  openBtn.disabled = true;
  if (!mayCallApi()) {
    showGate('החוברת נפתחת דרך השרת של מבט כפול, והעמוד הזה לא מחובר לשרת.', { error: true });
    document.documentElement.dataset.ready = 'true';
    return;
  }
  say('מתחברים לשרת...', { spin: true });
  const { health: hh } = await fetchHealth({
    onWaking: () => say('מעירים את השרת של ההדגמה... אחרי הפסקה זה יכול לקחת עד חצי דקה.', { spin: true }),
  });
  health = hh;
  banner.set(bannerKind(hh), hh);
  document.documentElement.dataset.ready = 'true';
  if (!hh) {
    const again = h('button', { type: 'button', class: 'btn btn-ghost btn-sm', id: 'bk-retry' }, icon('rotate'), 'לנסות שוב');
    again.addEventListener('click', () => { window.location.reload(); });
    showGate(apiIsRemote() ? 'השרת של ההדגמה לא ענה, ולכן אי אפשר לפתוח את החוברת כרגע.' : 'השרת המקומי לא ענה. הפעילו אותו (npm run start:local) ונסו שוב.', { error: true });
    statusEl.append(' ', again);
    return;
  }
  if (!hh.booklet_available) {
    showGate('החוברת לא זמינה בשרת הזה.', { error: true });
    return;
  }
  openBtn.disabled = false;
  const saved = storedCode();
  if (saved) await open(saved, { auto: true });
  else say('');
}

boot();

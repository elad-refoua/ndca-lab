// Under the hood: run metadata, provenance per model call, gate results (ARCHITECTURE 4), and the prompt layers by
// name and fingerprint (the texts are in the booklet, D17).
import { $, h, clear, fmtMs, fmtDate, shortHash, plural } from './util.js';
import { icon } from './icons.js';
import { STAGES, stageByN } from './stages.js';
import { FINGERPRINT_TEXT } from './views.js';

// The English persona names, in one typographic style everywhere (the agent's ink, tracked caps).
const persona = (st) => h('bdi', { class: 'persona', dir: 'ltr', style: { '--hue': st.hue } }, st.persona);

const GATES = [
  ['G1', 'אימות מילולי', 'כל ציטוט בשלבים 1, 4, 6 ו-9 נמצא מילה במילה בראיון שצוין. פרפרזה או מילה שהשתנתה נכשלות.'],
  ['G2', 'עיוורון', 'בשלבים 3, 5 ו-8 הקלט שנשלח אינו מכיל שדות של ציטוט, טקסט או עדות, רק את השדות שמותרים לשלב, ואין בו רצף של שש מילים מהראיונות.'],
  ['G3', 'שלמות', 'כל חוליה בשרשרת קיימת: יחידה, תווית, ניגוד, תוצאה, ציר, נקודות אמצע, שמות, קשרים ופסקאות. ציר שביר אינו ציר ליבה.'],
];

export function initHood(app) {
  const render = () => { renderMeta(app); renderTable(app); renderGates(app); renderPrompts(app); };
  render();
  app.on('model', render);
  app.on('prompts', () => renderPrompts(app));
}

function renderMeta(app) {
  const box = clear($('#run-meta'));
  const r = app.model.run || {};
  const item = (t, v) => h('div', {}, h('dt', {}, t), h('dd', {}, v));
  let source;
  const from = app.health && app.health.remote ? 'מהשרת' : 'מהשרת המקומי';
  if (app.mode === 'live') source = app.live && app.live.kind === 'custom' ? `הרצה חיה על החומרים שלכם, ${from}` : `הרצה חיה ${from}`;
  else source = app.fixture ? 'קובץ הדגמה: פלט שנכתב ביד והורץ דרך המנוע האמיתי' : `ייצוא מהמנוע, ${fmtDate(app.file.exported_at)}`;
  box.append(h('dl', {},
    item('מזהה ההרצה', h('span', { class: 'id' }, r.run_id || '')),
    // the model id never breaks at its hyphens ("gemini-2.5-" / "pro"); it moves to its own line instead
    item('ספק ומודל', h('bdi', {}, `${r.provider || ''} / `, h('bdi', { style: { whiteSpace: 'nowrap' } }, r.model || ''))),
    item('גרסת המנוע', h('span', { class: 'id' }, r.engine_version || '')),
    item('נוצרה', fmtDate(r.created_at)),
    item('קורפוס', h('span', { class: 'id' }, r.corpus_id || '')),
    item('מקור הנתונים', source)));
}

function renderTable(app) {
  const wrap = clear($('#prov-table-wrap'));
  const calls = app.model.allCalls;
  if (!calls.length) {
    wrap.append(h('p', { style: { padding: '16px', margin: 0 }, class: 'muted' }, 'עוד אין קריאות מתועדות.'));
    return;
  }
  const table = h('table', { class: 'prov' },
    h('caption', {}, 'כל שורה היא קריאה אחת למודל. בשלב 1 יש קריאה נפרדת לכל ראיון; קריאת תיקון מסומנת.'),
    h('thead', {}, h('tr', {},
      ['שלב', 'סוכן', 'מודל', 'ראה נתונים', 'משך', 'ניסיונות', 'טביעת אצבע של ההנחיה', 'טביעת אצבע של הקלט'].map((t) => h('th', { scope: 'col' }, t)))),
    h('tbody', {}, calls.map((c) => {
      const st = stageByN(c.stage) || STAGES[0];
      return h('tr', {},
        h('td', {}, h('span', { class: 'stage-chip', style: { '--hue': st.hue } }, String(c.stage))),
        h('td', {}, persona(st), c.call_index ? [' ', h('span', { class: 'id call-n' }, `#${c.call_index + 1}`)] : null,
          c.repair_of !== undefined ? h('span', { class: 'badge badge-warm', style: { marginInlineStart: '6px' } }, 'תיקון') : null),
        h('td', {}, h('bdi', { class: 'num' }, c.model || '')),
        h('td', {}, c.sees_data
          ? h('span', { class: 'badge badge-muted' }, icon('eye'), 'כן')
          : h('span', { class: 'badge badge-outline' }, icon('eyeOff'), 'לא')),
        h('td', { class: 'num' }, fmtMs(c.duration_ms)),
        h('td', { class: 'num' }, String(c.attempts ?? '')),
        h('td', {}, h('span', { class: 'num', title: c.system_prompt_sha256 || '' }, shortHash(c.system_prompt_sha256, 12))),
        h('td', {}, h('span', { class: 'num', title: c.input_sha256 || '' }, shortHash(c.input_sha256, 12))));
    })));
  wrap.append(table);
  const explain = document.getElementById('prov-explain');
  if (explain) explain.textContent = FINGERPRINT_TEXT;
  wrap.setAttribute('tabindex', '0');
  wrap.setAttribute('role', 'region');
  wrap.setAttribute('aria-label', 'טבלת התיעוד של הקריאות למודל');
}

function statusBadge(status) {
  const st = String(status || '').toLowerCase();
  if (st === 'pass') return h('span', { class: 'badge badge-ok' }, icon('check'), 'עבר');
  if (st === 'fail') return h('span', { class: 'badge badge-danger' }, icon('x'), 'נכשל');
  if (st === 'warn') return h('span', { class: 'badge badge-warm' }, icon('alert'), 'אזהרה');
  return h('span', { class: 'badge badge-muted' }, 'לא הורץ');
}

function describe(item) {
  if (typeof item === 'string') return item;
  if (!item || typeof item !== 'object') return String(item);
  const where = [item.stage !== undefined ? `שלב ${item.stage}` : '', item.where || item.path || ''].filter(Boolean).join(', ');
  const what = item.reason || '';
  const q = item.quote ? ` "${item.quote}"` : (item.run ? ` "${item.run}"` : '');
  return `${where ? `${where}: ` : ''}${what}${q}` || JSON.stringify(item);
}

function gateDetails(key, g) {
  const ul = h('ul', {});
  const c = g.counts || {};
  const per = c.per_stage || g.per_stage || {};
  if (key === 'G1') {
    Object.entries(per).forEach(([st, v]) => {
      const ok = v.found === v.total;
      ul.append(h('li', { class: ok ? '' : 'bad' }, icon(ok ? 'check' : 'x'), `שלב ${st}: ${v.found} מתוך ${v.total} ציטוטים נמצאו`));
    });
  } else if (key === 'G2') {
    Object.entries(per).forEach(([st, v]) => {
      const ran = v.ran !== false;
      ul.append(h('li', { class: ran ? '' : 'warn' }, icon(ran ? 'check' : 'alert'), ran ? `שלב ${st}: הקלט נבדק (${v.calls ?? 1} קריאות)` : `שלב ${st}: לא רץ`));
    });
    if (c.strings_checked !== undefined) ul.append(h('li', {}, icon('check'), `${c.strings_checked} מחרוזות נבדקו מול ${c.corpus_runs} רצפים של שש מילים מהראיונות`));
  } else if (key === 'G3' && c.units !== undefined) {
    ul.append(h('li', {}, icon('check'), `${plural(c.units, 'יחידה אחת', 'יחידות')}, ${plural(c.labels, 'תווית אחת', 'תוויות')}, ${plural(c.contrasts, 'ניגוד אחד', 'ניגודים')}, ${plural(c.results, 'תוצאה אחת', 'תוצאות')}`));
    ul.append(h('li', {}, icon('check'), `${plural(c.retained, 'אחד שרד', 'שרדו')}, ${plural(c.removed_at_A, 'זוג אחד הונח בצד', 'הונחו בצד')} בעצירה א, ${plural(c.axes, 'ציר אחד', 'צירים')} (${plural(c.populated, 'אחד מאוכלס', 'מאוכלסים')}, ${plural(c.brittle, 'אחד שביר', 'שבירים')})`));
    ul.append(h('li', {}, icon('check'), `${plural(c.names, 'ציר אחד קיבל', 'צירים קיבלו')} שם, ${plural(c.relations, 'קשר אחד', 'קשרים')}, ${plural(c.paragraphs, 'פסקה אחת', 'פסקאות')}, ${plural(c.markers_checked, 'סימון ציר אחד נבדק', 'סימוני צירים נבדקו')}`));
  }
  if (Array.isArray(g.checks)) {
    g.checks.forEach((ck) => ul.append(h('li', { class: ck.ok ? '' : 'bad' }, icon(ck.ok ? 'check' : 'x'), `${ck.name}${ck.detail ? ` (${ck.detail})` : ''}`)));
  }
  const failures = g.failures || g.misses || [];
  (Array.isArray(failures) ? failures : []).slice(0, 12).forEach((f) => ul.append(h('li', { class: 'bad' }, icon('x'), describe(f))));
  const warnings = Array.isArray(g.warnings) ? g.warnings : [];
  warnings.slice(0, 8).forEach((w) => ul.append(h('li', { class: 'warn' }, icon('alert'), describe(w))));
  return ul;
}

function renderGates(app) {
  const box = clear($('#gates'));
  const gates = app.model.gates || {};
  GATES.forEach(([key, name, about]) => {
    const g = gates[key];
    const has = g && Object.keys(g).length;
    box.append(h('article', { class: 'gate', 'data-gate': key },
      h('div', { class: 'gate-h' }, h('h4', {}, h('span', { class: 'id' }, key), ` ${name}`), statusBadge(has ? g.status : null)),
      h('p', {}, about),
      has ? gateDetails(key, g) : h('p', { class: 'small muted' }, app.mode === 'live' ? 'הבדיקה רצה בסוף ההרצה.' : 'אין תוצאה בקובץ.'),
      has && g.read ? gateRead(g.read, gates.checked_at) : null));
  });
}

// Which files a gate read (CLAUDE.md 3.3c), as a small list rather than one joined developer line.
const READ_WORDS = [[/\s*\(in memory\)\s*$/i, 'בזיכרון'], [/\s*\(embedded\)\s*$/i, 'מוטמע בקובץ']];
function readValue(v) {
  let path = String(v || '');
  let note = '';
  READ_WORDS.forEach(([re, word]) => { if (re.test(path)) { path = path.replace(re, ''); note = word; } });
  return h('dd', {}, path ? h('code', { dir: 'ltr' }, path) : null, note ? ` (${note})` : null);
}
// `checkedAt`: when the gates ran on this record. A file keeps the verdict of the gates as they were then;
// gates made stricter later are not re-run by the page, so the date says which version of the checks spoke.
function gateRead(read, checkedAt) {
  const rows = typeof read === 'string' ? [['מה נבדק', read]] : [['קובץ ההרצה', read.run], ['הראיונות', read.corpus]].filter(([, v]) => v);
  if (!rows.length) return null;
  return h('dl', { class: 'gate-read' }, rows.map(([t, v]) => h('div', {}, h('dt', {}, t), readValue(v))),
    checkedAt ? h('div', {}, h('dt', {}, 'נבדק'), h('dd', {}, fmtDate(checkedAt))) : null);
}

// The prompt layers (D17): names and SHA-256 fingerprints only. The texts are in the booklet (booklet.html), behind
// its code; this page never holds them. Each layer shows the fingerprint the run's own calls recorded for it (what
// the agents actually received), and, when the server has told us today's fingerprints (GET /api/prompts), whether
// the run used today's version, which is the one the booklet shows.
const LAYER_ORDER = ['universal', ...STAGES.map((st) => `stage${String(st.n).padStart(2, '0')}`), 'study'];

function recordedLayers(app) {
  const out = new Map();
  app.model.allCalls.forEach((c) => (Array.isArray(c.layers) ? c.layers : []).forEach((l) => {
    if (!l || typeof l.name !== 'string' || typeof l.sha256 !== 'string') return;
    if (!out.has(l.name)) out.set(l.name, { hashes: new Set(), calls: 0 });
    const r = out.get(l.name);
    r.hashes.add(l.sha256);
    r.calls += 1;
  }));
  return out;
}

function layerHead(name) {
  if (name === 'universal') {
    return [h('span', { class: 'badge badge-cool' }, 'כל השלבים'), h('span', { class: 'ttl' }, h('span', {}, 'השכבה הכללית: כללים שאף שלב אינו יכול להסיר'), h('small', {}, 'universal'))];
  }
  if (name === 'study') {
    return [h('span', { class: 'badge badge-warm' }, 'מחקר'), h('span', { class: 'ttl' }, h('span', {}, 'שכבת המחקר: שאלת המחקר ותיאור הקורפוס'), h('small', {}, 'study'))];
  }
  const st = stageByN(Number(name.slice(5)));
  return [h('span', { class: 'stage-chip', style: { '--hue': st.hue } }, String(st.n)), h('span', { class: 'ttl' }, h('span', {}, st.title), persona(st))];
}

function renderPrompts(app) {
  const box = clear($('#prompts'));
  const recorded = recordedLayers(app);
  const p = app.prompts || {};
  const listed = new Map((p.layers || []).map((l) => [l.name, l.sha256]));
  const today = p.source === 'server' ? listed : null;
  const list = h('ol', { class: 'layer-list' });
  LAYER_ORDER.forEach((name) => {
    const rec = recorded.get(name);
    const hashes = rec ? [...rec.hashes] : (listed.has(name) ? [listed.get(name)] : []);
    const notes = [];
    if (rec) notes.push(h('span', {}, icon('check'), rec.calls === 1 ? 'נרשמה בקריאה אחת בהרצה הזאת' : `נרשמה ב-${rec.calls} קריאות בהרצה הזאת`));
    else if (hashes.length) notes.push(h('span', { class: 'muted' }, app.mode === 'live' ? 'השלב עוד לא רץ; זו הטביעה של ההנחיה בשרת' : 'לא נרשמה בקריאות של ההרצה'));
    if (today && name !== 'study' && hashes.length) {
      notes.push(hashes.every((x) => x === today.get(name))
        ? h('span', { class: 'ok' }, icon('check'), 'זהה להנחיה שבחוברת')
        : h('span', { class: 'warn' }, icon('alert'), 'גרסה קודמת של ההנחיה: החוברת מציגה את הגרסה של היום'));
    }
    if (name !== 'study') {
      const target = name === 'universal' ? 'universal' : `agent-${Number(name.slice(5))}`;
      notes.push(h('a', { href: `booklet.html#bk-${target}`, class: 'layer-link' }, 'ההנחיה המלאה בחוברת'));
    } else {
      notes.push(h('span', { class: 'muted' }, 'נבנית בשרת מתוך שאלת המחקר ותיאור הקורפוס של כל הרצה'));
    }
    list.append(h('li', { class: 'layer', 'data-layer': name },
      h('div', { class: 'layer-h' }, layerHead(name)),
      h('p', { class: 'layer-hash' }, h('span', { class: 'lbl' }, 'טביעת אצבע (SHA-256)'),
        hashes.length ? hashes.map((x) => h('code', { dir: 'ltr', class: 'hash' }, x)) : h('span', { class: 'muted' }, 'אין בקובץ')),
      h('p', { class: 'layer-notes' }, notes)));
  });
  box.append(list);
}

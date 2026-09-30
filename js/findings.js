// Findings: the axis map (stages 5-7), the relations among axes (stage 8), the integrated text (stage 9),
// and the downloads (a readable findings page and the run record).
import { $, h, s, clear, downloadBlob, downloadJson, safeName } from './util.js';
import { icon } from './icons.js';
import { axisGraphic, pointList, relationItem, statusBadge } from './views.js';
import { marked, axisNameSpan } from './model.js';
import { quoteButton } from './reader.js';
import { RELATION_TEXT } from './stages.js';
import { buildFindingsHtml } from './export.js';
import { withMore, openFolds, restoreFolds } from './disclose.js';

export function initFindings(app) {
  const render = () => { renderActions(app); renderAxes(app); renderRelations(app); renderManuscript(app); };
  render();
  app.on('model', render);
  app.on('setaside', () => renderAxes(app));
  app.on('mode', () => renderActions(app));
}

function renderActions(app) {
  const box = clear($('#findings-actions'));
  const m = app.model;
  if (!m.s9) return;
  const status = h('p', { class: 'form-status', role: 'status', id: 'findings-status' });
  const dlHtml = h('button', { type: 'button', class: 'btn btn-ghost btn-sm', id: 'dl-findings' }, icon('download'), 'הורדת הממצאים (דף קריא להדפסה)');
  const dlJson = h('button', { type: 'button', class: 'btn btn-quiet btn-sm', id: 'dl-run-json' }, icon('download'), 'הורדת רשומת ההרצה (קובץ נתונים, JSON)');
  const runId = safeName(m.run && m.run.run_id);
  dlHtml.addEventListener('click', () => {
    const html = buildFindingsHtml(app);
    downloadBlob(new Blob([html], { type: 'text/html;charset=utf-8' }), `mabat-kaful-findings-${runId}.html`);
    status.textContent = 'הקובץ הורד. פתחו אותו בדפדפן; אפשר להדפיס אותו או לשמור כ-PDF.';
  });
  dlJson.addEventListener('click', async () => {
    let record = m.run;
    if (app.mode === 'live' && app.live && app.live.fetchRecord) {
      try { record = await app.live.fetchRecord(); } catch { record = m.run; }
    }
    downloadJson({ corpus: m.corpus, run: record, chosen_names_on_screen: app.chosen }, `mabat-kaful-run-${runId}.json`);
    status.textContent = 'רשומת ההרצה הורדה.';
  });
  box.append(dlHtml, dlJson);
  if (app.live && app.live.kind === 'custom' && app.live.deleteControl) box.append(app.live.deleteControl('findings'));
  box.append(status);
}

function renderAxes(app) {
  const box = $('#axis-map');
  const m = app.model;
  if (!m.hasStage(6)) {
    clear(box);
    box.append(h('p', { class: 'callout' }, app.mode === 'live' ? 'מפת הצירים תופיע כשההרצה החיה תגיע לשלב 6.' : 'אין בקובץ ההרצה צירים.'));
    return;
  }
  const folds = openFolds(box);
  clear(box);
  const core = new Set((m.s8 && m.s8.core_axes) || []);
  const aside = app.mode === 'replay' ? app.asideAxes() : new Set();
  const few = m.axes.length <= 4;
  const card = (a) => {
    const mp = m.midByAxis.get(a.id) || { status: 'brittle', points: [] };
    const nm = m.namesByAxis.get(a.id);
    const brittle = mp.status === 'brittle';
    const pts = mp.points || [];
    // The quotes of the middle points: open on a core axis (or when there are only a few axes), one click
    // away on the others. The numbered dots on the axis open the same quotes in the interview.
    const quotes = pts.length
      ? h('details', { class: 'pts-fold', 'data-key': `pts-${a.id}`, open: few || core.has(a.id) },
        h('summary', {}, icon('chevronDown'), h('span', {}, pts.length === 1 ? 'הציטוט של נקודת האמצע' : `${pts.length} הציטוטים של נקודות האמצע`)),
        pointList(pts, app))
      : null;
    return h('article', { class: `axis-card${aside.has(a.id) ? ' is-setaside' : ''}${core.has(a.id) ? ' is-core' : ''}`, 'aria-labelledby': `axis-h-${a.id}`, 'data-axis': a.id },
      h('header', { class: 'axis-card-h' },
        h('h3', { id: `axis-h-${a.id}` }, axisNameSpan(a.id, app)),
        h('span', { class: 'id' }, a.id),
        core.has(a.id) ? h('span', { class: 'badge badge-warm' }, 'ציר ליבה') : null,
        brittle ? h('span', { class: 'badge badge-quiet' }, 'ציר שביר') : statusBadge('populated', pts.length === 1 ? 'נקודת אמצע אחת' : `${pts.length} נקודות אמצע`),
        aside.has(a.id) ? h('span', { class: 'badge badge-outline' }, 'הנחתם את הזוג שלו בצד בעצירה א') : null),
      h('p', { class: 'axis-def' }, (nm && nm.definition) || a.dimension || ''),
      axisGraphic({ poleA: a.pole_a, poleB: a.pole_b, status: mp.status, points: pts, numbered: true }),
      brittle ? h('p', { class: 'brittle-note' }, icon('info'), mp.note || 'לא נמצאו בנתונים עמדות בין הקצוות.') : null,
      quotes);
  };
  const list = () => h('div', { class: 'axis-list' });
  const coreAxes = m.axes.filter((a) => core.has(a.id));
  const others = m.axes.filter((a) => !core.has(a.id));
  if (coreAxes.length && others.length && !few) {
    const nBrittle = others.filter((a) => m.brittleAxes.has(a.id)).length;
    box.append(
      h('h3', { class: 'axis-group-h' }, `צירי הליבה (${coreAxes.length})`),
      h('p', { class: 'axis-group-sub muted' }, 'הצירים שהסוכן בשלב 8 זיהה כמבנה המרכזי של הממצא.'),
      withMore(coreAxes.map(card), list, { initial: 6, total: (n) => `כל ${n} צירי הליבה`, key: 'axes-core' }),
      h('h3', { class: 'axis-group-h' }, `שאר הצירים (${others.length})`),
      h('p', { class: 'axis-group-sub muted' }, `כל ציר עם ההגדרה שלו, נקודות האמצע והציטוטים.${nBrittle ? ` ${nBrittle === 1 ? 'אחד מהם שביר' : `${nBrittle} מהם שבירים`}: לא נמצאו בנתונים עמדות ביניים.` : ''}`),
      withMore(others.map(card), list, { initial: 3, total: (n) => `כל ${n} הצירים`, key: 'axes-other' }));
  } else {
    box.append(withMore(m.axes.map(card), list, { initial: 5, total: (n) => `כל ${n} הצירים`, key: 'axes-all' }));
  }
  restoreFolds(box, folds);
}

// The axes the diagram draws: those in a relation, and the core axes. An axis in no relation adds a node with
// no line, so on a real run (35 axes, 12 relations) it is left to the list and the axis map.
function diagramAxes(m) {
  const rels = (m.s8 && m.s8.relations) || [];
  const core = new Set((m.s8 && m.s8.core_axes) || []);
  const inRel = new Set();
  rels.forEach((r) => { inRel.add(r.from); inRel.add(r.to); });
  return m.axes.filter((a) => inRel.has(a.id) || core.has(a.id));
}

function relationDiagram(app) {
  const m = app.model;
  const rels = (m.s8 && m.s8.relations) || [];
  const core = new Set((m.s8 && m.s8.core_axes) || []);
  const shown = diagramAxes(m);
  const nAx = Math.max(1, shown.length);
  // Up to eight nodes carry their names; more carry their ids only (the names are in the list beside it,
  // each with its id), because eighteen Hebrew names around one circle overlap whatever the layout.
  const named = nAx <= 8;
  const nodeR = named ? 26 : 19;
  const W = 560;
  let H = 420;
  let cx = W / 2;
  let cy = H / 2 + 6;
  let rx = (Math.min(W, H) / 2 - 92) * 1.3;
  let ry = Math.min(W, H) / 2 - 92;
  if (!named) {
    // a circle big enough for the nodes to keep clear of one another
    const r = Math.min(230, Math.max(150, (nAx * (2 * nodeR + 18)) / (2 * Math.PI)));
    H = Math.round(2 * r + 2 * nodeR + 24);
    cx = W / 2;
    cy = H / 2;
    rx = r;
    ry = r;
  }
  const pos = new Map();
  shown.forEach((a, i) => {
    const ang = -Math.PI / 2 + (i * 2 * Math.PI) / nAx;
    pos.set(a.id, { x: cx + rx * Math.cos(ang), y: cy + ry * Math.sin(ang) });
  });
  const svg = s('svg', { class: `rel-svg${named ? '' : ' is-ids'}`, viewBox: `0 0 ${W} ${H}`, 'aria-hidden': 'true' },
    s('defs', {}, s('marker', { id: 'rel-arrow', viewBox: '0 0 10 10', refX: '9', refY: '5', markerWidth: '7', markerHeight: '7', orient: 'auto-start-reverse' },
      s('path', { d: 'M 0 0 L 10 5 L 0 10 z', fill: 'var(--a8)' }))));
  rels.forEach((r) => {
    const a = pos.get(r.from);
    const b = pos.get(r.to);
    if (!a || !b) return;
    const provisional = m.brittleAxes.has(r.from) || m.brittleAxes.has(r.to);
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const len = Math.hypot(dx, dy) || 1;
    const ux = dx / len;
    const uy = dy / len;
    const p0 = { x: a.x + ux * (nodeR + 6), y: a.y + uy * (nodeR + 6) };
    const p1 = { x: b.x - ux * (nodeR + 6), y: b.y - uy * (nodeR + 6) };
    const cls = `edge ${r.type}${provisional ? ' is-provisional' : ''}`;
    if (r.type === 'parallel') {
      [-4, 4].forEach((o) => svg.append(s('line', { class: cls, x1: p0.x - uy * o, y1: p0.y + ux * o, x2: p1.x - uy * o, y2: p1.y + ux * o })));
    } else {
      svg.append(s('line', { class: cls, x1: p0.x, y1: p0.y, x2: p1.x, y2: p1.y, 'marker-end': r.type === 'hierarchical' ? 'url(#rel-arrow)' : null }));
    }
    const mx = (a.x + b.x) / 2;
    const my = (a.y + b.y) / 2;
    let nx = -uy;
    let ny = ux;
    if (nx * (mx - cx) + ny * (my - cy) < 0) { nx = -nx; ny = -ny; }
    // edge labels only while the picture is small; with many edges the line style carries the type (legend)
    if (named) {
      const off = r.type === 'parallel' ? 34 : 24;
      svg.append(s('text', { class: 'etype', x: mx + nx * off, y: my + ny * off + 4 }, `${RELATION_TEXT[r.type] || r.type}${provisional ? ' (זמני)' : ''}`));
    }
  });
  shown.forEach((a) => {
    const p = pos.get(a.id);
    const g = s('g', { class: `node${core.has(a.id) ? ' core' : ''}${m.brittleAxes.has(a.id) ? ' brittle' : ''}` },
      s('title', {}, `${a.id}: ${app.axisName(a.id)}`),
      s('circle', { cx: p.x, cy: p.y, r: nodeR }),
      s('text', { class: 'nid', x: p.x, y: p.y + 5 }, a.id),
      named ? s('text', { class: 'axis-name', 'data-axis': a.id, x: p.x, y: p.y + (p.y < cy ? -38 : 54) }, app.axisName(a.id)) : null);
    svg.append(g);
  });
  return svg;
}

function renderRelations(app) {
  const box = clear($('#relations'));
  const m = app.model;
  if (!m.s8) {
    if (app.mode === 'live') box.append(h('p', { class: 'callout' }, 'מפת הקשרים תופיע כשההרצה החיה תגיע לשלב 8.'));
    return;
  }
  const shown = diagramAxes(m).length;
  const left = m.axes.length - shown;
  const cons = (m.s8.consolidations || []).filter((c) => (c.axis_ids || []).length);
  box.append(
    h('div', {},
      h('h3', {}, 'איך הצירים קשורים זה לזה'),
      h('p', { class: 'muted' }, 'שלב 8 נעשה בלי הנתונים: הסוכן ראה רק את השמות, ההגדרות, והאם כל ציר אוכלס. מקבילים מתארים אותה דינמיקה מזוויות שונות; ניצבים הם ממדים נפרדים; היררכיים פירושו שציר אחד מעצב את המשמעות של אחר. קשר של ציר שביר הוא זמני.'),
      withMore((m.s8.relations || []).map((r) => relationItem(r, app)), () => h('ul', { class: 'rel-list' }),
        { initial: 5, total: (n) => `כל ${n} הקשרים`, key: 'relations' }),
      cons.length ? h('div', { class: 'rel-cons' },
        h('h4', {}, 'צירים שאוחדו'),
        h('ul', {}, cons.map((c) => h('li', {},
          h('div', { class: 'cons-names' }, (c.axis_ids || []).map((id) => h('span', { class: 'rel-end' }, axisNameSpan(id, app), h('span', { class: 'id' }, id)))),
          c.reason ? h('p', { class: 'rel-note' }, marked(c.reason, app)) : null)))) : null,
      m.s8.structure_note ? h('div', { class: 'structure-box' },
        h('h4', {}, 'המבנה כולו, לפי הסוכן'),
        h('p', { class: 'structure muted' }, marked(m.s8.structure_note, app))) : null),
    h('figure', { class: 'rel-figure' }, relationDiagram(app),
      h('figcaption', { class: 'rel-legend' },
        h('span', { class: 'sr-only' }, 'תרשים של הצירים כצמתים והקשרים ביניהם; אותו מידע מופיע ברשימה. '),
        left > 0 ? h('span', { class: 'rel-left' }, `בתרשים ${shown} הצירים שיש להם קשר או שהם צירי ליבה; ${left === 1 ? 'ציר אחד נוסף' : `${left} צירים נוספים`} בלי קשר ישיר ${left === 1 ? 'מופיע' : 'מופיעים'} במפת הצירים למעלה.`) : null,
        h('span', { class: 'lg-item' }, h('span', { class: 'lg-mark dashed-circle', 'aria-hidden': 'true' }), 'עיגול מקווקו: ציר שביר'),
        h('span', { class: 'lg-item' }, h('span', { class: 'lg-mark dashed-line', 'aria-hidden': 'true' }), 'קו מקווקו: ניצבים'),
        h('span', { class: 'lg-item' }, h('span', { class: 'lg-mark faint-line', 'aria-hidden': 'true' }), 'קו חיוור: קשר זמני'),
        h('span', { class: 'lg-item' }, h('span', { class: 'lg-mark double-line', 'aria-hidden': 'true' }), 'קו כפול: מקבילים'),
        h('span', { class: 'lg-item' }, h('span', { class: 'lg-mark arrow-line', 'aria-hidden': 'true' }), 'חץ: היררכיים'),
        h('span', { class: 'lg-item' }, h('span', { class: 'lg-mark core-circle', 'aria-hidden': 'true' }), 'עיגול כתום: ציר ליבה'))));
}

function renderManuscript(app) {
  const box = clear($('#manuscript'));
  const s9 = app.model.s9;
  if (!s9) {
    box.hidden = app.mode !== 'live';
    if (app.mode === 'live') box.append(h('p', {}, 'הטקסט המסכם יופיע בסוף ההרצה החיה.'));
    return;
  }
  box.hidden = false;
  box.append(
    h('p', { class: 'ms-kicker' }, 'הטקסט המסכם של שלב 9, כפי שכתב אותו הסוכן'),
    h('h3', { class: 'ms-title' }, marked(s9.title || '', app)));
  const secs = s9.sections || [];
  if (secs.length >= 3) {
    box.append(h('nav', { class: 'ms-toc', 'aria-labelledby': 'ms-toc-h' },
      h('p', { class: 'ms-toc-h', id: 'ms-toc-h' }, `בטקסט הזה ${secs.length} חלקים`),
      h('ol', {}, secs.map((sec, i) => h('li', {}, h('a', { href: `#ms-sec-${i + 1}` }, marked(sec.heading || `חלק ${i + 1}`, app)))))));
  }
  secs.forEach((sec, i) => {
    box.append(h('h4', { id: `ms-sec-${i + 1}` }, marked(sec.heading || '', app)));
    (sec.paragraphs || []).forEach((p) => {
      box.append(h('div', { class: 'lp' },
        h('span', { class: 'lp-tag' }, 'טענה'), h('p', { class: 'lp-claim' }, marked(p.claim || '', app)),
        h('span', { class: 'lp-tag' }, 'ציטוט'), h('div', {}, quoteButton(p.quote, app, { variant: 'paper' })),
        h('span', { class: 'lp-tag' }, 'ניתוח'), h('p', { class: 'lp-analysis' }, marked(p.analysis || '', app))));
    });
  });
  if (s9.reflexive_check) {
    box.append(h('div', { class: 'ms-reflexive' },
      h('h4', {}, 'בדיקה רפלקטיבית אחרונה'),
      h('p', {}, marked(s9.reflexive_check, app))));
  }
  // Wording that overclaims, counted by code (engine/signals.mjs, stages[9].signals.overclaim_wording).
  const run = app.model.run;
  const w = run && run.stages && run.stages['9'] && run.stages['9'].signals && run.stages['9'].signals.overclaim_wording;
  if (w && w.stage9) {
    const n = (x) => (x ? x.mechanism + x.development : 0);
    const hits9 = [...(w.stage9.mechanism_hits || []), ...(w.stage9.development_hits || [])].map((x) => `${x.where} ("${x.term}")`).join('; ');
    box.append(h('p', { class: 'callout callout-cool small' },
      n(w.stage9) + n(w.stage6) + n(w.stage8)
        ? `מה הקוד סימן בניסוח: בטקסט הזה מונחים של מנגנון פסיכולוגי ${w.stage9.mechanism} וניסוח של התפתחות ${w.stage9.development}${hits9 ? ` (${hits9})` : ''}; בהערות של שלב 6: ${n(w.stage6)}; במפה של שלב 8: ${n(w.stage8)}. הבדל בין משתתפות אינו התפתחות, ומנגנון פסיכולוגי אינו תיאור של מה שנאמר.`
        : 'מה הקוד סימן בניסוח: אין בטקסט, בהערות של שלב 6 ובמפה של שלב 8 מונחים של מנגנון פסיכולוגי או ניסוח של התפתחות.'));
  }
}

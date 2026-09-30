// Per-stage views used by the run panel: what the agent received, what it returned, its provenance.
// Everything shown comes from the run model; only method explanations are UI text.
import { h, fmtMs, fmtDate, shortHash } from './util.js';
import { icon } from './icons.js';
import { quoteButton, interviewLabel, openInterview, openQuote, parseTurns } from './reader.js';
import { marked, axisNameSpan } from './model.js';
import { stageByN, SIGHT_TEXT, RELATION_TEXT, KIND_TEXT, CHECKPOINTS } from './stages.js';
import { withMore } from './disclose.js';

const clamp01 = (x) => Math.max(0, Math.min(1, Number(x) || 0));

// Hebrew counted nouns for the "show all" buttons ("הצגת כל 45 התוויות").
const ALL = {
  units: (n) => `כל ${n} היחידות`,
  labels: (n) => `כל ${n} התוויות`,
  pairs: (n) => `כל ${n} הזוגות`,
  results: (n) => `כל ${n} התוצאות`,
  axes: (n) => `כל ${n} הצירים`,
  names: (n) => `כל ${n} השמות`,
  relations: (n) => `כל ${n} הקשרים`,
};
const listOf = (tag, cls) => () => h(tag, { class: cls });

export const WHY_BLIND = {
  3: 'כך הניגוד נבנה מהתווית בלבד ולא נמשך אל מה שהנתונים כבר אומרים. לפי המאמר, כשהנתונים גלויים הניגוד נוטה לאשר במקום לבנות (סעיף 5.1).',
  5: 'הציר הוא בנייה תאורטית מעל זוג שכבר אומת. גם הציטוטים שאישרו את הזוג נשארים בחוץ, כדי שהציר לא יתעצב לפיהם. הנתונים חוזרים בשלב 6 (סעיפים 4.5, 5.1).',
  8: 'את היחסים בין הצירים ממפים מהשמות וההגדרות בלבד, בלי לחזור לנתונים או לתוויות. המבנה ייבחן מול הנתונים בשלב 9 (סעיפים 4.8, 5.1).',
};

// ---------- the interview cards: sealed at blind stages, open at the others ----------
export function sealedSet(app, animate) {
  const itvs = app.model.interviews.slice(0, 6);
  const more = app.model.interviews.length - itvs.length;
  return h('div', {
    class: `seal-set sealed${animate ? ' is-sealing' : ''}`,
    role: 'img',
    'aria-label': `${app.model.interviews.length} כרטיסי ראיון חתומים מאחורי זכוכית חלבית: הסוכן בשלב הזה לא רואה את הראיונות`,
  },
  h('div', { class: 'seal-cards', 'aria-hidden': 'true' },
    itvs.map((itv, i) => h('div', { class: 'seal-card' },
      h('strong', {}, interviewLabel(itv)),
      h('div', { class: `lines${i % 2 ? ' short' : ''}` }))),
    more > 0 ? h('div', { class: 'seal-card' }, h('strong', {}, `ועוד ${more}`)) : null),
  h('div', { class: 'seal-glass', 'aria-hidden': 'true' },
    h('span', { class: 'seal-eye' }, icon('eyeOff')),
    h('p', { class: 'seal-title' }, 'הסוכן לא רואה את הראיונות')));
}

function firstAnswer(itv) {
  const a = parseTurns(itv.text).find((t) => t.who === 'a');
  const s = a ? a.text : String(itv.text || '');
  return s.length > 140 ? `${s.slice(0, 140)}...` : s;
}

function openCards(app) {
  return h('div', { class: 'open-set' }, app.model.interviews.map((itv) => {
    const b = h('button', { type: 'button', class: 'open-card', 'aria-label': `פתיחת הראיון עם ${interviewLabel(itv)}` },
      h('strong', {}, interviewLabel(itv), h('span', { class: 'id' }, itv.id)),
      h('span', { class: 'ex', 'aria-hidden': 'true' }, firstAnswer(itv)));
    b.addEventListener('click', () => openInterview(itv.id, b));
    return b;
  }));
}

function fragments(texts, more) {
  return h('div', { class: 'frag-list' },
    texts.map((t) => h('span', { class: 'frag' }, t)),
    more > 0 ? h('span', { class: 'frag-more' }, `ועוד ${more}`) : null);
}

function chips(items, total = ALL.labels) {
  return withMore(items.map((t) => h('span', { class: 'chip' }, t)), listOf('div', 'chips'), { initial: 12, slack: 4, total });
}

function keptPairs(m) {
  return m.results
    .filter((r) => r.verdict === 'retained' && !m.removed.has(r.contrast_id))
    .map((r) => m.pairOf(r.contrast_id))
    .filter(Boolean);
}

export function renderReceived(n, app, animate) {
  const m = app.model;
  const calls = m.calls(n);
  const input = calls[0] && calls[0].input ? calls[0].input : {};
  const box = h('div', {});
  switch (n) {
    case 1:
      box.append(openCards(app), h('p', { class: 'recv-line' }, `${calls.filter((c) => c.repair_of === undefined).length || m.interviews.length} קריאות למודל, אחת לכל ראיון, כל ראיון בטקסט מלא.`));
      break;
    case 2: {
      const qs = m.units.map((u) => u.quote);
      box.append(fragments(qs.slice(0, 4), qs.length - 4),
        h('p', { class: 'recv-line' }, `${m.units.length} יחידות משמעות, כל אחת בנפרד. שאר הטקסט של הראיונות לא נשלח.`));
      break;
    }
    case 3: {
      const labels = Array.isArray(input.labels) ? input.labels.map((l) => l.label) : m.labels.map((l) => l.label);
      box.append(sealedSet(app, animate),
        h('p', { class: 'sealed-why' }, WHY_BLIND[3]),
        h('p', { class: 'recv-line' }, `מה כן קיבל: ${labels.length} תוויות, בלי המשפטים שמהם נגזרו.`), chips(labels));
      break;
    }
    case 4:
      box.append(openCards(app), h('p', { class: 'recv-line' }, `ועוד ${m.contrasts.length} זוגות של תווית וניגוד לבדיקה.`));
      break;
    case 5: {
      const pairs = Array.isArray(input.pairs) ? input.pairs.map((p) => ({ label: p.label, antithesis: p.antithesis })) : keptPairs(m);
      box.append(sealedSet(app, animate),
        h('p', { class: 'sealed-why' }, WHY_BLIND[5]),
        h('p', { class: 'recv-line' }, `מה כן קיבל: ${pairs.length} זוגות ששרדו, בלי הציטוטים שאישרו אותם.`),
        chips(pairs.map((p) => `${p.label} / ${p.antithesis}`), ALL.pairs));
      break;
    }
    case 6:
      box.append(openCards(app), h('p', { class: 'recv-line' }, `ועוד ${m.axes.length} צירים שבהם מחפשים את האמצע.`));
      break;
    case 7: {
      const qs = m.midpoints.flatMap((mp) => (mp.points || []).map((p) => p.quote));
      box.append(fragments(qs.slice(0, 4), qs.length - 4),
        h('p', { class: 'recv-line' }, `${m.axes.length} צירים ו-${qs.length} נקודות אמצע עם הציטוטים שלהן. שאר הראיונות לא נשלחו.`));
      break;
    }
    case 8: {
      const recorded = Array.isArray(input.axes) && input.axes.every((a) => a && a.name)
        ? input.axes.map((a) => `${a.name}${a.status === 'brittle' ? ' (ציר שביר)' : ''}`)
        : m.axes.map((a) => app.axisName(a.id));
      box.append(sealedSet(app, animate),
        h('p', { class: 'sealed-why' }, WHY_BLIND[8]),
        h('p', { class: 'recv-line' }, `מה כן קיבל: ${recorded.length} שמות של צירים, ההגדרות שלהם, והאם כל ציר אוכלס בשלב 6. השמות הם אלה שנשלחו בהרצה.`),
        chips(recorded, ALL.names));
      break;
    }
    case 9:
      box.append(openCards(app), h('p', { class: 'recv-line' }, 'הכול: הראיונות, הצירים, השמות שנבחרו, נקודות האמצע, הקשרים והציטוטים.'));
      break;
    default:
      break;
  }
  return box;
}

// ---------- the axis graphic (signature motif) ----------
// numbered: each middle point carries the number of its quote card in the list below the axis.
export function axisGraphic({ poleA, poleB, status = 'populated', points = [], hypo = [], numbered = false }) {
  const track = h('div', { class: 'axis-track' },
    h('span', { class: 'axis-end a', 'aria-hidden': 'true' }), h('span', { class: 'axis-end b', 'aria-hidden': 'true' }));
  hypo.forEach((_, i) => track.append(h('span', { class: 'axis-pt hypo', 'aria-hidden': 'true', style: { '--pos': (i + 1) / (hypo.length + 1) } })));
  points.forEach((p, i) => {
    const b = h('button', {
      type: 'button', class: 'axis-pt', tabindex: '-1', title: p.quote, 'aria-hidden': 'true',
      style: { '--pos': clamp01(p.position) },
    }, numbered ? h('span', { class: 'pt-n' }, String(i + 1)) : null);
    b.addEventListener('click', () => openQuote(p, b));
    track.append(b);
  });
  return h('div', { class: 'axis', 'data-status': status },
    h('div', { class: 'axis-poles' },
      h('span', { class: 'pa' }, h('small', {}, 'קוטב ראשון'), poleA),
      h('span', { class: 'pb' }, h('small', {}, 'קוטב שני'), poleB)),
    track);
}

// The quote cards of an axis's middle points, numbered as the dots on the axis above them. The exact
// position (0 = first pole, 1 = second) stays available as a tooltip.
export function pointList(points, app) {
  return h('ol', { class: 'pt-list' }, points.map((p, i) =>
    h('li', { class: 'pt-item' },
      h('span', { class: 'pt-num', title: `נקודה ${i + 1} על הציר. מיקום ${clamp01(p.position).toFixed(2)}, כש-0 הוא הקוטב הראשון ו-1 השני` }, String(i + 1)),
      h('div', {},
        quoteButton(p, app),
        h('p', { class: 'pt-note' }, p.kind ? h('span', { class: 'badge badge-warm' }, KIND_TEXT[p.kind] || p.kind) : null, p.note || '')))));
}

// ---------- outputs ----------
function pairView(p) {
  return h('div', { class: 'pair' },
    h('div', { class: 'pair-a' }, p.label),
    h('div', { class: 'pair-link', 'aria-hidden': 'true' }),
    h('div', { class: 'pair-b' }, p.antithesis));
}

function out1(app) {
  const m = app.model;
  const wrap = h('div', {});
  m.interviews.forEach((itv) => {
    const us = m.units.filter((u) => u.interview_id === itv.id);
    if (!us.length) return;
    wrap.append(h('div', { class: 'out-group' },
      h('h5', { class: 'out-group-h' }, `${interviewLabel(itv)}: ${us.length} יחידות`),
      withMore(us.map((u) => h('li', {},
        quoteButton(u, app, { showSource: false }),
        h('p', { class: 'unit-why' }, h('span', { class: 'id' }, u.id), u.why || ''))),
      listOf('ul', 'unit-list'), { initial: m.interviews.length > 3 ? 2 : 3, total: ALL.units, key: `out1-${itv.id}` })));
  });
  return wrap;
}

function out2(app) {
  const m = app.model;
  return withMore(m.labels.map((l) => {
    const us = (l.unit_ids || []).map((id) => m.unitById.get(id)).filter(Boolean);
    return h('div', { class: 'tag' },
      h('div', { class: 'tag-label' }, l.label),
      h('div', { class: 'tag-meta' }, h('span', { class: 'id' }, l.id), ` ${us.length} יחידות`),
      us.length ? h('details', {}, h('summary', {}, 'הציטוטים שקיבלו את התווית'), us.map((u) => quoteButton(u, app))) : null);
  }), listOf('div', 'tag-grid'), { initial: 12, slack: 3, total: ALL.labels, key: 'out2' });
}

function out3(app) {
  const m = app.model;
  return withMore(m.contrasts.map((c) => {
    const p = m.pairOf(c.id);
    return h('li', {},
      pairView(p),
      h('p', { class: 'pair-note' }, h('span', { class: 'id' }, c.id), ' ', c.rationale || ''));
  }), listOf('ul', 'pair-list'), { initial: 6, total: ALL.pairs, key: 'out3' });
}

// A stage-4 result. `compact`: the pair and its verdict stay in view; the evidence quotes and the agent's
// note sit behind one fold (a real run has dozens of results, each with long quotes).
export function resultItem(r, app, { withRemoveToggle = null, compact = false } = {}) {
  const m = app.model;
  const p = m.pairOf(r.contrast_id) || { label: r.contrast_id, antithesis: '' };
  const removed = m.removed.has(r.contrast_id);
  const aside = app.mode === 'replay' && app.setAside.has(r.contrast_id);
  const kept = r.verdict === 'retained';
  const evidence = (r.evidence || []).map((e) => quoteButton(e, app));
  const note = r.note ? h('p', { class: 'res-note' }, r.note) : null;
  let detail = [evidence, note];
  if (compact && (evidence.length || note)) {
    const n = evidence.length;
    const what = n
      ? `${n === 1 ? 'ציטוט עדות אחד' : `${n} ציטוטי עדות`}${note ? ' והסבר הסוכן' : ''}`
      : 'למה נפל, לפי הסוכן';
    detail = h('details', { class: 'res-fold', 'data-key': `res-${r.contrast_id}` },
      h('summary', {}, icon('chevronDown'), h('span', {}, what)),
      h('div', { class: 'res-fold-body' }, evidence, note));
  }
  const li = h('li', { class: `res${kept ? '' : ' is-dropped'}${removed || aside ? ' is-removed' : ''}${compact ? ' is-compact' : ''}`, 'data-contrast': r.contrast_id },
    h('div', { class: 'res-top' },
      kept
        ? h('span', { class: 'badge badge-ok' }, icon('check'), 'נמצא בנתונים')
        : h('span', { class: 'badge badge-danger' }, icon('x'), 'נפל'),
      removed ? h('span', { class: 'badge badge-warm' }, 'הונח בצד בעצירה א') : null,
      aside && !removed ? h('span', { class: 'badge badge-warm' }, 'הנחתם בצד (אצלכם בלבד)') : null,
      h('span', { class: 'id' }, r.contrast_id)),
    pairView(p),
    detail);
  if (withRemoveToggle) li.append(withRemoveToggle);
  return li;
}

function out4(app) {
  const m = app.model;
  const kept = m.results.filter((r) => r.verdict === 'retained');
  const dropped = m.results.filter((r) => r.verdict !== 'retained');
  return h('div', {},
    h('div', { class: 'summary-counts' },
      h('div', { class: 'count-card ok' }, h('strong', {}, String(kept.length)), h('span', {}, 'ניגודים נמצאו בנתונים')),
      h('div', { class: 'count-card bad' }, h('strong', {}, String(dropped.length)), h('span', {}, 'ניגודים נפלו'))),
    m.pattern ? h('div', { class: 'callout', style: { marginBottom: '16px' } },
      h('h4', {}, 'מה דפוס ההישרדות אומר, לפי הסוכן'), h('p', {}, m.pattern)) : null,
    withMore([...kept, ...dropped].map((r) => resultItem(r, app, { compact: true })), listOf('ul', 'res-list'),
      { initial: 6, total: ALL.results, key: 'out4' }));
}

function out5(app) {
  const m = app.model;
  return withMore(m.axes.map((a) => h('div', { class: 'axis-block' },
    h('div', { class: 'axis-block-h' }, h('h5', { class: 'out-group-h', style: { margin: 0 } }, `ציר ${a.id}`), h('span', { class: 'id' }, a.contrast_id)),
    axisGraphic({ poleA: a.pole_a, poleB: a.pole_b, status: 'hypothetical', hypo: a.hypothetical_positions || [] }),
    h('p', { class: 'axis-dim' }, a.dimension || ''),
    (a.hypothetical_positions || []).length
      ? h('div', {}, h('p', { class: 'small muted', style: { margin: '10px 0 0' } }, 'עמדות משוערות (ניחוש תאורטי, לא ממצא):'),
        h('ul', { class: 'hypo-list' }, a.hypothetical_positions.map((t) => h('li', {}, t))))
      : null)), listOf('div', 'axis-blocks'), { initial: 4, total: ALL.axes, key: 'out5' });
}

// A brittle axis is information about the construction, not an error: a quiet dashed badge, not red.
export function statusBadge(status, populatedText = 'מאוכלס') {
  return status === 'brittle'
    ? h('span', { class: 'badge badge-quiet' }, 'ציר שביר: אין נקודות אמצע')
    : h('span', { class: 'badge badge-kept' }, icon('check'), populatedText);
}

function out6(app) {
  const m = app.model;
  return withMore(m.axes.map((a) => {
    const mp = m.midByAxis.get(a.id) || { status: 'brittle', points: [] };
    return h('div', { class: 'axis-block' },
      h('div', { class: 'axis-block-h' }, h('h5', { class: 'out-group-h', style: { margin: 0 } }, `ציר ${a.id}`), statusBadge(mp.status)),
      axisGraphic({ poleA: a.pole_a, poleB: a.pole_b, status: mp.status, points: mp.points || [], numbered: true }),
      mp.note ? h('p', { class: 'axis-dim' }, mp.note) : null,
      (mp.points || []).length ? pointList(mp.points, app) : null);
  }), listOf('div', 'axis-blocks'), { initial: 3, total: ALL.axes, key: 'out6' });
}

function out7(app) {
  const m = app.model;
  return withMore(m.names.map((n) => h('div', { class: 'axis-block' },
    h('div', { class: 'axis-block-h' }, h('h5', { class: 'out-group-h', style: { margin: 0 } }, `ציר ${n.axis_id}`)),
    h('p', { class: 'axis-dim', style: { marginTop: 0, marginBottom: '10px' } }, n.definition || ''),
    h('ol', { class: 'cand-list' }, (n.candidates || []).map((c, i) => h('li', {},
      h('div', { class: 'nm-badges' }, h('span', { class: 'cand-name' }, c.name),
        i === n.recommended ? h('span', { class: 'badge badge-cool' }, 'המלצת הסוכן') : null),
      h('p', {}, c.rationale || ''),
      h('p', {}, h('strong', {}, 'האמצע: '), c.covers_middle || '')))))), listOf('div', 'axis-blocks'), { initial: 2, total: ALL.axes, key: 'out7' });
}

const REL_GLYPH = {
  parallel: '<path d="M2 4h28M2 10h28"/>',
  orthogonal: '<path d="M2 11h28M16 11V1"/>',
  hierarchical: '<path d="M2 7h26M23 2l6 5-6 5"/>',
};
export function relGlyph(type) {
  const span = h('span', { class: 'rel-type' });
  const svgWrap = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svgWrap.setAttribute('viewBox', '0 0 32 14');
  svgWrap.setAttribute('class', 'rel-glyph');
  svgWrap.setAttribute('aria-hidden', 'true');
  // constant markup only: the data value is used as a lookup key, never as markup
  svgWrap.innerHTML = Object.prototype.hasOwnProperty.call(REL_GLYPH, type) ? REL_GLYPH[type] : REL_GLYPH.parallel;
  span.append(svgWrap, RELATION_TEXT[type] || type);
  return span;
}

export function relationItem(r, app) {
  const provisional = app.model.brittleAxes.has(r.from) || app.model.brittleAxes.has(r.to);
  return h('li', { class: 'rel-item' },
    h('div', { class: 'rel-top' },
      h('span', { class: 'rel-end' }, axisNameSpan(r.from, app), h('span', { class: 'id' }, r.from)),
      relGlyph(r.type),
      h('span', { class: 'rel-end' }, axisNameSpan(r.to, app), h('span', { class: 'id' }, r.to)),
      provisional ? h('span', { class: 'rel-provisional', title: 'אחד הצירים שביר (שלב 6), ולכן הקשר זמני' }, 'זמני') : null),
    r.note ? h('p', { class: 'rel-note' }, marked(r.note, app)) : null);
}

function out8(app) {
  const s8 = app.model.s8 || {};
  return h('div', {},
    withMore((s8.relations || []).map((r) => relationItem(r, app)), listOf('ul', 'rel-list'), { initial: 5, total: ALL.relations, key: 'out8' }),
    (s8.consolidations || []).length
      ? h('div', { class: 'rel-cons' }, h('h4', {}, 'צירים שאוחדו'),
        h('ul', {}, (s8.consolidations || []).map((c) => h('li', {},
          h('div', { class: 'cons-names' }, (c.axis_ids || []).map((id) => h('span', { class: 'rel-end' }, axisNameSpan(id, app), h('span', { class: 'id' }, id)))),
          c.reason ? h('p', { class: 'rel-note' }, marked(c.reason, app)) : null))))
      : null,
    (s8.core_axes || []).length
      ? h('p', { style: { marginTop: '16px' } }, h('strong', {}, 'צירי ליבה: '), (s8.core_axes || []).map((id, i) => [i ? ', ' : '', axisNameSpan(id, app)]))
      : null,
    // the structure note is long on a real run and is shown in full in the findings; here it is one fold away
    s8.structure_note ? h('details', { class: 'pts-fold', 'data-key': 's8-structure' },
      h('summary', {}, icon('chevronDown'), h('span', {}, 'המבנה כולו, לפי הסוכן')),
      h('p', { class: 'muted s8-structure' }, marked(s8.structure_note, app))) : null);
}

function out9(app) {
  const s9 = app.model.s9 || {};
  const paras = (s9.sections || []).reduce((n, s) => n + (s.paragraphs || []).length, 0);
  return h('div', {},
    h('p', { class: 's9-title', style: { fontFamily: 'var(--f-display)', fontSize: '1.35rem', fontWeight: 700, color: 'var(--text)', lineHeight: 1.35 } }, marked(s9.title || '', app)),
    h('p', { class: 'recv-line' }, `${paras} פסקאות, וכל אחת בנויה משלוש שכבות: טענה, ציטוט, ניתוח. הטענות:`),
    (s9.sections || []).map((s) => h('div', { class: 'out-group' },
      h('h5', { class: 'out-group-h' }, marked(s.heading || '', app)),
      h('ul', { class: 'claim-list' }, (s.paragraphs || []).map((p) => h('li', {}, marked(p.claim || '', app)))))),
    toSection('#findings', 'לטקסט המלא ולמפת הצירים'));
}

export function toSection(target, label) {
  return h('a', { class: 'btn btn-ghost btn-sm to-section', href: target }, label, icon('arrowDown'));
}

const OUT = { 1: out1, 2: out2, 3: out3, 4: out4, 5: out5, 6: out6, 7: out7, 8: out8, 9: out9 };
export function renderOutput(n, app) {
  if (!app.model.hasStage(n)) return h('p', { class: 'pn-empty' }, 'לשלב הזה עוד אין פלט.');
  return OUT[n](app);
}

// ---------- checkpoints inside the panel ----------
// The checkpoint is a decision moment, for the viewer too: a warm callout with the decision as the
// primary action. Replay: the viewer may decide for themselves; live: the run waits for them.
export function renderCheckpointStep(key, app) {
  const cp = CHECKPOINTS[key];
  const m = app.model;
  const box = h('div', {}, h('p', { class: 'pn-intro' }, cp.about));
  const recorded = key === 'A' ? m.cpA : m.cpB;
  const ctaLabel = key === 'A' ? 'להחליט בעצמכם: מה להניח בצד' : 'לבחור שם לכל ציר';
  const turn = (lead, rest) => h('div', { class: 'callout callout-warm cp-turn' },
    h('p', {}, h('strong', {}, lead), ' ', rest),
    h('a', { class: 'btn btn-warm', href: cp.target }, ctaLabel, icon('arrowDown')));
  if (app.mode === 'replay') {
    box.append(turn('תורכם.', 'החוקרת עוצרת כאן ומחליטה. אפשר להחליט בעצמכם בחלק של נקודת העצירה, או ללחוץ על הפעלה כדי להמשיך בהרצה.'));
  } else if (!recorded) {
    box.append(turn('ההרצה ממתינה להחלטה שלכם.', 'היא תמשיך רק אחרי שתשלחו אותה.'));
  }
  if (key === 'A') {
    const rec = m.cpA;
    if (rec) {
      const removed = rec.removed_contrast_ids || [];
      box.append(h('div', { class: 'voice voice-human' },
        h('h4', {}, icon('user'), app.mode === 'live' ? 'ההחלטה שלכם' : 'מה החליטה החוקרת בהרצה הזאת'),
        h('p', {}, removed.length
          ? ['הונח בצד: ', removed.map((id, i) => { const p = m.pairOf(id); return [i ? '; ' : '', p ? `${p.label} / ${p.antithesis}` : id]; })]
          : 'לא הונח בצד אף זוג.'),
        rec.reflection && !(rec.decided_by === 'auto' && /^\(auto\)$/i.test(String(rec.reflection).trim())) ? h('p', { class: 'muted' }, rec.reflection) : null,
        h('p', { class: 'by' }, rec.decided_by === 'human' ? 'הוחלט בידי אדם' : 'הוחלט אוטומטית')));
    }
    if (app.mode === 'live' && rec) box.append(toSection('#checkpoint-a', 'לנקודת העצירה המלאה'));
  } else {
    box.append(withMore(m.axes.map((a) => h('li', { class: 'rel-item' },
      h('div', { class: 'rel-top' }, h('span', { class: 'id' }, a.id), axisNameSpan(a.id, app)))),
    listOf('ul', 'rel-list'), { initial: 8, total: ALL.axes, key: 'stepB' }));
    if (app.mode === 'live' && m.cpB) box.append(toSection('#checkpoint-b', 'לשמות שנבחרו'));
  }
  return box;
}

// ---------- provenance ----------
export const FINGERPRINT_TEXT = 'טביעת אצבע: קוד קצר שמחושב מהטקסט עצמו. אם משתנה בטקסט אות אחת, הקוד משתנה, וכך אפשר להוכיח איזו הנחיה ואיזה קלט בדיוק קיבל כל סוכן.';
export function provenanceFold(calls, { title = 'תיעוד הקריאה למודל' } = {}) {
  const fold = h('details', { class: 'fold prov-card' });
  const summary = h('summary', {}, icon('fingerprint'), `${title} (${calls.length})`);
  const body = h('div', { class: 'fold-body' });
  fold.append(summary, body);
  let filled = false;
  fold.addEventListener('toggle', () => {
    if (!fold.open || filled) return;
    filled = true;
    calls.forEach((c, i) => {
      if (calls.length > 1) body.append(h('p', { class: 'out-group-h' }, `קריאה ${i + 1}${c.repair_of !== undefined ? ' (תיקון)' : ''}`));
      body.append(h('dl', {},
        dlItem('מודל', h('bdi', {}, `${c.provider || ''} / ${c.model || ''}`)),
        dlItem('ראה נתונים', c.sees_data ? 'כן' : 'לא'),
        dlItem('משך', fmtMs(c.duration_ms)),
        dlItem('ניסיונות', String(c.attempts ?? '')),
        dlItem('התחלה', fmtDate(c.started_at)),
        dlItem('טביעת אצבע של ההנחיה', h('span', { class: 'id', title: c.system_prompt_sha256 || '' }, shortHash(c.system_prompt_sha256, 16))),
        dlItem('טביעת אצבע של הקלט', h('span', { class: 'id', title: c.input_sha256 || '' }, shortHash(c.input_sha256, 16))),
        c.usage && Object.keys(c.usage).length ? dlItem('טוקנים (יחידות הטקסט שהמודל סופר)', h('span', { class: 'id' }, Object.entries(c.usage).map(([k, v]) => `${k}: ${v}`).join('  '))) : null),
        (c.layers || []).length ? h('ul', { class: 'layer-list' }, c.layers.map((l) => h('li', { class: 'chip' }, h('bdi', {}, l.name), ' ', h('span', { class: 'id', title: l.sha256 }, shortHash(l.sha256, 8))))) : null);
      if (i === 0) body.append(h('p', { class: 'small muted prov-explain' }, FINGERPRINT_TEXT));
      const inputFold = h('details', { class: 'fold', style: { marginBottom: '12px' } }, h('summary', {}, 'הקלט המדויק שנשלח'));
      const inputBody = h('div', { class: 'fold-body' });
      inputFold.append(inputBody);
      inputFold.addEventListener('toggle', () => {
        if (inputFold.open && !inputBody.firstChild) inputBody.append(h('pre', { class: 'code', dir: 'ltr', tabindex: '0', 'aria-label': 'הקלט המדויק שנשלח' }, JSON.stringify(c.input, null, 2)));
      });
      body.append(inputFold);
    });
  });
  return fold;
}

function dlItem(term, value) {
  return h('div', {}, h('dt', {}, term), h('dd', {}, value));
}

export function sightOf(n, app) {
  const st = stageByN(n);
  const calls = app.model.calls(n);
  if (calls.length && calls.every((c) => c.sees_data === false)) return 'none';
  if (calls.length && st.sight === 'none' && calls.some((c) => c.sees_data)) return 'full';
  return st.sight;
}

export { SIGHT_TEXT };

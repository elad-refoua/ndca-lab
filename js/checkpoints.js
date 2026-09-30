// Checkpoint A (after stage 4) and checkpoint B (within stage 7): paper section 5.3.
// Replay: the recorded decision is shown; the viewer's own reflection, set-aside pairs and name
// choices stay in this browser. Live: the same views submit the decision to the local server.
import { $, $$, h, clear, store, debounce, announce } from './util.js';
import { icon } from './icons.js';
import { resultItem, axisGraphic } from './views.js';
import { axisNameSpan } from './model.js';
import { withMore, openFolds, restoreFolds } from './disclose.js';

const REFLECTION_KEY = 'mabat-kaful:reflection-a';

// Where an axis name appears outside checkpoint B, named for the person who just chose it.
const PLACES = [['#axis-map', 'מפת הצירים'], ['#relations', 'הקשרים בין הצירים'], ['#manuscript', 'הטקסט המסכם'], ['#run-panel', 'ההרצה']];

export function initCheckpoints(app) {
  const renderAll = () => { renderA(app); renderB(app); };
  renderAll();
  app.on('model', renderAll);
  app.on('setaside', () => renderA(app, { keepFocus: true }));
  // after each choice at checkpoint B: say where the new name now appears, and link to it
  app.on('names', (id) => {
    const box = document.getElementById(`nm-status-${id}`);
    if (!box) return;
    const outside = $$(`.axis-name[data-axis="${CSS.escape(id)}"]`).filter((el) => !el.closest('#cpb-body'));
    const where = PLACES.filter(([sel]) => outside.some((el) => el.closest(sel))).map(([, name]) => name);
    clear(box);
    if (!outside.length) return;
    const text = `השם עודכן ב-${outside.length} מקומות בהמשך${where.length ? `: ${where.join(', ')}` : ''}.`;
    box.append(icon('check'), h('span', {}, text), ' ',
      document.getElementById(`axis-h-${id}`) ? h('a', { href: `#axis-h-${id}` }, 'לראות בממצאים') : null);
    announce(text);
  });
}

// An automatic checkpoint records the placeholder "(auto)" as its reflection; it is not a person's words.
export function realReflection(cp) {
  const t = cp && typeof cp.reflection === 'string' ? cp.reflection.trim() : '';
  return t && !(cp.decided_by === 'auto' && /^\(auto\)$/i.test(t)) ? t : '';
}

function notYet(text) {
  return h('p', { class: 'callout' }, text);
}

function pairText(m, id) {
  const p = m.pairOf(id);
  return p ? `${p.label} / ${p.antithesis}` : id;
}

// Facts counted by code beside the agent's reading (engine/signals.mjs, run.stages[4].signals; ARCHITECTURE
// 3.4 checkpoint A). Nothing is shown for a run file made before these were recorded.
function factsA(m) {
  const s = m.run && m.run.stages && m.run.stages['4'] && m.run.stages['4'].signals;
  if (!s) return null;
  const pseud = (id) => { const iv = m.interviewById.get(id); return iv && iv.pseudonym ? `${iv.pseudonym} (${id})` : id; };
  const ids = (list) => (list && list.length ? list.map((id) => pairText(m, id)).join('; ') : 'אין');
  const items = [
    `מספר הראיונות: ${s.interviews}. לפי המאמר הרצפה היא כעשרה ראיונות מורחבים${s.below_floor ? ', והקורפוס הזה מתחתיה: ניגוד שנפל עשוי להעיד על דלות החומר ולא על היעדר.' : '.'}`,
    `שרדו ${s.retained} מתוך ${s.contrasts} ניגודים (${Math.round((s.survival_rate || 0) * 100)}%).`,
    `ציטוטי עדות לפי ראיון: ${Object.entries(s.evidence_per_interview || {}).map(([id, n]) => `${pseud(id)} ${n}`).join(', ')}.`,
    `קטעים שמעגנים יותר מניגוד אחד: ${(s.passages_for_several_contrasts || []).length}.`,
    `עדות שהסוכן לקח מתוך היחידה של התווית עצמה, או מהמשפטים שלפניה או אחריה באותה תשובה (הם מעגנים את התווית ולא את הניגוד): הוצעה ${s.label_unit_evidence ? s.label_unit_evidence.offered_in_first_reply : 0} פעמים; זוגות שהקוד הוריד אחרי התיקון: ${(s.demoted_by_code || []).length}.`,
    `ניגודים ששרדו ובהם מילים של "תרופה" או מיומנות (פיתוח, יכולת, מיומנות, גמיש...): ${s.remedy_antitheses_retained ? s.remedy_antitheses_retained.count : 0}. ${ids(s.remedy_antitheses_retained && s.remedy_antitheses_retained.ids)}`,
    `ניגודים ששרדו ושומרים חצי ממילות התווית, אולי היפוך לוגי: ${s.possible_logical_opposites ? s.possible_logical_opposites.count : 0}. ${ids(s.possible_logical_opposites && s.possible_logical_opposites.ids)}`,
  ];
  return h('div', { class: 'callout callout-cool cpa-facts' },
    h('h3', {}, 'מה הקוד ספר, בלי פרשנות'),
    h('p', { class: 'small muted' }, 'עובדות שחושבו מההרצה עצמה, לצד הקריאה של הסוכן. הן מראות איפה כדאי להסתכל; ההחלטה שלכם.'),
    h('ul', {}, items.map((t) => h('li', {}, t))));
}

// ---------- A ----------
function renderA(app, { keepFocus = false } = {}) {
  const body = $('#cpa-body');
  const focusedId = keepFocus && document.activeElement && body.contains(document.activeElement) ? document.activeElement.id : null;
  const folds = openFolds(body);
  clear(body);
  const m = app.model;
  if (!m.hasStage(4)) {
    body.append(notYet(app.mode === 'live' ? 'ההרצה החיה עוד לא הגיעה לכאן. נקודת העצירה תיפתח כשהסוכן בשלב 4 יסיים.' : 'אין בקובץ ההרצה פלט של שלב 4.'));
    return;
  }
  const live = app.mode === 'live';
  const awaiting = live && !m.cpA && app.live && app.live.awaiting === 'A';
  const kept = m.results.filter((r) => r.verdict === 'retained');
  const dropped = m.results.filter((r) => r.verdict !== 'retained');
  const liveRemove = new Map();

  const keptItems = kept.map((r) => {
    let toggle = null;
    const id = `aside-${r.contrast_id}`;
    if (awaiting) {
      const cb = h('input', { type: 'checkbox', id, value: r.contrast_id });
      liveRemove.set(r.contrast_id, cb);
      toggle = h('label', { class: 'check res-remove', for: id }, cb, h('span', {}, 'להניח את הזוג בצד: זה היפוך לוגי ולא חלופה תאורטית'));
    } else if (!live) {
      const cb = h('input', { type: 'checkbox', id, value: r.contrast_id, checked: app.setAside.has(r.contrast_id) });
      cb.addEventListener('change', () => app.toggleSetAside(r.contrast_id, cb.checked));
      toggle = h('label', { class: 'check res-remove', for: id }, cb, h('span', {}, 'הייתי מניח/ה את הזוג בצד: זה היפוך לוגי ולא חלופה תאורטית'));
    }
    return resultItem(r, app, { withRemoveToggle: toggle, compact: true });
  });
  const resList = () => h('ul', { class: 'res-list' });

  body.append(
    h('div', { class: 'cpa-grid' },
      h('div', { class: 'cpa-col cpa-kept' },
        h('h3', {}, h('span', { class: 'n' }, String(kept.length)), 'נמצאו בנתונים ושרדו'),
        withMore(keptItems, resList, { initial: 6, total: (n) => `כל ${n} הזוגות ששרדו`, key: 'cpa-kept' })),
      h('div', { class: 'cpa-col cpa-dropped' },
        h('h3', {}, h('span', { class: 'n' }, String(dropped.length)), 'לא נמצאה להם עדות, ונפלו'),
        withMore(dropped.map((r) => resultItem(r, app, { compact: true })), resList,
          { initial: 6, total: (n) => `כל ${n} הזוגות שנפלו`, key: 'cpa-dropped' }))));

  const lower = h('div', { class: 'cpa-lower' });
  lower.append(h('div', { class: 'voice voice-agent' },
    h('h3', {}, icon('cpu'), 'מה הדפוס אומר, לפי הסוכן'),
    h('p', {}, m.pattern || 'הסוכן לא החזיר סיכום דפוס.')));
  const facts = factsA(m);
  if (facts) lower.append(facts);
  if (m.cpA) {
    const removed = m.cpA.removed_contrast_ids || [];
    lower.append(h('div', { class: 'voice voice-human' },
      h('h3', {}, icon('user'), live ? 'ההחלטה שלכם' : 'מה החליטה החוקרת בהרצה הזאת'),
      h('p', {}, removed.length ? ['הונח בצד: ', removed.map((id, i) => [i ? '; ' : '', pairText(m, id)])] : 'לא הונח בצד אף זוג.'),
      realReflection(m.cpA) ? h('p', {}, m.cpA.reflection) : null,
      h('p', { class: 'by' }, m.cpA.decided_by === 'human' ? 'הוחלט בידי אדם' : 'הוחלט אוטומטית, בלי חוקרת')));
  }
  body.append(lower);

  // the viewer's own reflection
  const saved = live ? '' : store.get(REFLECTION_KEY, '');
  const status = h('p', { class: 'form-status', role: 'status' });
  const ta = h('textarea', { class: 'ta', id: 'reflection-a', placeholder: 'מה הפתיע אותך? איזה ניגוד נפל, ולמה אולי לא דמיינו אותו ברצינות?' });
  ta.value = typeof saved === 'string' ? saved : '';
  if (app.live && typeof app.live.draftReflection === 'string') ta.value = app.live.draftReflection;
  const persist = debounce(() => {
    if (live) { if (app.live) app.live.draftReflection = ta.value; return; }
    const ok = store.set(REFLECTION_KEY, ta.value);
    status.textContent = ok ? 'נשמר בדפדפן שלכם בלבד.' : 'הדפדפן חוסם שמירה מקומית; הטקסט יאבד ברענון.';
    status.classList.toggle('is-error', !ok);
  }, 400);
  ta.addEventListener('input', persist);

  const yours = h('div', { class: 'yours' },
    h('h3', {}, live ? 'הרפלקציה שלכם, לפני שההרצה ממשיכה' : 'והרפלקציה שלכם'),
    h('p', { class: 'muted' }, live
      ? `המאמר מבקש לכתוב כאן, לא לחשוב בלב: איזה דפוס עולה מהניגודים ששרדו ומאלה שנפלו, ומה הוא אומר על ההנחות שנכנסו לניתוח. הטקסט נשמר ברשומת ההרצה ${app.health && app.health.remote ? 'בשרת' : 'בשרת המקומי'}.`
      : 'המאמר מבקש לכתוב כאן, לא לחשוב בלב: איזה דפוס עולה מהניגודים ששרדו ומאלה שנפלו, ומה הוא אומר על ההנחות שנכנסו לניתוח. הטקסט נשמר רק בדפדפן שלכם.'),
    h('div', { class: 'field' }, h('label', { for: 'reflection-a', class: 'sr-only' }, 'הרפלקציה שלכם על נקודת עצירה א'), ta),
    status);

  if (!live && app.setAside.size) {
    yours.append(h('div', { class: 'callout callout-warm setaside-note', id: 'setaside-note', role: 'note' },
      h('p', {}, h('strong', {}, 'ההחלטה שלכם נרשמה בדפדפן הזה בלבד. '),
        `הנחתם בצד: ${[...app.setAside].map((id) => pairText(m, id)).join('; ')}.`),
      h('p', {}, 'שלבים 5 עד 9 שמוצגים כאן הוקלטו בלי ההחלטה הזאת, ולכן ציר שנבנה מזוג כזה עדיין מופיע בהם, מסומן. כדי לראות את ההשפעה שלה צריך להריץ את השיטה מחדש.')));
  }

  if (awaiting) {
    const submit = h('button', { type: 'button', class: 'btn btn-warm', id: 'cpa-submit', disabled: true }, 'שליחת ההחלטה והמשך ההרצה');
    const liveStatus = h('p', { class: 'form-status', role: 'status' });
    const hint = h('p', { class: 'small muted', style: { margin: 0 } }, 'כדי להמשיך צריך לכתוב רפלקציה, ולהשאיר לפחות זוג אחד שממנו ייבנו צירים.');
    const refresh = () => {
      const removedCount = [...liveRemove.values()].filter((cb) => cb.checked).length;
      const tooMany = kept.length > 0 && removedCount >= kept.length;
      submit.disabled = !ta.value.trim() || tooMany;
      liveStatus.textContent = tooMany ? 'אי אפשר להניח בצד את כל הזוגות: לפחות אחד צריך להישאר.' : '';
      liveStatus.classList.toggle('is-error', tooMany);
    };
    ta.addEventListener('input', refresh);
    liveRemove.forEach((cb) => cb.addEventListener('change', refresh));
    submit.addEventListener('click', async () => {
      submit.disabled = true;
      liveStatus.classList.remove('is-error');
      liveStatus.textContent = 'שולח...';
      try {
        await app.live.submitA({
          reflection: ta.value.trim(),
          removed_contrast_ids: [...liveRemove.entries()].filter(([, cb]) => cb.checked).map(([id]) => id),
        });
      } catch (e) {
        liveStatus.textContent = e.message;
        liveStatus.classList.add('is-error');
        submit.disabled = false;
      }
    });
    yours.append(h('div', { class: 'live-cp-actions' }, submit, hint, liveStatus));
    refresh();
  } else {
    yours.append(h('div', { class: 'live-cp-actions' },
      h('a', { class: 'btn btn-ghost', href: '#run' }, icon('arrowUp'), 'חזרה להרצה')));
  }
  body.append(yours);
  restoreFolds(body, folds);
  if (focusedId) { const el = document.getElementById(focusedId); if (el) el.focus({ preventScroll: true }); }
}

// ---------- B ----------
// Checkpoint-B flags written by code (engine/stages.mjs nameFormProblems, engine/signals.mjs).
const FLAG_SHORT = {
  name_transition: 'שם של מעבר', name_versus: 'שם של שני קצוות', name_between_frame: 'שם של שני קצוות',
  name_between: 'שם של שני קצוות', name_latin: 'אותיות לטיניות', name_both_ends: 'שם של שני קצוות',
  attribution_to_verify: 'ייחוס לבדיקה',
};
const FLAG_TEXT = {
  name_transition: 'השם מתאר תנועה מקוטב לקוטב (המעבר מ...), ולא את הממד עצמו.',
  name_versus: 'השם בנוי כ"X מול Y" או "X לעומת Y", כלומר מתאר את שני הקצוות ולא את מה שמשתנה ביניהם.',
  name_between_frame: 'השם פותח ב"ההבחנה/הדיכוטומיה/הדיאלקטיקה/המתח בין", כלומר מתאר את שני הקצוות.',
  name_between: 'השם בנוי כ"בין X ל-Y", כלומר מתאר את שני הקצוות.',
  name_latin: 'בשם יש אותיות לטיניות; מונח באנגלית שייך להסבר.',
  name_both_ends: 'השם לוקח מילה מכל אחד משני הקטבים, כלומר מתאר את הקצוות.',
  attribution_to_verify: 'ההסבר מייחס את המונח לאדם בשם. שום דבר בהרצה לא יכול לאמת את הייחוס הזה; כדאי לבדוק לפני שבוחרים.',
};
const AXIS_FLAG_TEXT = {
  pole_b_contested: 'שימו לב: העדות היחידה לקוטב ב\' נקראה בשלב 6 כנקודת אמצע, כך שייתכן שלקוטב ב\' אין מופע משלו בנתונים.',
  pole_a_missing: 'שימו לב: בשלב 6 לא נמצא מופע לקוטב א\' בנתונים.',
  pole_b_missing: 'שימו לב: בשלב 6 לא נמצא מופע לקוטב ב\' בנתונים.',
};

function renderB(app) {
  const folds = openFolds($('#cpb-body'));
  const body = clear($('#cpb-body'));
  const m = app.model;
  if (!m.hasStage(7)) {
    body.append(notYet(app.mode === 'live' ? 'ההרצה החיה עוד לא הגיעה לכאן. בחירת השמות תיפתח כשהסוכן בשלב 7 יציע אותם.' : 'אין בקובץ ההרצה פלט של שלב 7.'));
    return;
  }
  const live = app.mode === 'live';
  const awaiting = live && !m.cpB && app.live && app.live.awaiting === 'B';
  const locked = live && !!m.cpB;
  // Flags counted by code (engine/signals.mjs, run.stages[7].signals and [5].signals; ARCHITECTURE 3.4 stage 7).
  const st = (n) => (m.run && m.run.stages && m.run.stages[String(n)] && m.run.stages[String(n)].signals) || null;
  const sig7 = st(7);
  const sig5 = st(5);
  if (sig5 && sig5.ranked_dimensions) {
    body.append(h('p', { class: 'callout callout-cool small' },
      `צירים שהממד שלהם מדרג את הקצוות (מילת חסר בקצה אחד ומילת כשירות בשני, ולכן עלול להפוך לסולם): ${sig5.ranked_dimensions.count} מתוך ${sig5.axes}${sig5.ranked_dimensions.count ? `: ${sig5.ranked_dimensions.ids.join(', ')}` : ''}.`));
  }
  // Stage-6 notes that name a psychological mechanism or read a difference as development (engine/signals.mjs).
  const w6 = st(6) && st(6).overclaim_wording;
  if (w6 && (w6.mechanism || w6.development)) {
    const where = [...(w6.mechanism_hits || []), ...(w6.development_hits || [])].map((x) => `${x.where} ("${x.term}")`).join('; ');
    body.append(h('p', { class: 'callout callout-cool small' },
      `בהערות של שלב 6, שעליהן נשענים השמות: מונחים של מנגנון פסיכולוגי ${w6.mechanism}, ניסוח של התפתחות ${w6.development}. ${where}.`));
  }

  const fewAxes = m.axes.length <= 4;
  const rows = m.axes.map((axis) => {
    const entry = m.namesByAxis.get(axis.id);
    if (!entry) return null;
    const mp = m.midByAxis.get(axis.id) || { status: 'brittle', points: [] };
    const current = app.axisName(axis.id);
    const recorded = app.recordedName(axis.id);
    const recordedSource = m.cpB && m.cpB.chosen && m.cpB.chosen[axis.id] ? m.cpB.chosen[axis.id].source : null;
    const group = `nm-${axis.id}`;
    const cands = entry.candidates || [];
    const matchIdx = cands.findIndex((c) => c.name === current);

    const options = h('div', { class: 'nm-options', role: 'radiogroup', 'aria-label': `שם לציר ${axis.id}` });
    cands.forEach((c, i) => {
      const id = `${group}-${i}`;
      const input = h('input', { type: 'radio', name: group, id, value: c.name, checked: i === matchIdx, disabled: locked });
      input.addEventListener('change', () => { if (input.checked) app.choose(axis.id, c.name, 'candidate'); });
      options.append(h('label', { class: 'nm-opt', for: id }, input,
        h('span', { class: 'nm-card' },
          h('span', { class: 'nm-name' }, c.name),
          h('span', { class: 'nm-badges' },
            i === entry.recommended ? h('span', { class: 'badge badge-cool' }, 'המלצת הסוכן') : null,
            recorded === c.name && !live ? h('span', { class: 'badge badge-warm' }, 'בחירת החוקרת בהרצה') : null,
            ...((sig7 && sig7.candidate_flags && sig7.candidate_flags[axis.id] && sig7.candidate_flags[axis.id][i]) || [])
              .map((f) => h('span', { class: 'badge badge-danger', title: FLAG_TEXT[f] || f }, FLAG_SHORT[f] || f))),
          h('span', { class: 'nm-p' }, c.rationale || ''),
          h('span', { class: 'nm-p' }, h('strong', {}, 'האמצע: '), c.covers_middle || ''))));
    });

    // a name of your own
    const customId = `${group}-custom`;
    const customRadio = h('input', { type: 'radio', name: group, value: '__custom', id: customId, checked: matchIdx < 0, disabled: locked });
    const customText = h('input', {
      type: 'text', class: 'tx', maxlength: '120', id: `${customId}-text`, 'aria-label': `שם משלכם לציר ${axis.id}`,
      placeholder: 'כתבו שם לציר כולו', disabled: locked,
    });
    if (matchIdx < 0) customText.value = current;
    else if (recordedSource === 'custom' && recorded) customText.value = recorded;
    const applyCustom = () => { if (customRadio.checked && customText.value.trim()) app.choose(axis.id, customText.value, 'custom'); };
    customRadio.addEventListener('change', applyCustom);
    // Passing through the field with the keyboard changes nothing; typing a name selects "a name of
    // your own". Leaving it empty puts the selection back on the name that is actually in use.
    const applySoon = debounce(applyCustom, 300);
    customText.addEventListener('input', () => {
      if (!customText.value.trim()) return;
      customRadio.checked = true;
      applySoon();
    });
    customText.addEventListener('blur', () => {
      if (customText.value.trim() || !customRadio.checked) return;
      const inUse = options.querySelector(`input[type="radio"][value="${CSS.escape(app.axisName(axis.id))}"]`);
      if (inUse) inUse.checked = true;
    });
    options.append(h('div', { class: 'nm-opt nm-custom' }, customRadio,
      h('span', { class: 'nm-card' },
        h('label', { class: 'nm-name', for: customId }, 'שם משלכם'),
        h('span', { class: 'nm-badges' },
          recordedSource === 'custom' && !live ? h('span', { class: 'badge badge-warm' }, 'בחירת החוקרת בהרצה') : null),
        h('span', { class: 'nm-p' }, 'אם אף הצעה לא מכסה את כל הטווח, כולל האמצע, כתבו שם אחר.'),
        customText)));

    const axisFlags = (sig7 && sig7.axis_flags && sig7.axis_flags[axis.id]) || [];
    const nFlagged = ((sig7 && sig7.candidate_flags && sig7.candidate_flags[axis.id]) || []).filter((f) => f && f.length).length;
    // With many axes each one is a short row and its choice sits in a fold; with a few, the fold starts open.
    const choose = h('details', { class: 'nm-choose', 'data-key': `nm-${axis.id}`, open: fewAxes },
      h('summary', {}, icon('chevronDown'),
        h('span', {}, locked ? 'שלוש ההצעות של הסוכן' : 'בחירת שם: שלוש ההצעות של הסוכן, או שם משלכם'),
        nFlagged ? h('span', { class: 'badge badge-danger' }, nFlagged === 1 ? 'הצעה אחת מסומנת' : `${nFlagged} הצעות מסומנות`) : null),
      options);
    return h('fieldset', { class: 'nm-axis', 'data-axis': axis.id },
      h('legend', {}, `ציר ${axis.id}`),
      h('p', { class: 'nm-current' }, h('span', { class: 'nm-current-k' }, 'השם שמופיע עכשיו בהמשך'), axisNameSpan(axis.id, app)),
      h('p', { class: 'nm-status', id: `nm-status-${axis.id}` }),
      h('p', { class: 'nm-def' }, entry.definition || axis.dimension || ''),
      axisFlags.length ? h('p', { class: 'callout callout-warm small' }, axisFlags.map((f) => AXIS_FLAG_TEXT[f] || f).join(' ')) : null,
      axisGraphic({ poleA: axis.pole_a, poleB: axis.pole_b, status: mp.status, points: mp.points || [] }),
      choose);
  }).filter(Boolean);

  if (!fewAxes) {
    body.append(h('p', { class: 'nm-lead muted' }, awaiting
      ? `${rows.length} צירים. לכל ציר נבחר כרגע השם שהסוכן המליץ עליו; פתחו ציר כדי לבחור הצעה אחרת או לכתוב שם משלכם.`
      : `${rows.length} צירים. לכל ציר מופיע השם שנבחר; פתחו ציר כדי לראות את שלוש ההצעות ולבחור אחרת.`));
  }
  body.append(withMore(rows, () => h('div', { class: 'nm-list' }), { initial: 5, total: (n) => `כל ${n} הצירים`, key: 'cpb' }));
  restoreFolds(body, folds);

  const actions = h('div', { class: 'cpb-actions' });
  if (awaiting) {
    const submit = h('button', { type: 'button', class: 'btn btn-warm', id: 'cpb-submit' }, 'אישור השמות והמשך ההרצה');
    const st = h('p', { class: 'form-status', role: 'status' });
    submit.addEventListener('click', async () => {
      submit.disabled = true;
      st.classList.remove('is-error');
      st.textContent = 'שולח...';
      const chosen = {};
      m.axes.forEach((a) => {
        const c = app.chosen[a.id];
        chosen[a.id] = c ? { name: c.name, source: c.source } : { name: app.axisName(a.id), source: 'candidate' };
      });
      try {
        await app.live.submitB({ chosen });
      } catch (e) {
        st.textContent = e.message;
        st.classList.add('is-error');
        submit.disabled = false;
      }
    });
    actions.append(submit, st);
  } else if (!live) {
    const reset = h('button', { type: 'button', class: 'btn btn-ghost' }, icon('rotate'), 'חזרה לשמות מההרצה המקורית');
    reset.addEventListener('click', () => { app.resetNames(); renderB(app); });
    actions.append(reset, h('a', { class: 'btn btn-quiet', href: '#findings' }, 'לממצאים', icon('arrowDown')));
  } else {
    actions.append(h('a', { class: 'btn btn-quiet', href: '#findings' }, 'לממצאים', icon('arrowDown')));
  }
  body.append(actions);
}

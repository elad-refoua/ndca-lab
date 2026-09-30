// Interview paper rendering, the reader dialog, and clickable quotes.
// A quote opens its interview scrolled to the passage, highlighted (matching rule: ARCHITECTURE 3.2).
import { h, $, clear, findQuote, announce, reducedMotion } from './util.js';
import { icon } from './icons.js';

let appRef = null;
let lastFocus = null;
let current = null;

export function interviewLabel(itv) {
  if (!itv) return '';
  return itv.pseudonym ? `${itv.pseudonym}` : itv.id;
}

// Split "ש: ... \n ת: ..." into turns. Lines without a marker continue the previous turn.
export function parseTurns(text) {
  const turns = [];
  String(text || '').normalize('NFC').split(/\r?\n/).forEach((line) => {
    const t = line.trim();
    if (!t) return;
    const m = t.match(/^(ש|ת)\s*:\s*(.*)$/);
    if (m) turns.push({ who: m[1] === 'ש' ? 'q' : 'a', text: m[2] });
    else if (turns.length) turns[turns.length - 1].text += ` ${t}`;
    else turns.push({ who: 'a', text: t });
  });
  return turns;
}

export function renderInterview(itv, { headingTag = 'h3', clamp = false } = {}) {
  const years = Number.isFinite(itv.years_in_field) ? `${itv.years_in_field} שנים בתחום` : '';
  const meta = [itv.role, years].filter(Boolean).join(', ');
  const body = h('div', { class: 'doc-body', id: `doc-body-${itv.id}` });
  const card = h('article', { class: 'doc-card', 'data-interview': itv.id, 'aria-label': `ראיון עם ${interviewLabel(itv)}` },
    h('header', { class: 'doc-head' },
      h('div', {},
        h(headingTag, { class: 'doc-name' }, interviewLabel(itv)),
        meta ? h('p', { class: 'doc-meta' }, meta) : null,
      ),
      h('span', { class: 'id' }, itv.id),
    ),
    body,
  );
  const turns = parseTurns(itv.text);
  turns.forEach((t) => {
    body.append(h('p', { class: `turn turn-${t.who}` },
      h('span', { class: 'who', 'aria-hidden': 'true' }, t.who === 'q' ? 'ש' : 'ת'),
      h('span', { class: 'said' }, h('span', { class: 'sr-only' }, t.who === 'q' ? 'שאלה: ' : 'תשובה: '), t.text),
    ));
  });
  const long = String(itv.text || '').length > 900;
  if (clamp && long) {
    card.classList.add('is-clamped');
    const more = h('button', { type: 'button', class: 'btn btn-quiet btn-sm doc-more', 'aria-expanded': 'false', 'aria-controls': body.id }, 'להצגת הראיון המלא');
    more.addEventListener('click', () => {
      const open = card.classList.toggle('is-clamped') === false;
      more.setAttribute('aria-expanded', open ? 'true' : 'false');
      more.textContent = open ? 'לקיצור הראיון' : 'להצגת הראיון המלא';
    });
    card.append(more);
  }
  return card;
}

// Wrap the quote inside an answer turn in <mark>. Returns the mark or null.
export function highlightIn(card, quote) {
  const answers = card.querySelectorAll('.turn-a .said');
  for (const said of answers) {
    const textNode = Array.from(said.childNodes).find((n) => n.nodeType === Node.TEXT_NODE);
    if (!textNode) continue;
    const span = findQuote(textNode.data, quote);
    if (!span) continue;
    const range = document.createRange();
    range.setStart(textNode, span[0]);
    range.setEnd(textNode, span[1]);
    const mark = document.createElement('mark');
    mark.className = 'hl';
    range.surroundContents(mark);
    return mark;
  }
  return null;
}

export function initReader(app) {
  appRef = app;
  const dlg = $('#reader');
  $('#reader-close').addEventListener('click', () => dlg.close());
  dlg.addEventListener('click', (e) => { if (e.target === dlg) dlg.close(); });
  dlg.addEventListener('close', () => {
    if (lastFocus && document.contains(lastFocus)) lastFocus.focus();
  });
  app.on('model', () => { if (dlg.open) dlg.close(); tabsFor = null; });
  $('#reader-tabs').addEventListener('keydown', onTabKey);
}

// The interview tabs are built once per corpus and then only re-marked, so focus stays on the tab the
// person chose. Arrow keys move between tabs (RTL: left is the next interview).
let tabsFor = null;
function renderTabs(activeId) {
  const tabs = $('#reader-tabs');
  const itvs = appRef.model.interviews;
  const key = itvs.map((x) => x.id).join('|');
  if (tabsFor !== key || tabs.children.length !== itvs.length) {
    clear(tabs);
    tabsFor = key;
    itvs.forEach((itv) => {
      tabs.append(h('button', {
        type: 'button', role: 'tab', id: `reader-tab-${itv.id}`, 'aria-controls': 'reader-body', 'data-interview': itv.id,
        onclick: () => show(itv.id, null),
      }, interviewLabel(itv)));
    });
  }
  Array.from(tabs.children).forEach((b) => {
    const on = b.dataset.interview === activeId;
    b.setAttribute('aria-selected', on ? 'true' : 'false');
    b.setAttribute('tabindex', on ? '0' : '-1');
  });
  const body = $('#reader-body');
  if (document.getElementById(`reader-tab-${activeId}`)) body.setAttribute('aria-labelledby', `reader-tab-${activeId}`);
  else body.removeAttribute('aria-labelledby');
}

function onTabKey(e) {
  const tabs = Array.from($('#reader-tabs').children);
  const i = tabs.indexOf(document.activeElement);
  if (i < 0) return;
  let j = null;
  if (e.key === 'ArrowLeft') j = Math.min(tabs.length - 1, i + 1);
  if (e.key === 'ArrowRight') j = Math.max(0, i - 1);
  if (e.key === 'Home') j = 0;
  if (e.key === 'End') j = tabs.length - 1;
  if (j === null) return;
  e.preventDefault();
  show(tabs[j].dataset.interview, null);
  tabs[j].focus();
}

function show(interviewId, quote) {
  const itv = appRef.model.interviewById.get(interviewId);
  const body = clear($('#reader-body'));
  const note = $('#reader-note');
  note.textContent = '';
  current = interviewId;
  renderTabs(interviewId);
  if (!itv) {
    $('#reader-title').textContent = 'ראיון';
    note.textContent = `הראיון ${interviewId} לא נמצא בקורפוס.`;
    return;
  }
  $('#reader-title').textContent = `ראיון עם ${interviewLabel(itv)}`;
  const card = renderInterview(itv, { headingTag: 'h3' });
  body.append(card);
  body.scrollTop = 0;
  if (quote) {
    const mark = highlightIn(card, quote);
    if (mark) {
      window.requestAnimationFrame(() => {
        mark.scrollIntoView({ block: 'center', behavior: reducedMotion() ? 'auto' : 'smooth' });
      });
      announce(`נפתח הראיון עם ${interviewLabel(itv)}. הציטוט מסומן.`);
    } else {
      note.textContent = 'הציטוט לא נמצא מילה במילה בראיון הזה. בהרצה אמיתית בדיקת האימות המילולי (G1) הייתה מסמנת זאת.';
    }
  }
}

export function openQuote(ref, trigger) {
  const dlg = $('#reader');
  lastFocus = trigger || document.activeElement;
  if (!dlg.open) dlg.showModal();
  show(ref.interview_id, ref.quote);
  $('#reader-close').focus({ preventScroll: true });
}

export function openInterview(id, trigger) {
  const dlg = $('#reader');
  lastFocus = trigger || document.activeElement;
  if (!dlg.open) dlg.showModal();
  show(id, null);
  $('#reader-close').focus({ preventScroll: true });
}

// A quote as a button. variant: '' (paper), 'paper' (white, inside the manuscript), 'inline'.
export function quoteButton(ref, app, { variant = '', showSource = true } = {}) {
  if (!ref || !ref.quote) return null;
  const itv = app.model.interviewById.get(ref.interview_id);
  const who = itv ? interviewLabel(itv) : ref.interview_id;
  const cls = ['q', variant === 'paper' ? 'q-paper' : '', variant === 'inline' ? 'q-inline' : ''].join(' ').trim();
  const btn = h('button', {
    type: 'button',
    class: cls,
    'aria-label': `ציטוט מהראיון עם ${who}: ${ref.quote}. פתיחת הראיון במקום הזה`,
  }, ref.quote);
  if (showSource && variant !== 'inline') {
    const src = h('span', { class: 'q-src' }, icon('file'), `${who}, `, h('span', { class: 'id' }, ref.interview_id));
    btn.append(src);
  }
  btn.addEventListener('click', () => openQuote(ref, btn));
  return btn;
}

// The method section: the nine-stage score (emblem, persona, Hebrew title, sight ribbon) and the
// "who sees what" matrix. Method constants only; no run content.
import { $, h, clear } from './util.js';
import { icon } from './icons.js';
import { emblem } from './emblems.js';
import { STAGES, CHECKPOINTS, SIGHT_TEXT, SIGHT_MATRIX, MATRIX_COLUMNS } from './stages.js';

function medal(st, { labelled = false } = {}) {
  return h('span', { class: 'st-medal' },
    emblem(st.n, { labelled }),
    h('span', { class: 'st-num', 'aria-hidden': 'true' }, String(st.n)));
}

export function initMethod() {
  const tabs = $('#score-tabs');
  const panel = $('#score-panel');
  const mq = window.matchMedia('(max-width: 1023px)');
  let active = 1;

  const buttons = STAGES.map((st) => {
    const cp = st.n === 4 ? 'after' : (st.n === 7 ? 'within' : null);
    const b = h('button', {
      type: 'button', role: 'tab', class: 'st', id: `st-tab-${st.n}`,
      'aria-controls': 'score-panel', 'aria-selected': 'false', tabindex: '-1',
      style: { '--hue': st.hue },
    },
    medal(st),
    h('span', { class: 'st-text' },
      h('span', { class: 'st-persona' }, st.persona),
      h('span', { class: 'st-title' }, st.title)),
    h('span', { class: 'st-ribbon', 'data-sight': st.sight, 'data-cp': cp, 'aria-hidden': 'true' },
      st.sight === 'none' ? icon('eyeOff') : null),
    h('span', { class: 'sr-only' }, `, שלב ${st.n}, ${SIGHT_TEXT[st.sight]}${cp ? `, ואחריו ${cp === 'after' ? CHECKPOINTS.A.title : CHECKPOINTS.B.title}` : ''}`));
    b.addEventListener('click', () => select(st.n));
    tabs.append(b);
    // phones: the list shows the researcher's two stops between the stages, as the legend promises
    // (hidden on wide screens, where the ribbon carries the diamonds; the tab text already says it)
    if (cp) {
      tabs.append(h('div', { class: 'st-cp-row', 'aria-hidden': 'true' },
        h('span', { class: 'cp-diamond' }), cp === 'after' ? CHECKPOINTS.A.short : CHECKPOINTS.B.short,
        h('span', { class: 'st-cp-note' }, cp === 'after' ? 'החוקרת בוחנת מה שרד' : 'החוקרת בוחרת שמות')));
    }
    return b;
  });

  tabs.addEventListener('keydown', (e) => {
    if (mq.matches) return;
    let next = null;
    if (e.key === 'ArrowLeft') next = Math.min(9, active + 1); // RTL: left is forward
    if (e.key === 'ArrowRight') next = Math.max(1, active - 1);
    if (e.key === 'Home') next = 1;
    if (e.key === 'End') next = 9;
    if (next === null) return;
    e.preventDefault();
    select(next);
    buttons[next - 1].focus();
  });

  function renderPanel(st) {
    clear(panel);
    panel.setAttribute('aria-labelledby', `st-tab-${st.n}`);
    panel.style.setProperty('--hue', st.hue);
    const cp = st.n === 4 ? CHECKPOINTS.A : (st.n === 7 ? CHECKPOINTS.B : null);
    panel.append(h('div', { class: 'sp-grid' },
      h('div', {},
        h('div', { class: 'sp-head' },
          medal(st, { labelled: true }),
          h('div', {},
            h('span', { class: 'sp-persona' }, h('bdi', { dir: 'ltr', class: 'persona' }, st.persona), `, שלב ${st.n}`),
            h('h3', {}, st.title),
            st.deck ? h('p', { class: 'sp-deck' }, `בשקף של הכנס: ${st.deck}`) : null)),
        h('p', { class: 'sp-about' }, st.about),
        cp ? h('p', { class: 'sp-cp' }, h('strong', {}, `${cp.title}${st.n === 4 ? ', מיד אחרי השלב. ' : ', בתוך השלב. '}`), cp.about) : null),
      h('dl', { class: 'sp-facts' },
        h('div', {}, h('dt', {}, 'מה הסוכן רואה'),
          h('dd', {}, h('span', { class: 'sp-sight', 'data-sight': st.sight }, icon(st.sight === 'none' ? 'eyeOff' : 'eye'), SIGHT_TEXT[st.sight]))),
        h('div', {}, h('dt', {}, 'מקבל'), h('dd', {}, st.receives)),
        h('div', {}, h('dt', {}, 'מחזיר'), h('dd', {}, st.returns)))));
  }

  // Wide screens: a tablist with one panel below. Narrow screens: disclosure buttons, with the
  // panel opened right under the chosen stage (a tabpanel may not sit inside a tablist).
  function place() {
    const b = buttons[active - 1];
    if (mq.matches) {
      tabs.removeAttribute('role');
      panel.setAttribute('role', 'region');
      buttons.forEach((x, i) => {
        x.removeAttribute('role');
        x.removeAttribute('aria-selected');
        x.setAttribute('aria-expanded', i === active - 1 ? 'true' : 'false');
        x.setAttribute('tabindex', '0');
        x.dataset.selected = i === active - 1 ? 'true' : 'false';
      });
      b.after(panel);
    } else {
      tabs.setAttribute('role', 'tablist');
      panel.setAttribute('role', 'tabpanel');
      buttons.forEach((x, i) => {
        x.setAttribute('role', 'tab');
        x.removeAttribute('aria-expanded');
        x.setAttribute('aria-selected', i === active - 1 ? 'true' : 'false');
        x.setAttribute('tabindex', i === active - 1 ? '0' : '-1');
        x.dataset.selected = i === active - 1 ? 'true' : 'false';
      });
      if (panel.previousElementSibling !== tabs) tabs.after(panel);
    }
  }

  function select(n) {
    active = n;
    renderPanel(STAGES[n - 1]);
    place();
  }

  mq.addEventListener('change', place);
  select(1);
  renderMatrix();
}

// Which kinds of material one recorded stage input carries. The interview texts are not walked into,
// so a quote counts only when it was sent as a quote of its own.
export function kindsIn(input) {
  const found = new Set();
  const walk = (v) => {
    if (Array.isArray(v)) { v.forEach(walk); return; }
    if (!v || typeof v !== 'object') return;
    for (const [k, x] of Object.entries(v)) {
      if (k === 'interview' || (k === 'corpus' && x && Array.isArray(x.interviews))) { found.add('interviews'); continue; }
      if (typeof x === 'string') {
        if (k === 'quote') found.add('quotes');
        else if (k === 'label' || k === 'pole_a') found.add('labels');
        else if (k === 'antithesis' || k === 'pole_b') found.add('contrasts');
        else if (k === 'name' || k === 'definition') found.add('names');
        else if (k === 'status') found.add('status');
      }
      walk(x);
    }
  };
  walk(input);
  return found;
}

// The matrix from the recorded run: for every stage, the union over its calls of what the input held.
export function updateMatrix(model) {
  const rows = {};
  let measured = 0;
  for (const st of STAGES) {
    const calls = model ? model.calls(st.n) : [];
    if (calls.length) {
      const kinds = new Set();
      calls.forEach((c) => kindsIn(c.input || {}).forEach((k) => kinds.add(k)));
      rows[st.n] = Object.fromEntries([...kinds].map((k) => [k, true]));
      measured += 1;
    } else {
      rows[st.n] = SIGHT_MATRIX[st.n];
    }
  }
  renderMatrix(rows);
  const note = $('#matrix-source');
  if (note) {
    note.textContent = measured === STAGES.length
      ? 'הנקודות נגזרות מהקלט המדויק שכל סוכן קיבל בהרצה המוקלטת, כפי שנשמר בתיעוד שלה.'
      : 'הנקודות לפי הגדרת השלבים של השיטה.';
  }
}

// "Who sees what": nine agents x the kinds of material (ARCHITECTURE 3.3).
function renderMatrix(rows = SIGHT_MATRIX) {
  const table = clear($('#sight-matrix'));
  table.append(
    h('caption', { class: 'sr-only' }, 'איזה חומר מקבל כל אחד מתשעת הסוכנים. השורות של שלבים 3, 5 ו-8 מסומנות כעיוורות לראיונות.'),
    h('thead', {}, h('tr', {},
      h('th', { scope: 'col' }, 'הסוכן'),
      MATRIX_COLUMNS.map((c) => h('th', { scope: 'col' },
        h('span', { class: 'lbl-long' }, c.label),
        h('span', { class: 'lbl-short', 'aria-hidden': 'true' }, c.short))))),
    h('tbody', {}, STAGES.map((st) => {
      const row = rows[st.n] || {};
      return h('tr', { class: st.sight === 'none' ? 'is-blind' : '', style: { '--hue': st.hue } },
        h('th', { scope: 'row' },
          h('span', { class: 'mx-agent' },
            emblem(st.n),
            h('span', { class: 'nn', 'aria-hidden': 'true' }, String(st.n)),
            h('span', { class: 'nm' },
              h('span', { class: 'ps' }, `${st.n} ${st.persona.replace('THE ', '')}`),
              h('span', { class: 'tt' }, st.short))),
          h('span', { class: 'mx-blind' }, icon('eyeOff'), 'עיוור')),
        MATRIX_COLUMNS.map((c) => {
          const v = row[c.key];
          const text = v === 'part' ? `${c.label}: חלקית` : (v ? `${c.label}: כן` : `${c.label}: לא`);
          return h('td', {}, h('span', { class: `mx-dot${v === true ? ' on' : ''}${v === 'part' ? ' part' : ''}`, role: 'img', 'aria-label': text }));
        }));
    })));
}

// Consent, pre- and post-questionnaire. Placeholder items until the researchers send theirs.
// Answers live only in this browser (localStorage) and can be downloaded as JSON. Nothing is sent.
import { $, h, clear, store, downloadJson } from './util.js';

const KEY = 'mabat-kaful:participant:v1';
const REFLECTION_KEY = 'mabat-kaful:reflection-a';

const SCALE = [1, 2, 3, 4, 5];
const ANCHORS = ['כלל לא מסכים/ה', 'מסכים/ה מאוד'];

const PRE = [
  { id: 'familiar', text: 'אני מכיר/ה את הניתוח הדיאלקטי-קונסטרוקטיביסטי בתשעה שלבים.' },
  { id: 'trust_ai', text: 'אני סומך/ת על כלי בינה מלאכותית שיסייעו בניתוח איכותני.' },
  { id: 'see_contrasts', text: 'בינה מלאכותית יכולה לעזור לי לראות ניגודים שלא הייתי מבחין/ה בהם בעצמי.' },
  { id: 'human_control', text: 'חשוב לי שהפרשנות תישאר בידי החוקר/ת.' },
];
const POST = [
  ...PRE,
  { id: 'blindness_clear', text: 'ההדגמה עזרה לי להבין למה חלק מהשלבים נעשים בלי לראות את הנתונים.' },
];

let participant = null;

function newId() {
  const bytes = new Uint8Array(4);
  (window.crypto || window.msCrypto).getRandomValues(bytes);
  return `P-${Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('').toUpperCase()}`;
}

function load() {
  let p = store.get(KEY, null);
  if (!p || typeof p !== 'object' || !p.participant_id) {
    p = { participant_id: newId(), created_at: new Date().toISOString(), consent: null, pre: null, post: null };
    store.set(KEY, p);
  }
  return p;
}

function save() {
  return store.set(KEY, participant);
}

function likert(prefix, item, index, saved) {
  const name = `${prefix}-${item.id}`;
  const legendId = `${name}-q`;
  return h('fieldset', { class: 'lk', 'aria-describedby': `${prefix}-anchors` },
    h('legend', { class: 'lk-q', id: legendId }, `${index + 1}. ${item.text}`),
    h('div', { class: 'lk-scale' }, SCALE.map((v) => h('label', { class: 'lk-opt' },
      h('input', { type: 'radio', name, value: String(v), checked: saved === v, 'aria-label': `${v} מתוך 5${v === 1 ? `, ${ANCHORS[0]}` : ''}${v === 5 ? `, ${ANCHORS[1]}` : ''}` }),
      h('span', { 'aria-hidden': 'true' }, String(v))))),
    h('div', { class: 'lk-ends', 'aria-hidden': 'true' }, h('span', {}, ANCHORS[0]), h('span', {}, ANCHORS[1])));
}

function collect(form, items, prefix) {
  const answers = {};
  items.forEach((it) => {
    const v = form.querySelector(`input[name="${prefix}-${it.id}"]:checked`);
    answers[it.id] = v ? Number(v.value) : null;
  });
  return answers;
}

function setStatus(el, text, isError = false) {
  el.textContent = text;
  el.classList.toggle('is-error', isError);
}

function renderForm(prefix, items, fieldset, savedAnswers, extra) {
  // keep the legend, rebuild the items
  const legend = fieldset.querySelector('legend');
  clear(fieldset);
  fieldset.append(legend);
  fieldset.append(h('p', { class: 'sr-only', id: `${prefix}-anchors` }, `סולם מ-1, ${ANCHORS[0]}, עד 5, ${ANCHORS[1]}.`));
  items.forEach((it, i) => fieldset.append(likert(prefix, it, i, savedAnswers ? savedAnswers[it.id] : null)));
  if (extra) fieldset.append(extra);
}

function applyConsent() {
  const given = !!(participant.consent && participant.consent.given);
  $('#consent-check').checked = given;
  $('#pre-items').disabled = !given;
  $('#pre-save').disabled = !given;
  $('#post-items').disabled = !given;
  $('#post-save').disabled = !given;
  const hint = $('#post-hint');
  if (hint) hint.hidden = given;
  const open = $('#consent-hint');
  if (open) open.hidden = given;
}

export function initSurvey(app) {
  participant = load();
  $('#pid').textContent = participant.participant_id;

  renderForm('pre', PRE, $('#pre-items'), participant.pre && participant.pre.answers);

  const openText = h('div', { class: 'field lk' },
    h('label', { for: 'post-open', class: 'lk-q' }, `${POST.length + 1}. מה נשאר איתך מההדגמה? (לא חובה)`),
    h('textarea', { class: 'ta', id: 'post-open', name: 'post-open' }));
  renderForm('post', POST, $('#post-items'), participant.post && participant.post.answers, openText);
  if (participant.post && participant.post.open_text) $('#post-open').value = participant.post.open_text;

  const postForm = $('#post-form');
  postForm.insertBefore(h('p', { class: 'callout callout-warm', id: 'post-hint' },
    'כדי לענות, אשרו קודם את ההסכמה בחלק ', h('a', { href: '#consent' }, 'לפני שמתחילים'), '.'), postForm.firstChild);

  applyConsent();

  $('#consent-check').addEventListener('change', (e) => {
    participant.consent = e.target.checked ? { given: true, at: new Date().toISOString() } : null;
    const ok = save();
    applyConsent();
    setStatus($('#pre-status'), ok ? '' : 'הדפדפן חוסם שמירה מקומית. אפשר עדיין להוריד את התשובות כקובץ.', !ok);
  });

  $('#pre-form').addEventListener('submit', (e) => {
    e.preventDefault();
    participant.pre = { answers: collect(e.target, PRE, 'pre'), saved_at: new Date().toISOString() };
    const ok = save();
    const missing = Object.values(participant.pre.answers).filter((v) => v === null).length;
    setStatus($('#pre-status'), ok
      ? `נשמר בדפדפן שלכם.${missing === 1 ? ' שאלה אחת נשארה בלי תשובה.' : missing ? ` ${missing} שאלות נשארו בלי תשובה.` : ''}`
      : 'הדפדפן חוסם שמירה מקומית. אפשר עדיין להוריד את התשובות כקובץ.', !ok);
  });

  postForm.addEventListener('submit', (e) => {
    e.preventDefault();
    participant.post = {
      answers: collect(e.target, POST, 'post'),
      open_text: $('#post-open').value.trim(),
      saved_at: new Date().toISOString(),
    };
    const ok = save();
    setStatus($('#post-status'), ok ? 'נשמר בדפדפן שלכם. תודה.' : 'הדפדפן חוסם שמירה מקומית. אפשר עדיין להוריד את התשובות כקובץ.', !ok);
  });

  $('#download-json').addEventListener('click', () => {
    const payload = {
      note: 'אב-טיפוס מבט כפול. התשובות נשמרו בדפדפן בלבד ולא נשלחו לשום מקום. השאלות זמניות.',
      exported_at: new Date().toISOString(),
      demo_run_id: app.replayModel.run && app.replayModel.run.run_id,
      ...participant,
      reflection_checkpoint_a: store.get(REFLECTION_KEY, ''),
      // the viewer's choices on the recorded demo run; nothing from a run on their own materials
      chosen_axis_names: app.mode === 'replay' ? app.chosen : null,
      set_aside_at_checkpoint_a: app.mode === 'replay' ? [...app.setAside] : null,
    };
    downloadJson(payload, `mabat-kaful-${participant.participant_id}.json`);
    setStatus($('#data-status'), 'הקובץ הורד למחשב שלכם.');
  });

  // Deleting the answers asks first, in a row with its own confirm and cancel (no time limit).
  const clearBtn = $('#clear-data');
  const confirmRow = h('div', { class: 'confirm-row', id: 'clear-confirm', hidden: true },
    h('p', { role: 'alert' }, 'למחוק את כל התשובות מהדפדפן? המחיקה אינה הפיכה. הורידו קודם את הקובץ אם תרצו לשמור עותק.'),
    h('button', { type: 'button', class: 'btn btn-danger-solid btn-sm', id: 'clear-yes' }, 'כן, למחוק'),
    h('button', { type: 'button', class: 'btn btn-ghost btn-sm', id: 'clear-no' }, 'ביטול'));
  clearBtn.after(confirmRow);
  clearBtn.addEventListener('click', () => {
    confirmRow.hidden = false;
    clearBtn.hidden = true;
    setStatus($('#data-status'), '');
    $('#clear-yes').focus();
  });
  $('#clear-no').addEventListener('click', () => {
    confirmRow.hidden = true;
    clearBtn.hidden = false;
    clearBtn.focus();
  });
  $('#clear-yes').addEventListener('click', () => {
    confirmRow.hidden = true;
    clearBtn.hidden = false;
    store.remove(KEY);
    store.remove(REFLECTION_KEY);
    participant = load();
    $('#pid').textContent = participant.participant_id;
    renderForm('pre', PRE, $('#pre-items'), null);
    renderForm('post', POST, $('#post-items'), null, openText);
    $('#post-open').value = '';
    const ta = document.getElementById('reflection-a');
    if (ta) ta.value = '';
    applyConsent();
    setStatus($('#data-status'), 'התשובות נמחקו. נוצר מזהה אנונימי חדש.');
    clearBtn.focus();
  });
}

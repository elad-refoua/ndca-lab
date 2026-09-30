// The demo banner at the top of every page (decision D16). Two kinds:
//   'public'  the API reports public_demo: the agents run live on a free, basic model behind our server, Google
//             may use what is entered, and nothing real may go in. Calm amber, never alarming.
//   'replay'  no live API (the public site before or without its server): a softer note that the run on
//             screen was recorded in advance on invented interviews.
//   'none'    a local server that is not the public demo (npm run start:local): the person runs it themselves.
// It sits inside the fixed top bar. On a first view it is open; after that it starts folded to one line that
// still carries the essential sentence, and the person can open or fold it; both are remembered per kind in
// localStorage (every access wrapped in try/catch through util.store, so a private window still works).
// Its height is published as the CSS variable --banner-h, so everything that clears the top bar clears it too.
import { h, clear, store, announce } from './util.js';
import { icon } from './icons.js';

const KEY = 'mabat-kaful:banner';

/** "Gemini Flash" for any flash model (the words the banner uses), otherwise the model id itself. */
export function modelWords(health) {
  const m = String((health && health.model) || '');
  return /flash/i.test(m) ? 'Gemini Flash' : (m || 'Gemini');
}

function whyPublic(health) {
  const model = String((health && health.model) || '');
  const fallback = String((health && health.fallback_model) || '');
  const ttl = Number(health && health.run_ttl_minutes);
  const lines = [
    'זו הדגמה ציבורית של אב-טיפוס, כדי שכל אחד יוכל לנסות את השיטה בלי תשלום ובלי התקנה. לכן הסוכנים רצים כאן על מפתח חינמי של Google (Gemini API) ועל מודל מהיר ובסיסי'
      + (model ? `: ${model}${fallback ? `, ובשעות עומס ${fallback}` : ''}.` : '.'),
    'לפי התנאים של Google, מה שנשלח במפתח חינמי עשוי לשמש לשיפור המוצרים שלה, ועובדים שלה עשויים לקרוא אותו.',
    'גרסת מחקר תרוץ אחרת: על שירות בתשלום או על מודל של המוסד, אחרי אישור של ועדת אתיקה, החלטה לאן מותר לנתונים להגיע ובדיקת אבטחה. אלה ההגנות שחסרות כאן.',
  ];
  if (health && health.storage === 'memory') {
    lines.push(`השרת של ההדגמה לא כותב טקסטים לדיסק: כל הרצה נשמרת רק בזיכרון שלו${Number.isFinite(ttl) && ttl > 0 ? ` ונמחקת אחרי ${ttl} דקות בלי פעילות` : ''}.`);
  }
  lines.push('לכן כאן: רק הראיונות הבדויים של ההדגמה, או טקסט שהמצאתם בעצמכם.');
  return lines;
}

const WHY_REPLAY = [
  'העמוד מציג הרצה אמיתית של תשעת הסוכנים, שנשמרה מראש בקובץ: מה כל סוכן קיבל, מה החזיר, ותוצאות הבדיקות האוטומטיות. הראיונות בה בדויים.',
  'השרת שמריץ את הסוכנים בזמן אמת לא מחובר לעמוד הזה כרגע, ולכן שום טקסט לא נשלח מכאן למודל. תשובות לשאלונים ובחירות בנקודות העצירה נשמרות רק בדפדפן שלכם.',
  'זה אב-טיפוס להדגמה של השיטה, לא כלי מחקר.',
];

const TEXT = {
  public: {
    label: 'הודעה: הדגמה בלבד',
    full: (health) => [h('strong', {}, 'הדגמה בלבד:'), ` הסוכנים רצים כאן על מודל חינמי ובסיסי (${modelWords(health)}), בלי ההגנות של גרסת מחקר. גוגל רשאית להשתמש בטקסט שמוכנס כאן. `, h('strong', {}, 'אל תכניסו ראיונות אמיתיים או פרטים מזהים.')],
    // two lengths, so a phone keeps the one sentence that matters on one line
    short: () => [
      h('span', { class: 'db-short-wide' }, h('strong', {}, 'הדגמה בלבד:'), ' מודל חינמי, בלי הגנות. אל תכניסו ראיונות אמיתיים או פרטים מזהים.'),
      h('span', { class: 'db-short-narrow' }, h('strong', {}, 'הדגמה בלבד:'), ' בלי ראיונות אמיתיים.'),
    ],
    why: whyPublic,
    announce: (health) => `הדגמה בלבד: הסוכנים רצים כאן על מודל חינמי ובסיסי (${modelWords(health)}), בלי ההגנות של גרסת מחקר. גוגל רשאית להשתמש בטקסט שמוכנס כאן. אל תכניסו ראיונות אמיתיים או פרטים מזהים.`,
  },
  replay: {
    label: 'הודעה: הדגמה מוקלטת',
    full: () => [h('strong', {}, 'הדגמה מוקלטת:'), ' ההרצה שמוצגת כאן הוקלטה מראש, על ראיונות בדויים. זה אב-טיפוס להדגמה, לא כלי מחקר.'],
    short: () => [h('strong', {}, 'הדגמה מוקלטת'), ' על ראיונות בדויים.'],
    why: () => WHY_REPLAY,
    announce: null,
  },
};

function saved() {
  const v = store.get(KEY, {});
  return v && typeof v === 'object' ? v : {};
}

/**
 * Wire the banner element (an empty <div id="demo-banner" hidden> inside the top bar).
 * Returns { set(kind, health) } with kind 'public' | 'replay' | 'none'.
 */
export function initBanner(el) {
  const root = document.documentElement;
  let kind = 'none';
  let announced = false;

  const publishHeight = () => {
    const px = el.hidden ? 0 : Math.ceil(el.getBoundingClientRect().height);
    root.style.setProperty('--banner-h', `${px}px`);
  };
  if (typeof ResizeObserver === 'function') new ResizeObserver(publishHeight).observe(el);
  window.addEventListener('resize', publishHeight, { passive: true });

  function render(health) {
    clear(el);
    root.dataset.banner = kind;
    if (kind === 'none') { el.hidden = true; publishHeight(); return; }
    const t = TEXT[kind];
    const s = saved();
    const seen = s.seen && typeof s.seen === 'object' ? s.seen : {};
    // An explicit choice wins; otherwise open on the first view of this kind, folded after it.
    let open = s[kind] === 'open' ? true : (s[kind] === 'closed' ? false : !seen[kind]);
    store.set(KEY, { ...s, seen: { ...seen, [kind]: true } });

    const fullId = `demo-banner-full-${kind}`;
    const full = h('div', { class: 'db-full', id: fullId },
      h('p', { class: 'db-lead' }, t.full(health)),
      h('details', { class: 'db-why' },
        h('summary', {}, 'למה?'),
        h('div', { class: 'db-why-body' }, t.why(health).map((line) => h('p', {}, line)))));
    const short = h('p', { class: 'db-short' }, t.short(health));
    const toggle = h('button', { type: 'button', class: 'db-toggle', 'aria-controls': fullId });
    const apply = () => {
      el.dataset.state = open ? 'open' : 'closed';
      full.hidden = !open;
      short.hidden = open;
      toggle.setAttribute('aria-expanded', String(open));
      clear(toggle).append(open ? 'הבנתי, לצמצם' : 'עוד');
      toggle.setAttribute('aria-label', open ? 'צמצום ההודעה לשורה אחת' : 'הצגת ההודעה המלאה');
      window.requestAnimationFrame(publishHeight);
    };
    toggle.addEventListener('click', () => {
      open = !open;
      store.set(KEY, { ...saved(), [kind]: open ? 'open' : 'closed' });
      apply();
    });
    el.dataset.kind = kind;
    el.setAttribute('role', 'region');
    el.setAttribute('aria-label', t.label);
    el.append(h('div', { class: 'db-inner' },
      icon(kind === 'public' ? 'alert' : 'info', 'db-icon'),
      h('div', { class: 'db-text' }, full, short),
      toggle));
    el.hidden = false;
    apply();
    if (kind === 'public' && t.announce && !announced) { announced = true; announce(t.announce(health)); }
  }

  return {
    set(next, health = null) {
      const k = next === 'public' || next === 'replay' ? next : 'none';
      if (k === kind && el.childElementCount && k !== 'public') return;
      kind = k;
      render(health);
    },
    get kind() { return kind; },
  };
}

/** Which banner a page shows: the public demo's, the softer replay-only one (no live API, or not yet), or none. */
export function bannerKind(health) {
  if (health && health.public_demo === true) return 'public';
  return health ? 'none' : 'replay';
}

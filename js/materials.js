// "Your own materials" (ARCHITECTURE 5.3). Visible as a form only when the local server answers with
// custom_corpus_allowed: true; otherwise a calm explanation of how to run it locally and why it is
// local-only for now. The texts may be kept as a draft in util.tabStore (never localStorage): sessionStorage on a
// page served from this machine, this page's memory alone on a public host, whose origin other sites share (security
// review 2026-09-30). They are cleared on delete. Nothing is sent before the privacy check is reviewed and consent is
// ticked.
import { $, h, clear, tabStore, tabStoreKind, debounce } from './util.js';
import { icon } from './icons.js';
import { scanText, contextOf, HIT_LABEL } from './privacy.js';
import { providerLabel, destinationLines, limitsOf, DRAFT_KEY, RUN_KEY, serverName, inServer, toServer, apiIsRemote, accessCodeField, hasAccessCode, errorText } from './live.js';

const MAMMOTH_URL = 'https://cdnjs.cloudflare.com/ajax/libs/mammoth/1.13.0/mammoth.browser.min.js';
const MAMMOTH_SRI = 'sha512-5hAL8cCOeSztnaZ+3xjLAflXeSwJpGrdrH6McLq2Dtl0vfvCQw+jO9q652eMASTNAU8anRvrXnlW9QqzlfN2HA==';
const MAX_FILE_BYTES = 8 * 1024 * 1024;

const fmt = (n) => Number(n || 0).toLocaleString('he-IL');
const defaultName = (i) => `מרואיין/ת ${i + 1}`;
const emptyDraft = () => ({ rq: '', interviews: [{ pseudonym: defaultName(0), text: '' }] });

function loadDraft() {
  const d = tabStore.get(DRAFT_KEY, null);
  if (!d || typeof d !== 'object' || !Array.isArray(d.interviews) || !d.interviews.length) return emptyDraft();
  return {
    rq: typeof d.rq === 'string' ? d.rq : '',
    interviews: d.interviews.slice(0, 50).map((x, i) => ({
      pseudonym: typeof x.pseudonym === 'string' ? x.pseudonym : defaultName(i),
      text: typeof x.text === 'string' ? x.text : '',
    })),
  };
}

let mammothPromise = null;
function loadMammoth() {
  if (window.mammoth) return Promise.resolve(window.mammoth);
  if (!mammothPromise) {
    mammothPromise = new Promise((resolve, reject) => {
      const sc = document.createElement('script');
      sc.src = MAMMOTH_URL;
      sc.integrity = MAMMOTH_SRI;
      sc.crossOrigin = 'anonymous';
      sc.referrerPolicy = 'no-referrer';
      sc.onload = () => (window.mammoth ? resolve(window.mammoth) : reject(new Error('mammoth did not load')));
      sc.onerror = () => { mammothPromise = null; reject(new Error('mammoth did not load')); };
      document.head.append(sc);
    });
  }
  return mammothPromise;
}

async function readFileText(file) {
  const name = String(file.name || '').toLowerCase();
  if (file.size > MAX_FILE_BYTES) throw new Error('הקובץ גדול מדי (יותר מ-8MB).');
  if (name.endsWith('.docx')) {
    let lib;
    try { lib = await loadMammoth(); } catch { throw new Error('לא ניתן לטעון את קורא קובצי Word (mammoth.js). בדקו חיבור לאינטרנט, או העתיקו את הטקסט והדביקו אותו.'); }
    const res = await lib.extractRawText({ arrayBuffer: await file.arrayBuffer() });
    return String(res.value || '').replace(/\n{3,}/g, '\n\n').trim();
  }
  if (name.endsWith('.txt') || name.endsWith('.md') || file.type.startsWith('text/')) {
    const buf = await file.arrayBuffer();
    let text = new TextDecoder('utf-8').decode(buf);
    if (text.includes('�')) {
      // Hebrew text files saved by older Windows tools are often Windows-1255
      try { text = new TextDecoder('windows-1255').decode(buf); } catch { /* keep utf-8 */ }
    }
    return text.replace(/^﻿/, '').trim();
  }
  throw new Error('אפשר לטעון רק קובצי טקסט (txt או md) או Word (docx).');
}

export function initMaterials(app) {
  const body = $('#materials-body');
  let draft = loadDraft();
  let dismissed = new Set();
  let refs = null; // live references into the rendered form
  let lastNotice = '';
  let focusNotice = false;
  let focusKey = null; // the privacy hit whose button was just pressed, so focus returns to it
  const announceEl = $('#mat-announce');
  let lastSaid = '';
  // One quiet announcement when the number of privacy findings or of things blocking the start
  // changes, a second after typing stops; the counters themselves are not live regions.
  const announceState = debounce((text) => {
    if (!announceEl || text === lastSaid) return;
    lastSaid = text;
    announceEl.textContent = text;
  }, 1000);

  const isEmpty = (d) => !d.rq.trim() && d.interviews.every((x) => !x.text.trim());
  const saveDraft = debounce(() => {
    if (isEmpty(draft)) tabStore.remove(DRAFT_KEY); else tabStore.set(DRAFT_KEY, draft);
  }, 400);

  const isPublicDemo = () => !!(app.health && app.health.public_demo === true);

  // The hero's link and this section's opening line promise what the section can do on this page.
  function renderPromises() {
    const heroLink = $('#hero-own-link');
    const lead = $('#materials-lead');
    const publicOnly = !['127.0.0.1', 'localhost', '[::1]', '::1'].includes(window.location.hostname) && !apiIsRemote();
    let link;
    let text;
    if (isPublicDemo() && app.health.custom_corpus_allowed) {
      link = 'או לנסות את הסוכנים על טקסט בדוי משלכם';
      text = 'אותם תשעה סוכנים ואותן שתי עצירות, על טקסט שתכניסו כאן. זו הדגמה ציבורית: הטקסט נשלח לשרת ההדגמה, ומשם ל-Google במפתח חינמי. הכניסו רק טקסט בדוי, או טקסט שאין בו שום דבר על אדם אמיתי. ראיונות מחקר מנתחים בהתקנה מקומית.';
    } else if (apiIsRemote()) {
      link = 'ניתוח ראיונות משלכם: בהתקנה מקומית';
      text = 'אותם תשעה סוכנים ואותן שתי עצירות, על ראיונות שלכם. באתר הזה אפשר להריץ את הסוכנים על הראיונות הבדויים של ההדגמה; ראיונות משלכם מנתחים בהתקנה מקומית, על המחשב שלכם.';
    } else if (publicOnly) {
      link = 'ניתוח ראיונות משלכם: רק בהתקנה מקומית';
      text = 'אותם תשעה סוכנים ואותן שתי עצירות, על ראיונות שלכם. הניתוח רץ בהתקנה מקומית: הטקסטים עוברים רק דרך שרת שרץ על המחשב שלכם, אל ספק המודל שמופיע על המסך, ונשמרים רק אצלכם עד שתמחקו אותם.';
    } else {
      link = 'או לנתח ראיונות משלכם, על המחשב שלכם';
      text = 'אותם תשעה סוכנים ואותן שתי עצירות, על ראיונות שלכם. הטקסטים עוברים רק דרך שרת שרץ על המחשב שלכם, אל ספק המודל שמופיע על המסך, ונשמרים רק אצלכם עד שתמחקו אותם.';
    }
    if (heroLink) heroLink.textContent = link;
    if (lead) lead.textContent = text;
  }

  function render() {
    clear(body);
    refs = null;
    renderPromises();
    if (app.live && app.live.kind === 'custom') { renderRunCard(); return; }
    if (!app.health && apiIsRemote() && app.healthState !== 'failed' && app.healthState !== 'off') { renderWaking(); return; }
    if (!app.health) { renderHowTo('none'); return; }
    if (!app.health.custom_corpus_allowed) { renderHowTo('disabled'); return; }
    renderForm();
  }

  // A deployed server that has not answered yet: first "connecting", then, after WAKING_AFTER_MS, a Cloud Run cold
  // start is the likely reason, and the card says so, calmly.
  function renderWaking() {
    const waking = app.healthState === 'waking';
    body.append(h('div', { class: 'mat-card mat-waking', id: 'mat-waking', role: 'status', 'data-state': waking ? 'waking' : 'checking' },
      h('p', {}, h('span', { class: 'spinner', 'aria-hidden': 'true' }),
        waking ? 'מעירים את השרת של ההדגמה... אחרי הפסקה זה יכול לקחת עד חצי דקה.' : 'מתחברים לשרת של ההדגמה...'),
      h('p', { class: 'muted small' }, 'בינתיים אפשר לקרוא את הראיונות ולצפות בהרצה המוקלטת. הטופס יופיע כאן כשהשרת יענה.')));
  }

  // ---------- not available: how to run it locally, and why ----------
  function renderHowTo(reason) {
    const retry = h('button', { type: 'button', class: 'btn btn-ghost btn-sm', id: 'mat-retry' }, icon('rotate'), 'לבדוק שוב את החיבור');
    retry.addEventListener('click', async () => { retry.disabled = true; await app.liveApi.probe(); });
    const onPublic = !['127.0.0.1', 'localhost', '[::1]', '::1'].includes(window.location.hostname);
    let lead;
    if (reason === 'disabled') {
      lead = apiIsRemote()
        ? 'השרת של מבט כפול פועל, אבל הוא מקבל כרגע רק את הראיונות הבדויים של ההדגמה. כדי לנתח ראיונות משלכם, מריצים את מבט כפול על המחשב שלכם:'
        : 'השרת המקומי פועל, אבל הוא הופעל בלי האפשרות לנתח חומרים משלכם. עצרו אותו והפעילו אותו מחדש במצב המקומי:';
    } else if (apiIsRemote()) {
      lead = 'השרת של מבט כפול לא ענה כרגע. אפשר לצפות בהדגמה המוקלטת, או להריץ את מבט כפול על המחשב שלכם:';
    } else if (onPublic) {
      lead = 'באתר הציבורי אפשר לצפות בהדגמה בלבד. ניתוח ראיונות משלכם זמין כרגע רק בהתקנה מקומית של מבט כפול, שמקבלים מהחוקרות.';
    } else {
      lead = 'לא נמצא שרת מקומי שמאפשר חומרים משלכם. כדי לנתח ראיונות משלכם, מריצים את מבט כפול על המחשב שלכם:';
    }
    const keyCmd = (label, cmd) => h('div', { class: 'cmd-row' }, h('span', { class: 'cmd-os' }, label), h('code', { class: 'cmd' }, cmd));
    const steps = h('ol', { class: 'mat-steps' },
      h('li', {}, h('p', {}, 'מתקינים Node.js בגרסה 20 ומעלה: התוכנה שמריצה את השרת הקטן של מבט כפול על המחשב (nodejs.org). מעתיקים למחשב את תיקיית הפרויקט שקיבלתם מהחוקרות.')),
      h('li', {}, h('p', {}, 'בחלון פקודות, בתוך תיקיית הפרויקט, מתקינים את החבילות:', h('code', { class: 'cmd' }, 'npm install'))),
      h('li', {}, h('p', {}, 'מגדירים את המפתח לספק המודל. המפתח הוא סיסמה אישית ששרתי Google מזהים בה אתכם; יוצרים אותו ב-Google AI Studio, מתוך פרויקט שהוגדר בו חיוב (billing), כי רק אז Google מתחייבת לא להשתמש בטקסט לשיפור המוצרים שלה. המפתח נשמר רק בחלון הפקודות, לא בקובץ:'),
        keyCmd('Windows, PowerShell', '$env:GEMINI_API_KEY="..."'),
        keyCmd('Windows, cmd', 'set GEMINI_API_KEY=...'),
        keyCmd('macOS או Linux', 'export GEMINI_API_KEY=...')),
      h('li', {}, h('p', {}, 'באותו חלון מפעילים את המצב המקומי:', h('code', { class: 'cmd' }, 'npm run start:local'))),
      h('li', {}, h('p', {}, 'פותחים בדפדפן את הכתובת:', h('code', { class: 'cmd' }, 'http://127.0.0.1:8080#materials'))));
    body.append(h('div', { class: 'mat-grid', id: 'mat-howto', 'data-reason': reason },
      h('div', { class: 'mat-card' },
        h('h3', {}, onPublic && reason === 'none' && !apiIsRemote() ? 'ניתוח ראיונות משלכם' : 'איך מריצים על המחשב שלכם'),
        h('p', { class: 'muted' }, lead),
        onPublic && reason === 'none' && !apiIsRemote()
          ? h('details', { class: 'fold mat-steps-fold' }, h('summary', {}, 'למי שקיבל את ההתקנה: איך מפעילים אותה'), h('div', { class: 'fold-body' }, steps))
          : steps,
        onPublic && !apiIsRemote() ? null : h('div', { class: 'list-actions' }, retry)),
      h('div', { class: 'mat-why' },
        h('h3', {}, 'למה רק מקומית, בינתיים'),
        h('p', {}, 'ראיונות מחקר הם מידע על משתתפים. במצב המקומי השרת מאזין רק למחשב שלכם, המפתח לספק המודל נשאר אצלכם, והטקסטים נשלחים רק לספק שמופיע על המסך לפני השליחה.'),
        h('p', {}, 'גרסה ציבורית שמקבלת חומרים דורשת קודם אישור של ועדת אתיקה, החלטה לאן מותר לנתונים להגיע (למשל Vertex AI באזור ישראל, או מודל שרץ במוסד), מגבלות עלות ובדיקת אבטחה.'),
        h('p', {}, 'גם במצב המקומי: רק טקסט שעבר התממה, ורק כשמותר לכם לעבד אותו כך. חומר קליני לא נכנס לכאן.'))));
  }

  // ---------- the form ----------
  function renderForm() {
    const lim = limitsOf(app.health);
    const prov = providerLabel(app.health);
    const form = h('form', { class: 'mat-form', id: 'mat-form', novalidate: true });
    form.addEventListener('submit', (e) => e.preventDefault());

    // after a delete: the confirmation at the top of the form the person comes back to
    const notice = lastNotice
      ? h('p', { class: 'callout callout-cool mat-notice', id: 'mat-notice', role: 'status', tabindex: '-1' }, icon('check'), lastNotice)
      : null;
    if (notice) form.append(notice);
    // The public demo (D16): the same warning as the banner, where text is actually entered, with the limits.
    if (isPublicDemo()) {
      const perIp = Number(lim.runsPerIp);
      form.append(h('div', { class: 'callout callout-warm mat-public', id: 'mat-public' },
        h('p', {}, h('strong', {}, 'הדגמה ציבורית: אל תכניסו ראיונות אמיתיים או פרטים מזהים. '),
          'מותר טקסט בדוי, למשל ראיון קצר שכתבתם כדי לראות איך השיטה עובדת.'),
        h('p', { class: 'small' }, `עד ${fmt(lim.maxInterviews)} ראיונות, עד ${fmt(lim.perInterview)} תווים לראיון ו-${fmt(lim.total)} בסך הכול.${Number.isFinite(perIp) && perIp > 0 ? ` מכל כתובת אפשר להתחיל עד ${fmt(perIp)} הרצות ביום.` : ''}`)));
    }
    form.append(h('p', { class: 'mat-conn' }, h('span', { class: 'dot', 'aria-hidden': 'true' }),
      `${serverName()} מחובר. הטקסטים יישלחו אל: `, h('span', { class: 'provider-name' }, prov)));
    if (app.health.storage === 'memory') {
      const ttl = Number(app.health.run_ttl_minutes);
      form.append(h('p', { class: 'hint mat-storage' }, `השרת לא שומר את הטקסטים בדיסק: ההרצה נשמרת רק בזיכרון שלו${Number.isFinite(ttl) && ttl > 0 ? ` ונמחקת אחרי ${fmt(ttl)} דקות` : ''}. הורידו את הממצאים לפני שאתם עוזבים.`));
    }

    // a run this tab started before a reload is still on the local server: go back to it, or delete it
    const pending = tabStore.get(RUN_KEY, null);
    if (pending && typeof pending.runId === 'string') {
      const note = h('p', { class: 'form-status', role: 'status' });
      const back = h('button', { type: 'button', class: 'btn btn-primary btn-sm', id: 'mat-resume' }, 'חזרה לניתוח');
      const del = h('button', { type: 'button', class: 'btn btn-danger btn-sm', id: 'mat-resume-delete' }, icon('trash'), 'מחיקת ההרצה והטקסטים');
      back.addEventListener('click', async () => {
        back.disabled = true;
        try { await app.liveApi.resume(pending.runId, localCorpus()); } catch (e) {
          // a run the server forgot (memory storage restarted, or it expired): the message says so; the draft stays
          note.textContent = e.status === 404 ? `${e.message} הטיוטה שלכם עדיין כאן, בטופס למטה.` : e.message;
          note.classList.add('is-error');
          back.disabled = e.status === 404;
          if (e.status === 404) del.hidden = true;
        }
      });
      del.addEventListener('click', async () => {
        del.disabled = true;
        try { await app.liveApi.deleteById(pending.runId); } catch (e) {
          if (e.status === 404) { tabStore.remove(RUN_KEY); render(); return; }
          note.textContent = `המחיקה לא הושלמה: ${e.message}`; note.classList.add('is-error'); del.disabled = false;
        }
      });
      form.append(h('div', { class: 'callout callout-cool', id: 'mat-pending' },
        h('p', {}, `בלשונית הזאת התחלתם ניתוח שעדיין שמור ${inServer()} `, h('span', { class: 'id' }, pending.runId), '.'),
        // the access code is held in memory only, so after a reload it is asked for again
        app.health.access_code_required && !hasAccessCode() ? accessCodeField('mat-code-resume').wrap : null,
        h('div', { class: 'list-actions', style: { marginTop: '8px' } }, back, del), note));
    }

    // 1. research question
    const rq = h('textarea', { class: 'ta', id: 'mat-rq', rows: '3', placeholder: 'למשל: כיצד מורים מתחילים מתארים את המעבר מהכשרה לכיתה?' });
    rq.value = draft.rq;
    const rqCount = h('span', { class: 'count', id: 'mat-rq-count', 'aria-live': 'off' });
    rq.setAttribute('aria-describedby', 'mat-rq-count');
    rq.addEventListener('input', () => { draft.rq = rq.value; saveDraft(); refresh(); });
    form.append(step(1, 'שאלת המחקר', 'שאלה אחת, כפי שתנסחו אותה במאמר. היא נכנסת להנחיה של כל סוכן כנתון, לא כהוראה.',
      h('div', { class: 'field' }, h('label', { class: 'sr-only', for: 'mat-rq' }, 'שאלת המחקר'), rq, rqCount)));

    // 2. interviews
    const list = h('div', { class: 'itv-list', id: 'mat-itv-list' });
    const addBtn = h('button', { type: 'button', class: 'btn btn-ghost btn-sm', id: 'mat-add' }, icon('plus'), 'הוספת ראיון');
    addBtn.addEventListener('click', () => {
      draft.interviews.push({ pseudonym: defaultName(draft.interviews.length), text: '' });
      saveDraft();
      renderList();
      const last = list.querySelector('.itv:last-child textarea');
      if (last) last.focus();
    });
    const multi = h('input', { type: 'file', multiple: true, accept: '.txt,.md,.docx,text/plain,text/markdown', 'aria-label': 'טעינת כמה קבצים, ראיון אחד בכל קובץ', id: 'mat-files' });
    const multiNote = h('p', { class: 'file-note', role: 'status' });
    multi.addEventListener('change', async () => {
      const files = Array.from(multi.files || []);
      multi.value = '';
      let added = 0;
      const errors = [];
      for (const f of files) {
        try {
          const text = await readFileText(f);
          const emptySlot = draft.interviews.findIndex((x) => !x.text.trim());
          if (emptySlot >= 0) draft.interviews[emptySlot].text = text;
          else draft.interviews.push({ pseudonym: defaultName(draft.interviews.length), text });
          added += 1;
        } catch (e) { errors.push(`${f.name}: ${e.message}`); }
      }
      saveDraft();
      renderList();
      multiNote.textContent = [added ? `נטענו ${added} קבצים. שם הקובץ לא נשמר; תנו לכל ראיון כינוי.` : '', ...errors].filter(Boolean).join(' ');
      multiNote.classList.toggle('is-error', !!errors.length);
    });
    const totals = h('p', { class: 'totals', id: 'mat-totals', 'aria-live': 'off' });
    const thin = h('p', { class: 'callout mat-thin', id: 'mat-thin', hidden: true });
    // Paper, section 8: the floor is about ten extended interviews. Approximate length of a transcript
    // at the per-interview limit: Hebrew speech at ~120 words a minute, ~6 characters a word with the
    // space, is ~22,000 characters for half an hour.
    const approx = lim.perInterview === 25000 ? ', בערך חצי שעה של ראיון מתומלל' : '';
    form.append(step(2, 'הראיונות',
      `עד ${fmt(lim.maxInterviews)} ראיונות, בהדבקה או מקובץ: טקסט (txt או md) או Word (docx), שנקרא כאן בדפדפן. מומלץ לסמן שאלה ב"ש:" ותשובה ב"ת:", כל אחת בשורה חדשה; טקסט בלי סימונים נחשב לתשובה אחת. תנו לכל ראיון כינוי, לא שם.`,
      h('p', { class: 'hint' }, `לפי המאמר, השיטה צריכה בערך עשרה ראיונות מלאים. עם פחות, צירים רבים ייצאו שבירים בגלל מיעוט החומר ולא בגלל התוכן. כל ראיון יכול להגיע עד ${fmt(lim.perInterview)} תווים${approx}, וכולם יחד עד ${fmt(lim.total)} תווים. ראיון ארוך יותר אפשר לחלק לכמה חלקים, או לבחור ממנו קטעים.`),
      list,
      h('div', { class: 'list-actions' }, addBtn,
        h('label', { class: 'btn btn-quiet btn-sm file-btn' }, icon('upload'), 'טעינת קבצים (ראיון לכל קובץ)', multi)),
      multiNote, totals, thin));

    // 3. privacy check
    const priv = h('div', { class: 'priv', id: 'mat-privacy' });
    form.append(step(3, 'בדיקת פרטיות', 'לפני השליחה הדף מחפש בטקסט פרטים שעלולים לזהות: כתובות דוא"ל, מספרי טלפון, מספרים בני 9 ספרות, קישורים ומה שנראה כמו כתובת. היא לא מוצאת שמות, מקומות או פרטים ייחודיים, ולכן היא לא אומרת שהטקסט אנונימי. עברו עליו גם בעצמכם.', priv));

    // 4. consent and start
    const consent = h('input', { type: 'checkbox', id: 'mat-consent' });
    const startBtn = h('button', { type: 'button', class: 'btn btn-warm', id: 'mat-start', disabled: true }, icon('play'), 'התחלת הניתוח');
    const startStatus = h('p', { class: 'form-status', role: 'status', id: 'mat-start-status' });
    const blockers = h('ul', { class: 'mat-blockers', id: 'mat-blockers', 'aria-label': 'מה עוד חסר כדי להתחיל' });
    startBtn.setAttribute('aria-describedby', 'mat-blockers');
    consent.addEventListener('change', refresh);
    startBtn.addEventListener('click', async () => {
      if (collectBlockers().length) { refresh(); return; }
      startBtn.disabled = true;
      startStatus.classList.remove('is-error');
      startStatus.textContent = `שולח ${toServer()}...`;
      const lc = localCorpus();
      const interviews = lc.interviews.map((x) => ({ pseudonym: x.pseudonym, text: x.text }));
      try {
        await app.liveApi.start({ kind: 'custom', corpusBody: { research_question: lc.research_question, interviews }, localCorpus: lc });
      } catch (e) {
        startStatus.replaceChildren(errorText('לא ניתן להתחיל: ', e));
        startStatus.classList.add('is-error');
        refresh();
      }
    });
    // Clearing wipes every pasted interview: it asks first, the way delete does.
    const clearWrap = h('span', { class: 'del-wrap', style: { display: 'contents' } });
    const clearBtn = h('button', { type: 'button', class: 'btn btn-quiet btn-sm', id: 'mat-clear' }, icon('trash'), 'ניקוי הטופס והטיוטה');
    clearBtn.addEventListener('click', () => {
      if (isEmpty(draft)) { doClear(); return; }
      const yes = h('button', { type: 'button', class: 'btn btn-danger-solid btn-sm', id: 'mat-clear-confirm' }, 'כן, לנקות');
      const no = h('button', { type: 'button', class: 'btn btn-ghost btn-sm' }, 'ביטול');
      const n = draft.interviews.filter((x) => x.text.trim()).length;
      clearWrap.replaceChildren(h('div', { class: 'confirm-row' },
        h('p', { role: 'alert' }, `לנקות את הטופס? שאלת המחקר ו${n === 1 ? 'הראיון' : `${n} הראיונות`} יימחקו מהלשונית הזאת. אי אפשר לשחזר.`), yes, no));
      no.addEventListener('click', () => { clearWrap.replaceChildren(clearBtn); clearBtn.focus(); });
      yes.addEventListener('click', doClear);
      yes.focus();
    });
    clearWrap.append(clearBtn);
    function doClear() {
      draft = emptyDraft();
      dismissed = new Set();
      tabStore.remove(DRAFT_KEY);
      render();
      const rqEl = document.getElementById('mat-rq');
      if (rqEl) rqEl.focus({ preventScroll: true });
    }
    const needCode = !!app.health.access_code_required;
    const code = needCode ? accessCodeField('mat-code') : null;
    const dest = destinationLines(app.health);
    form.append(step(4, 'הסכמה ושליחה', null,
      code ? code.wrap : null,
      dest.length ? h('div', { class: 'mat-dest', id: 'mat-destination' },
        h('h4', {}, icon('info'), 'לאן הטקסט הולך'),
        dest.map((line) => h('p', {}, line))) : null,
      h('div', { class: 'mat-consent' },
        h('label', { class: 'check', for: 'mat-consent' }, consent,
          isPublicDemo()
            ? h('span', {}, 'אני מאשר/ת שאין בטקסטים ראיונות אמיתיים ולא פרטים שמזהים אדם (הטקסט בדוי, או שאין בו שום דבר על אדם אמיתי), שהם יישלחו לניתוח אל ',
              h('span', { class: 'provider-name', id: 'mat-provider' }, prov), ', ושקראתי לאן הטקסט נשלח ומה נעשה בו שם.')
            : h('span', {}, 'אני מאשר/ת שהטקסטים עברו התממה (הוסרו שמות ופרטים מזהים), שמותר לי לעבד אותם כך, שהם יישלחו לניתוח אל ',
              h('span', { class: 'provider-name', id: 'mat-provider' }, prov), ', ושקראתי לאן הטקסט נשלח ומה נעשה בו שם.'))),
      h('div', { class: 'mat-start' }, startBtn, startStatus),
      blockers,
      h('div', { class: 'list-actions' },
        h('p', { class: 'draft-note' }, tabStoreKind === 'memory'
          ? 'הטיוטה נשמרת רק בזיכרון של הדף הזה ונמחקת ברענון, כשסוגרים את הלשונית, או בכפתור הניקוי.'
          : 'הטיוטה נשמרת רק בזיכרון של הלשונית הזאת ונמחקת כשסוגרים אותה, או בכפתור הניקוי.'),
        clearWrap)));

    body.append(form);
    refs = { rq, rqCount, list, totals, thin, priv, consent, startBtn, startStatus, blockers, lim };
    renderList();
    if (notice) {
      lastNotice = '';
      if (focusNotice) {
        focusNotice = false;
        notice.focus({ preventScroll: true });
        notice.scrollIntoView({ block: 'center' });
      }
    }
  }

  // The corpus as this page shows it until the server's own copy arrives with stage 1 (ids I1, I2...).
  function localCorpus() {
    const interviews = draft.interviews.filter((x) => x.text.trim())
      .map((x, i) => ({ id: `I${i + 1}`, pseudonym: x.pseudonym.trim() || defaultName(i), text: x.text }));
    return { corpus_id: 'custom', language: 'he', invented: false, research_question: draft.rq.trim(), description: '', interviews };
  }

  function step(n, title, hint, ...content) {
    return h('section', { class: 'mat-step', 'aria-labelledby': `mat-step-${n}` },
      h('span', { class: 'mat-step-n', 'aria-hidden': 'true' }, String(n)),
      h('div', {},
        h('h3', { id: `mat-step-${n}` }, title),
        hint ? h('p', { class: 'hint' }, hint) : null,
        ...content));
  }

  function renderList() {
    if (!refs) return;
    const { list, lim } = refs;
    clear(list);
    draft.interviews.forEach((itv, i) => {
      const pid = `mat-p-${i}`;
      const tid = `mat-t-${i}`;
      const name = h('input', { type: 'text', class: 'tx', id: pid, maxlength: '60', autocomplete: 'off' });
      name.value = itv.pseudonym;
      name.addEventListener('input', () => { draft.interviews[i].pseudonym = name.value; saveDraft(); refresh(); });
      const ta = h('textarea', { class: 'ta', id: tid, rows: '8', placeholder: 'ש: ספרי לי על...\nת: ...' });
      ta.value = itv.text;
      ta.addEventListener('input', () => { draft.interviews[i].text = ta.value; saveDraft(); refresh(); });
      const count = h('span', { class: 'count', 'data-count': String(i), 'aria-live': 'off' });
      const note = h('p', { class: 'file-note', role: 'status' });
      const file = h('input', { type: 'file', accept: '.txt,.md,.docx,text/plain,text/markdown', 'aria-label': `טעינת קובץ לראיון ${i + 1}`, id: `mat-f-${i}` });
      file.addEventListener('change', async () => {
        const f = file.files && file.files[0];
        file.value = '';
        if (!f) return;
        note.classList.remove('is-error');
        note.textContent = 'קורא את הקובץ...';
        try {
          const text = await readFileText(f);
          draft.interviews[i].text = text;
          ta.value = text;
          saveDraft();
          refresh();
          note.textContent = `נטען: ${fmt(text.length)} תווים. שם הקובץ לא נשמר.`;
        } catch (e) {
          note.textContent = e.message;
          note.classList.add('is-error');
        }
      });
      const remove = h('button', { type: 'button', class: 'btn btn-quiet btn-sm', 'aria-label': `הסרת ראיון ${i + 1}` }, icon('x'), 'הסרה');
      remove.addEventListener('click', () => {
        draft.interviews.splice(i, 1);
        if (!draft.interviews.length) draft.interviews.push({ pseudonym: defaultName(0), text: '' });
        saveDraft();
        renderList();
      });
      list.append(h('div', { class: 'itv', 'data-index': String(i) },
        h('div', { class: 'itv-top' },
          h('div', { class: 'field' },
            h('label', { class: 'field-label', for: pid }, `כינוי לראיון ${i + 1}`, h('span', { class: 'itv-id', 'aria-hidden': 'true' }, `I${i + 1}`)),
            name)),
        h('label', { class: 'sr-only', for: tid }, `הטקסט של ראיון ${i + 1}`),
        ta,
        count,
        h('div', { class: 'itv-actions' },
          h('label', { class: 'btn btn-quiet btn-sm file-btn' }, icon('upload'), 'טעינה מקובץ', file),
          remove),
        note));
    });
    const add = $('#mat-add');
    if (add) add.disabled = draft.interviews.length >= lim.maxInterviews;
    refresh();
  }

  // ---------- counts, privacy, blockers: updated in place on every edit ----------
  function fields() {
    const out = [{ id: 'mat-rq', where: 'שאלת המחקר', text: draft.rq, itv: -1 }];
    draft.interviews.forEach((x, i) => {
      out.push({ id: `mat-p-${i}`, where: `כינוי לראיון ${i + 1}`, text: x.pseudonym, itv: i });
      out.push({ id: `mat-t-${i}`, where: `ראיון ${i + 1}${x.pseudonym.trim() ? `, ${x.pseudonym.trim()}` : ''}`, text: x.text, itv: i });
    });
    return out;
  }

  function allHits() {
    const hits = [];
    fields().forEach((f) => {
      const seen = new Map();
      scanText(f.text).forEach((hit) => {
        const k = `${f.id}|${hit.text}`;
        const nth = (seen.get(k) || 0) + 1;
        seen.set(k, nth);
        hits.push({ ...hit, field: f, key: `${k}|${nth}` });
      });
    });
    return hits;
  }

  function collectBlockers() {
    if (!refs) return ['הטופס לא מוכן'];
    const { lim } = refs;
    const b = [];
    const rq = draft.rq.trim();
    if (!rq) b.push('כתבו שאלת מחקר.');
    else if (draft.rq.length > lim.question) b.push(`שאלת המחקר ארוכה מ-${fmt(lim.question)} תווים.`);
    const filled = draft.interviews.filter((x) => x.text.trim());
    if (!filled.length) b.push('הוסיפו לפחות ראיון אחד עם טקסט.');
    if (filled.length > lim.maxInterviews) b.push(`אפשר עד ${fmt(lim.maxInterviews)} ראיונות.`);
    draft.interviews.forEach((x, i) => { if (x.text.length > lim.perInterview) b.push(`ראיון ${i + 1} ארוך מ-${fmt(lim.perInterview)} תווים.`); });
    const total = draft.interviews.reduce((n, x) => n + x.text.length, 0);
    if (total > lim.total) b.push(`סך כל הטקסט ארוך מ-${fmt(lim.total)} תווים.`);
    const open = allHits().filter((x) => !dismissed.has(x.key)).length;
    if (open === 1) b.push('בבדיקת הפרטיות נשאר ממצא אחד: תקנו אותו, או סמנו שאינו מזהה.');
    else if (open) b.push(`בבדיקת הפרטיות נשארו ${open} ממצאים: תקנו אותם, או סמנו שאינם מזהים.`);
    if (app.health && app.health.access_code_required && !hasAccessCode()) b.push('הקלידו את קוד הגישה.');
    if (!refs.consent.checked) b.push('סמנו את תיבת ההסכמה.');
    if (app.liveApi && app.liveApi.isBusy()) b.push('הרצה אחרת עדיין פועלת.');
    return b;
  }

  function jumpTo(hit) {
    const el = document.getElementById(hit.field.id);
    if (!el) return;
    el.focus({ preventScroll: true });
    try { el.setSelectionRange(hit.start, hit.end); } catch { /* not a text field */ }
    el.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }

  function renderPrivacy() {
    const { priv } = refs;
    clear(priv);
    const hits = allHits();
    const open = hits.filter((x) => !dismissed.has(x.key));
    priv.classList.toggle('has-hits', open.length > 0);
    priv.append(h('div', { class: 'priv-head' },
      icon(open.length ? 'alert' : 'shield'),
      h('strong', { id: 'mat-privacy-summary' }, open.length
        ? (open.length === 1 ? 'נמצא פרט אחד שעלול לזהות' : `נמצאו ${open.length} פרטים שעלולים לזהות`)
        : (hits.length ? 'כל הממצאים סומנו כלא מזהים' : 'לא נמצאו דפוסים של פרטים מזהים'))));
    const bodyEl = h('div', { class: 'priv-body' },
      h('p', { class: 'priv-note' }, 'זו בדיקה של דפוסים בלבד. היא לא מבטיחה שהטקסט אנונימי.'));
    if (hits.length) {
      bodyEl.append(h('ul', { class: 'hits', id: 'mat-hits' }, hits.map((hit) => {
        const isDismissed = dismissed.has(hit.key);
        const ctx = contextOf(hit.field.text, hit);
        const go = h('button', { type: 'button', class: 'btn btn-ghost btn-sm hit-jump' }, 'מעבר לתיקון');
        go.addEventListener('click', () => jumpTo(hit));
        const dis = h('button', { type: 'button', class: 'btn btn-quiet btn-sm hit-dismiss', 'data-key': hit.key }, isDismissed ? 'להחזיר לרשימה' : 'זה לא פרט מזהה');
        dis.addEventListener('click', () => {
          if (isDismissed) dismissed.delete(hit.key); else dismissed.add(hit.key);
          focusKey = hit.key; // the list is rebuilt: focus comes back to this finding's button
          refresh();
        });
        return h('li', { class: `hit${isDismissed ? ' is-dismissed' : ''}`, 'data-type': hit.type },
          h('div', {},
            h('p', { class: 'hit-where' }, h('span', { class: 'badge badge-danger' }, HIT_LABEL[hit.type] || hit.type), hit.field.where),
            h('p', { class: 'hit-ctx' }, ctx.before, h('mark', {}, ctx.match), ctx.after)),
          h('div', { class: 'hit-btns' }, go, dis));
      })));
    }
    priv.append(bodyEl);
    if (focusKey) {
      const again = priv.querySelector(`button.hit-dismiss[data-key="${CSS.escape(focusKey)}"]`);
      focusKey = null;
      if (again) again.focus({ preventScroll: true });
    }
  }

  function refresh() {
    if (!refs) return;
    const { lim, rqCount, totals, blockers, startBtn } = refs;
    rqCount.textContent = `${fmt(draft.rq.length)} / ${fmt(lim.question)}`;
    rqCount.classList.toggle('is-over', draft.rq.length > lim.question);
    document.querySelectorAll('#mat-itv-list [data-count]').forEach((el) => {
      const i = Number(el.dataset.count);
      const n = (draft.interviews[i] && draft.interviews[i].text.length) || 0;
      el.textContent = `${fmt(n)} / ${fmt(lim.perInterview)}`;
      el.classList.toggle('is-over', n > lim.perInterview);
    });
    const total = draft.interviews.reduce((n, x) => n + x.text.length, 0);
    const filled = draft.interviews.filter((x) => x.text.trim()).length;
    clear(totals);
    totals.append(
      h('span', { class: filled > lim.maxInterviews ? 'is-over' : '' }, `${fmt(filled)} ראיונות עם טקסט, מתוך ${fmt(lim.maxInterviews)} אפשריים`),
      h('span', { class: total > lim.total ? 'is-over' : '', id: 'mat-total' }, `סך הכול ${fmt(total)} / ${fmt(lim.total)} תווים`));
    // mark interviews that hold a privacy hit
    const hitItv = new Set(allHits().filter((x) => !dismissed.has(x.key)).map((x) => x.field.itv));
    document.querySelectorAll('#mat-itv-list .itv').forEach((el) => el.classList.toggle('has-hit', hitItv.has(Number(el.dataset.index))));
    // fewer than about ten interviews: a note, never a block (paper, section 8)
    refs.thin.hidden = filled === 0 || filled >= 10;
    refs.thin.textContent = filled > 0 && filled < 10
      ? `${filled === 1 ? 'יש כרגע ראיון אחד' : `יש כרגע ${fmt(filled)} ראיונות`}. אפשר להריץ כך, אבל עם פחות מעשרה ראיונות הניתוח צפוי להיות דק: חלק מהצירים ייצאו שבירים כי אין מספיק חומר.`
      : '';
    renderPrivacy();
    const b = collectBlockers();
    clear(blockers);
    b.forEach((t) => blockers.append(h('li', {}, t)));
    startBtn.disabled = b.length > 0;
    const open = allHits().filter((x) => !dismissed.has(x.key)).length;
    announceState(`${open === 1 ? 'פרט מזהה אחד בבדיקת הפרטיות' : `${open} פרטים מזהים בבדיקת הפרטיות`}. ${b.length ? `${b.length === 1 ? 'דבר אחד חסר' : `${b.length} דברים חסרים`} כדי להתחיל.` : 'אפשר להתחיל את הניתוח.'}`);
  }

  // ---------- after starting: the run card ----------
  function renderRunCard() {
    const live = app.live;
    const card = h('div', { class: 'mat-card mat-run', id: 'mat-run' },
      h('div', { class: 'mat-run-h' },
        h('h3', { tabindex: '-1' }, 'הניתוח שלכם'),
        h('span', { class: 'id' }, live.runId || '')),
      h('p', { class: 'muted', id: 'mat-run-where', style: { margin: 0 } }),
      h('div', { class: 'mini-axis', id: 'mat-progress', 'aria-hidden': 'true' },
        ['1', '2', '3', '4', 'A', '5', '6', '7', 'B', '8', '9'].map((st) => h('span', { 'data-st': st, class: /[AB]/.test(st) ? 'is-cp' : '' }))),
      h('p', { id: 'mat-run-status', role: 'status', style: { margin: 0 } }, ''),
      h('div', { id: 'mat-privacy-ack' }),
      h('div', { class: 'mat-run-actions', id: 'mat-run-actions' }));
    body.append(card);
    updateRunCard();
  }

  // The server's privacy findings, in context, while stage 1 waits for the person's decision.
  function serverHits() {
    const lc = localCorpus();
    const byId = new Map(lc.interviews.map((x) => [x.id, x]));
    const where = (field, id) => {
      if (field === 'research_question') return 'שאלת המחקר';
      const itv = byId.get(id);
      const nm = itv ? `, ${itv.pseudonym}` : '';
      return field === 'pseudonym' ? `כינוי לראיון ${id}${nm}` : `ראיון ${id}${nm}`;
    };
    const w = app.live && Array.isArray(app.live.privacyWarnings) ? app.live.privacyWarnings : null;
    if (w) {
      return w.map((x) => ({ type: x.type, where: where(x.field, x.interview_id), before: x.before || '', match: x.match || '', after: x.after || '' }));
    }
    // after a reload the server keeps only the count; the same scan runs here on this tab's draft
    const out = [];
    if (lc.research_question) scanText(lc.research_question).forEach((hit) => out.push({ type: hit.type, where: where('research_question'), ...contextOf(lc.research_question, hit) }));
    lc.interviews.forEach((x) => {
      scanText(x.pseudonym).forEach((hit) => out.push({ type: hit.type, where: where('pseudonym', x.id), ...contextOf(x.pseudonym, hit) }));
      scanText(x.text).forEach((hit) => out.push({ type: hit.type, where: where('text', x.id), ...contextOf(x.text, hit) }));
    });
    return out;
  }

  function renderPrivacyAck(box) {
    clear(box);
    if (!app.live || app.live.awaiting !== 'privacy') return;
    const hits = serverHits();
    const total = Number.isFinite(app.live.privacyTotal) ? app.live.privacyTotal : hits.length;
    const note = h('p', { class: 'form-status', role: 'status' });
    const go = h('button', { type: 'button', class: 'btn btn-warm btn-sm', id: 'mat-privacy-go' }, icon('check'), 'עברתי על הממצאים. להמשיך לניתוח');
    go.addEventListener('click', async () => {
      go.disabled = true;
      note.classList.remove('is-error');
      note.textContent = 'שולח...';
      try { await app.live.acknowledgePrivacy(); } catch (e) { note.textContent = e.message; note.classList.add('is-error'); go.disabled = false; }
    });
    // The page's own check and the server's run the same code (npm run sync:privacy), so these are the
    // findings the person already marked as not identifying: the server asks for the decision itself.
    box.append(h('div', { class: 'priv has-hits priv-ack', id: 'mat-privacy-server' },
      h('div', { class: 'priv-head' }, icon('alert'),
        h('strong', { id: 'mat-privacy-title', tabindex: '-1' }, `${serverName()} בדק את הטקסט שוב ומצא ${total === 1 ? 'את הפרט שסימנתם כלא מזהה' : `את ${fmt(total)} הפרטים שסימנתם כלא מזהים`}. אשרו שוב כדי להתחיל.`)),
      h('div', { class: 'priv-body' },
        h('p', { class: 'priv-note' }, 'שום טקסט לא נשלח עדיין לספק המודל. אם אחד הממצאים מזהה אדם, מחקו את ההרצה, תקנו את הטקסט והתחילו מחדש. אם אף אחד מהם לא מזהה, אפשר להמשיך.'),
        hits.length ? h('ul', { class: 'hits' }, hits.slice(0, 20).map((x) => h('li', { class: 'hit', 'data-type': x.type },
          h('div', {},
            h('p', { class: 'hit-where' }, h('span', { class: 'badge badge-danger' }, HIT_LABEL[x.type] || x.type), x.where),
            h('p', { class: 'hit-ctx' }, x.before, h('mark', {}, x.match), x.after))))) : null,
        h('div', { class: 'list-actions' }, go, app.live.deleteControl('privacy')),
        note)));
  }

  function updateRunCard() {
    const card = $('#mat-run');
    if (!card || !app.live) return;
    const m = app.model;
    const done = new Set(Object.keys((m.run && m.run.stages) || {}));
    if (m.cpA) done.add('A');
    if (m.cpB) done.add('B');
    const order = ['1', '2', '3', '4', 'A', '5', '6', '7', 'B', '8', '9'];
    const now = order.find((st) => !done.has(st));
    card.querySelectorAll('#mat-progress span').forEach((el) => {
      el.classList.toggle('is-done', done.has(el.dataset.st));
      el.classList.toggle('is-now', el.dataset.st === now);
    });
    const st = $('#mat-run-status');
    // The server no longer knows this run (live.js forgotten()): nothing to follow, nothing left there to delete.
    if (app.live.forgotten) {
      clear($('#mat-run-where')).append('הטקסטים שלכם לא נשמרו בשרת. הטיוטה עדיין בלשונית הזאת.');
      clear($('#mat-privacy-ack'));
      st.textContent = app.live.forgotten;
      const back = h('button', { type: 'button', class: 'btn btn-primary btn-sm', id: 'mat-forgotten-back' }, 'חזרה לטופס');
      back.addEventListener('click', () => app.liveApi.backToReplay());
      clear($('#mat-run-actions')).append(back);
      return;
    }
    // where the texts are, worded by state: nothing has left the server before the privacy decision
    const where = clear($('#mat-run-where'));
    const prov = h('span', { class: 'provider-name' }, app.live.providerLabel || '');
    if (!done.has('1')) where.append(`הטקסטים נמצאים ${inServer()}. ${app.live.awaiting === 'privacy' ? 'רק אחרי ההחלטה שלכם הם יישלחו אל: ' : 'הם נשלחים אל: '}`, prov);
    else where.append('הטקסטים נשלחו אל: ', prov);
    renderPrivacyAck($('#mat-privacy-ack'));
    if (app.live.done) st.textContent = 'הניתוח הסתיים. אפשר להוריד את הממצאים, ובסוף למחוק את ההרצה ואת הטקסטים.';
    else if (app.live.ended === 'no_retained') st.textContent = 'הניתוח נעצר בנקודת עצירה א: אף ניגוד לא שרד, ולכן אין ממה לבנות צירים. אפשר להוריד את רשומת ההרצה, ובסוף למחוק את ההרצה ואת הטקסטים.';
    else if (app.live.awaiting === 'privacy') st.textContent = 'ההרצה ממתינה להחלטה שלכם על בדיקת הפרטיות. עד אז שום טקסט לא נשלח למודל.';
    else if (app.live.awaiting === 'A') st.textContent = 'ההרצה ממתינה לכם בנקודת עצירה א.';
    else if (app.live.awaiting === 'B') st.textContent = 'ההרצה ממתינה לכם בנקודת עצירה ב.';
    else st.textContent = `בעבודה: ${done.size} מתוך 11 צעדים הושלמו.`;
    const actions = clear($('#mat-run-actions'));
    actions.append(h('a', { class: 'btn btn-ghost btn-sm', href: '#run' }, 'למעקב בהרצה'));
    if (app.live.awaiting === 'A') actions.append(h('a', { class: 'btn btn-warm btn-sm', href: '#checkpoint-a' }, 'לנקודת עצירה א'));
    if (app.live.awaiting === 'B') actions.append(h('a', { class: 'btn btn-warm btn-sm', href: '#checkpoint-b' }, 'לנקודת עצירה ב'));
    if (app.live.done) actions.append(h('a', { class: 'btn btn-primary btn-sm', href: '#findings' }, 'לממצאים ולהורדה'));
    if (app.live.ended === 'no_retained') actions.append(h('a', { class: 'btn btn-primary btn-sm', href: '#findings' }, 'להורדת רשומת ההרצה'));
    // while the privacy box is shown it holds the delete control itself: one delete button, not two
    if (app.live.awaiting !== 'privacy') actions.append(app.live.deleteControl('materials'));
  }

  app.on('health', render);
  app.on('mode', render);
  // a remote server waking from a cold start: the waking card, until its answer re-renders the section
  app.on('health-state', (st) => { if (st === 'waking' && !app.health && !(app.live && app.live.kind === 'custom')) render(); });
  app.on('model', () => { if (app.live && app.live.kind === 'custom') updateRunCard(); });
  app.on('live-progress', updateRunCard);
  app.on('live-busy', () => { if (refs) refresh(); });
  document.addEventListener('mabat:access-code', () => { if (refs) refresh(); });
  app.on('live-deleted', (ev) => {
    draft = emptyDraft();
    dismissed = new Set();
    lastNotice = `ההרצה והטקסטים נמחקו מ${serverName()} ומהדפדפן.`;
    // the confirmation takes focus here unless the person deleted from the findings (shown there)
    focusNotice = !(ev && ev.where === 'findings');
    render();
  });
  render();
}

// Live mode (ARCHITECTURE 5.1, 5.3, 5.4). The API base URL comes only from config.js (through health.js).
// The page talks to it when the engine answers GET /api/health: a remote API (the public demo on Cloud Run,
// also from GitHub Pages), or the local API when the page itself is served from this machine. The browser can
// only create a run, advance it, answer a checkpoint or the privacy acknowledgement, read it and delete it;
// prompts, stage wiring and the model live on the server.
import { $, h, clear, announce, tabStore, sleep } from './util.js';
import { icon } from './icons.js';
import { API, hasApi, apiIsRemote, pageIsLocal, mayCallApi, fetchHealth, pacificMidnightLocal, localTime } from './health.js';

export { API, hasApi, apiIsRemote, pageIsLocal };
export const DRAFT_KEY = 'mabat-kaful:materials-draft';
export const RUN_KEY = 'mabat-kaful:custom-run';

// The last GET /api/health answer: some messages depend on the server (its limits, its storage, its fallback).
let currentHealth = null;
const fmtN = (n) => Number(n || 0).toLocaleString('he-IL');
/** "the local server" or "the server", for the texts that name where the materials go. */
export const serverName = () => (apiIsRemote() ? 'השרת' : 'השרת המקומי');
// Hebrew fuses "in"/"to" with the article: בשרת, not בהשרת. (מ + ה stays: מהשרת.)
export const inServer = () => (apiIsRemote() ? 'בשרת' : 'בשרת המקומי');
export const toServer = () => (apiIsRemote() ? 'לשרת' : 'לשרת המקומי');

// The access code (ARCHITECTURE 5.4) is held in memory only: never stored, never logged, sent as a
// header on every API call once the person has typed it.
let accessCode = '';
export function setAccessCode(code) { accessCode = String(code || '').trim(); }
export const hasAccessCode = () => !!accessCode;

/** The access-code field shown when GET /api/health says access_code_required. Returns { wrap, input }. */
export function accessCodeField(id) {
  const input = h('input', {
    type: 'password', class: 'tx code-input', id, autocomplete: 'off', spellcheck: 'false', maxlength: '200', dir: 'ltr',
  });
  input.value = accessCode;
  input.addEventListener('input', () => {
    setAccessCode(input.value);
    // keep every code field on the page in step, and let the forms re-check what blocks them
    document.querySelectorAll('input.code-input').forEach((el) => { if (el !== input) el.value = input.value; });
    document.dispatchEvent(new CustomEvent('mabat:access-code'));
  });
  const wrap = h('div', { class: 'field access-code' },
    h('label', { class: 'field-label', for: id }, 'קוד גישה'),
    input,
    h('p', { class: 'hint small' }, 'השרת הזה פתוח רק למי שקיבל קוד מהחוקרות. הקוד נשמר רק בזיכרון של הדף ונשלח עם כל בקשה לשרת.'));
  return { wrap, input };
}

// A 413's details ({ field: 'interviews' | 'total' | '<id>.text', interview_id, limit, actual }) in words.
function overLimits(details) {
  const parts = [];
  for (const d of Array.isArray(details) ? details : []) {
    if (!d || !Number.isFinite(Number(d.limit))) continue;
    if (d.field === 'interviews') parts.push(`${fmtN(d.actual)} ראיונות, והמגבלה היא ${fmtN(d.limit)}`);
    else if (d.field === 'total') parts.push(`סך הכול ${fmtN(d.actual)} תווים, והמגבלה היא ${fmtN(d.limit)}`);
    else if (d.interview_id) parts.push(`ראיון ${d.interview_id} ארוך ${fmtN(d.actual)} תווים, והמגבלה היא ${fmtN(d.limit)}`);
  }
  return parts.join('; ');
}

// Stage 4 left no retained pair (or checkpoint A set every one aside): stage 5 has nothing to build axes from, and the
// method ends the analysis there (added 2026-09-30, live QA: two short invented interviews on the free model).
export const NO_RETAINED_TEXT = 'אף ניגוד לא נשאר אחרי שלב 4 ונקודת העצירה, ולכן אין ממה לבנות צירים: הניתוח נעצר כאן, כפי שהשיטה מורה. לפי המאמר (סעיף 8), כשכמעט כל הניגודים נופלים ייתכן שבחומר אין מספיק עומק דיאלקטי, למשל כשיש מעט ראיונות, או ראיונות קצרים.';

/** How many retained stage-4 pairs remain once checkpoint A's `removed` ids are set aside. */
export function retainedLeft(record, removed = []) {
  const results = (record && record.stages && record.stages['4'] && record.stages['4'].output && record.stages['4'].output.results) || [];
  const gone = new Set(removed || []);
  return results.filter((x) => x && x.verdict === 'retained' && !gone.has(x.contrast_id)).length;
}

// The public demo's words for "a run this server no longer knows": it keeps runs in memory only.
function forgottenText(code) {
  const memory = currentHealth && currentHealth.storage === 'memory';
  if (code === 'run_expired') return 'ההרצה פגה: השרת שומר הרצות רק בזיכרון, ומוחק הרצה אחרי זמן בלי פעילות. שום דבר ממנה לא נשאר בשרת.';
  if (memory) return 'השרת כבר לא מכיר את ההרצה הזאת. הוא שומר הרצות רק בזיכרון, והן נמחקות כשהוא מופעל מחדש, למשל אחרי זמן בלי פעילות. שום דבר ממנה לא נשאר בשרת.';
  return 'ההרצה לא נמצאת בשרת. ייתכן שנמחקה.';
}

/**
 * The plain Hebrew message for an API error, by code and status. The server's own English message stays on
 * the error as err.detail (see errorText) for whoever debugs it; it is never the message itself. `path` is the
 * request's path: a 404 on a run means the server does not know that run (any more).
 */
export function plainError(status, data, path = '') {
  const code = data && typeof data.code === 'string' ? data.code : '';
  const serverText = data && typeof data.error === 'string' ? data.error : '';
  const limits = (currentHealth && currentHealth.limits) || {};
  if (code === 'access_code_attempts') return 'היו יותר מדי ניסיונות עם קוד גישה שגוי מהכתובת הזאת. נסו שוב בעוד רבע שעה.';
  if (code === 'access_code_invalid') return 'קוד הגישה לא התקבל. השדה נוקה כדי שהקוד השגוי לא יישלח שוב; הקלידו את הקוד מחדש.';
  if (status === 401 || /access_code/.test(code)) return accessCode ? 'קוד הגישה לא התקבל. בדקו אותו ונסו שוב.' : 'השרת דורש קוד גישה. הקלידו אותו בשדה קוד הגישה.';
  // The public demo's free model (D16): Google's own rate limit, told by the server as demo_quota.
  if (code === 'demo_quota') {
    if (data.quota === 'daily') {
      const at = pacificMidnightLocal();
      return `המודל החינמי של ההדגמה ניצל את כל הבקשות שלו להיום. Google מחדשת את המכסה החינמית בחצות לפי שעון החוף המערבי בארצות הברית${at ? `, כלומר בערך ב-${at} אצלכם` : ''}. בינתיים אפשר לצפות בהרצה המוקלטת.`;
    }
    const s = Number(data.retry_after_s);
    if (data.quota === 'minute' || (Number.isFinite(s) && s > 0)) {
      return `המודל החינמי מקבל רק מעט בקשות בכל דקה, וכרגע הגיע למגבלה. ${Number.isFinite(s) && s > 0 ? `חכו כ-${fmtN(s)} שניות` : 'חכו דקה'} ונסו שוב את השלב.`;
    }
    return 'המכסה של המודל החינמי נגמרה לעת עתה. נסו שוב בעוד כמה דקות. אם זה חוזר, נגמרה המכסה היומית, והיא מתחדשת מחר.';
  }
  if (code === 'demo_ip_run_limit') {
    const n = Number(limits.runs_per_ip_per_day);
    const at = localTime(data.resetsAt);
    return `מהכתובת הזאת כבר התחילו היום ${Number.isFinite(n) && n > 0 ? `${fmtN(n)} הרצות` : 'כמה הרצות'}, המספר המרבי בהדגמה הציבורית${at ? `. המגבלה מתאפסת ב-${at}` : ''}. בינתיים אפשר לצפות בהרצה המוקלטת.`;
  }
  if (code === 'daily_run_limit') {
    const at = localTime(data.resetsAt);
    return `השרת הגיע היום למספר ההרצות המרבי שלו${at ? `, והמגבלה מתאפסת ב-${at}` : ''}. אפשר לחזור מחר, ובינתיים לצפות בהרצה המוקלטת.`;
  }
  if (code === 'daily_quota') {
    const at = localTime(data.resetsAt);
    return `השרת ניצל את מכסת הקריאות למודל שלו להיום${at ? `, והיא מתחדשת ב-${at}` : ''}. אפשר לחזור מחר, ובינתיים לצפות בהרצה המוקלטת.`;
  }
  // Added 2026-09-30 (security review): the server's daily allowance of outbound data is used up.
  if (code === 'daily_egress_limit') {
    const at = localTime(data.resetsAt);
    return `השרת של ההדגמה שלח היום את כל כמות הנתונים שמותרת לו${at ? `, והמגבלה מתאפסת ב-${at}` : ''}. אפשר לחזור מחר, ובינתיים לצפות בהרצה המוקלטת.`;
  }
  if (status === 429) return 'השרת קיבל יותר מדי בקשות מהכתובת הזאת. חכו דקה ונסו שוב.';
  if (status === 413) {
    const what = overLimits(data && data.limits);
    return what
      ? `הטקסט ארוך מהמגבלות של השרת: ${what}. קצרו אותו, או חלקו ראיון ארוך לכמה חלקים, ונסו שוב.`
      : 'הטקסט ארוך מהמגבלה של השרת. קצרו אותו, או חלקו ראיון ארוך לכמה חלקים, ונסו שוב.';
  }
  if (code === 'server_full') return 'השרת מריץ כרגע יותר מדי ניתוחים. נסו שוב בעוד כמה דקות.';
  if (code === 'run_expired') return forgottenText(code);
  if (code === 'run_deleted') return 'הניתוח נמחק בזמן שהשלב רץ. שום דבר ממנו לא נשמר.';
  if (code === 'custom_corpus_disabled') return 'השרת הזה לא מקבל חומרים משלכם, רק את ההדגמה. ניתוח חומרים משלכם זמין בהתקנה מקומית.';
  if (code === 'consent_required') return 'צריך לסמן את תיבת ההסכמה לפני השליחה.';
  if (code === 'privacy_ack_required') return 'בדיקת הפרטיות של השרת ממתינה להחלטה שלכם לפני שהניתוח ממשיך.';
  if (code === 'no_retained_contrasts') return NO_RETAINED_TEXT;
  if (status === 404 && /^\/api\/runs\//.test(path)) return forgottenText(code);
  if (status === 404) return 'השרת לא מכיר את הבקשה הזאת.';
  if (status === 409) return 'הפעולה לא מתאימה לשלב שבו הניתוח נמצא. רעננו את הדף ונסו שוב.';
  if (status === 410) return 'הניתוח נמחק בזמן שהשלב רץ.';
  if (status === 400) return 'השרת לא קיבל את הבקשה, כי משהו בה לא תקין.';
  if (code === 'output_cut_off') return 'התשובה של המודל נקטעה במגבלת האורך שלה, ולכן אינה שלמה. עם חומרים ארוכים זה סימן שהם גדולים מדי לשלב הזה; עם חומרים קצרים זה בדרך כלל סימן שהמודל נתקע בחזרות. אפשר לנסות שוב, ואם זה חוזר, להריץ עם מודל חזק יותר.';
  if (code === 'provider_unavailable') return 'השרת לא מחובר כרגע לספק המודל, ולכן אי אפשר להריץ את השלב. ההרצה המוקלטת זמינה.';
  // An overloaded model: Google answered 503 and, where the server has one, its fallback model too.
  if (code === 'provider_error' && /upstream 503|temporarily unavailable/i.test(serverText)) {
    const fb = currentHealth && currentHealth.fallback_model;
    return `המודל של Google עמוס כרגע${fb ? ', וגם מודל הגיבוי לא ענה' : ''}. זה קורה בשעות עומס. אפשר לנסות שוב את השלב בעוד דקה או שתיים.`;
  }
  if (code === 'provider_error' && /upstream timeout|504/i.test(serverText)) return 'המודל לא ענה בזמן. אפשר לנסות שוב את השלב.';
  if (status === 502 || status === 503 || status === 504) return 'ספק המודל לא ענה כראוי. אפשר לנסות שוב בעוד רגע.';
  return `משהו השתבש בשרת (קוד ${status}).`;
}

// A message element for a failed request: the Hebrew sentence, with the server's own words folded away.
export function errorText(prefix, e) {
  const wrap = h('span', { class: 'err-text' }, `${prefix}${e.message}`);
  if (e.detail) wrap.append(' ', h('details', { class: 'err-detail' }, h('summary', {}, 'פרטים טכניים'), h('code', { dir: 'ltr' }, e.detail)));
  return wrap;
}

// A code the server refused is not sent again: every request carrying it would count as another wrong
// code from this address, and enough of them lock out everyone behind the same address (a workshop room).
function forgetAccessCode() {
  accessCode = '';
  if (typeof document === 'undefined') return;
  document.querySelectorAll('input.code-input').forEach((el) => { el.value = ''; });
  document.dispatchEvent(new CustomEvent('mabat:access-code'));
}

/**
 * One API request. Resolves to { res, data }; throws an Error with a plain Hebrew message, and with
 * `status` and `data` for an HTTP error, or `lost: true` when no answer came (a timeout or a lost
 * connection: the request may still be running on the server). timeoutMs 0 = no timeout of our own.
 */
async function request(method, path, body, timeoutMs = 300000) {
  const ctl = new AbortController();
  const t = timeoutMs > 0 ? window.setTimeout(() => ctl.abort(), timeoutMs) : null;
  const headers = {};
  if (body) headers['Content-Type'] = 'application/json';
  if (accessCode) headers['X-Access-Code'] = accessCode;
  let res;
  try {
    res = await fetch(API + path, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
      signal: ctl.signal,
      cache: 'no-store',
      credentials: 'omit',
    });
  } catch (e) {
    let msg;
    if (e.name === 'AbortError') msg = `${serverName()} לא ענה בזמן.`;
    else if (apiIsRemote()) msg = 'אין חיבור לשרת. בדקו את החיבור לאינטרנט ונסו שוב.';
    else msg = `אין חיבור ${toServer()}. בדקו שהוא עדיין רץ.`;
    const err = new Error(msg);
    err.lost = true;
    throw err;
  } finally {
    if (t !== null) window.clearTimeout(t);
  }
  let data = null;
  try { data = await res.json(); } catch { data = null; }
  if (!res.ok) {
    const err = new Error(plainError(res.status, data, path));
    err.status = res.status;
    err.data = data;
    err.detail = data && typeof data.error === 'string' ? data.error : '';
    // A run the server no longer knows: memory storage restarted, or the run expired.
    err.forgotten = (res.status === 404 && /^\/api\/runs\/[^/]+/.test(path)) || (data && data.code === 'run_expired');
    if (res.status === 401 && data && data.code === 'access_code_invalid') forgetAccessCode();
    throw err;
  }
  return { res, data };
}

export async function api(method, path, body, timeoutMs = 300000) {
  return (await request(method, path, body, timeoutMs)).data;
}

// One stage can take much longer than an ordinary request: a single model call was measured at 214 s on
// the 22,000-character demo, a call may be retried and repaired, and stage 1 makes one call per interview.
// So the advance request waits this long, and after that (or after a lost connection) the portal does
// not give up: it waits for the stage through advanceWithRecovery().
export const ADVANCE_TIMEOUT_MS = 15 * 60000;
export const ADVANCE_POLL_MS = 10000;

/**
 * Advance one stage, surviving a request that is cut off. The server keeps computing a stage after the
 * browser's request is gone (our timeout, a lost connection, a proxy's limit) and refuses a second advance
 * while it does (409 stage_running). After either, this reads the run every `pollMs`:
 *   - the stage is in the record: it is returned in the shape of an advance response;
 *   - the server says nothing is running (X-Run-Running: 0) and the run records an error for this stage:
 *     that error is thrown;
 *   - nothing is running and nothing is recorded (the request never arrived, or the server restarted):
 *     the advance is sent once more.
 * post() sends the advance; get() resolves to { record, running }. Both throw like api().
 */
export async function advanceWithRecovery({ stage, post, get, sleep, pollMs = ADVANCE_POLL_MS, maxLostPolls = 6, onWait = () => {} }) {
  let resent = false;
  for (;;) {
    try {
      return await post();
    } catch (e) {
      const lost = Boolean(e && e.lost);
      const running = Boolean(e && e.status === 409 && e.data && e.data.code === 'stage_running');
      if (!lost && !running) throw e;
    }
    onWait();
    let lostPolls = 0;
    for (;;) {
      await sleep(pollMs);
      let got;
      try {
        got = await get();
        lostPolls = 0;
      } catch (e) {
        if (e && e.lost && ++lostPolls < maxLostPolls) continue;
        throw e;
      }
      const rec = (got && got.record) || {};
      const st = rec.state || {};
      const done = rec.stages && rec.stages[String(stage)];
      if (done) {
        const calls = Array.isArray(done.calls) ? done.calls : [];
        return {
          stage: Number(stage), agent: calls[0] ? calls[0].agent : null, output: done.output || {}, calls,
          next: st.next ?? null, awaiting_checkpoint: st.awaiting_checkpoint || null, done: Boolean(st.done),
        };
      }
      if (got && got.running) continue;
      if (st.error && Number(st.error.stage) === Number(stage)) {
        const err = new Error(typeof st.error.message === 'string' && st.error.message ? st.error.message : `שלב ${stage} נכשל.`);
        err.status = 502;
        err.data = { error: st.error.message, code: st.error.code };
        throw err;
      }
      break;
    }
    if (resent) throw new Error(`${serverName()} אינו מריץ את שלב ${stage} ולא רשם אותו. נסו שוב.`);
    resent = true;
  }
}

/** A Hebrew one-letter prefix (ל, ב, מ...) glued to a word: with a maqaf before a Latin letter or a digit ("ל-Google"). */
export function hePrefix(prefix, word) {
  const w = String(word || '');
  return /^[A-Za-z0-9]/.test(w) ? `${prefix}-${w}` : `${prefix}${w}`;
}

// What the consent line names: the provider and mode the local server reports.
export function providerLabel(hh) {
  if (!hh) return '';
  const model = hh.model ? ` (${hh.model})` : '';
  if (hh.provider === 'mock') return `מודל מדומה מקומי${model}: שום טקסט לא יוצא מהמחשב`;
  if (hh.provider === 'gemini') {
    if (String(hh.mode || '').startsWith('vertex')) {
      const region = hh.region || hh.location || hh.vertex_region || '';
      return `Vertex AI של Google${region ? `, ${region}` : ''}${model}`;
    }
    if (hh.public_demo === true || hh.mode === 'public-api-free-tier') return `Google Gemini API, במפתח החינמי של ההדגמה${model}`;
    return `Google Gemini API (ציבורי)${model}`;
  }
  return `${hh.provider || 'ספק לא ידוע'}${model}`;
}

const REGION_PLACE = {
  'me-west1': 'ישראל (תל אביב)',
  'us-central1': 'ארצות הברית (איווה)',
  'us-east1': 'ארצות הברית (דרום קרוליינה)',
  'europe-west1': 'בלגיה',
  'europe-west4': 'הולנד',
  global: 'Google בוחרת את המיקום, בלי התחייבות לאזור מסוים',
};

// "Where the text goes" (ARCHITECTURE 5.3): what happens to the text at the destination the server
// names, in words a researcher can weigh. The Gemini API wording follows Google's Gemini API terms
// (ai.google.dev/gemini-api/terms, "Unpaid Services" and "Paid Services"), checked 2026-09-30.
export function destinationLines(hh) {
  if (!hh) return [];
  // The public demo (D16): a free key that the server holds, not the visitor's; so no advice about keys here.
  if (hh.public_demo === true) {
    const where = hh.provider === 'mock'
      ? 'בשרת הזה המודל הוא מודל מדומה, אבל בהדגמה הציבורית הטקסט נשלח ל-Google דרך Gemini API.'
      : 'הטקסט נשלח לשרת ההדגמה, ומשם ל-Google דרך Gemini API, במפתח החינמי של ההדגמה. Google לא מתחייבת לאזור שבו הוא מעובד.';
    return [
      where,
      'לפי התנאים של Google, מה שנשלח במפתח חינמי עשוי לשמש לשיפור המוצרים שלה, ועובדים שלה עשויים לקרוא אותו.',
      'לכן כאן רק טקסט בדוי, או טקסט שאין בו שום דבר על אדם אמיתי. ראיונות מחקר מנתחים בהתקנה מקומית, עם מפתח מפרויקט בתשלום או במודל של המוסד.',
    ];
  }
  if (hh.provider === 'mock' || hh.mode === 'mock') return ['מודל מדומה שרץ על המחשב הזה. שום טקסט לא יוצא מהמחשב.'];
  if (String(hh.mode || '').startsWith('vertex')) {
    const region = hh.region || hh.location || hh.vertex_region || '';
    const place = REGION_PLACE[region] || (region ? `אזור ${region}` : 'לא ידוע');
    return [
      'הטקסט נשלח ל-Vertex AI של Google, בפרויקט הענן שהוגדר בשרת.',
      `איפה הוא מעובד: ${place}.`,
    ];
  }
  return [
    'הטקסט נשלח לשרתים של Google דרך Gemini API. Google לא מתחייבת לאזור שבו הוא מעובד.',
    'במפתח מפרויקט בלי חיוב, לפי התנאים של Google, התוכן עשוי לשמש לשיפור המוצרים שלה, ועובדים שלה עשויים לקרוא אותו. Google עצמה מבקשת לא לשלוח כך מידע אישי או רגיש.',
    'לכן השתמשו רק במפתח מפרויקט עם חיוב פעיל. שם, לפי אותם תנאים, התוכן לא משמש לשיפור המוצרים, ונשמר לזמן מוגבל רק כדי לאתר שימוש לרעה ולעמוד בדרישות החוק.',
  ];
}

// Limits from GET /api/health, with the contract's values when a key is missing (ARCHITECTURE 5.3).
export function limitsOf(hh) {
  const l = (hh && hh.limits) || {};
  const pick = (keys, fallback) => {
    for (const k of keys) {
      const v = Number(l[k]);
      if (Number.isFinite(v) && v > 0) return v;
    }
    return fallback;
  };
  return {
    maxInterviews: pick(['max_interviews', 'interviews_max', 'interviews'], 12),
    perInterview: pick(['max_interview_chars', 'interview_chars', 'per_interview_chars', 'max_chars_per_interview'], 25000),
    total: pick(['max_total_chars', 'total_chars', 'max_corpus_chars', 'corpus_chars'], 150000),
    question: pick(['max_question_chars', 'research_question_chars', 'question_chars', 'max_research_question_chars'], 500),
    // the public demo's new runs per address a day (0 = no such limit)
    runsPerIp: pick(['runs_per_ip_per_day'], 0),
  };
}

const LABEL_BY_STAGE = { 1: 'קורא כל ראיון ומסמן יחידות משמעות', 2: 'נותן תוויות תיאוריות', 3: 'בונה ניגודים, בלי לראות את הראיונות', 4: 'מחפש את הניגודים בראיונות', 5: 'בונה צירים, בלי לראות את הראיונות', 6: 'מחפש נקודות אמצע בראיונות', 7: 'מציע שמות לצירים', 8: 'ממפה קשרים בין צירים, בלי לראות את הראיונות', 9: 'כותב את הטקסט המסכם' };

export async function initLive(app, run) {
  app.health = null;
  const btn = $('#rc-live');
  const statusEl = $('#live-status');
  let busy = false;
  let liveRun = null;
  let corpus = app.file.corpus;

  const status = (text, { error = false, spin = false, actions = null } = {}) => {
    clear(statusEl);
    statusEl.hidden = !text;
    statusEl.classList.toggle('is-error', error);
    if (spin) statusEl.append(h('span', { class: 'spinner', 'aria-hidden': 'true' }));
    statusEl.append(h('span', {}, text || ''));
    if (actions) statusEl.append(actions);
    if (text) announce(text);
  };

  // app.healthState: 'off' (no API this page may call), 'checking', 'waking' (a remote server that has not
  // answered yet: a Cloud Run cold start), 'ok', 'failed'. Emitted as 'health-state'.
  let wakingShown = false;
  const setHealthState = (st) => { app.healthState = st; document.documentElement.dataset.api = st; app.emit('health-state', st); };

  async function probe() {
    // A page on a public host (GitHub Pages) never calls an API on 127.0.0.1: that is a different
    // person's machine. It calls a remote API only when config.js names one (health.js mayCallApi).
    if (!mayCallApi()) {
      app.health = null; currentHealth = null; btn.hidden = true;
      setHealthState('off');
      app.emit('health', null);
      return null;
    }
    setHealthState('checking');
    const { health, state } = await fetchHealth({
      onWaking: () => {
        setHealthState('waking');
        // only while nothing else is being said in the run area
        if (!busy && !liveRun && statusEl.hidden) {
          wakingShown = true;
          status('מעירים את השרת של ההדגמה... אחרי הפסקה זה יכול לקחת עד חצי דקה. בינתיים אפשר לצפות בהרצה המוקלטת.', { spin: true });
        }
      },
    });
    app.health = health;
    currentHealth = health;
    btn.hidden = !app.health || customRunOpen();
    if (app.health) btn.title = providerLabel(app.health);
    if (wakingShown) {
      wakingShown = false;
      if (!busy && !liveRun) status('');
    }
    if (!health && apiIsRemote() && !busy && !liveRun && statusEl.hidden) {
      const again = h('button', { type: 'button', class: 'chip-btn', id: 'live-probe-again' }, icon('rotate'), 'לנסות שוב להתחבר');
      again.addEventListener('click', () => { status(''); probe(); });
      status('השרת של ההדגמה לא ענה, ולכן אי אפשר להריץ כרגע את הסוכנים בעצמכם. ההרצה המוקלטת זמינה במלואה.', { actions: again });
    }
    setHealthState(state);
    app.emit('health', app.health);
    // today's prompt fingerprints, so "under the hood" can say whether the run on screen used them
    if (app.health) loadPromptHashes();
    return app.health;
  }

  const setBusy = (on) => { busy = on; btn.disabled = on; app.emit('live-busy', on); };

  // Stage-1 calls carry each interview in their input; use them so quotes resolve against the
  // server's corpus (it assigns the interview ids).
  function corpusFromCalls(calls, base) {
    const itvs = (calls || []).filter((c) => c && c.repair_of === undefined)
      .map((c) => c && c.input && c.input.interview).filter((x) => x && x.id && typeof x.text === 'string');
    return itvs.length ? { ...base, interviews: itvs } : base;
  }

  function backToReplay() {
    if (busy) return;
    app.mode = 'replay';
    app.live = null;
    app.setModel(app.file.corpus, app.file.run);
    app.loadNames();
    app.loadSetAside();
    app.emit('names-all');
    app.emit('mode');
    run.go(null);
    status('');
  }

  const backBtn = () => {
    const b = h('button', { type: 'button', class: 'chip-btn' }, 'חזרה להרצה המוקלטת');
    b.addEventListener('click', backToReplay);
    return b;
  };

  function progress(extra = {}) {
    const done = liveRun ? Object.keys(liveRun.stages).map(Number) : [];
    app.emit('live-progress', { runId: liveRun && liveRun.run_id, done, awaiting: app.live && app.live.awaiting, finished: !!(app.live && app.live.done), ...extra });
  }

  async function loop() {
    setBusy(true);
    try {
      for (;;) {
        const nextN = Object.keys(liveRun.stages).length + 1;
        status(`שלב ${nextN} מתוך 9: הסוכן ${LABEL_BY_STAGE[nextN] || 'עובד'}...`, { spin: true });
        progress({ working: nextN });
        const runPath = `/api/runs/${encodeURIComponent(liveRun.run_id)}`;
        const res = await advanceWithRecovery({
          stage: nextN,
          post: () => api('POST', `${runPath}/advance`, {}, ADVANCE_TIMEOUT_MS),
          get: async () => {
            const { res: r, data } = await request('GET', runPath, null, 20000);
            return { record: data, running: r.headers.get('X-Run-Running') !== '0' };
          },
          sleep,
          onWait: () => status(`שלב ${nextN} מתוך 9: ${serverName()} עדיין עובד על השלב הזה. ממתינים לו...`, { spin: true }),
        });
        liveRun.stages[String(res.stage)] = { output: res.output || {}, calls: res.calls || [] };
        if (Number(res.stage) === 1) corpus = corpusFromCalls(res.calls, corpus);
        if (res.awaiting_checkpoint) {
          // The advance answer carries the stage's output and calls. The facts counted by code for the
          // researcher (stages[n].signals, engine/signals.mjs: checkpoint A's facts, checkpoint B's flags) are
          // in the run record, so they are fetched before the checkpoint opens. Without them it still works.
          try {
            const full = await api('GET', `/api/runs/${encodeURIComponent(liveRun.run_id)}`, null, 20000);
            Object.entries((full && full.stages) || {}).forEach(([k, v]) => {
              if (liveRun.stages[k] && v && v.signals) liveRun.stages[k].signals = v.signals;
            });
          } catch { /* the checkpoint opens without the facts */ }
        }
        app.live.awaiting = res.awaiting_checkpoint || null;
        app.setModel(corpus, liveRun);
        run.go(String(res.stage));
        if (res.awaiting_checkpoint) {
          const key = res.awaiting_checkpoint;
          run.go(key);
          const link = h('a', { class: 'chip-btn', href: key === 'A' ? '#checkpoint-a' : '#checkpoint-b' }, 'לנקודת העצירה', icon('arrowDown'));
          status(key === 'A'
            ? 'ההרצה ממתינה לכם: עברו על הניגודים ששרדו, כתבו רפלקציה, והחליטו אם להניח זוגות בצד.'
            : 'ההרצה ממתינה לכם: בחרו שם לכל ציר.', { actions: link });
          setBusy(false);
          progress();
          return;
        }
        if (res.done) break;
      }
      try {
        const full = await api('GET', `/api/runs/${encodeURIComponent(liveRun.run_id)}`);
        if (full && full.stages) liveRun = { ...full, stages: full.stages, checkpoints: full.checkpoints || liveRun.checkpoints };
      } catch { /* keep what we have */ }
      app.live.awaiting = null;
      app.live.done = true;
      app.setModel(corpus, liveRun);
      run.go('9');
      const actions = h('span', { class: 'rc-group' }, h('a', { class: 'chip-btn', href: '#findings' }, 'לממצאים', icon('arrowDown')));
      if (app.live.kind !== 'custom') actions.append(backBtn());
      status(app.live.kind === 'custom'
        ? `הניתוח הסתיים. הממצאים ובדיקות האיכות מעודכנים למטה. הטקסטים שלכם נשארים ${inServer()} עד שתמחקו אותם.`
        : 'ההרצה החיה הסתיימה. הממצאים ובדיקות האיכות מעודכנים למטה.', { actions });
      progress();
    } catch (e) {
      setBusy(false);
      if (e && e.forgotten) { forgotten(e); return; }
      if (e && e.data && e.data.code === 'no_retained_contrasts') {
        app.live.ended = 'no_retained';
        app.setModel(corpus, liveRun);
        endedAtA();
        return;
      }
      const more = e.detail ? h('details', { class: 'err-detail' }, h('summary', {}, 'פרטים טכניים'), h('code', { dir: 'ltr' }, e.detail)) : null;
      // A busy or unreachable model (502/503/504, a rate limit, a lost connection) is worth another try, and
      // the engine allows it: a failed stage records nothing, so the same stage is simply sent again. A daily
      // limit is not: nothing succeeds before it resets.
      const data = (e && e.data) || {};
      const code = data.code;
      const daily = code === 'daily_quota' || code === 'daily_run_limit' || code === 'demo_ip_run_limit' || code === 'daily_egress_limit' || (code === 'demo_quota' && data.quota === 'daily');
      const retriable = e && !daily && (e.lost || [502, 503, 504].includes(e.status) || e.status === 429);
      let retry = null;
      if (retriable) {
        const label = h('span', {}, 'לנסות שוב את השלב');
        retry = h('button', { type: 'button', class: 'chip-btn', id: 'live-retry' }, icon('rotate'), label);
        retry.addEventListener('click', () => { loop(); });
        // The free model asked us to wait (demo_quota per minute): the button counts down and opens itself.
        const wait = Number(data.retry_after_s);
        if (code === 'demo_quota' && Number.isFinite(wait) && wait > 0) {
          let left = Math.min(Math.ceil(wait), 600);
          retry.disabled = true;
          label.textContent = `לנסות שוב בעוד ${left} שניות`;
          const timer = window.setInterval(() => {
            left -= 1;
            if (!retry.isConnected) { window.clearInterval(timer); return; }
            if (left <= 0) {
              window.clearInterval(timer);
              retry.disabled = false;
              label.textContent = 'לנסות שוב את השלב';
            } else {
              label.textContent = `לנסות שוב בעוד ${left} שניות`;
            }
          }, 1000);
        }
      }
      status(`ההרצה נעצרה: ${e.message}`, { error: true, actions: h('span', { class: 'rc-group' }, retry, more, app.live && app.live.kind === 'custom' ? null : backBtn()) });
      progress({ error: e.message });
    } finally {
      setBusy(false);
    }
  }

  // The server no longer knows this run (memory storage restarted, or the run expired): nothing of it is left
  // there, so it cannot go on. Say so, and offer the way forward: a new live run of the demo, or back to the
  // form with this tab's draft (the person's text is still in the tab, never on the server).
  function forgotten(e) {
    const custom = !!(app.live && app.live.kind === 'custom');
    liveRun = null;
    if (custom) tabStore.remove(RUN_KEY);
    if (app.live) { app.live.forgotten = e.message; app.live.awaiting = null; }
    const again = custom
      ? h('button', { type: 'button', class: 'chip-btn', id: 'live-restart' }, 'חזרה לטופס')
      : h('button', { type: 'button', class: 'chip-btn live-btn', id: 'live-restart' }, icon('rotate'), 'להתחיל הרצה חיה חדשה');
    again.addEventListener('click', async () => {
      backToReplay();
      if (custom) {
        const m = document.getElementById('materials');
        if (m) m.scrollIntoView({ block: 'start' });
        return;
      }
      try { await start({ kind: 'demo' }); } catch (err) { status(`לא ניתן להתחיל הרצה חיה: ${err.message}`, { error: true }); }
    });
    const tail = custom ? ' הטקסטים שלכם לא נשמרו בשרת; הטיוטה עדיין בלשונית הזאת, בחלק "החומרים שלכם".' : '';
    status(`ההרצה נעצרה: ${e.message}${tail}`, { error: true, actions: h('span', { class: 'rc-group' }, again, custom ? null : backBtn()) });
    progress({ error: e.message, forgotten: true });
  }

  // A checkpoint answer to a run the server forgot: the run area says what happened; the checkpoint shows the message.
  async function send(method, path, body, timeoutMs = 300000) {
    try {
      return await api(method, path, body, timeoutMs);
    } catch (e) {
      if (e && e.forgotten) forgotten(e);
      throw e;
    }
  }

  async function submitA({ reflection, removed_contrast_ids }) {
    await send('POST', `/api/runs/${encodeURIComponent(liveRun.run_id)}/checkpoint/A`, { reflection, removed_contrast_ids });
    liveRun.checkpoints.A = { reflection, removed_contrast_ids, decided_by: 'human' };
    app.live.awaiting = null;
    app.live.draftReflection = '';
    // No pair left to build axes from: the analysis ends at this checkpoint (the server would refuse stage 5).
    const ended = retainedLeft(liveRun, removed_contrast_ids) === 0;
    if (ended) app.live.ended = 'no_retained';
    app.setModel(corpus, liveRun);
    showRun();
    run.go('A');
    if (ended) { endedAtA(); return; }
    loop();
  }

  function endedAtA() {
    const custom = app.live && app.live.kind === 'custom';
    const actions = h('span', { class: 'rc-group' },
      custom ? h('a', { class: 'chip-btn', href: '#materials' }, 'להורדה ולמחיקה', icon('arrowDown')) : backBtn());
    status(`${NO_RETAINED_TEXT} הרפלקציה שלכם נשמרה ברשומת ההרצה.${custom ? ` הטקסטים שלכם נשארים ${inServer()} עד שתמחקו אותם.` : ''}`, { actions });
    progress({ ended: 'no_retained' });
  }

  async function submitB({ chosen }) {
    await send('POST', `/api/runs/${encodeURIComponent(liveRun.run_id)}/checkpoint/B`, { chosen });
    liveRun.checkpoints.B = { chosen, decided_by: 'human' };
    app.live.awaiting = null;
    app.setModel(corpus, liveRun);
    showRun();
    run.go('B');
    loop();
  }

  async function fetchRecord() {
    return api('GET', `/api/runs/${encodeURIComponent(liveRun.run_id)}`);
  }

  // The server's own privacy scan (ARCHITECTURE 5.3). When it finds anything, stage 1 waits until the
  // person has seen the findings and chooses to go on (POST /api/runs/:id/privacy-ack); until then no
  // text reaches the model. The page never acknowledges on the person's behalf.
  function awaitPrivacy() {
    app.live.awaiting = 'privacy';
    const n = Number.isFinite(app.live.privacyTotal) ? app.live.privacyTotal : (app.live.privacyWarnings || []).length;
    status(`${serverName()} מצא ${n === 1 ? 'פרט אחד שעלול לזהות' : `${n} פרטים שעלולים לזהות`}. שום טקסט לא נשלח עדיין למודל. עברו על הממצאים בחלק "החומרים שלכם" והחליטו אם להמשיך.`,
      { actions: h('a', { class: 'chip-btn', href: '#materials' }, 'לממצאים ולהחלטה', icon('arrowDown')) });
    progress();
    // The next action is the person's decision, in the run card: take them there, and put focus on it
    // (the form they started from has just been replaced by that card).
    window.requestAnimationFrame(() => {
      const card = document.getElementById('mat-run');
      const title = document.getElementById('mat-privacy-title') || (card && card.querySelector('h3'));
      if (card) card.scrollIntoView({ block: 'start' });
      if (title) title.focus({ preventScroll: true });
    });
  }

  // Show the run itself (its controls at the top of the screen) and keep keyboard focus on the page.
  function showRun() {
    const ctrl = document.getElementById('run-controls');
    if (ctrl) ctrl.scrollIntoView({ block: 'start' });
    const panel = document.getElementById('run-panel');
    if (panel && (!document.activeElement || document.activeElement === document.body)) panel.focus({ preventScroll: true });
  }

  async function acknowledgePrivacy() {
    if (!liveRun || !app.live || app.live.awaiting !== 'privacy') return;
    await send('POST', `/api/runs/${encodeURIComponent(liveRun.run_id)}/privacy-ack`, { acknowledged: true }, 20000);
    app.live.awaiting = null;
    app.live.privacyAcknowledged = true;
    status('');
    progress();
    showRun();
    loop();
  }

  // Delete (5.3): DELETE /api/runs/:id, then clear the draft and go back to the recorded demo.
  // `where` names the control the person used, so the confirmation appears there (live-deleted).
  async function deleteRun(where = '') {
    if (!liveRun) return;
    // A run the server already forgot has nothing left to delete there: that is the outcome asked for.
    try { await api('DELETE', `/api/runs/${encodeURIComponent(liveRun.run_id)}`, null, 20000); } catch (e) { if (e.status !== 404) throw e; }
    tabStore.remove(DRAFT_KEY);
    tabStore.remove(RUN_KEY);
    const id = liveRun.run_id;
    liveRun = null;
    busy = false;
    backToReplay();
    app.emit('live-deleted', { id, where });
  }
  // The confirmation after a delete from the findings: in the same place, focused, so the person who
  // just deleted private material can see it worked before they see the demo's findings again.
  app.on('live-deleted', (ev) => {
    if (!ev || ev.where !== 'findings') return;
    const box = document.getElementById('findings-actions');
    if (!box) return;
    const note = h('p', { class: 'callout callout-cool deleted-note', role: 'status', tabindex: '-1', id: 'findings-deleted' },
      icon('check'), `ההרצה והטקסטים נמחקו ${apiIsRemote() ? 'מהשרת' : 'מהשרת המקומי'} ומהדפדפן. מוצגת שוב ההדגמה המוקלטת.`);
    box.prepend(note);
    note.focus({ preventScroll: true });
    note.scrollIntoView({ block: 'center' });
  });

  function deleteControl(where) {
    const wrap = h('span', { class: 'del-wrap', style: { display: 'contents' } });
    const btn2 = h('button', { type: 'button', class: 'btn btn-danger btn-sm', id: `del-${where}` }, icon('trash'), 'מחיקת ההרצה והטקסטים');
    btn2.addEventListener('click', () => {
      if (busy) return;
      const yes = h('button', { type: 'button', class: 'btn btn-danger-solid btn-sm', id: `del-confirm-${where}` }, 'כן, למחוק');
      const no = h('button', { type: 'button', class: 'btn btn-ghost btn-sm' }, 'ביטול');
      const fromWhere = apiIsRemote() ? 'מהשרת' : 'מהשרת המקומי (מהזיכרון שלו ומהתיקייה במחשב שבה נשמרות ההרצות)';
      const msg = h('p', { role: 'alert' }, `למחוק את ההרצה ואת הטקסטים? הם יימחקו ${fromWhere} ומהטיוטה בדפדפן. אי אפשר לשחזר.`);
      const row = h('div', { class: 'confirm-row' }, msg, yes, no);
      wrap.replaceChildren(row);
      no.addEventListener('click', () => { wrap.replaceChildren(btn2); btn2.focus(); });
      yes.addEventListener('click', async () => {
        yes.disabled = true;
        msg.textContent = 'מוחק...';
        try {
          await deleteRun(where);
        } catch (e) {
          msg.textContent = `המחיקה לא הושלמה: ${e.message}`;
          yes.disabled = false;
        }
      });
      yes.focus();
    });
    wrap.append(btn2);
    return wrap;
  }

  // The server's prompt layers, names and SHA-256 hashes only (GET /api/prompts, D17). Never a text: a server
  // that still sent texts would not have them shown, because the page keeps only { name, sha256 }.
  async function loadPromptHashes() {
    const p = await api('GET', '/api/prompts', null, 8000).catch(() => null);
    const layers = p && Array.isArray(p.layers)
      ? p.layers.filter((l) => l && typeof l.name === 'string' && typeof l.sha256 === 'string').map((l) => ({ name: l.name, sha256: l.sha256 }))
      : null;
    if (layers && layers.length) { app.prompts = { layers, source: 'server' }; app.emit('prompts'); }
  }

  async function start({ kind, corpusBody = null, localCorpus = null }) {
    if (busy) throw new Error('הרצה אחרת עדיין פועלת.');
    setBusy(true);
    try {
      await loadPromptHashes();
      const body = kind === 'custom' ? { corpus: corpusBody, consent: true } : { corpus: 'demo' };
      const created = await api('POST', '/api/runs', body, 30000);
      liveRun = {
        run_id: created.run_id,
        engine_version: app.health && app.health.engine_version,
        created_at: new Date().toISOString(),
        corpus_id: kind === 'custom' ? (created.corpus_id || 'custom') : ((app.file.corpus && app.file.corpus.corpus_id) || 'demo'),
        provider: app.health && app.health.provider,
        model: app.health && app.health.model,
        stages: {},
        checkpoints: {},
        gates: {},
      };
      corpus = kind === 'custom' ? localCorpus : app.file.corpus;
      app.mode = 'live';
      app.live = {
        kind, runId: created.run_id, awaiting: null, done: false, submitA, submitB, fetchRecord, deleteControl, acknowledgePrivacy,
        providerLabel: providerLabel(app.health), draftReflection: '',
        privacyWarnings: Array.isArray(created.privacy_warnings) ? created.privacy_warnings : null,
        privacyTotal: created.privacy_summary && Number.isFinite(created.privacy_summary.total) ? created.privacy_summary.total : null,
      };
      // only the run id is remembered in this tab, so the run can be found again (and deleted) after a reload
      if (kind === 'custom') tabStore.set(RUN_KEY, { runId: created.run_id });
      app.loadNames();
      app.loadSetAside();
      app.setModel(corpus, liveRun);
      app.emit('mode');
      run.go(null);
      setBusy(false);
      if (created.privacy_ack_required === true) {
        awaitPrivacy();
        return created;
      }
      showRun();
      loop();
      return created;
    } catch (e) {
      setBusy(false);
      throw e;
    }
  }

  // After a reload: load a run this tab started from the local server and carry on from where it is.
  async function resume(runId, localCorpus) {
    if (busy) throw new Error('הרצה אחרת עדיין פועלת.');
    setBusy(true);
    try {
      const rec = await api('GET', `/api/runs/${encodeURIComponent(runId)}`, null, 15000);
      await loadPromptHashes();
      liveRun = { ...rec, stages: rec.stages || {}, checkpoints: rec.checkpoints || {}, gates: rec.gates || {} };
      corpus = liveRun.stages['1'] ? corpusFromCalls(liveRun.stages['1'].calls, localCorpus) : localCorpus;
      const st = rec.state || {};
      const priv = rec.privacy || null;
      const privacyPending = !!(priv && priv.ack_required && !priv.acknowledged && !liveRun.stages['1']);
      app.mode = 'live';
      app.live = {
        kind: 'custom', runId, awaiting: privacyPending ? 'privacy' : (st.awaiting_checkpoint || null), done: !!st.done,
        submitA, submitB, fetchRecord, deleteControl, acknowledgePrivacy,
        providerLabel: providerLabel(app.health), draftReflection: '',
        privacyWarnings: priv && Array.isArray(priv.warnings) ? priv.warnings : null,
        privacyTotal: priv && Number.isFinite(priv.warnings_total) ? priv.warnings_total : null,
      };
      app.loadNames();
      app.loadSetAside();
      app.setModel(corpus, liveRun);
      app.emit('mode');
      setBusy(false);
      if (privacyPending) {
        awaitPrivacy();
      } else if (app.live.done) {
        run.go('9');
        status(`הניתוח נטען מחדש מ${serverName()}. הוא הסתיים; הממצאים למטה.`, { actions: h('a', { class: 'chip-btn', href: '#findings' }, 'לממצאים', icon('arrowDown')) });
      } else if (app.live.awaiting) {
        run.go(app.live.awaiting);
        status(`הניתוח נטען מחדש מ${serverName()}, והוא ממתין לך בנקודת העצירה.`, { actions: h('a', { class: 'chip-btn', href: app.live.awaiting === 'A' ? '#checkpoint-a' : '#checkpoint-b' }, 'לנקודת העצירה', icon('arrowDown')) });
      } else {
        loop();
      }
      progress();
    } catch (e) {
      setBusy(false);
      if (e.status === 404) tabStore.remove(RUN_KEY);
      throw e;
    }
  }

  // Delete a run this tab started, without loading it (the reload case).
  async function deleteById(runId) {
    await api('DELETE', `/api/runs/${encodeURIComponent(runId)}`, null, 20000);
    tabStore.remove(RUN_KEY);
    tabStore.remove(DRAFT_KEY);
    app.emit('live-deleted', { id: runId, where: 'materials' });
  }

  // While a run on the person's own materials exists, the live demo is not offered: starting it would
  // replace their analysis on the page while their texts stay on the server.
  const customRunOpen = () => !!(app.live && app.live.kind === 'custom');
  app.on('mode', () => { btn.hidden = !app.health || customRunOpen(); });

  btn.addEventListener('click', () => {
    if (busy || customRunOpen()) return;
    const go = h('button', { type: 'button', class: 'chip-btn live-btn' }, 'להתחיל');
    const cancel = h('button', { type: 'button', class: 'chip-btn' }, 'ביטול');
    const needCode = !!(app.health && app.health.access_code_required);
    const code = needCode ? accessCodeField('live-code') : null;
    go.addEventListener('click', async () => {
      if (code && !code.input.value.trim()) { code.input.focus(); return; }
      status('');
      try { await start({ kind: 'demo' }); } catch (e) { status(`לא ניתן להתחיל הרצה חיה: ${e.message}`, { error: true }); }
    });
    cancel.addEventListener('click', () => status(''));
    const freeTier = !!(app.health && app.health.public_demo);
    status(`הרצה חיה שולחת את הראיונות הבדויים ${hePrefix('ל', providerLabel(app.health))} דרך ${serverName()}, ועשויה להימשך כמה דקות.${freeTier ? ' למודל החינמי יש מגבלת בקשות לדקה וליום, ולכן לפעמים צריך לחכות בין שלבים.' : ''}`,
      { actions: h('span', { class: 'rc-group' }, code ? code.wrap : null, go, cancel) });
  });

  app.liveApi = {
    probe,
    start,
    resume,
    deleteById,
    isBusy: () => busy,
    backToReplay,
    deleteControl,
  };
  await probe();
}

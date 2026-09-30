// engine/privacy.mjs - a warning-only scan for likely identifiers in materials a user is about to
// analyse (ARCHITECTURE.md section 5.3). Used by the server on every custom corpus; it has no imports
// and no Node APIs, so the site can load this same file in the browser.
//
// It finds five kinds of pattern: e-mail addresses, Israeli phone numbers in their common written
// formats, 9-digit ID-like numbers, web addresses, and phrases that look like street or postal
// addresses. It WARNS. It never claims that a text is anonymous: names, places, dates, workplaces
// and rare details cannot be found by pattern, and the person running the analysis must read the
// text themselves.

export const PRIVACY_TYPES = Object.freeze(['email', 'phone', 'id_number', 'url', 'address']);

export const PRIVACY_LABELS = Object.freeze({
  email: 'e-mail address',
  phone: 'phone number',
  id_number: '9-digit number that looks like an ID number',
  url: 'web address',
  address: 'looks like a street or postal address',
});

export const PRIVACY_LABELS_HE = Object.freeze({
  email: 'כתובת דוא"ל',
  phone: 'מספר טלפון',
  id_number: 'מספר בן 9 ספרות שנראה כמו מספר זהות',
  url: 'כתובת אתר',
  address: 'נראה כמו כתובת מגורים או כתובת דואר',
});

export const PRIVACY_NOTE = 'This check looks for common identifier patterns only. It does not find names, places, '
  + 'dates or rare details, and a text with no warnings is not thereby anonymous.';

export const CONTEXT_CHARS = 30;
export const MAX_WARNINGS = 200;

// Hebrew letters (alef to tav, final forms included).
const HE = '\\u05D0-\\u05EA';
// A number of up to 4 digits must not be followed by a unit that makes it a duration or a count.
const NOT_A_COUNT = '(?!\\s*(?:שנים|שנה|שנות|חודשים|חודש|שבועות|שבוע|ימים|יום|שעות|שעה|דקות|דקה|פעמים|פעם|ילדים|אחוז|%))';

// Earlier entries win when two hits overlap (an e-mail's domain is not also a web address).
// Every repeat in the e-mail pattern is bounded (local part 64 characters, a domain label 63, ten labels,
// the top-level part 24): an unbounded one made the scan quadratic on a long run of letters or digits with
// no "@" (25,000 characters took 0.6 s, and the server runs the scan inside the request). A longer local
// part is still reported, from its last 64 characters.
const PATTERNS = [
  ['email', /[A-Za-z0-9_%+][A-Za-z0-9._%+-]{0,63}@[A-Za-z0-9-]{1,63}(?:\.[A-Za-z0-9-]{1,63}){0,9}\.[A-Za-z]{2,24}/g],
  ['url', /\b(?:https?:\/\/|www\.)[^\s<>"'״”“]+/gi],
  // A bare domain may follow a Hebrew prefix and hyphen ("ב-example.org.il"), but never starts in the
  // middle of a longer name ("my-site.com" is matched from "my").
  ['url', /(?<![@\w.]|\w-)[A-Za-z0-9][A-Za-z0-9-]*(?:\.[A-Za-z0-9-]+)*\.(?:co\.il|org\.il|ac\.il|gov\.il|net\.il|muni\.il|k12\.il|com|org|net|edu|gov|info|io|il)\b(?:\/[^\s<>"'״”“]*)?/gi],
  // Phones: +972 / 00972 international form; 05X, 07X mobile and VoIP; 02/03/04/08/09 landlines
  // (these need a separator or brackets, since nine bare digits are reported as an ID-like number);
  // 1-800 / 1-700 numbers.
  ['phone', /(?<![\d+])(?:\+|00)?972[-\s.]?\(?0?\)?[-\s.]?(?:5\d|7[2-9]|[2-489])[-\s.]?\d{3}[-\s.]?\d{4}(?!\d)/g],
  ['phone', /(?<![\d+])\(?0(?:5\d|7[2-9])\)?[-\s.]?\d{3}[-\s.]?\d{4}(?!\d)/g],
  ['phone', /(?<![\d+])(?:\(0[2-489]\)\s?|0[2-489][-\s.])\d{3}[-\s.]?\d{4}(?!\d)/g],
  ['phone', /(?<![\d+])1[-\s]?[78]00[-\s]?\d{2,3}[-\s]?\d{3,4}(?!\d)/g],
  // ID-like: nine digits standing alone, or eight digits, a dash and a check digit.
  ['id_number', /(?<![\d.,:/-])\d{9}(?![\d]|[.,:/-]\d)/g],
  ['id_number', /(?<![\d.,:/-])\d{8}-\d(?![\d]|[.,:/-]\d)/g],
  // Addresses, Hebrew: a street word (with up to two prefix letters such as ב, ל, ה), one to three
  // words of a name, and a house number that is not a duration or a count.
  ['address', new RegExp(`(?<![${HE}])[ובלמהשכ]{0,2}(?:רחוב|רח['׳]|שדרות|שד['׳]|סמטת|סמטה)\\s+(?:[${HE}"'׳״-]+\\s+){1,3}\\d{1,4}[${HE}]?(?:/\\d{1,3})?(?!\\d)${NOT_A_COUNT}`, 'g')],
  ['address', new RegExp(`(?<![${HE}])[ובלמהש]{0,2}מיקוד\\s*:?\\s*\\d{5}(?:\\d{2})?(?!\\d)`, 'g')],
  ['address', new RegExp(`(?<![${HE}])[ובלמהש]{0,2}ת\\s?["״.]\\s?ד\\.?\\s*:?\\s*\\d{1,6}(?!\\d)`, 'g')],
  ['address', new RegExp(`(?<![${HE}])[ובלמהש]{0,2}כתובת(?:י|ו|ה|נו|ם|ן|ך)?\\s*:\\s*[^\\n]{3,80}`, 'g')],
  // Addresses, English.
  ['address', /\b\d{1,5}\s+(?:[A-Z][A-Za-z'-]+\s+){1,3}(?:Street|St|Avenue|Ave|Road|Rd|Boulevard|Blvd|Lane|Ln|Drive|Dr|Way|Court|Ct)\b\.?/g],
  ['address', /\bP\.?\s?O\.?\s?Box\s+\d{1,6}\b/gi],
];

const TRAILING_PUNCT = /[.,;:!?)\]}'"״”“]+$/;

function oneLine(s) {
  return String(s).replace(/\s+/g, ' ');
}

/** Israeli ID check digit (the Luhn-like rule the Population Authority uses). */
export function israeliIdChecksumOk(digits) {
  const d = String(digits).replace(/\D/g, '');
  if (d.length !== 9) return false;
  let sum = 0;
  for (let i = 0; i < 9; i++) {
    let v = Number(d[i]) * ((i % 2) + 1);
    if (v > 9) v -= 9;
    sum += v;
  }
  return sum % 10 === 0;
}

/**
 * Scan one text. Returns hits sorted by position:
 * [{ type, match, start, end, before, after, context }], where `context` is the match with up to
 * CONTEXT_CHARS characters on each side (whitespace collapsed, "..." where the text was cut).
 */
export function scanText(text, { contextChars = CONTEXT_CHARS } = {}) {
  const s = String(text ?? '');
  const found = [];
  for (const [type, re] of PATTERNS) {
    re.lastIndex = 0;
    let m;
    while ((m = re.exec(s))) {
      let match = m[0];
      if (!match) { re.lastIndex++; continue; }
      if (type === 'url' || type === 'address') match = match.replace(TRAILING_PUNCT, '');
      if (type === 'address') match = match.replace(/\s+$/, '');
      if (!match) continue;
      const start = m.index;
      const end = start + match.length;
      if (found.some(h => start < h.end && end > h.start)) continue;
      found.push({ type, match, start, end });
    }
  }
  found.sort((a, b) => a.start - b.start);
  return found.map((h) => {
    const from = Math.max(0, h.start - contextChars);
    const to = Math.min(s.length, h.end + contextChars);
    const before = (from > 0 ? '...' : '') + oneLine(s.slice(from, h.start));
    const after = oneLine(s.slice(h.end, to)) + (to < s.length ? '...' : '');
    const hit = { type: h.type, match: h.match, start: h.start, end: h.end, before, after, context: before + oneLine(h.match) + after };
    if (h.type === 'id_number') hit.id_checksum_ok = israeliIdChecksumOk(h.match);
    return hit;
  });
}

/**
 * Scan a corpus as the portal sends it: { research_question, interviews: [{ id?, pseudonym, text }] }.
 * Every field a person typed is scanned. Returns
 * { warnings: [{ type, label, field, interview_id, match, before, after, context, start }], counts, total, truncated, note }.
 * `counts` and `total` cover every hit; `warnings` stops at maxWarnings.
 */
export function scanCorpus(corpus, { maxWarnings = MAX_WARNINGS, contextChars = CONTEXT_CHARS } = {}) {
  const counts = Object.fromEntries(PRIVACY_TYPES.map(t => [t, 0]));
  const warnings = [];
  let total = 0;
  const add = (field, interviewId, value) => {
    for (const h of scanText(value, { contextChars })) {
      counts[h.type]++;
      total++;
      if (warnings.length < maxWarnings) {
        const w = { type: h.type, label: PRIVACY_LABELS[h.type], field, interview_id: interviewId, match: h.match, before: h.before, after: h.after, context: h.context, start: h.start };
        if (h.id_checksum_ok !== undefined) w.id_checksum_ok = h.id_checksum_ok;
        warnings.push(w);
      }
    }
  };
  if (typeof corpus?.research_question === 'string') add('research_question', null, corpus.research_question);
  (Array.isArray(corpus?.interviews) ? corpus.interviews : []).forEach((iv, i) => {
    const id = typeof iv?.id === 'string' && iv.id ? iv.id : `I${i + 1}`;
    if (typeof iv?.pseudonym === 'string') add('pseudonym', id, iv.pseudonym);
    if (typeof iv?.text === 'string') add('text', id, iv.text);
  });
  return { warnings, counts, total, truncated: total > warnings.length, note: PRIVACY_NOTE };
}

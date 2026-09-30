// The nine agent emblems: custom monoline drawings on a 64-unit grid, drawn in the agent's hue
// (DESIGN.md "Icons"). Stroke colour is currentColor; .fill-soft is a 14% wash of it.
// Constant markup only: nothing from the run data is ever inserted here.

export const EMBLEMS = {
  // 1 THE MINER: a pick beside a split stone with a small seam of lines
  1: `<path class="thin" d="M3 56H61"/>
      <path class="fill-soft" d="M5 52L9 35L21 27L33 30L39 43L36 53Z"/>
      <path d="M21.5 27.5L19 36.5L24 42L21 53"/>
      <path class="thin" d="M26 37l7-1.8M27 42.5h8M26 47.5l6 1.2"/>
      <path class="bold" d="M38 57L53 17"/>
      <path class="bold" d="M40 15.5Q56 8.5 62.5 27"/>`,

  // 2 THE BOTANIST: a leaf on a specimen card, with a tag on a string
  2: `<rect x="10" y="7" width="34" height="46" rx="2.5"/>
      <path class="fill-soft" d="M27 45C18 37 18 24 28 14C36 24 36 37 27 45Z"/>
      <path class="thin" d="M27.2 47L27.9 17"/>
      <path class="thin" d="M27.6 27l-4.5-3.6M27.5 33l4.6-3.8M27.4 39l-4.6-3.6"/>
      <path class="thin" d="M44 37C50 39 49 45 50.5 49.5"/>
      <path d="M47 47H56L60 51.5L56 56H47Z"/>
      <circle class="fill-solid" cx="50.5" cy="51.5" r="1.3"/>`,

  // 3 THE ARTIST: a brush, and a shape mirrored across a dotted line
  3: `<path class="dash" d="M32 6V58"/>
      <path class="fill-soft" d="M36 18C46 16 53 24 49 33C46 40 38 40 36 35Z"/>
      <path class="dash" d="M28 18C18 16 11 24 15 33C18 40 26 40 28 35Z"/>
      <path d="M61 61L52 51"/>
      <path class="bold" d="M52 51L48.5 47"/>
      <path class="fill-solid" d="M49.5 46Q45 44.5 42.5 38.5Q48.5 40 50.8 44.6Z"/>`,

  // 4 THE DETECTIVE: a magnifying glass over a page with one highlighted line
  4: `<path d="M8 7H32L40 15V55H8Z"/>
      <path class="thin" d="M32 7V15H40"/>
      <path class="thin" d="M14 21H32M14 27H34M14 45H28M14 50H31"/>
      <path class="bold" d="M14 36H26"/>
      <circle class="knock" cx="37" cy="36" r="11"/>
      <path class="bold" d="M29.5 36H44.5"/>
      <path class="bold" d="M45 44L56 55"/>`,

  // 5 THE PHYSICIST: a rod between two weights, with dots along it (moved up and enlarged a little, so
  // it sits in the optical centre of its circle like the others)
  5: `<g transform="translate(0 -5) scale(1.12) translate(-3.4 0)"><path class="thin" d="M16 50H48"/>
      <path class="fill-soft" d="M26 50L32 39L38 50Z"/>
      <path d="M8 37H56"/>
      <circle class="fill-soft" cx="10" cy="29" r="6.5"/>
      <circle class="fill-solid" cx="54" cy="29" r="6.5"/>
      <path class="thin" d="M10 35.5V37M54 35.5V37"/>
      <circle class="fill-solid" cx="19" cy="37" r="1.7"/>
      <circle class="fill-solid" cx="25.5" cy="37" r="1.7"/>
      <circle class="fill-solid" cx="32" cy="37" r="2.2"/>
      <circle class="fill-solid" cx="38.5" cy="37" r="1.7"/>
      <circle class="fill-solid" cx="45" cy="37" r="1.7"/></g>`,

  // 6 THE CHEF: two bowls pouring into one
  6: `<g transform="translate(15 15) rotate(38)"><path class="fill-soft" d="M-10 0Q0 13 10 0Z"/><path d="M-12 0H12"/></g>
      <g transform="translate(51 27) rotate(-40)"><path d="M-9 0Q0 11 9 0Z"/><path d="M-11 0H11"/></g>
      <circle class="fill-solid" cx="25" cy="27" r="1.4"/>
      <circle class="fill-solid" cx="27" cy="32.5" r="1.4"/>
      <circle class="fill-solid" cx="28.5" cy="38" r="1.4"/>
      <circle cx="41" cy="35" r="1.3"/>
      <circle cx="38.5" cy="39.5" r="1.3"/>
      <path class="fill-soft" d="M15 44Q32 64 49 44Z"/>
      <path d="M12 44H52"/>
      <path class="thin" d="M26 57.5H38"/>`,

  // 7 THE CARTOGRAPHER: a compass rose over a folded map
  7: `<path d="M5 18L21 12L37 18L53 12V48L37 54L21 48L5 54Z"/>
      <path class="thin" d="M21 12V48M37 18V54"/>
      <path class="thin dash" d="M9 47C14 41 19 47 24 41S29 33 32 35"/>
      <circle class="knock" cx="43" cy="30" r="11"/>
      <path class="fill-soft" d="M43 19L45.4 30L43 41L40.6 30Z"/>
      <path class="thin" d="M32 30L43 27.8L54 30L43 32.2Z"/>
      <path class="fill-solid" d="M43 19L45.4 30H40.6Z"/>`,

  // 8 THE COMPOSER: crossing staff lines
  8: `<path d="M5 22C21 18 43 26 59 22"/>
      <path d="M5 29C21 25 43 33 59 29"/>
      <path d="M5 36C21 32 43 40 59 36"/>
      <path class="thin" d="M13 56L37 8"/>
      <path class="thin" d="M19.5 58L43.5 10"/>
      <path class="thin" d="M26 60L50 12"/>
      <ellipse class="fill-solid" cx="27.5" cy="25.8" rx="3.2" ry="2.3" transform="rotate(-24 27.5 25.8)"/>
      <ellipse class="fill-solid" cx="40" cy="33" rx="3.2" ry="2.3" transform="rotate(-24 40 33)"/>`,

  // 9 THE ARCHITECT: drafting dividers over an arch
  9: `<path class="thin" d="M5 58H59"/>
      <path d="M12 58V42A20 20 0 0 1 52 42V58"/>
      <path class="thin" d="M20 58V43A12 12 0 0 1 44 43V58"/>
      <path class="fill-soft" d="M29 20.5H35L34 28H30Z"/>
      <circle cx="32" cy="5.5" r="2.4"/>
      <path d="M32 3.1V0.8"/>
      <path d="M30.9 7.6L20.5 23M33.1 7.6L43.5 23"/>`,
};

const PERSONA_WORD = {
  1: 'הכורה', 2: 'הבוטנאית', 3: 'האמן', 4: 'הבלש', 5: 'הפיזיקאית',
  6: 'השף', 7: 'הקרטוגרפית', 8: 'המלחין', 9: 'האדריכלית',
};

export const EMBLEM_ALT = {
  1: 'סמל הכורה: מכוש לצד אבן סדוקה',
  2: 'סמל הבוטנאית: עלה על כרטיס דגימה עם תווית',
  3: 'סמל האמן: מכחול וצורה שמשתקפת מעבר לקו מנוקד',
  4: 'סמל הבלש: זכוכית מגדלת מעל דף עם שורה מודגשת',
  5: 'סמל הפיזיקאית: מוט בין שתי משקולות ועליו נקודות',
  6: 'סמל השף: שתי קערות שנשפכות לקערה אחת',
  7: 'סמל הקרטוגרפית: שושנת רוחות מעל מפה מקופלת',
  8: 'סמל המלחין: קווי חמשה מצטלבים',
  9: 'סמל האדריכלית: מחוגה מעל קשת',
};

export const personaWord = (n) => PERSONA_WORD[n] || '';

export function emblemMarkup(n, { title = '' } = {}) {
  const t = title ? `<title>${title}</title>` : '';
  const hidden = title ? 'role="img"' : 'aria-hidden="true" focusable="false"';
  return `<svg class="emblem" viewBox="0 0 64 64" ${hidden}>${t}${EMBLEMS[n] || ''}</svg>`;
}

// An element (span wrapper) holding the emblem, for use with h().
export function emblem(n, { labelled = false } = {}) {
  const span = document.createElement('span');
  span.className = 'emblem-wrap';
  span.style.display = 'contents';
  span.innerHTML = emblemMarkup(n, { title: labelled ? EMBLEM_ALT[n] : '' });
  return span;
}

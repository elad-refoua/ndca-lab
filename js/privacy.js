// Privacy check before sending (ARCHITECTURE 5.3), run in the browser on every edit. The patterns are
// the server's own: engine-privacy.js is a byte-identical copy of engine/privacy.mjs, made by
// tools/sync_site_privacy.mjs and checked by the e2e test. It WARNS; it cannot tell that a text is
// anonymous, and the page never says it is.
import { scanText as engineScan, PRIVACY_LABELS_HE } from './engine-privacy.js';

export const HIT_LABEL = PRIVACY_LABELS_HE;

/** All hits in one text, earliest first: [{ type, start, end, text }]. */
export function scanText(text) {
  return engineScan(String(text || '')).map((x) => ({ type: x.type, start: x.start, end: x.end, text: x.match }));
}

/** Context around a hit: { before, match, after }, cut to about `width` characters each side. */
export function contextOf(text, hit, width = 42) {
  const src = String(text || '');
  const a = Math.max(0, hit.start - width);
  const b = Math.min(src.length, hit.end + width);
  return {
    before: (a > 0 ? '...' : '') + src.slice(a, hit.start).replace(/\s+/g, ' '),
    match: src.slice(hit.start, hit.end),
    after: src.slice(hit.end, b).replace(/\s+/g, ' ') + (b < src.length ? '...' : ''),
  };
}

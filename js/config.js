// The one place the portal learns where the engine API lives (ARCHITECTURE 5.4, decisions D16 and D17).
//
// DEPLOYED_API below holds a placeholder. The deploy step replaces that one string, in the published copy of
// the site only, with the address of the deployed API: the Cloud Run service's https URL, with no path and no
// trailing slash. The placeholder appears exactly once in this file, and nowhere else in the site, so a plain
// text replacement cannot change anything else (tests/e2e/cloud.spec.mjs checks both, and simulates the
// replacement).
//
// While DEPLOYED_API is still the placeholder:
//   - on a page served from this machine (127.0.0.1 or localhost, as npm run start:local serves it), the API
//     is the local server at http://127.0.0.1:8787;
//   - anywhere else (a public host before the deploy step ran, or a file opened from disk) there is no API,
//     and the page replays the recorded run only. A public page never calls 127.0.0.1: that would be the
//     visitor's own machine.
// A replaced value that is not an http(s) address is ignored (no API), with a warning in the console.
const DEPLOYED_API = 'https://ndca-api-hh3cb3opca-zf.a.run.app';

export const LOCAL_API = 'http://127.0.0.1:8787';
const LOCAL_HOSTS = ['127.0.0.1', 'localhost', '[::1]', '::1'];

function resolveApiBase() {
  const raw = String(DEPLOYED_API || '').trim();
  // Still the placeholder: two underscores, capitals, two underscores. Tested by shape, not by comparing with
  // the literal, because the deploy step's replacement would change that literal too.
  if (/^__[A-Z_]+__$/.test(raw)) {
    let host = '';
    try { host = window.location.hostname; } catch { host = ''; }
    return { base: LOCAL_HOSTS.includes(host) ? LOCAL_API : '', source: LOCAL_HOSTS.includes(host) ? 'local-default' : 'none' };
  }
  try {
    const u = new URL(raw);
    if (u.protocol !== 'https:' && u.protocol !== 'http:') throw new Error('not http(s)');
    return { base: u.origin + u.pathname.replace(/\/+$/, ''), source: 'deployed' };
  } catch {
    console.warn('site/js/config.js: the API address is not an http(s) URL; live mode is off');
    return { base: '', source: 'none' };
  }
}

const RESOLVED = resolveApiBase();
/** The API's base URL, or '' when this page has no API (replay only). */
export const API_BASE = RESOLVED.base;
/** Where API_BASE came from: 'deployed' (the deploy step's value), 'local-default' or 'none'. */
export const API_SOURCE = RESOLVED.source;

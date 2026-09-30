// Where the API is, and whether it answers (ARCHITECTURE 5.1, 5.4). Shared by the portal (live.js) and the
// booklet page (booklet.js). The address comes only from config.js.
//
// A deployed API on Cloud Run with no instance kept warm takes a while to answer its first request after a
// quiet spell (a "cold start", up to about half a minute). So a remote health check waits up to
// REMOTE_HEALTH_WAIT_MS, tries again after a short pause when the answer is an error, and tells the page after
// WAKING_AFTER_MS that it is still waiting, so the page can say "waking the server" instead of looking broken.
import { API_BASE } from './config.js';

export const API = String(API_BASE || '').replace(/\/+$/, '');
const LOCAL = new Set(['127.0.0.1', 'localhost', '[::1]', '::1']);

function hostOf(url) {
  try { return new URL(url).hostname; } catch { return ''; }
}
/** True when this page has an API at all. */
export const hasApi = () => Boolean(API);
/** True when the API is on another machine (a deployed service), not this one. */
export const apiIsRemote = () => hasApi() && !LOCAL.has(hostOf(API));
export const pageIsLocal = () => LOCAL.has(window.location.hostname);
/** A page on a public host talks only to a remote API; a local page, to either. */
export const mayCallApi = () => hasApi() && (pageIsLocal() || apiIsRemote());

export const WAKING_AFTER_MS = 1500;
export const REMOTE_HEALTH_WAIT_MS = 35000;
export const LOCAL_HEALTH_WAIT_MS = 2500;
const RETRY_PAUSE_MS = 2500;

const wait = (ms) => new Promise((r) => window.setTimeout(r, ms));

/**
 * GET /api/health. Resolves to { health, state }:
 *   state 'ok'      health is the server's answer, plus { remote };
 *   state 'off'     this page has no API it may call (no request is made);
 *   state 'failed'  no usable answer within the wait (health null).
 * onWaking() is called once, when a remote server has not answered after WAKING_AFTER_MS.
 */
export async function fetchHealth({ onWaking = null } = {}) {
  if (!mayCallApi()) return { health: null, state: 'off' };
  const remote = apiIsRemote();
  const deadline = Date.now() + (remote ? REMOTE_HEALTH_WAIT_MS : LOCAL_HEALTH_WAIT_MS);
  const waking = remote && onWaking ? window.setTimeout(() => { try { onWaking(); } catch { /* the page's business */ } }, WAKING_AFTER_MS) : null;
  try {
    for (;;) {
      const left = deadline - Date.now();
      if (left <= 0) return { health: null, state: 'failed' };
      const ctl = new AbortController();
      const t = window.setTimeout(() => ctl.abort(), left);
      try {
        const res = await fetch(`${API}/api/health`, { cache: 'no-store', credentials: 'omit', signal: ctl.signal });
        let data = null;
        try { data = await res.json(); } catch { data = null; }
        if (res.ok && data && data.status === 'ok') return { health: { ...data, remote }, state: 'ok' };
        // A server that is starting may answer 5xx for a moment; anything else will not change by waiting.
        if (!remote || res.status < 500) return { health: null, state: 'failed' };
      } catch {
        if (!remote) return { health: null, state: 'failed' };
      } finally {
        window.clearTimeout(t);
      }
      if (deadline - Date.now() <= RETRY_PAUSE_MS) return { health: null, state: 'failed' };
      await wait(RETRY_PAUSE_MS);
    }
  } finally {
    if (waking !== null) window.clearTimeout(waking);
  }
}

// The free tier's daily quota resets at midnight Pacific time (Google's Gemini API rate-limit page). Returns
// that moment as a local time string, "HH:MM" in the viewer's time zone. Approximate by up to an hour on the
// two days a year when only one of the two places changes its clock.
export function pacificMidnightLocal(now = new Date()) {
  try {
    const parts = Object.fromEntries(new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/Los_Angeles', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
    }).formatToParts(now).map((p) => [p.type, p.value]));
    const since = Number(parts.hour) * 3600 + Number(parts.minute) * 60 + Number(parts.second);
    const at = new Date(now.getTime() + (86400 - since) * 1000);
    return at.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '';
  }
}

/** An ISO time from the server (resetsAt), as a local "HH:MM", or ''. */
export function localTime(iso) {
  const d = new Date(iso);
  if (!iso || Number.isNaN(d.getTime())) return '';
  return d.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' });
}

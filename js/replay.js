// The run section: replay controls, the network, the work log and the stage panel.
// Replay steps through the recorded run; live mode feeds the same views as stages arrive.
import { $, h, clear, announce, reducedMotion, sleep, plural } from './util.js';
import { icon, setIcon } from './icons.js';
import { emblem } from './emblems.js';
import { STEPS, stageByN, isCheckpoint, CHECKPOINTS, SIGHT_TEXT } from './stages.js';
import { createNetwork } from './network.js';
import { renderReceived, renderOutput, renderCheckpointStep, provenanceFold } from './views.js';
import { interviewLabel } from './reader.js';

// How long a stage stays on screen during autoplay. The same with and without animation: turning
// motion off removes animation, it does not speed the run up.
const DWELL = 6500;

export function initRun(app) {
  const panel = $('#run-panel');
  const logBody = $('#log-body');
  const logAgent = $('#log-agent');
  const logEl = $('#log');
  const playBtn = $('#rc-play');
  const stepsEl = $('#rc-steps');
  const moreEl = $('#rc-more');
  const narrow = window.matchMedia('(max-width: 1023px)');

  const state = {
    step: null,
    playing: false,
    speed: 1,
    instant: reducedMotion(),
    // navToken: which go() is current (navigation). typeToken: which typing of the log is current.
    // Skipping the typing or clicking the log bumps only typeToken, so the dwell timer of the current
    // stage is still scheduled and autoplay goes on.
    navToken: 0,
    typeToken: 0,
    timer: null,
  };

  const net = createNetwork($('#network'), app, (step) => { stop(); go(step, { frame: true }); });

  function available(step) {
    const m = app.model;
    if (step === 'A') return !!m.cpA || (app.mode === 'live' && m.hasStage(4));
    if (step === 'B') return !!m.cpB || (app.mode === 'live' && m.hasStage(7));
    return m.hasStage(Number(step));
  }
  const availableSteps = () => STEPS.filter(available);

  // ---------- the source chip: whose data is on screen ----------
  function renderSource() {
    const chip = $('#source-chip');
    clear(chip);
    let mode = 'replay';
    let text = app.fixture ? 'הרצה מוקלטת (קובץ הדגמה) על ראיונות בדויים' : 'הרצה מוקלטת על ראיונות בדויים';
    if (app.mode === 'live' && app.live) {
      mode = app.live.kind === 'custom' ? 'custom' : 'live';
      const who = app.live.kind === 'custom' ? 'על החומרים שלכם' : 'על הראיונות הבדויים';
      text = `הרצה חיה ${who}, ${app.live.providerLabel || ''}`.trim();
    }
    chip.dataset.mode = mode;
    chip.append(h('span', { class: 'dot', 'aria-hidden': 'true' }), text);
  }

  // ---------- step buttons ----------
  function renderSteps() {
    clear(stepsEl);
    const idx = state.step ? STEPS.indexOf(state.step) : -1;
    STEPS.forEach((st, i) => {
      const cp = isCheckpoint(st);
      const meta = cp ? null : stageByN(st);
      const label = cp ? `${CHECKPOINTS[st].title}` : `שלב ${st}: ${meta.title}${meta.sight === 'none' ? ', עיוור לראיונות' : ''}`;
      const b = h('button', {
        type: 'button',
        'aria-label': label,
        title: label,
        'data-step': st,
        'data-cp': cp ? 'true' : null,
        'data-blind': !cp && meta.sight === 'none' ? 'true' : null,
        'aria-current': st === state.step ? 'step' : null,
        class: i < idx ? 'is-done' : '',
        style: { '--hue': cp ? 'var(--warm)' : meta.hue },
        disabled: !available(st),
      }, h('span', {}, cp ? (st === 'A' ? 'א' : 'ב') : st));
      b.addEventListener('click', () => { stop(); go(st, { frame: true }); });
      stepsEl.append(h('li', {}, b));
    });
    const list = availableSteps();
    const cur = list.indexOf(state.step);
    $('#rc-prev').disabled = cur <= 0;
    $('#rc-next').disabled = !list.length || (state.step !== null && cur >= list.length - 1);
    playBtn.disabled = !list.length;
    keepStepInView();
  }

  // On a phone the step pills scroll sideways: keep the current one in view, without moving the page.
  function keepStepInView() {
    if (stepsEl.scrollWidth <= stepsEl.clientWidth + 1) return;
    const b = stepsEl.querySelector('button[aria-current="step"]');
    if (!b) return;
    const br = b.getBoundingClientRect();
    const sr = stepsEl.getBoundingClientRect();
    const delta = (br.left + br.width / 2) - (sr.left + sr.width / 2);
    if (Math.abs(delta) > 2) stepsEl.scrollBy({ left: delta, behavior: reducedMotion() ? 'auto' : 'smooth' });
  }

  // ---------- the work log ----------
  function logLines(step) {
    const m = app.model;
    if (isCheckpoint(step)) {
      return step === 'A'
        ? ['עצירה. ההרצה ממתינה לחוקרת', 'מה דפוס ההישרדות מלמד על ההנחות שלנו?']
        : ['עצירה. החוקרת בוחרת שם לכל ציר', 'השם צריך להתאים לציר כולו, גם לאמצע'];
    }
    const n = Number(step);
    const kept = m.results.filter((r) => r.verdict === 'retained').length;
    switch (n) {
      case 1: {
        const lines = m.interviews.slice(0, 4).map((itv) => {
          const c = m.units.filter((u) => u.interview_id === itv.id).length;
          return `קורא את הראיון עם ${interviewLabel(itv)}: ${plural(c, 'יחידת משמעות אחת', 'יחידות משמעות')}`;
        });
        if (m.interviews.length > 4) lines.push(`ועוד ${plural(m.interviews.length - 4, 'ראיון אחד', 'ראיונות')}`);
        return lines;
      }
      case 2:
        return [`מקבל ${m.units.length} יחידות, בלי ההקשר שלהן`, 'נותן לכל יחידה תווית תיאורית קצרה',
          `${plural(m.labels.length, 'תווית אחת', 'תוויות')}, למשל: ${m.labels.slice(0, 2).map((l) => l.label).join('; ')}`];
      case 3: {
        const c = m.contrasts[0];
        const p = c ? m.pairOf(c.id) : null;
        return ['הראיונות חתומים. מקבל תוויות בלבד', `בונה חלופה תאורטית לכל אחת מ-${m.labels.length} התוויות`,
          p ? `${p.label}  /  ${p.antithesis}` : ''];
      }
      case 4:
        return [`חוזר לראיונות עם ${m.contrasts.length} השערות`, 'מחפש ציטוט מילולי לכל ניגוד',
          `${plural(kept, 'ניגוד אחד נמצא', 'נמצאו')} בנתונים, ${plural(m.results.length - kept, 'אחד נפל', 'נפלו')}`];
      case 5:
        return ['הראיונות חתומים שוב, וגם הציטוטים שאישרו את הזוגות', 'הופך כל זוג לרצף בין שני קצוות', plural(m.axes.length, 'ציר אחד', 'צירים')];
      case 6: {
        const brittle = m.midpoints.filter((x) => x.status === 'brittle').length;
        return ['חוזר לראיונות בפעם השנייה', 'מחפש עמדות ביניים על כל ציר',
          `${plural(m.midpoints.length - brittle, 'ציר מאוכלס אחד', 'צירים מאוכלסים')}, ${plural(brittle, 'ציר שביר אחד', 'שבירים')}`];
      }
      case 7:
        return ['מציע שלושה שמות תאורטיים לכל ציר', 'בודק שכל שם מכסה גם את נקודות האמצע'];
      case 8: {
        const s8 = m.s8 || {};
        return ['הראיונות חתומים. מקבל רק שמות, הגדרות וסטטוס', `${plural((s8.relations || []).length, 'קשר אחד', 'קשרים')} בין צירים`,
          (s8.core_axes || []).length ? `צירי ליבה: ${(s8.core_axes || []).map((id) => app.axisName(id)).join(', ')}` : ''];
      }
      case 9: {
        const s9 = m.s9 || {};
        const title = String(s9.title || '').replace(/\[\[(A\d+)\]\]/g, (_, id) => app.axisName(id));
        return ['מקבל הכול: ראיונות, צירים, שמות וקשרים', 'כותב חשבון אחד: טענה, ציטוט, ניתוח', title ? `"${title}"` : ''];
      }
      default:
        return [];
    }
  }

  function logHead(step) {
    const cp = isCheckpoint(step);
    const meta = cp ? null : stageByN(step);
    logEl.style.setProperty('--log-hue', cp ? 'var(--warm)' : meta.hue);
    logAgent.classList.toggle('is-cp', cp);
    logAgent.textContent = cp ? CHECKPOINTS[step].short : meta.persona;
  }

  // the whole log at once (no typing): after a skip, a click on the log, or with motion turned off
  function logNow(step) {
    state.typeToken += 1;
    clear(logBody);
    logHead(step);
    logLines(step).filter(Boolean).forEach((l) => logBody.append(h('p', {}, l)));
  }

  async function typeLog(step) {
    const my = ++state.typeToken;
    clear(logBody);
    logHead(step);
    const lines = logLines(step).filter(Boolean);
    for (const line of lines) {
      if (my !== state.typeToken) return;
      const p = h('p', {});
      logBody.append(p);
      if (state.instant) { p.textContent = line; continue; }
      const caret = h('span', { class: 'caret' });
      const text = document.createTextNode('');
      p.append(text, caret);
      const per = 18 / state.speed;
      for (let i = 1; i <= line.length; i++) {
        if (my !== state.typeToken) return;
        if (state.instant) { text.data = line; break; }
        text.data = line.slice(0, i);
        await sleep(per);
      }
      if (my !== state.typeToken) return;
      caret.remove();
      await sleep(160 / state.speed);
    }
  }

  // ---------- the panel ----------
  function renderPanel(step, animate, dir = 'forward') {
    clear(panel);
    panel.dataset.dir = dir;
    panel.classList.toggle('is-still', !animate);
    if (!step) {
      panel.style.setProperty('--hue', 'var(--cool)');
      const waiting = app.mode === 'live' && !availableSteps().length;
      const medal = waiting
        ? h('div', { class: 'pn-medal is-idle', 'aria-hidden': 'true' }, icon('radio'))
        : h('button', { type: 'button', class: 'pn-medal is-idle', id: 'pn-play', 'aria-label': 'הפעלת ההרצה מתחילתה' }, icon('play'));
      if (!waiting) medal.addEventListener('click', () => play());
      panel.append(
        h('div', { class: 'pn-head' },
          medal,
          h('p', { class: 'pn-kicker' }, app.mode === 'live' ? 'הרצה חיה' : 'הרצה מוקלטת'),
          h('h3', {}, waiting ? 'הסוכן הראשון מתחיל לקרוא' : 'תשעה סוכנים, שתי עצירות')),
        h('p', { class: 'pn-intro' }, waiting
          ? 'השלב הראשון קורא כל ראיון בנפרד. כשהוא יסתיים, התוצאות יופיעו כאן והרשת תתקדם.'
          : 'לחצו על הפעלה כדי לצפות בהרצה מתחילתה, או בחרו שלב ברשת או בשורת השלבים. בשלבים 3, 5 ו-8 הראיונות במרכז הרשת נחתמים: הסוכן עובד בלי לראות אותם.'),
        h('p', { class: 'pn-intro' }, 'בכל שלב רואים שלושה דברים: מה הסוכן קיבל, מה הוא החזיר, ואת התיעוד של הקריאה למודל.'));
      return;
    }
    if (isCheckpoint(step)) {
      const cp = CHECKPOINTS[step];
      panel.style.setProperty('--hue', 'var(--warm)');
      panel.append(
        h('div', { class: 'pn-head' },
          h('div', { class: 'pn-medal is-cp' }, h('span', {}, step === 'A' ? 'א' : 'ב')),
          h('p', { class: 'pn-kicker' }, step === 'A' ? 'אחרי שלב 4' : 'בתוך שלב 7', h('span', { class: 'badge badge-warm' }, icon('user'), 'החוקרת')),
          h('h3', {}, cp.title)),
        renderCheckpointStep(step, app));
      return;
    }
    const n = Number(step);
    const meta = stageByN(n);
    const sight = app.sightOf(n);
    const calls = app.model.calls(n);
    panel.style.setProperty('--hue', meta.hue);
    panel.append(
      h('div', { class: 'pn-head' },
        h('div', { class: 'pn-medal' }, emblem(n)),
        h('p', { class: 'pn-kicker' }, `שלב ${n} מתוך 9`, h('span', { class: 'persona' }, meta.persona)),
        h('h3', {}, meta.title)),
      h('section', { class: 'pn-block', 'aria-label': 'מה הסוכן קיבל', 'data-block': 'received' },
        h('h4', { class: 'pn-h' }, icon(sight === 'none' ? 'eyeOff' : 'eye', sight === 'none' ? 'is-blind' : ''), `מה הסוכן קיבל: ${SIGHT_TEXT[sight]}`),
        renderReceived(n, app, animate && !state.instant)),
      h('section', { class: 'pn-block', 'aria-label': 'מה הסוכן החזיר', 'data-block': 'output' },
        h('h4', { class: 'pn-h' }, icon('output'), 'מה הסוכן החזיר'),
        renderOutput(n, app)),
      calls.length ? h('section', { class: 'pn-block' }, provenanceFold(calls)) : null);
  }

  // Keep the new stage in view. Wide screens: the panel's top just under the sticky controls, when a
  // reader deep in the previous stage (or far above it) would otherwise be left outside the run.
  // Narrow screens: the network's top under the sticky controls, so the network and the panel's head
  // are both on screen and the network is seen moving.
  function framePanel({ force = false } = {}) {
    const behavior = reducedMotion() || state.instant ? 'auto' : 'smooth';
    const ctrl = $('#run-controls');
    const bar = $('#topbar').getBoundingClientRect().bottom;
    if (!narrow.matches) {
      const r = panel.getBoundingClientRect();
      // where the controls will sit once they stick, whether or not they are stuck now
      const top = bar + 10 + ctrl.offsetHeight + 12;
      if (force || r.top < top - 1 || r.top > window.innerHeight * 0.85) window.scrollBy({ top: r.top - top, behavior });
      return;
    }
    const netTop = $('#network-wrap').getBoundingClientRect().top;
    const top = bar + ctrl.offsetHeight + 8;
    if (Math.abs(netTop - top) > 4) window.scrollBy({ top: netTop - top, behavior });
  }

  // ---------- navigation ----------
  async function go(step, { frame = false } = {}) {
    if (step && !available(step)) return;
    const token = ++state.navToken;
    window.clearTimeout(state.timer);
    const before = state.step;
    state.step = step;
    renderSteps();
    updatePlayLabel();
    const animate = !state.instant;
    net.setStep(step, { animate, speed: state.speed });
    const dir = before && step && STEPS.indexOf(step) < STEPS.indexOf(before) ? 'back' : 'forward';
    renderPanel(step, animate, dir);
    if (frame) framePanel();
    if (step) {
      const cp = isCheckpoint(step);
      const meta = cp ? null : stageByN(step);
      announce(cp ? `${CHECKPOINTS[step].title}. ההרצה ממתינה לחוקרת.`
        : `שלב ${step}: ${meta.title}. ${SIGHT_TEXT[app.sightOf(Number(step))]}.`);
    }
    if (!step) { state.typeToken += 1; clear(logBody); logAgent.textContent = ''; return; }
    await typeLog(step);
    if (token !== state.navToken) return;
    if (!state.playing) return;
    if (isCheckpoint(step)) {
      stop();
      announce('ההרצה נעצרה בנקודת עצירה. אפשר להחליט בחלק של נקודת העצירה, או ללחוץ על הפעלה כדי להמשיך.');
      return;
    }
    const list = availableSteps();
    const next = list[list.indexOf(step) + 1];
    if (!next) { stop(); return; }
    state.timer = window.setTimeout(() => {
      if (token === state.navToken && state.playing) go(next, { frame: true });
    }, DWELL / state.speed);
  }

  function updatePlayLabel() {
    const label = state.playing ? 'השהיה' : (isCheckpoint(state.step) ? 'המשך אחרי העצירה' : 'הפעלה');
    playBtn.setAttribute('aria-label', label);
    playBtn.title = label;
  }
  function setPlaying(on) {
    state.playing = on;
    setIcon(playBtn, on ? 'pause' : 'play');
    updatePlayLabel();
  }
  function stop() {
    window.clearTimeout(state.timer);
    setPlaying(false);
  }

  function play() {
    const list = availableSteps();
    if (!list.length) return;
    setPlaying(true);
    const cur = list.indexOf(state.step);
    const target = state.step === null || cur === list.length - 1 ? list[0] : list[cur + 1];
    go(target, { frame: false });
    // bring the whole instrument into view when play starts
    framePanel({ force: !narrow.matches && $('#run-controls').getBoundingClientRect().top > window.innerHeight * 0.3 });
  }
  function step(delta) {
    stop();
    const list = availableSteps();
    const cur = state.step === null ? -1 : list.indexOf(state.step);
    const next = list[Math.max(0, Math.min(list.length - 1, cur + delta))];
    if (next) go(next, { frame: true });
  }

  playBtn.addEventListener('click', () => (state.playing ? stop() : play()));
  $('#rc-prev').addEventListener('click', () => step(-1));
  $('#rc-next').addEventListener('click', () => step(1));
  logEl.addEventListener('click', () => { if (state.step) logNow(state.step); });

  // A person who scrolls while the run plays is reading: pause, so the content never changes under them.
  const onUserScroll = () => {
    if (!state.playing) return;
    stop();
    announce('ההפעלה הושהתה כי גללתם בדף. לחצו על הפעלה כדי להמשיך.');
  };
  window.addEventListener('wheel', onUserScroll, { passive: true });
  window.addEventListener('touchmove', onUserScroll, { passive: true });

  const speedBtns = Array.from(document.querySelectorAll('#rc-speed button'));
  const setSpeed = (b) => {
    state.speed = Number(b.dataset.speed) || 1;
    speedBtns.forEach((x) => {
      x.setAttribute('aria-checked', x === b ? 'true' : 'false');
      x.setAttribute('tabindex', x === b ? '0' : '-1');
    });
  };
  speedBtns.forEach((b) => b.addEventListener('click', () => setSpeed(b)));
  $('#rc-speed').addEventListener('keydown', (e) => {
    const i = speedBtns.findIndex((b) => b.getAttribute('aria-checked') === 'true');
    let j = i;
    if (e.key === 'ArrowLeft') j = Math.min(speedBtns.length - 1, i + 1);
    else if (e.key === 'ArrowRight') j = Math.max(0, i - 1);
    else return;
    e.preventDefault();
    setSpeed(speedBtns[j]);
    speedBtns[j].focus();
  });
  setSpeed(speedBtns.find((b) => b.getAttribute('aria-checked') === 'true') || speedBtns[1]);

  const skipBtn = $('#rc-skip');
  skipBtn.setAttribute('aria-pressed', state.instant ? 'true' : 'false');
  skipBtn.addEventListener('click', () => {
    state.instant = !state.instant;
    skipBtn.setAttribute('aria-pressed', state.instant ? 'true' : 'false');
    if (state.instant && state.step) {
      net.setStep(state.step, { animate: false, speed: state.speed });
      panel.querySelectorAll('.is-sealing').forEach((el) => el.classList.remove('is-sealing'));
      panel.classList.add('is-still');
      logNow(state.step);
    }
  });

  // The options (speed, no animation, live demo) sit in a disclosure on narrow screens and are always
  // open on wide ones, where there is room for them in the bar.
  const syncMore = () => { if (moreEl) moreEl.open = !narrow.matches; };
  narrow.addEventListener('change', syncMore);
  syncMore();
  const liveBtn = $('#rc-live');
  if (liveBtn) liveBtn.addEventListener('click', () => { if (narrow.matches && moreEl) moreEl.open = false; });

  $('#network').addEventListener('keydown', (e) => {
    if (e.key === 'ArrowLeft') { e.preventDefault(); step(1); }
    if (e.key === 'ArrowRight') { e.preventDefault(); step(-1); }
  });

  app.on('model', () => {
    renderSource();
    net.refreshArchive();
    renderSteps();
    if (app.mode === 'live') return;
    go(state.step && available(state.step) ? state.step : null);
  });
  app.on('mode', renderSource);
  app.on('setaside', () => { if (state.step) renderPanel(state.step, false); });
  // live mode: the network shows which agent is working while its stage runs on the server
  app.on('live-progress', (p) => net.setWorking(p && Number.isFinite(p.working) ? p.working : null));

  renderSource();
  renderSteps();
  go(null);

  return {
    go,
    stop,
    showLatest() {
      const list = availableSteps();
      if (list.length) go(list[list.length - 1]);
      else go(null);
    },
    get step() { return state.step; },
  };
}

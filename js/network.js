// The agent network (DESIGN.md): nine white nodes with a hue ring and the agent's line emblem, on an
// ellipse around the interview archive. Seeing stages open a spoke to the archive; blind stages
// (3, 5, 8) seal the archive behind frosted glass and cut their spoke.
import { s, clear } from './util.js';
import { STAGES, STEPS, stageByN } from './stages.js';
import { iconSvg } from './icons.js';
import { EMBLEMS } from './emblems.js';

const W = 1000;
const H = 640;
const CX = 500;
const CY = 318;
const RX = 302;
const RY = 234;
const R = 42;
const STEP_ANGLE = (2 * Math.PI) / 9;
// node 1 at the top right, then counter-clockwise, so the ring reads right to left
const angleOf = (i) => -Math.PI / 2 + 0.6 - (i - 1) * STEP_ANGLE;
const pt = (a) => ({ x: CX + RX * Math.cos(a), y: CY + RY * Math.sin(a) });
const inner = (svgMarkup) => svgMarkup.replace(/^<svg[^>]*>|<\/svg>$/g, '');

function arcPath(a0, a1) {
  const p0 = pt(a0);
  const p1 = pt(a1);
  return `M ${p0.x.toFixed(1)} ${p0.y.toFixed(1)} A ${RX} ${RY} 0 0 0 ${p1.x.toFixed(1)} ${p1.y.toFixed(1)}`;
}

export function createNetwork(svg, app, onSelect) {
  const nodes = new Map();
  const cps = new Map();
  const arcs = [];
  const spokes = new Map();
  const seals = new Map();
  let archive;
  let archSub;

  function build() {
    clear(svg);
    fitViewBox();
    svg.append(s('defs', {},
      s('filter', { id: 'net-blur', x: '-20%', y: '-20%', width: '140%', height: '140%' }, s('feGaussianBlur', { stdDeviation: '3.2' }))));

    svg.append(s('ellipse', { class: 'net-ring', cx: CX, cy: CY, rx: RX, ry: RY }));

    // arcs between consecutive nodes
    for (let i = 1; i < 9; i++) {
      const d = arcPath(angleOf(i), angleOf(i + 1));
      const hue = stageByN(i + 1).hue;
      const lit = s('path', { class: 'net-arc', d, style: { '--hue': hue } });
      const beam = s('path', { class: 'net-beam', d, pathLength: '1000', style: { '--hue': hue } });
      svg.append(lit, beam);
      arcs.push({ from: i, to: i + 1, lit, beam });
    }

    // spokes from the archive to every node; blind ones are cut by a seal
    STAGES.forEach((st) => {
      const p = pt(angleOf(st.n));
      const len = Math.hypot(p.x - CX, p.y - CY);
      const ux = (p.x - CX) / len;
      const uy = (p.y - CY) / len;
      const start = { x: CX + ux * 92, y: CY + uy * 70 };
      const end = { x: p.x - ux * (R + 8), y: p.y - uy * (R + 8) };
      const d = `M ${start.x.toFixed(1)} ${start.y.toFixed(1)} L ${end.x.toFixed(1)} ${end.y.toFixed(1)}`;
      const blind = st.sight === 'none';
      const line = s('path', { class: `net-spoke${blind ? ' blind' : ''}`, d, style: { '--hue': st.hue } });
      const beam = s('path', { class: 'net-beam', d, pathLength: '1000', style: { '--hue': st.hue } });
      svg.append(line, beam);
      if (blind) {
        const mx = (start.x + end.x) / 2;
        const my = (start.y + end.y) / 2;
        const seal = s('g', { class: 'net-seal', transform: `translate(${(mx - 15).toFixed(1)} ${(my - 15).toFixed(1)})` },
          s('rect', { width: 30, height: 30, rx: 8 }));
        const glyph = s('g', { class: 'glyph', transform: 'translate(6 6) scale(0.75)' });
        glyph.innerHTML = inner(iconSvg('eyeOff'));
        seal.append(glyph);
        svg.append(seal);
        seals.set(st.n, seal);
      }
      spokes.set(st.n, { line, beam });
    });

    // the archive at the centre: a small stack of interview sheets
    archive = s('g', { class: 'archive' });
    const docs = s('g', { class: 'docs-g' });
    [-26, 0, 26].forEach((dx, i) => {
      const g = s('g', { transform: `translate(${CX + dx - 26} ${CY - 70 + (i === 1 ? -8 : 0)}) rotate(${[-8, 0, 8][i]} 26 34)` },
        s('rect', { class: 'doc', width: 52, height: 68, rx: 4 }),
        [15, 23, 31, 39, 47, 55].map((y, k) => s('line', { class: k === 2 && i === 1 ? 'doc-line hl-line' : 'doc-line', x1: 9, x2: k % 2 ? 36 : 43, y1: y, y2: y })));
      docs.append(g);
    });
    archive.append(docs);
    archive.append(s('rect', { class: 'glass', x: CX - 74, y: CY - 90, width: 148, height: 106, rx: 14 }));
    const eye = s('g', { class: 'seal-eye', transform: `translate(${CX - 20} ${CY - 57})` },
      s('circle', { cx: 20, cy: 20, r: 20 }));
    const eyeGlyph = s('g', { class: 'glyph', transform: 'translate(8 8)' });
    eyeGlyph.innerHTML = inner(iconSvg('eyeOff'));
    eye.append(eyeGlyph);
    archive.append(eye);
    archive.append(s('text', { class: 'arch-label', x: CX, y: CY + 44 }, 'הראיונות'));
    archSub = s('text', { class: 'arch-sub', x: CX, y: CY + 66 }, '');
    archive.append(archSub);
    svg.append(archive);

    // checkpoint markers on the ring: A after stage 4, B within stage 7
    [['A', angleOf(4) + 0.55 * (angleOf(5) - angleOf(4)), 'עצירה א'], ['B', angleOf(7) + 0.5 * (angleOf(8) - angleOf(7)), 'עצירה ב']].forEach(([key, a, label]) => {
      const p = pt(a);
      const len = Math.hypot(p.x - CX, p.y - CY) || 1;
      const ux = (p.x - CX) / len;
      const uy = (p.y - CY) / len;
      const lx = p.x + ux * 24;
      const ly = p.y + uy * 24 + (uy > 0.5 ? 14 : 5);
      const anchor = ux > 0.4 ? 'start' : (ux < -0.4 ? 'end' : 'middle');
      // not a tab stop: the step buttons above the network give the same choices from the keyboard
      const g = s('g', { class: 'net-cp', tabindex: '-1', role: 'button', 'aria-label': `${label}: נקודת עצירה של החוקרת` },
        s('rect', { class: 'dia', x: p.x - 11, y: p.y - 11, width: 22, height: 22, rx: 3, transform: `rotate(45 ${p.x} ${p.y})` }),
        s('text', { x: lx.toFixed(1), y: ly.toFixed(1), 'text-anchor': anchor }, label));
      bindSelect(g, key);
      svg.append(g);
      cps.set(key, g);
    });

    // nodes
    STAGES.forEach((st) => {
      const p = pt(angleOf(st.n));
      const blind = st.sight === 'none';
      const g = s('g', {
        class: 'net-node', tabindex: '-1', role: 'button', style: { '--hue': st.hue }, 'data-stage': String(st.n),
        'aria-label': `שלב ${st.n}: ${st.title}, ${st.persona}. ${blind ? 'לא רואה את הראיונות' : 'רואה נתונים'}`,
      });
      // a soft halo behind the ring: shown for the active agent, and pulsing while a live stage runs
      g.append(s('circle', { class: 'halo', cx: p.x, cy: p.y, r: R + 11 }));
      g.append(s('circle', { class: 'ring', cx: p.x, cy: p.y, r: R }));
      const em = s('g', { class: 'emblem-g', transform: `translate(${p.x - 25} ${p.y - 25}) scale(0.78)` });
      const inner2 = s('g', { class: 'emblem', style: { fill: 'none', stroke: 'currentColor', 'stroke-width': '1.6', 'stroke-linecap': 'round', 'stroke-linejoin': 'round' } });
      inner2.innerHTML = EMBLEMS[st.n];
      em.append(inner2);
      g.append(em);
      g.append(s('text', { class: 'num-big', x: p.x, y: p.y }, String(st.n)));
      // Two lines radially outside the ring, anchored away from it: the deck's persona (without "THE",
      // as in the matrix) and, for a Hebrew reader, what the agent does.
      const dx = p.x - CX;
      const dy = p.y - CY;
      const dl = Math.hypot(dx, dy) || 1;
      const ux = dx / dl;
      const uy = dy / dl;
      const lx = p.x + ux * (R + 16);
      const base = p.y + uy * (R + 16);
      const anchor = ux > 0.4 ? 'start' : (ux < -0.4 ? 'end' : 'middle');
      // above the node the block ends at the node; below it, it starts at the node; at the sides, centred
      const [yPersona, yRole] = uy < -0.5 ? [base - 30, base - 2] : (uy > 0.5 ? [base + 16, base + 44] : [base - 8, base + 20]);
      g.append(s('text', { class: 'persona', x: lx.toFixed(1), y: yPersona.toFixed(1), 'text-anchor': anchor }, st.persona.replace(/^THE /, '')));
      // the Hebrew line runs right to left (so its number reads first); in RTL text "start" is the right
      // edge, so the anchor is mirrored to keep the line on the same side of the node
      const rtlAnchor = { start: 'end', end: 'start', middle: 'middle' }[anchor];
      g.append(s('text', { class: 'role', x: lx.toFixed(1), y: yRole.toFixed(1), direction: 'rtl', 'text-anchor': rtlAnchor }, `${st.n}. ${st.short}`));
      if (blind) {
        // the eye tag sits on the node's rim, between the outside label and the ring
        const tx = -uy;
        const ty = ux;
        const bxv = ux * 0.55 + tx * 0.84;
        const byv = uy * 0.55 + ty * 0.84;
        const b = s('g', { class: 'blind-tag', transform: `translate(${(p.x + bxv * R).toFixed(1)} ${(p.y + byv * R).toFixed(1)})` },
          s('circle', { r: 13 }));
        const gl = s('g', { class: 'glyph', transform: 'translate(-8.5 -8.5) scale(0.71)' });
        gl.innerHTML = inner(iconSvg('eyeOff'));
        b.append(gl);
        g.append(b);
      }
      bindSelect(g, String(st.n));
      svg.append(g);
      nodes.set(st.n, g);
    });
    setArchiveText('idle');
    fitViewBox();
  }

  // The viewBox is cropped to what is actually drawn, so no empty margin shrinks the labels. Narrow
  // screens hide the agents' labels (CSS), so there the crop is the ring and the checkpoint labels and
  // the picture grows. (Hidden elements do not count in getBBox.)
  const narrowMq = window.matchMedia('(max-width: 700px)');
  function fitViewBox() {
    const pad = R + 10;
    const fallback = narrowMq.matches ? `${CX - RX - pad} ${CY - RY - pad} ${2 * (RX + pad)} ${2 * (RY + pad)}` : `0 0 ${W} ${H}`;
    svg.setAttribute('viewBox', fallback);
    let bb = null;
    try { bb = svg.getBBox(); } catch { bb = null; }
    if (bb && bb.width > 100 && bb.height > 100) {
      const m = 10;
      svg.setAttribute('viewBox', `${(bb.x - m).toFixed(0)} ${(bb.y - m).toFixed(0)} ${(bb.width + 2 * m).toFixed(0)} ${(bb.height + 2 * m).toFixed(0)}`);
    }
  }
  narrowMq.addEventListener('change', fitViewBox);
  // the labels' width depends on the web fonts: fit again once they have loaded
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => fitViewBox()).catch(() => {});

  function bindSelect(el, step) {
    el.addEventListener('click', () => onSelect(step));
    el.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect(step); }
    });
  }

  function setArchiveText(state) {
    const n = app.model.interviews.length;
    const custom = app.live && app.live.kind === 'custom';
    const txt = {
      idle: custom ? `${n} ראיונות שלכם` : `${n} ראיונות בדויים`,
      reading: 'פתוחים לסוכן הזה',
      partial: 'רק קטעים נשלחים',
      sealed: 'חתומים בפני הסוכן',
      human: 'החוקרת בוחנת',
    }[state];
    archSub.textContent = txt;
  }

  // Live mode: stage n is running on the server. Its node pulses, the light keeps travelling to it, and
  // the archive shows what it may see (sealed for a blind stage). setStep clears it when the stage lands.
  let working = null;
  function clearWorking() {
    if (working === null) return;
    const g = nodes.get(working);
    if (g) g.classList.remove('is-working');
    arcs.forEach((a) => a.beam.classList.remove('is-looping'));
    spokes.forEach((sp) => sp.beam.classList.remove('is-looping'));
    working = null;
  }
  function setWorking(n) {
    clearWorking();
    const g = nodes.get(Number(n));
    if (!g) return;
    working = Number(n);
    g.classList.add('is-working');
    const arc = arcs.find((a) => a.to === working);
    if (arc) arc.beam.classList.add('is-looping');
    archive.classList.remove('is-sealed', 'is-reading', 'is-human');
    if (app.sightOf(working) === 'none') {
      archive.classList.add('is-sealed');
      setArchiveText('sealed');
    } else {
      archive.classList.add('is-reading');
      setArchiveText(app.sightOf(working) === 'partial' ? 'partial' : 'reading');
      const sp = spokes.get(working);
      sp.line.classList.add('is-open');
      sp.beam.classList.add('is-looping');
    }
  }

  // step: '1'..'9' | 'A' | 'B' | null
  function setStep(step, { animate = true, speed = 1 } = {}) {
    clearWorking();
    const idx = step ? STEPS.indexOf(step) : -1;
    if (step) svg.dataset.step = step; else delete svg.dataset.step;
    svg.style.setProperty('--beam-ms', `${Math.round(1400 / speed)}ms`);
    const beamOn = (el) => { if (animate) { el.classList.remove('is-on'); void el.getBoundingClientRect(); el.classList.add('is-on'); } };

    nodes.forEach((g, n) => {
      const sIdx = STEPS.indexOf(String(n));
      g.classList.toggle('is-active', String(n) === step);
      g.classList.toggle('is-done', idx >= 0 && sIdx < idx);
    });
    cps.forEach((g, key) => {
      const sIdx = STEPS.indexOf(key);
      g.classList.toggle('is-active', key === step);
      g.classList.toggle('is-done', idx >= 0 && sIdx < idx);
    });
    arcs.forEach((a) => {
      a.beam.classList.remove('is-on');
      a.lit.classList.toggle('is-lit', idx >= 0 && STEPS.indexOf(String(a.to)) <= idx);
    });
    spokes.forEach((sp) => { sp.beam.classList.remove('is-on'); sp.line.classList.remove('is-open'); });
    seals.forEach((g) => g.classList.remove('is-active'));
    archive.classList.remove('is-sealed', 'is-reading', 'is-human');

    if (!step) { setArchiveText('idle'); return; }
    if (step === 'A' || step === 'B') {
      archive.classList.add('is-human');
      setArchiveText('human');
      return;
    }
    const n = Number(step);
    const sight = app.sightOf(n);
    if (sight === 'none') {
      archive.classList.add('is-sealed');
      setArchiveText('sealed');
      if (seals.has(n)) seals.get(n).classList.add('is-active');
    } else {
      archive.classList.add('is-reading');
      setArchiveText(sight === 'partial' ? 'partial' : 'reading');
      spokes.get(n).line.classList.add('is-open');
      beamOn(spokes.get(n).beam);
    }
    const arc = arcs.find((a) => a.to === n);
    if (arc) beamOn(arc.beam);
  }

  build();
  return { setStep, setWorking, rebuild: build, refreshArchive: () => { if (working === null) setArchiveText('idle'); } };
}

// The run model: lookups over {corpus, run} (ARCHITECTURE 3.1-3.5) plus the app-wide event bus.
// Replay builds it once from data/demo-run.json; live mode rebuilds it as each stage arrives.
import { store, h, $$ } from './util.js';

export function buildModel(corpus, run) {
  const stages = (run && run.stages) || {};
  const entry = (n) => stages[String(n)] || null;
  const out = (n) => (entry(n) && entry(n).output) || null;
  const calls = (n) => (entry(n) && Array.isArray(entry(n).calls) ? entry(n).calls : []);
  const interviews = (corpus && Array.isArray(corpus.interviews)) ? corpus.interviews : [];
  const byId = (arr, key = 'id') => new Map((arr || []).map((x) => [x[key], x]));

  const units = (out(1) && out(1).units) || [];
  const labels = (out(2) && out(2).labels) || [];
  const contrasts = (out(3) && out(3).contrasts) || [];
  const results = (out(4) && out(4).results) || [];
  const axes = (out(5) && out(5).axes) || [];
  const midpoints = (out(6) && out(6).midpoints) || [];
  const names = (out(7) && out(7).names) || [];
  const checkpoints = (run && run.checkpoints) || {};
  const cpA = checkpoints.A && Object.keys(checkpoints.A).length ? checkpoints.A : null;
  const cpB = checkpoints.B && Object.keys(checkpoints.B).length ? checkpoints.B : null;

  const labelById = byId(labels);
  const labelOfUnit = new Map();
  labels.forEach((l) => (l.unit_ids || []).forEach((u) => labelOfUnit.set(u, l)));
  const contrastById = byId(contrasts);

  const allCalls = [];
  for (let n = 1; n <= 9; n++) calls(n).forEach((c) => allCalls.push(c));

  return {
    corpus: corpus || {},
    run: run || {},
    interviews,
    interviewById: byId(interviews),
    out,
    calls,
    hasStage: (n) => !!out(n),
    units,
    unitById: byId(units),
    labels,
    labelById,
    labelOfUnit,
    contrasts,
    contrastById,
    results,
    resultByContrast: byId(results, 'contrast_id'),
    pattern: (out(4) && out(4).pattern_summary) || '',
    axes,
    axisById: byId(axes),
    midpoints,
    midByAxis: byId(midpoints, 'axis_id'),
    brittleAxes: new Set(midpoints.filter((m) => m.status !== 'populated').map((m) => m.axis_id)),
    names,
    namesByAxis: byId(names, 'axis_id'),
    s8: out(8),
    s9: out(9),
    cpA,
    cpB,
    removed: new Set((cpA && cpA.removed_contrast_ids) || []),
    allCalls,
    gates: (run && run.gates) || {},
    // pole labels of a contrast, used wherever a pair is shown
    pairOf(contrastId) {
      const c = contrastById.get(contrastId);
      if (!c) return null;
      const l = labelById.get(c.label_id);
      return { id: c.id, label: l ? l.label : c.label_id, antithesis: c.antithesis, rationale: c.rationale };
    },
  };
}

// The prompt layers of a site data file: names and SHA-256 hashes only (ARCHITECTURE 5.2, D17). A file exported
// before D17 carried the texts; the page keeps none of them, whatever the file holds, and shows the hashes the
// run's own calls recorded instead (hood.js).
export function promptLayersOf(p) {
  const layers = p && Array.isArray(p.layers)
    ? p.layers.filter((l) => l && typeof l.name === 'string' && typeof l.sha256 === 'string').map((l) => ({ name: l.name, sha256: l.sha256 }))
    : [];
  return { layers, source: 'file' };
}

export function createApp(file) {
  const listeners = {};
  const app = {
    file,
    fixture: !!file.fixture,
    mode: 'replay',
    prompts: promptLayersOf(file.prompts),
    model: buildModel(file.corpus, file.run),
    replayModel: null,
    chosen: {},
    on(ev, fn) { (listeners[ev] = listeners[ev] || []).push(fn); },
    emit(ev, data) { (listeners[ev] || []).forEach((fn) => { try { fn(data); } catch (e) { console.warn(e); } }); },
  };
  app.replayModel = app.model;

  const namesKey = () => `mabat-kaful:names:${(app.model.run && app.model.run.run_id) || 'run'}`;

  app.loadNames = () => {
    app.chosen = app.mode === 'replay' ? (store.get(namesKey(), {}) || {}) : {};
  };

  app.setModel = (corpus, run) => {
    app.model = buildModel(corpus, run);
    app.emit('model', app.model);
  };

  app.recordedName = (id) => {
    const b = app.model.cpB && app.model.cpB.chosen;
    return b && b[id] ? b[id].name : null;
  };

  app.recommendedName = (id) => {
    const n = app.model.namesByAxis.get(id);
    if (!n || !Array.isArray(n.candidates) || !n.candidates.length) return null;
    const i = Number.isInteger(n.recommended) ? n.recommended : 0;
    return (n.candidates[i] || n.candidates[0]).name;
  };

  app.axisName = (id) =>
    (app.chosen[id] && app.chosen[id].name) || app.recordedName(id) || app.recommendedName(id) || id;

  app.choose = (id, name, source) => {
    const clean = String(name || '').trim();
    if (!clean) return;
    app.chosen = { ...app.chosen, [id]: { name: clean, source } };
    if (app.mode === 'replay') store.set(namesKey(), app.chosen);
    app.emit('names', id);
  };

  app.resetNames = () => {
    app.chosen = {};
    if (app.mode === 'replay') store.remove(namesKey());
    app.model.axes.forEach((a) => app.emit('names', a.id));
  };

  // Checkpoint A in replay: the viewer may set aside a retained pair. It is recorded in this browser
  // as the viewer's decision; the recorded stages 5-9 ran without it, and the page says so.
  const asideKey = () => `mabat-kaful:setaside:${(app.model.run && app.model.run.run_id) || 'run'}`;
  app.setAside = new Set();
  app.loadSetAside = () => {
    const saved = app.mode === 'replay' ? store.get(asideKey(), []) : [];
    app.setAside = new Set(Array.isArray(saved) ? saved.filter((x) => typeof x === 'string') : []);
  };
  app.toggleSetAside = (contrastId, on) => {
    if (on) app.setAside.add(contrastId); else app.setAside.delete(contrastId);
    if (app.mode === 'replay') store.set(asideKey(), [...app.setAside]);
    app.emit('setaside', contrastId);
  };
  // Axis ids whose pair the viewer set aside (replay only).
  app.asideAxes = () => new Set(app.model.axes.filter((a) => app.setAside.has(a.contrast_id)).map((a) => a.id));

  app.loadNames();
  app.loadSetAside();
  return app;
}

// [[A1]] markers -> spans that always show the name chosen at checkpoint B.
const MARKER = /\[\[(A\d+)\]\]/g;
export function marked(text, app) {
  const frag = document.createDocumentFragment();
  const str = String(text == null ? '' : text);
  let last = 0;
  for (const m of str.matchAll(MARKER)) {
    if (m.index > last) frag.append(document.createTextNode(str.slice(last, m.index)));
    frag.append(axisNameSpan(m[1], app));
    last = m.index + m[0].length;
  }
  if (last < str.length) frag.append(document.createTextNode(str.slice(last)));
  return frag;
}

export function axisNameSpan(id, app) {
  return h('span', { class: 'axis-name', 'data-axis': id }, app.axisName(id));
}

export function refreshAxisNames(app, id) {
  $$(id ? `.axis-name[data-axis="${CSS.escape(id)}"]` : '.axis-name[data-axis]').forEach((el) => {
    const name = app.axisName(el.dataset.axis);
    if (el.textContent !== name) {
      el.textContent = name;
      el.classList.remove('flash');
      void el.offsetWidth;
      el.classList.add('flash');
      window.setTimeout(() => el.classList.remove('flash'), 900);
    }
  });
}

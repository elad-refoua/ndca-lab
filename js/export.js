// "Download findings" (ARCHITECTURE 5.3): one self-contained, printable HTML page with the axis map,
// the relations, the stage-9 text and the checkpoint decisions. Every value is escaped; markers
// [[A1]] are written with the name currently chosen at checkpoint B.
import { RELATION_TEXT, KIND_TEXT } from './stages.js';
import { interviewLabel } from './reader.js';

const esc = (v) => String(v == null ? '' : v)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

const clamp01 = (x) => Math.max(0, Math.min(1, Number(x) || 0));

function withNames(text, app) {
  return esc(String(text || '').replace(/\[\[(A\d+)\]\]/g, (_, id) => `\u0000${id}\u0001`))
    .replace(/\u0000(A\d+)\u0001/g, (_, id) => `<b class="nm">${esc(app.axisName(id))}</b>`);
}

// The axis as in the portal: pole a (the participants' label) in amber on the right, pole b (the
// constructed antithesis) in indigo on the left, the middle points numbered as their quotes below.
// The drawing scales with the page width (height follows), so the poles sit at the ends of the text row.
function axisSvg(a, mp) {
  const W = 600;
  const pad = 8;
  const y = 30;
  const x = (p) => W - pad - clamp01(p) * (W - 2 * pad); // RTL: pole a on the right
  const pts = (mp.points || []).map((p, i) => {
    const cx = x(p.position).toFixed(1);
    return `<circle cx="${cx}" cy="${y}" r="7" fill="#B86E0F" stroke="#fff" stroke-width="2"/><text x="${cx}" y="${y - 13}" font-size="11" font-family="ui-monospace, Consolas, monospace" fill="#8E5409" text-anchor="middle">${i + 1}</text>`;
  }).join('');
  const line = mp.status === 'brittle'
    ? `<line x1="${pad}" x2="${W * 0.34}" y1="${y}" y2="${y}" stroke="#474B55" stroke-width="1.25"/><line x1="${W * 0.66}" x2="${W - pad}" y1="${y}" y2="${y}" stroke="#474B55" stroke-width="1.25"/><line x1="${W * 0.34}" x2="${W * 0.66}" y1="${y}" y2="${y}" stroke="#D5D6D0" stroke-width="1.5" stroke-dasharray="5 5"/>`
    : `<line x1="${pad}" x2="${W - pad}" y1="${y}" y2="${y}" stroke="#474B55" stroke-width="1.25"/>`;
  return `<svg viewBox="0 0 ${W} 44" style="display:block;width:100%;height:auto" aria-hidden="true">${line}<circle cx="${W - pad}" cy="${y}" r="7" fill="#B86E0F"/><circle cx="${pad}" cy="${y}" r="7" fill="#3B4FD9"/>${pts}</svg>`;
}

export function buildFindingsHtml(app) {
  const m = app.model;
  const run = m.run || {};
  const corpus = m.corpus || {};
  const s8 = m.s8 || {};
  const s9 = m.s9 || {};
  const core = new Set(s8.core_axes || []);
  const who = (id) => {
    const itv = m.interviewById.get(id);
    return itv ? interviewLabel(itv) : id;
  };
  const quote = (q) => (q && q.quote ? `<blockquote><p>${esc(q.quote)}</p><cite>${esc(who(q.interview_id))} (${esc(q.interview_id)})</cite></blockquote>` : '');
  const custom = app.live && app.live.kind === 'custom';
  const nowIso = new Date().toISOString();

  const axes = m.axes.map((a) => {
    const mp = m.midByAxis.get(a.id) || { status: 'brittle', points: [] };
    const nm = m.namesByAxis.get(a.id);
    const badges = [
      core.has(a.id) ? '<span class="bd warm">ציר ליבה</span>' : '',
      mp.status === 'brittle' ? '<span class="bd quiet">ציר שביר</span>' : `<span class="bd kept">${(mp.points || []).length === 1 ? 'נקודת אמצע אחת' : `${(mp.points || []).length} נקודות אמצע`}</span>`,
    ].join(' ');
    const points = (mp.points || []).map((p, i) => `<li><span class="pos" title="מיקום ${clamp01(p.position).toFixed(2)}">${i + 1}</span>${quote(p)}<p class="note">${esc(KIND_TEXT[p.kind] || p.kind || '')}${p.note ? `: ${esc(p.note)}` : ''}</p></li>`).join('');
    return `<section class="axis">
      <h3>${esc(app.axisName(a.id))} <span class="id">${esc(a.id)}</span> ${badges}</h3>
      <p class="def">${esc((nm && nm.definition) || a.dimension || '')}</p>
      <div class="poles"><span>${esc(a.pole_a)}</span><span>${esc(a.pole_b)}</span></div>
      ${axisSvg(a, mp)}
      ${mp.status === 'brittle' && mp.note ? `<p class="note">${esc(mp.note)}</p>` : ''}
      ${points ? `<ol class="pts">${points}</ol>` : ''}
    </section>`;
  }).join('');

  const rels = (s8.relations || []).map((r) => {
    const provisional = m.brittleAxes.has(r.from) || m.brittleAxes.has(r.to);
    return `<li><b>${esc(app.axisName(r.from))}</b> <span class="rt">${esc(RELATION_TEXT[r.type] || r.type)}${provisional ? ', זמני' : ''}</span> <b>${esc(app.axisName(r.to))}</b>${r.note ? `<p>${withNames(r.note, app)}</p>` : ''}</li>`;
  }).join('');

  const text = (s9.sections || []).map((sec) => `<h3>${withNames(sec.heading, app)}</h3>${(sec.paragraphs || []).map((p) => `
    <div class="lp"><p class="claim">${withNames(p.claim, app)}</p>${quote(p.quote)}<p class="analysis">${withNames(p.analysis, app)}</p></div>`).join('')}`).join('');

  const cpA = m.cpA;
  const removed = (cpA && cpA.removed_contrast_ids) || [];
  const pair = (id) => { const p = m.pairOf(id); return p ? `${p.label} / ${p.antithesis}` : id; };
  const gates = run.gates || {};
  const gateLine = ['G1', 'G2', 'G3'].map((k) => (gates[k] ? `${k} ${esc(String(gates[k].status || '').toUpperCase())}` : '')).filter(Boolean).join(', ');

  return `<!doctype html>
<html lang="he" dir="rtl">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>מבט כפול: ממצאים ${esc(run.run_id || '')}</title>
<style>
  :root { --text:#16181D; --text2:#474B55; --text3:#6B6F79; --line:#E6E6E1; --warm:#B86E0F; --warmsoft:#FCEFD9; --paper:#FBF8F1; --cool:#3B4FD9; }
  * { box-sizing: border-box; }
  body { margin: 0; background: #fff; color: var(--text); font-family: "Assistant", "Segoe UI", Arial, sans-serif; font-size: 16px; line-height: 1.7; }
  main { max-width: 820px; margin: 0 auto; padding: 48px 24px 80px; }
  h1, h2, h3 { font-family: "Frank Ruhl Libre", "David", "Times New Roman", serif; line-height: 1.25; }
  h1 { font-size: 2.2rem; margin: 0 0 6px; }
  h2 { font-size: 1.5rem; margin: 44px 0 14px; padding-top: 18px; border-top: 1px solid var(--line); }
  h3 { font-size: 1.2rem; margin: 26px 0 8px; }
  .meta { color: var(--text3); font-size: .9rem; }
  .note-box { padding: 12px 16px; border-radius: 10px; background: var(--paper); border: 1px solid #EDE6D6; font-size: .92rem; color: var(--text2); }
  .rq { font-family: "Frank Ruhl Libre", serif; font-size: 1.25rem; border-inline-start: 3px solid var(--warm); padding-inline-start: 16px; }
  .id { font-family: ui-monospace, Consolas, monospace; font-size: .75rem; color: var(--text3); direction: ltr; unicode-bidi: isolate; }
  .bd { font-family: "Assistant", sans-serif; font-size: .75rem; font-weight: 600; padding: 1px 8px; border-radius: 99px; vertical-align: middle; }
  .bd.warm { background: var(--warmsoft); color: #8E5409; } .bd.quiet { color: var(--text3); border: 1px dashed #D5D6D0; } .bd.kept { color: var(--text2); border: 1px solid #D5D6D0; }
  .axis { padding: 16px 0 8px; border-bottom: 1px solid var(--line); break-inside: avoid; }
  .def { color: var(--text2); margin: 0 0 10px; }
  .poles { display: flex; justify-content: space-between; gap: 16px; font-weight: 600; font-size: .92rem; }
  .poles span:last-child { text-align: left; }
  .pts { list-style: none; padding: 0; margin: 10px 0 0; }
  .pts li { display: grid; grid-template-columns: 44px 1fr; gap: 10px; margin-bottom: 8px; }
  .pts .note { grid-column: 2; margin: 0; font-size: .88rem; color: var(--text2); }
  .pos { font-family: ui-monospace, monospace; font-size: .75rem; width: 22px; height: 22px; line-height: 20px; border: 1.5px solid var(--warm); color: #8E5409; border-radius: 50%; text-align: center; margin-top: 10px; direction: ltr; }
  blockquote { margin: 6px 0; padding: 8px 14px; background: var(--paper); border-inline-start: 3px solid var(--warm); border-radius: 8px 0 0 8px; }
  blockquote p { margin: 0; font-family: "Frank Ruhl Libre", serif; font-size: 1.02rem; }
  cite { display: block; font-style: normal; font-size: .8rem; color: var(--text3); }
  .rels { padding: 0; list-style: none; } .rels li { margin-bottom: 12px; } .rels p { margin: 2px 0 0; color: var(--text2); }
  .rt { font-size: .85rem; color: #8A35B8; padding: 0 6px; }
  .nm { color: var(--text); }
  .lp { margin: 0 0 20px; break-inside: avoid; }
  .claim { font-family: "Frank Ruhl Libre", serif; font-size: 1.08rem; margin: 0 0 4px; }
  .analysis { color: var(--text2); margin: 4px 0 0; }
  .reflexive { padding: 14px 16px; background: #FEF8EE; border-inline-start: 3px solid var(--warm); border-radius: 8px 0 0 8px; }
  footer { margin-top: 48px; font-size: .8rem; color: var(--text3); }
  @media print { main { padding: 0; } h2 { break-after: avoid; } a { color: inherit; } }
</style>
</head>
<body>
<main>
  <p class="meta">מבט כפול: ניתוח דיאלקטי-קונסטרוקטיביסטי בתשעה שלבים (אב-טיפוס), לפי השיטה של פרופ' גיא אנוש וטל אליוסף</p>
  <h1>${withNames(s9.title || 'ממצאים', app)}</h1>
  <p class="meta">הרצה <span class="id">${esc(run.run_id || '')}</span>, ${esc(run.provider || '')} / ${esc(run.model || '')}, הורד ${esc(nowIso.slice(0, 10))}${gateLine ? `, בדיקות: ${gateLine}` : ''}</p>
  <p class="note-box">${custom
    ? 'הדף הזה נוצר מהרצה על חומרים שהוכנסו בשרת מקומי. הוא כולל ציטוטים מהראיונות: שמרו אותו כמו שאתם שומרים את הראיונות עצמם.'
    : (corpus.invented ? 'הראיונות בהרצה הזאת בדויים ונכתבו לצורך הדגמה בלבד.' : '')}
  הניתוח נכתב בידי סוכני בינה מלאכותית, בשתי נקודות עצירה של חוקר/ת. זו טיוטה לעבודה, לא ממצא סופי.</p>

  <h2>שאלת המחקר</h2>
  <p class="rq">${esc(corpus.research_question || '')}</p>

  <h2>מפת הצירים</h2>
  ${axes}

  ${rels ? `<h2>הקשרים בין הצירים</h2><ul class="rels">${rels}</ul>${s8.structure_note ? `<p>${withNames(s8.structure_note, app)}</p>` : ''}` : ''}

  <h2>הטקסט המסכם</h2>
  ${text}
  ${s9.reflexive_check ? `<h3>בדיקה רפלקטיבית</h3><p class="reflexive">${withNames(s9.reflexive_check, app)}</p>` : ''}

  <h2>נקודות העצירה</h2>
  <h3>עצירה א, אחרי שלב 4</h3>
  <p>${removed.length ? `הונח בצד: ${esc(removed.map(pair).join('; '))}.` : 'לא הונח בצד אף זוג.'}</p>
  ${cpA && cpA.reflection && !(cpA.decided_by === 'auto' && /^\(auto\)$/i.test(String(cpA.reflection).trim())) ? `<p class="reflexive">${esc(cpA.reflection)}</p>` : ''}
  <h3>עצירה ב, בתוך שלב 7: השמות שנבחרו</h3>
  <ul>${m.axes.map((a) => `<li><span class="id">${esc(a.id)}</span> ${esc(app.axisName(a.id))}</li>`).join('')}</ul>

  <footer>נוצר מתוך מבט כפול, ${esc(nowIso)}.${gates.G1 && String(gates.G1.status).toUpperCase() === 'PASS' ? ' כל ציטוט בהרצה נבדק מילה במילה מול הראיון שממנו נלקח (בדיקה G1).' : ''}</footer>
</main>
</body>
</html>`;
}

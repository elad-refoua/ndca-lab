// Calm progressive disclosure for long lists. A real run has dozens of units, labels, pairs and axes; the
// page shows the first few of each list and keeps the rest one quiet button away ("הצגת כל 35 הזוגות").
//
// - Every item stays in the DOM, so counts, links and the axis-name refresh reach all of them.
// - The hidden rest is findable with the browser's in-page search where hidden="until-found" is supported
//   (it opens itself on a match), and a link that points into it opens it too.
// - Open/closed state survives a re-render of the same list (for example checkpoint A re-renders when a
//   pair is set aside): state is kept per `key`.
import { h } from './util.js';
import { icon } from './icons.js';

const openLists = new Set();
const supportsUntilFound = () => typeof document !== 'undefined' && document.body && 'onbeforematch' in document.body;
let seq = 0;

function hideRest(wrap) {
  if (supportsUntilFound()) wrap.setAttribute('hidden', 'until-found');
  else wrap.hidden = true;
}

/**
 * Split `nodes` into a first list and a hidden rest.
 *   makeList: () => a new, empty list element (same tag and class for both parts, so they read as one list)
 *   initial:  how many to show (a list at most `initial + slack` long is shown whole)
 *   total:    the noun with its article and number, for the button: e.g. (n) => `כל ${n} הזוגות`
 *   key:      a stable name, so the open state survives a re-render
 * Returns one element to append where the list would go.
 */
export function withMore(nodes, makeList, { initial = 6, slack = 2, total = (n) => `כל ${n} הפריטים`, key = null } = {}) {
  const list = nodes.filter(Boolean);
  const first = makeList();
  if (list.length <= initial + slack) {
    first.append(...list);
    return first;
  }
  first.append(...list.slice(0, initial));
  const rest = makeList();
  rest.classList.add('more-list');
  rest.append(...list.slice(initial));
  const id = `more-${key ? String(key).replace(/[^A-Za-z0-9_-]/g, '') : 'x'}-${++seq}`;
  const wrap = h('div', { class: 'more-rest', id }, rest);
  const hiddenCount = list.length - initial;
  const label = h('span', {});
  const count = h('span', { class: 'more-count' });
  const btn = h('button', { type: 'button', class: 'more-btn', 'aria-expanded': 'false', 'aria-controls': id },
    icon('chevronDown'), label, count);
  const box = h('div', { class: 'more-box' }, first, wrap, btn);

  const set = (open, { scroll = false } = {}) => {
    if (open) wrap.hidden = false; else hideRest(wrap);
    btn.setAttribute('aria-expanded', String(open));
    btn.classList.toggle('is-open', open);
    label.textContent = open ? 'הצגה מקוצרת' : `הצגת ${total(list.length)}`;
    count.textContent = open ? '' : `עוד ${hiddenCount}`;
    if (key) { if (open) openLists.add(key); else openLists.delete(key); }
    if (!open && scroll) btn.scrollIntoView({ block: 'nearest' });
  };
  btn.addEventListener('click', () => set(btn.getAttribute('aria-expanded') !== 'true', { scroll: true }));
  wrap.addEventListener('beforematch', () => set(true));
  wrap.__open = () => set(true);
  set(!!(key && openLists.has(key)));
  return box;
}

/** Open every hidden rest and closed fold that holds `el`, so a link or a focus move can reach it. */
export function revealTarget(el) {
  let node = el;
  while (node && node !== document.body) {
    if (node.classList && node.classList.contains('more-rest') && typeof node.__open === 'function') node.__open();
    if (node.tagName === 'DETAILS' && !node.open) node.open = true;
    node = node.parentElement;
  }
}

/** Keys of the folds (details[data-key]) open inside `root`, to reopen them after a re-render. */
export function openFolds(root) {
  return new Set(Array.from(root.querySelectorAll('details[data-key][open]')).map((d) => d.dataset.key));
}
export function restoreFolds(root, keys) {
  if (!keys || !keys.size) return;
  root.querySelectorAll('details[data-key]').forEach((d) => { if (keys.has(d.dataset.key)) d.open = true; });
}

// A link to a place inside a hidden rest (for example "לראות בממצאים" at checkpoint B) opens it first.
let wired = false;
export function wireDisclosureLinks() {
  if (wired) return;
  wired = true;
  const open = (hash) => {
    if (!hash || hash.length < 2) return;
    let target = null;
    try { target = document.getElementById(decodeURIComponent(hash.slice(1))); } catch { target = null; }
    if (target) revealTarget(target);
  };
  document.addEventListener('click', (e) => {
    const a = e.target && e.target.closest ? e.target.closest('a[href^="#"]') : null;
    if (a) open(a.getAttribute('href'));
  }, true);
  window.addEventListener('hashchange', () => open(window.location.hash));
}

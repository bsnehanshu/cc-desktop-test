// Build a click-through whiteboard explainer from a JSON spec.
// Usage: node build.mjs <spec.json> <out.html>
// One scene drawn cumulatively: step n shows the shapes of steps 1..n, so each step lists only what it adds.
// Shapes are rendered by rough.js at build time; the page itself loads nothing from outside.
import rough from 'roughjs';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const [specPath, outPath] = process.argv.slice(2);
if (!specPath || !outPath) {
  console.error('usage: node build.mjs <spec.json> <out.html>');
  process.exit(1);
}
const spec = JSON.parse(fs.readFileSync(specPath, 'utf8'));
const [W, H] = spec.canvas || [1620, 940];
const COLORS = new Set(['ink', 'muted', 'red', 'green', 'blue', 'orange', 'purple', 'yellow', 'gray']);
const FILLS = new Set(['green', 'blue', 'orange', 'purple', 'yellow', 'gray']);
const gen = rough.generator();
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

let where = '';
const fail = (msg) => { throw new Error(`${where}: ${msg}`); };
const color = (c, fallback, set = COLORS) => {
  const v = c ?? fallback;
  if (!set.has(v)) fail(`unknown color "${v}" (use ${[...set].join(', ')})`);
  return v;
};
const need = (el, ...keys) => keys.forEach((k) => el[k] === undefined && fail(`"${el.kind}" needs "${k}"`));

let seed = 11;
const opt = (stroke, extra = {}) => ({ stroke, strokeWidth: 2, roughness: 1, bowing: 1, seed: seed++, ...extra });

function svgPaths(drawable) {
  return gen.toPaths(drawable).map((p) => {
    const fill = p.fill && p.fill !== 'none' ? ` class="f-${p.fill}" stroke="none"` : '';
    const stroke = p.stroke && p.stroke !== 'none' ? ` class="s-${p.stroke}" fill="none" stroke-width="${p.strokeWidth}"` : '';
    return `<path d="${p.d}"${fill || stroke}/>`;
  }).join('');
}
const rr = (x, y, w, h, r) =>
  `M${x + r} ${y} L${x + w - r} ${y} Q${x + w} ${y} ${x + w} ${y + r} L${x + w} ${y + h - r} Q${x + w} ${y + h} ${x + w - r} ${y + h} ` +
  `L${x + r} ${y + h} Q${x} ${y + h} ${x} ${y + h - r} L${x} ${y + r} Q${x} ${y} ${x + r} ${y} Z`;

// Rounded box with a speech tail on its top or bottom edge, as one outline. The tail leaves the edge at tx..tx+30.
function bubblePath(x, y, w, h, r, tx, [px, py], side) {
  const tw = 30;
  if (side === 'bottom')
    return `M${x + r} ${y} L${x + w - r} ${y} Q${x + w} ${y} ${x + w} ${y + r} L${x + w} ${y + h - r} Q${x + w} ${y + h} ${x + w - r} ${y + h} ` +
      `L${tx + tw} ${y + h} L${px} ${py} L${tx} ${y + h} L${x + r} ${y + h} Q${x} ${y + h} ${x} ${y + h - r} L${x} ${y + r} Q${x} ${y} ${x + r} ${y} Z`;
  return `M${x + r} ${y} L${tx} ${y} L${px} ${py} L${tx + tw} ${y} L${x + w - r} ${y} Q${x + w} ${y} ${x + w} ${y + r} L${x + w} ${y + h - r} ` +
    `Q${x + w} ${y + h} ${x + w - r} ${y + h} L${x + r} ${y + h} Q${x} ${y + h} ${x} ${y + h - r} L${x} ${y + r} Q${x} ${y} ${x + r} ${y} Z`;
}

function text(x, y, str, { fs = 20, c = 'ink', anchor = 'middle' } = {}) {
  return String(str).split('\n').map((line, i) =>
    `<text x="${x}" y="${y + i * fs * 1.35}" font-size="${fs}" text-anchor="${anchor}" class="t-${c}">${esc(line)}</text>`).join('');
}
function arrowhead(points, c, width) {
  const [x1, y1] = points[points.length - 2], [x2, y2] = points[points.length - 1];
  const a = Math.atan2(y2 - y1, x2 - x1), L = 17;
  return [0.5, -0.5].map((s) =>
    svgPaths(gen.line(x2, y2, x2 - L * Math.cos(a + s), y2 - L * Math.sin(a + s), opt(c, { strokeWidth: width })))).join('');
}

const KINDS = {
  // Big heading with a hand-drawn red underline.
  title(el) {
    need(el, 'text');
    const fs = el.fs ?? 42, y = el.y ?? 84, half = Math.min(W * 0.42, el.text.length * fs * 0.21);
    const u = y + 28, x0 = W / 2 - half, x1 = W / 2 + half, step = (x1 - x0) / 4;
    return text(W / 2, y, el.text, { fs }) + (el.underline === false ? '' :
      svgPaths(gen.curve([0, 1, 2, 3, 4].map((i) => [x0 + i * step, u + (i % 2 ? -5 : 1)]), opt('red', { strokeWidth: 3 }))));
  },
  // Rounded, filled box: a title line and optional smaller body lines, centered.
  card(el) {
    need(el, 'x', 'y', 'w', 'h', 'title');
    const c = color(el.color, 'gray', FILLS), fs = el.fs ?? 27, lfs = el.lfs ?? 19, lines = el.lines ?? [];
    // Center the block: title baseline, then body baselines below it.
    const cx = el.x + el.w / 2, gap = fs * 0.55 + lfs * 1.25;
    const span = lines.length ? gap + (lines.length - 1) * lfs * 1.45 : 0;
    const top = el.y + el.h / 2 - (span + fs * 0.75 + (lines.length ? lfs * 0.25 : 0)) / 2 + fs * 0.75;
    return svgPaths(gen.path(rr(el.x, el.y, el.w, el.h, 16), opt(c, { fill: `${c}-fill`, fillStyle: 'solid' }))) +
      text(cx, top, el.title, { fs }) +
      lines.map((l, i) => text(cx, top + gap + i * lfs * 1.45, l, { fs: lfs })).join('');
  },
  // Speech bubble: tail on the "top" or "bottom" edge at tailAt, pointing to tip [x, y].
  bubble(el) {
    need(el, 'x', 'y', 'w', 'h', 'lines', 'tip');
    const c = color(el.color, 'yellow', FILLS), fs = el.fs ?? 22, side = el.tail ?? 'bottom';
    if (!['top', 'bottom'].includes(side)) fail('"tail" is "top" or "bottom"');
    const tailAt = el.tailAt ?? el.tip[0] - 15;
    const top = el.y + el.h / 2 - ((el.lines.length - 1) * fs * 1.45) / 2 + fs * 0.35;
    return svgPaths(gen.path(bubblePath(el.x, el.y, el.w, el.h, 14, tailAt, el.tip, side), opt(c, { fill: `${c}-fill`, fillStyle: 'solid' }))) +
      el.lines.map((l, i) => text(el.x + el.w / 2, top + i * fs * 1.45, l, { fs })).join('');
  },
  // Arrow through two or more points [[x, y], ...], head at the last one; optional label at labelAt.
  arrow(el) {
    need(el, 'points');
    if (el.points.length < 2) fail('"points" needs at least two [x, y]');
    const c = color(el.color, 'ink'), width = el.width ?? 2.5;
    const body = el.points.length === 2
      ? gen.line(...el.points[0], ...el.points[1], opt(c, { strokeWidth: width }))
      : gen.linearPath(el.points, opt(c, { strokeWidth: width }));
    const label = el.label ? text(...(el.labelAt ?? fail('"label" needs "labelAt"')), el.label, { fs: el.lfs ?? 20, c: color(el.labelColor, c === 'ink' ? 'muted' : c) }) : '';
    return svgPaths(body) + arrowhead(el.points, c, width) + label;
  },
  // Plain text; "\n" breaks lines. anchor: start | middle | end.
  text(el) {
    need(el, 'x', 'y', 'text');
    return text(el.x, el.y, el.text, { fs: el.fs ?? 20, c: color(el.color, 'ink'), anchor: el.anchor ?? 'middle' });
  },
  // Hand-drawn line or curve through points, no head (dividers, brackets, underlines).
  line(el) {
    need(el, 'points');
    const c = color(el.color, 'ink'), o = opt(c, { strokeWidth: el.width ?? 2 });
    return svgPaths(el.curve ? gen.curve(el.points, o) : gen.linearPath(el.points, o));
  },
};

if (!Array.isArray(spec.steps) || !spec.steps.length) throw new Error('spec needs a non-empty "steps" array');
const layers = spec.steps.map((st, i) => {
  where = `step ${i + 1}`;
  if (typeof st.caption !== 'string') fail('needs a "caption" string');
  const body = (st.draw ?? []).map((el, j) => {
    where = `step ${i + 1}, draw[${j}]`;
    const fn = KINDS[el.kind] ?? fail(`unknown kind "${el.kind}" (use ${Object.keys(KINDS).join(', ')})`);
    return fn(el);
  }).join('');
  return `<div class="layer" data-step="${i + 1}" aria-hidden="true"><svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" ` +
    `stroke-linecap="round" stroke-linejoin="round">${body}</svg></div>`;
});

const font = fs.readFileSync(path.join(HERE, 'excalifont-latin.css'), 'utf8');
const html = fs.readFileSync(path.join(HERE, 'page.html'), 'utf8')
  .replace('__TITLE__', () => esc(spec.title ?? 'Explainer'))
  .replace('__LABEL__', () => esc(spec.label ?? spec.title ?? 'Step-by-step diagram'))
  .replace('/*FONTS*/', () => font)
  .replace('aspect-ratio: 1620 / 940', () => `aspect-ratio: ${W} / ${H}`)
  .replace('* 1620 / 940', () => `* ${W} / ${H}`)
  .replace('<!--LAYERS-->', () => layers.join('\n'))
  .replace('/*STEPS*/[]', () => JSON.stringify(spec.steps.map((s) => s.caption)));
fs.writeFileSync(outPath, html);
console.log(`wrote ${outPath}: ${spec.steps.length} steps, ${Math.round(html.length / 1024)} KB`);

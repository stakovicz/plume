import { type Node, type Pt, type Subpath, add, cubicPoint, dist, node, pt, segments, sub } from './geometry';
import { fitCurve } from './curve-fit';
import { fromPaper, toPaper } from './boolean';
import { type Layer, type LineCap, type LineJoin, effectiveBorderPosition, hasVisibleStroke, isContainer, keepingPlace, localShape } from './layer';

/** Convert to Outlines (⌥⌘O): the border becomes a filled shape. */

const MITER_LIMIT = 10; // as drawn (LayerView)
const SAMPLES = 16; // per Bézier segment, before refitting

const mul = (a: Pt, k: number) => pt(a.x * k, a.y * k);
const dot = (a: Pt, b: Pt) => a.x * b.x + a.y * b.y;
const cross = (a: Pt, b: Pt) => a.x * b.y - a.y * b.x;
const unit = (a: Pt) => { const k = Math.hypot(a.x, a.y); return k > 0 ? mul(a, 1 / k) : a; };
const left = (t: Pt) => pt(t.y, -t.x); // normal; which side is "left" doesn't matter, both sides are built

/** Direction of a cubic at t; finite differences so zero-length handles still give a direction. */
const dir = (b: Pt[], t: number) => unit(sub(cubicPoint(b, Math.min(t + 1e-4, 1)), cubicPoint(b, Math.max(t - 1e-4, 0))));

/** Circular arc around `c` from angle `a0`, sweeping `da`, as Bézier nodes (≤ 90° per piece). */
function arc(c: Pt, r: number, a0: number, da: number): Node[] {
  const n = Math.max(1, Math.ceil(Math.abs(da) / (Math.PI / 2) - 1e-9)), step = da / n, k = (4 / 3) * Math.tan(step / 4) * r;
  const at = (a: number) => pt(c.x + r * Math.cos(a), c.y + r * Math.sin(a));
  const tan = (a: number) => pt(-Math.sin(a) * k, Math.cos(a) * k);
  return Array.from({ length: n + 1 }, (_, i) => {
    const a = a0 + i * step, p = at(a);
    return { p, cin: i ? sub(p, tan(a)) : p, cout: i < n ? add(p, tan(a)) : p };
  });
}

/** Appends `run` to `out`: shared end points merge, otherwise they're joined by a straight line. */
function append(out: Node[], run: Node[]) {
  if (!run.length) return;
  const last = out[out.length - 1];
  if (last && dist(last.p, run[0].p) < 1e-6) {
    out[out.length - 1] = { ...last, cout: run[0].cout };
    out.push(...run.slice(1));
  } else out.push(...run);
}

/** Corner at `p` from direction `a` to direction `b`, on side `s` (±1) of the path, half-width `h`. */
function joinAt(p: Pt, a: Pt, b: Pt, s: number, h: number, join: LineJoin): Node[] {
  const na = mul(left(a), s), nb = mul(left(b), s), from = add(p, mul(na, h)), to = add(p, mul(nb, h));
  if (dot(a, b) > 0.99999) return [];
  // Inner side: through the pivot, the overlap is cleaned up by the final union (nonzero).
  if (s * cross(a, b) < 0) return [from, p, to].map(node);
  if (join === 'round') {
    const a0 = Math.atan2(na.y, na.x);
    let da = Math.atan2(nb.y, nb.x) - a0;
    da = Math.atan2(Math.sin(da), Math.cos(da)); // the short way round
    return arc(p, h, a0, da);
  }
  const d = dot(na, nb);
  if (join === 'miter' && 2 / (1 + d) <= MITER_LIMIT * MITER_LIMIT) return [from, add(p, mul(add(na, nb), h / (1 + d))), to].map(node);
  return [from, to].map(node);
}

/** End of an open path at `p` going in direction `t`: from the `+` side round to the `−` side. */
function capAt(p: Pt, t: Pt, h: number, cap: LineCap): Node[] {
  const n = left(t);
  if (cap === 'round') return arc(p, h, Math.atan2(n.y, n.x), Math.PI); // n is a quarter turn back from t
  const e = cap === 'square' ? mul(t, h) : pt(0, 0);
  return [add(add(p, mul(n, h)), e), add(sub(p, mul(n, h)), e)].map(node);
}

/** One side (`s` = ±1) of a subpath's stroke, start to end. */
function side(segs: Pt[][], closed: boolean, s: number, h: number, join: LineJoin, tolerance: number): Node[] {
  const out: Node[] = [];
  segs.forEach((b, i) => {
    if (i > 0 || closed) append(out, joinAt(b[0], dir(segs[(i + segs.length - 1) % segs.length], 1), dir(b, 0), s, h, join));
    const samples = Array.from({ length: SAMPLES + 1 }, (_, k) => add(cubicPoint(b, k / SAMPLES), mul(left(dir(b, k / SAMPLES)), s * h)));
    append(out, fitCurve(samples, tolerance));
  });
  return out;
}

const reversed = (ns: Node[]) => ns.toReversed().map((n) => ({ p: n.p, cin: n.cout, cout: n.cin }));

/** Contours whose filled area (nonzero) is the stroke of `sp`. */
function strokeContours(sp: Subpath, width: number, cap: LineCap, join: LineJoin): Subpath[] {
  const segs = segments(sp).filter((b) => b.some((q) => dist(q, b[0]) > 1e-9));
  const h = width / 2, tolerance = Math.max(0.01, width / 200);
  if (!segs.length) { // a dot: only round and square caps draw it
    const p = sp.nodes[0]?.p;
    if (!p || cap === 'butt' || sp.closed) return [];
    const square = [pt(-h, -h), pt(h, -h), pt(h, h), pt(-h, h)].map((d) => node(add(p, d)));
    const circle = arc(p, h, 0, 2 * Math.PI), end = circle.pop()!;
    circle[0] = { ...circle[0], cin: end.cin }; // the last node is the first one again
    return [{ closed: true, nodes: cap === 'round' ? circle : square }];
  }
  const l = side(segs, sp.closed, 1, h, join, tolerance), r = reversed(side(segs, sp.closed, -1, h, join, tolerance));
  if (sp.closed) return [{ nodes: l, closed: true }, { nodes: r, closed: true }];
  const last = segs[segs.length - 1], nodes: Node[] = [];
  append(nodes, l);
  append(nodes, capAt(last[3], dir(last, 1), h, cap));
  append(nodes, r);
  append(nodes, capAt(segs[0][0], mul(dir(segs[0], 0), -1), h, cap));
  return [{ nodes, closed: true }];
}

/** Stroke area of `subpaths` (local space), border position applied: inside = clipped to the fill,
 *  outside = the fill cut out. Inside/outside strokes are drawn at twice the width, as in LayerView.
 *  ponytail: dashes are outlined as a solid border; split the subpaths along the dash pattern first if needed.
 *  ponytail: where the inner side curves tighter than half the width, the offset can loop; fine for usual widths. */
export function strokeShape(subpaths: Subpath[], width: number, cap: LineCap, join: LineJoin, position: 'center' | 'inside' | 'outside', evenOdd: boolean): Subpath[] {
  const w = position === 'center' ? width : width * 2;
  const raw = toPaper(subpaths.flatMap((sp) => strokeContours(sp, w, cap, join)), false);
  let area = raw.unite(raw, { insert: false }); // resolves the overlaps of the raw contours
  if (position !== 'center') {
    const fill = toPaper(subpaths, evenOdd);
    area = position === 'inside' ? area.intersect(fill, { insert: false }) : area.subtract(fill, { insert: false });
  }
  return fromPaper(area);
}

/** The layer with its border turned into its fill (color or gradient), and no border. Null if it has no visible border.
 *  A text layer becomes its glyphs, filled as the text was (null before the fonts are loaded). */
export function outlined(l: Layer): Layer | null {
  if (l.kind === 'text') {
    const subpaths = localShape(l);
    return subpaths.length ? keepingPlace({ ...l, kind: 'path', points: [], subpaths, evenOdd: false, text: undefined }, l) : null;
  }
  if (isContainer(l) || !hasVisibleStroke(l)) return null;
  const subpaths = strokeShape(localShape(l), l.strokeWidth, l.lineCap, l.lineJoin, effectiveBorderPosition(l), l.evenOdd);
  if (!subpaths.length) return null;
  const out: Layer = {
    ...l, kind: 'path', points: [], subpaths, evenOdd: false,
    fill: l.stroke, fillGradient: l.strokeGradient, strokeGradient: undefined, strokeWidth: 0, dash: [],
  };
  return keepingPlace(out, l);
}

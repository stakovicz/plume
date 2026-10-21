import { type Node, type Pt, cubicPoint, node } from './geometry';

/** Fits smooth cubic Béziers through sampled points (freehand pencil strokes).
 *  Philip J. Schneider, "An Algorithm for Automatically Fitting Digitized Curves", Graphics Gems (1990):
 *  least-squares fit of one cubic with fixed end tangents, Newton reparameterization when close,
 *  otherwise split at the worst point with a shared (smooth) tangent and recurse.
 *  `tolerance` is the max distance, in the points' units, between the samples and the curve. */
export function fitCurve(input: Pt[], tolerance: number): Node[] {
  // drop near-duplicates: they give zero-length tangents and add nothing
  const pts: Pt[] = [];
  for (const p of input) if (!pts.length || len(sub(pts[pts.length - 1], p)) > tolerance / 4) pts.push(p);
  const last = input[input.length - 1];
  if (last && pts[pts.length - 1] !== last) pts.length > 1 ? (pts[pts.length - 1] = last) : pts.push(last);
  if (pts.length < 2) return pts.map(node);

  const curves: Pt[][] = [];
  fitCubic(pts, 0, pts.length - 1, norm(sub(pts[1], pts[0])), norm(sub(pts[pts.length - 2], pts[pts.length - 1])),
    tolerance * tolerance, curves);

  const nodes = [node(curves[0][0])];
  for (const c of curves) {
    nodes[nodes.length - 1] = { ...nodes[nodes.length - 1], cout: c[1] };
    nodes.push({ p: c[3], cin: c[2], cout: c[3] });
  }
  return nodes;
}

const add = (a: Pt, b: Pt): Pt => ({ x: a.x + b.x, y: a.y + b.y });
const sub = (a: Pt, b: Pt): Pt => ({ x: a.x - b.x, y: a.y - b.y });
const mul = (a: Pt, k: number): Pt => ({ x: a.x * k, y: a.y * k });
const dot = (a: Pt, b: Pt) => a.x * b.x + a.y * b.y;
const len = (a: Pt) => Math.sqrt(dot(a, a));
const norm = (a: Pt) => (len(a) > 0 ? mul(a, 1 / len(a)) : a);

function fitCubic(d: Pt[], first: number, last: number, t1: Pt, t2: Pt, errSq: number, out: Pt[][]) {
  if (last - first === 1) { // two points: handles a third of the way along the tangents
    const dd = len(sub(d[last], d[first])) / 3;
    out.push([d[first], add(d[first], mul(t1, dd)), add(d[last], mul(t2, dd)), d[last]]);
    return;
  }
  let u = chordLength(d, first, last);
  let bez = generate(d, first, last, u, t1, t2);
  let [err, split] = maxError(d, first, last, bez, u);
  if (err < errSq) return void out.push(bez);
  if (err < errSq * 16) { // close (within 4× the tolerance): improve the parameterization before splitting
    for (let i = 0; i < 20; i++) {
      u = reparameterize(d, first, u, bez);
      bez = generate(d, first, last, u, t1, t2);
      [err, split] = maxError(d, first, last, bez, u);
      if (err < errSq) return void out.push(bez);
    }
  }
  const tc = norm(sub(d[split - 1], d[split + 1])); // smooth joint
  fitCubic(d, first, split, t1, tc, errSq, out);
  fitCubic(d, split, last, mul(tc, -1), t2, errSq, out);
}

function chordLength(d: Pt[], first: number, last: number) {
  const u = [0];
  for (let i = first + 1; i <= last; i++) u.push(u[u.length - 1] + len(sub(d[i], d[i - 1])));
  const total = u[u.length - 1];
  return total > 0 ? u.map((x) => x / total) : u;
}

/** Least-squares handle lengths along the fixed end tangents. */
function generate(d: Pt[], first: number, last: number, u: number[], t1: Pt, t2: Pt): Pt[] {
  const p0 = d[first], p3 = d[last];
  let c00 = 0, c01 = 0, c11 = 0, x0 = 0, x1 = 0;
  u.forEach((t, i) => {
    const mt = 1 - t, b0 = mt * mt * mt, b1 = 3 * t * mt * mt, b2 = 3 * t * t * mt, b3 = t * t * t;
    const a0 = mul(t1, b1), a1 = mul(t2, b2);
    c00 += dot(a0, a0); c01 += dot(a0, a1); c11 += dot(a1, a1);
    const tmp = sub(d[first + i], add(mul(p0, b0 + b1), mul(p3, b2 + b3)));
    x0 += dot(a0, tmp); x1 += dot(a1, tmp);
  });
  const det = c00 * c11 - c01 * c01;
  let aL = det === 0 ? 0 : (x0 * c11 - x1 * c01) / det;
  let aR = det === 0 ? 0 : (c00 * x1 - c01 * x0) / det;
  const seg = len(sub(p3, p0));
  if (aL < 1e-6 * seg || aR < 1e-6 * seg) aL = aR = seg / 3; // degenerate: Wu/Barsky heuristic
  return [p0, add(p0, mul(t1, aL)), add(p3, mul(t2, aR)), p3];
}

function maxError(d: Pt[], first: number, last: number, bez: Pt[], u: number[]): [number, number] {
  let worst = 0, split = Math.floor((first + last) / 2);
  for (let i = first + 1; i < last; i++) {
    const v = sub(cubicPoint(bez, u[i - first]), d[i]), e = dot(v, v);
    if (e >= worst) [worst, split] = [e, i];
  }
  return [worst, split];
}

/** One Newton–Raphson step per sample toward its closest point on the curve. */
function reparameterize(d: Pt[], first: number, u: number[], b: Pt[]) {
  return u.map((t, i) => {
    const mt = 1 - t;
    const q = sub(cubicPoint(b, t), d[first + i]);
    const q1 = mul(add(add(mul(sub(b[1], b[0]), mt * mt), mul(sub(b[2], b[1]), 2 * t * mt)), mul(sub(b[3], b[2]), t * t)), 3);
    const q2 = mul(add(mul(add(sub(b[2], mul(b[1], 2)), b[0]), mt), mul(add(sub(b[3], mul(b[2], 2)), b[1]), t)), 6);
    const den = dot(q1, q1) + dot(q, q2);
    return den === 0 ? t : Math.min(Math.max(t - dot(q, q1) / den, 0), 1);
  });
}

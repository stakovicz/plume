import { type Node, type PointType, type Pt, add, dist, eqPt, node, pt, splitCubic, sub } from './geometry';
import type { Layer } from './layer';

/** Point-edit operations. All points here are in the layer's local frame (use `toLocal` first).
 *  The mutating ones change `l` in place: pass a copy (`structuredClone`) when it must stay intact. */

export type NodeRef = { s: number; n: number };
export type Target = { ref: NodeRef; handle: 'node' | 'cin' | 'cout' };

/** Node or handle under `q`; handles are only live on the selected node. */
export function target(l: Layer, q: Pt, tol: number, selected: NodeRef | null): Target | null {
  const near = (a: Pt) => dist(a, q) < tol;
  const sel = selected && l.subpaths[selected.s]?.nodes[selected.n];
  if (selected && sel) {
    if (!eqPt(sel.cin, sel.p) && near(sel.cin)) return { ref: selected, handle: 'cin' };
    if (!eqPt(sel.cout, sel.p) && near(sel.cout)) return { ref: selected, handle: 'cout' };
  }
  for (const [s, sp] of l.subpaths.entries()) {
    const n = sp.nodes.findIndex((x) => near(x.p));
    if (n >= 0) return { ref: { s, n }, handle: 'node' };
  }
  return null;
}

/** Closest segment under `q`: subpath, segment k (nodes k → k+1, wrapping when closed), curve parameter t. */
// ponytail: brute-force 100 samples per segment, fine for hand-drawn paths; refine with Newton if huge imports get slow
export function segmentAt(l: Layer, q: Pt, tol: number): { s: number; k: number; t: number } | null {
  let best: { s: number; k: number; t: number; d: number } | null = null;
  for (const [s, sp] of l.subpaths.entries()) {
    const n = sp.nodes;
    if (n.length < 2) continue;
    for (let k = 0; k < (sp.closed ? n.length : n.length - 1); k++) {
      const a = n[k], b = n[(k + 1) % n.length];
      for (let i = 1; i < 100; i++) {
        const t = i / 100, d = dist(splitCubic(a.p, a.cout, b.cin, b.p, t)[2], q);
        if (d < tol && d < (best?.d ?? Infinity)) best = { s, k, t, d };
      }
    }
  }
  return best && { s: best.s, k: best.k, t: best.t };
}

/** Inserts a node on segment k at t without changing the shape. */
export function insertNode(l: Layer, s: number, k: number, t: number): NodeRef {
  const nodes = l.subpaths[s].nodes, j = (k + 1) % nodes.length;
  const a = nodes[k], b = nodes[j];
  const q = splitCubic(a.p, a.cout, b.cin, b.p, t);
  let m = node(q[2]);
  if (!eqPt(a.cout, a.p) || !eqPt(b.cin, b.p)) { // curved: keep the curve exact; straight stays straight
    nodes[k] = { ...a, cout: q[0] };
    nodes[j] = { ...nodes[j], cin: q[4] };
    m = { p: q[2], cin: q[1], cout: q[3] };
  }
  nodes.splice(k + 1, 0, m);
  return { s, n: k + 1 };
}

/** Mirrored handles for a straight node, along the line from the previous node to the next. */
function smoothed(l: Layer, r: NodeRef): Node {
  const { nodes, closed } = l.subpaths[r.s];
  const n = nodes[r.n];
  const prev = r.n > 0 ? nodes[r.n - 1].p : closed ? nodes[nodes.length - 1].p : n.p;
  const next = r.n < nodes.length - 1 ? nodes[r.n + 1].p : closed ? nodes[0].p : n.p;
  const d = { x: (next.x - prev.x) / 4, y: (next.y - prev.y) / 4 };
  return { p: n.p, cin: { x: n.p.x - d.x, y: n.p.y - d.y }, cout: { x: n.p.x + d.x, y: n.p.y + d.y } };
}

const isStraight = (n: Node) => eqPt(n.cin, n.p) && eqPt(n.cout, n.p);

/** Double-click on a node: corner ↔ smooth. */
export function toggleCurve(l: Layer, r: NodeRef) {
  const n = l.subpaths[r.s].nodes[r.n];
  l.subpaths[r.s].nodes[r.n] = isStraight(n) ? smoothed(l, r) : node(n.p);
}

/** The node's point type: the one chosen, else what its handles look like. */
export function pointType(n: Node): PointType {
  if (n.type) return n.type;
  if (isStraight(n)) return 'straight';
  const a = sub(n.cin, n.p), b = sub(n.cout, n.p), eps = 1e-6 * (Math.hypot(a.x, a.y) + Math.hypot(b.x, b.y));
  if (Math.abs(a.x + b.x) <= eps && Math.abs(a.y + b.y) <= eps) return 'mirrored';
  if (Math.abs(a.x * b.y - a.y * b.x) <= eps * eps && a.x * b.x + a.y * b.y < 0) return 'asymmetric';
  return 'disconnected';
}

/** Point Type in the inspector: straight drops the handles; the others pull handles out of a straight node,
 *  and line them up (mirrored: same length, their mean; asymmetric: each keeps its own). */
export function setPointType(l: Layer, r: NodeRef, type: PointType) {
  const nodes = l.subpaths[r.s].nodes;
  let n = nodes[r.n];
  if (type === 'straight') n = node(n.p);
  else if (isStraight(n)) n = smoothed(l, r);
  else if (type !== 'disconnected') {
    const { p } = n, lin = dist(n.cin, p), lout = dist(n.cout, p);
    let u = sub(n.cout, n.cin), k = Math.hypot(u.x, u.y);
    if (k === 0) [u, k] = [sub(n.cout, p), lout]; // handles on top of each other: keep the outgoing direction
    u = pt(u.x / k, u.y / k);
    const [a, b] = type === 'mirrored' ? [(lin + lout) / 2, (lin + lout) / 2] : [lin, lout];
    n = { p, cin: sub(p, pt(u.x * a, u.y * a)), cout: add(p, pt(u.x * b, u.y * b)) };
  }
  nodes[r.n] = { ...n, type };
}

/** Dragging one handle to `to`: the other follows the point type (⌥ = `free`: it stays, the point becomes disconnected). */
export function movedHandle(n: Node, which: 'cin' | 'cout', to: Pt, free: boolean): Node {
  const other = which === 'cin' ? 'cout' : 'cin', type = free ? 'disconnected' : pointType(n);
  let o = n[other];
  if (type === 'mirrored') o = pt(2 * n.p.x - to.x, 2 * n.p.y - to.y);
  else if (type === 'asymmetric') {
    const v = sub(n.p, to), k = Math.hypot(v.x, v.y), len = dist(o, n.p);
    if (k > 0) o = add(n.p, pt((v.x / k) * len, (v.y / k) * len));
  }
  return { ...n, [which]: to, [other]: o, ...(n.type || free ? { type } : {}) } as Node;
}

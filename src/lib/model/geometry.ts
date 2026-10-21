export type Pt = { x: number; y: number };
export type Rect = { x: number; y: number; width: number; height: number };

/** Bézier anchor with incoming/outgoing control points (equal to `p` when straight). */
export type Node = { p: Pt; cin: Pt; cout: Pt };
export type Subpath = { nodes: Node[]; closed: boolean };

export const pt = (x: number, y: number): Pt => ({ x, y });
export const ZERO: Pt = { x: 0, y: 0 };
export const node = (p: Pt): Node => ({ p, cin: p, cout: p });
export const eqPt = (a: Pt, b: Pt) => a.x === b.x && a.y === b.y;
export const add = (a: Pt, b: Pt): Pt => ({ x: a.x + b.x, y: a.y + b.y });
export const sub = (a: Pt, b: Pt): Pt => ({ x: a.x - b.x, y: a.y - b.y });
export const dist = (a: Pt, b: Pt) => Math.hypot(a.x - b.x, a.y - b.y);

export const mapNode = (n: Node, f: (p: Pt) => Pt): Node => ({ p: f(n.p), cin: f(n.cin), cout: f(n.cout) });
export const mapSubpaths = (s: Subpath[], f: (p: Pt) => Pt): Subpath[] =>
  s.map((sp) => ({ nodes: sp.nodes.map((n) => mapNode(n, f)), closed: sp.closed }));

// MARK: Affine transforms (same layout as CGAffineTransform)

export type Affine = { a: number; b: number; c: number; d: number; tx: number; ty: number };
export const IDENTITY: Affine = { a: 1, b: 0, c: 0, d: 1, tx: 0, ty: 0 };
export const apply = (t: Affine, p: Pt): Pt => ({ x: t.a * p.x + t.c * p.y + t.tx, y: t.b * p.x + t.d * p.y + t.ty });
export const translate = (x: number, y: number): Affine => ({ ...IDENTITY, tx: x, ty: y });
export const scale = (sx: number, sy = sx): Affine => ({ ...IDENTITY, a: sx, d: sy });
export const rotate = (r: number): Affine => ({ a: Math.cos(r), b: Math.sin(r), c: -Math.sin(r), d: Math.cos(r), tx: 0, ty: 0 });
export const determinant = (t: Affine) => t.a * t.d - t.b * t.c;

/** `t1` then `t2` (CGAffineTransform's `t1.concatenating(t2)`). */
export function concat(t1: Affine, t2: Affine): Affine {
  return {
    a: t1.a * t2.a + t1.b * t2.c,
    b: t1.a * t2.b + t1.b * t2.d,
    c: t1.c * t2.a + t1.d * t2.c,
    d: t1.c * t2.b + t1.d * t2.d,
    tx: t1.tx * t2.a + t1.ty * t2.c + t2.tx,
    ty: t1.tx * t2.b + t1.ty * t2.d + t2.ty,
  };
}

export function invert(t: Affine): Affine {
  const det = determinant(t);
  return {
    a: t.d / det, b: -t.b / det, c: -t.c / det, d: t.a / det,
    tx: (t.c * t.ty - t.d * t.tx) / det, ty: (t.b * t.tx - t.a * t.ty) / det,
  };
}

export const rotateAround = (c: Pt, r: number) => concat(concat(translate(-c.x, -c.y), rotate(r)), translate(c.x, c.y));
export const scaleAround = (c: Pt, sx: number, sy: number) => concat(concat(translate(-c.x, -c.y), scale(sx, sy)), translate(c.x, c.y));

/** The affine map that results from applying `f` after `t`. Exact when `f` is affine. */
export function mapAffine(t: Affine, f: (p: Pt) => Pt): Affine {
  const o = f(apply(t, ZERO)), ex = f(apply(t, pt(1, 0))), ey = f(apply(t, pt(0, 1)));
  return { a: ex.x - o.x, b: ex.y - o.y, c: ey.x - o.x, d: ey.y - o.y, tx: o.x, ty: o.y };
}

// MARK: Rects

export const midX = (r: Rect) => r.x + r.width / 2;
export const midY = (r: Rect) => r.y + r.height / 2;
export const rectCenter = (r: Rect): Pt => pt(midX(r), midY(r));
export const inset = (r: Rect, dx: number, dy = dx): Rect =>
  ({ x: r.x + dx, y: r.y + dy, width: r.width - 2 * dx, height: r.height - 2 * dy });
export const intersects = (a: Rect, b: Rect) =>
  a.x <= b.x + b.width && b.x <= a.x + a.width && a.y <= b.y + b.height && b.y <= a.y + a.height;
export const rectContains = (r: Rect, p: Pt) => p.x >= r.x && p.x <= r.x + r.width && p.y >= r.y && p.y <= r.y + r.height;

export function rectOf(points: Pt[]): Rect | null {
  if (!points.length) return null;
  const xs = points.map((p) => p.x), ys = points.map((p) => p.y);
  const x = Math.min(...xs), y = Math.min(...ys);
  return { x, y, width: Math.max(...xs) - x, height: Math.max(...ys) - y };
}

export function union(a: Rect | null, b: Rect | null): Rect | null {
  if (!a) return b;
  if (!b) return a;
  return rectOf([pt(a.x, a.y), pt(a.x + a.width, a.y + a.height), pt(b.x, b.y), pt(b.x + b.width, b.y + b.height)]);
}

// MARK: Curves

/** de Casteljau split of a cubic at t: [p01, p012, point on curve, p123, p23]. */
export function splitCubic(p0: Pt, p1: Pt, p2: Pt, p3: Pt, t: number): Pt[] {
  const l = (a: Pt, b: Pt) => pt(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t);
  const a = l(p0, p1), b = l(p1, p2), c = l(p2, p3), ab = l(a, b), bc = l(b, c);
  return [a, ab, l(ab, bc), bc, c];
}

export function cubicPoint(b: Pt[], t: number): Pt {
  const mt = 1 - t, k0 = mt * mt * mt, k1 = 3 * t * mt * mt, k2 = 3 * t * t * mt, k3 = t * t * t;
  return pt(b[0].x * k0 + b[1].x * k1 + b[2].x * k2 + b[3].x * k3, b[0].y * k0 + b[1].y * k1 + b[2].y * k2 + b[3].y * k3);
}

/** Cubic segments [p0, c1, c2, p3] of a subpath, including the closing one. */
export function segments(s: Subpath): Pt[][] {
  const n = s.nodes, out: Pt[][] = [];
  for (let k = 0; k < (s.closed ? n.length : n.length - 1); k++) {
    const a = n[k], b = n[(k + 1) % n.length];
    out.push([a.p, a.cout, b.cin, b.p]);
  }
  return out;
}

/** Curve parameters where one coordinate of a cubic has a local extremum. */
function extrema(a: number, b: number, c: number, d: number): number[] {
  const A = d - 3 * c + 3 * b - a, B = 2 * (c - 2 * b + a), C = b - a;
  if (Math.abs(A) < 1e-12) return Math.abs(B) < 1e-12 ? [] : [-C / B];
  const disc = B * B - 4 * A * C;
  if (disc < 0) return [];
  const s = Math.sqrt(disc);
  return [(-B + s) / (2 * A), (-B - s) / (2 * A)];
}

/** Tight bounds of the curves (not their control points), like CGPath's boundingRect. */
export function pathBounds(subpaths: Subpath[]): Rect | null {
  const pts: Pt[] = [];
  for (const s of subpaths) {
    for (const n of s.nodes) pts.push(n.p);
    for (const b of segments(s)) {
      for (const t of [...extrema(b[0].x, b[1].x, b[2].x, b[3].x), ...extrema(b[0].y, b[1].y, b[2].y, b[3].y)]) {
        if (t > 0 && t < 1) pts.push(cubicPoint(b, t));
      }
    }
  }
  return rectOf(pts);
}

/** Fill hit test; open subpaths are implicitly closed, as when filling.
 *  ponytail: curves flattened to 32 lines each, exact enough for picking; refine if precision matters. */
export function pathContains(subpaths: Subpath[], q: Pt, evenOdd: boolean): boolean {
  let winding = 0;
  for (const s of subpaths) {
    if (!s.nodes.length) continue;
    const poly: Pt[] = [s.nodes[0].p];
    for (const b of segments({ nodes: s.nodes, closed: true })) {
      for (let i = 1; i <= 32; i++) poly.push(cubicPoint(b, i / 32));
    }
    for (let i = 0; i < poly.length - 1; i++) {
      const a = poly[i], b = poly[i + 1];
      if ((a.y <= q.y) !== (b.y <= q.y)) {
        const x = a.x + ((q.y - a.y) / (b.y - a.y)) * (b.x - a.x);
        if (x > q.x) winding += b.y > a.y ? 1 : -1;
      }
    }
  }
  return evenOdd ? winding % 2 !== 0 : winding !== 0;
}

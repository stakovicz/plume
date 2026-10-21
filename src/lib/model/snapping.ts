import { type Pt, type Rect, midX, midY, pt } from './geometry';

/** Smart guides: a moved or drawn rectangle snaps its edges and center to those of other layers within
 *  `tol`, and a guide line is shown along every alignment the snapped rectangle ends up with.
 *  A guide is vertical (`axis: 'x'`, at x = `at`, spanning y from..to) or horizontal (`axis: 'y'`). */
export type Guide = { axis: 'x' | 'y'; at: number; from: number; to: number };

const xs = (r: Rect) => [r.x, midX(r), r.x + r.width];
const ys = (r: Rect) => [r.y, midY(r), r.y + r.height];
const EPS = 1e-6;

/** Offset to apply to `r` (0 on an axis with nothing within `tol`) and the guides once it is applied.
 *  `axes` limits snapping to x or y (a resize handle that moves one edge only). */
export function snapRect(r: Rect, targets: Rect[], tol: number, axes = { x: true, y: true }): { d: Pt; guides: Guide[] } {
  const best = (own: number[], of: (t: Rect) => number[]) => {
    let d = 0, gap = tol;
    for (const t of targets) for (const v of of(t)) for (const o of own) {
      if (Math.abs(v - o) <= gap) [gap, d] = [Math.abs(v - o), v - o];
    }
    return d;
  };
  const d = pt(axes.x ? best(xs(r), xs) : 0, axes.y ? best(ys(r), ys) : 0);
  const s = { ...r, x: r.x + d.x, y: r.y + d.y };
  const guides: Guide[] = [];
  const lines = (axis: 'x' | 'y', own: number[], of: (t: Rect) => number[], span: (t: Rect) => [number, number]) => {
    for (const at of new Set(own)) {
      const hits = targets.filter((t) => of(t).some((v) => Math.abs(v - at) < EPS));
      if (!hits.length) continue;
      const ends = [s, ...hits].flatMap(span);
      guides.push({ axis, at, from: Math.min(...ends), to: Math.max(...ends) });
    }
  };
  if (axes.x) lines('x', xs(s), xs, (t) => [t.y, t.y + t.height]);
  if (axes.y) lines('y', ys(s), ys, (t) => [t.x, t.x + t.width]);
  return { d, guides };
}

/** A point as a rectangle, for snapping and guides. */
export const pointRect = (p: Pt): Rect => ({ ...p, width: 0, height: 0 });

/** How far to slide `p` along unit vector `u` so that its x or y lines up with a target's edge or center
 *  (the closest within `tol`, else 0): a side handle of a rotated layer moves along one axis only. */
export function snapAlong(p: Pt, u: Pt, targets: Rect[], tol: number): number {
  let t = 0, gap = tol;
  const consider = (v: number, o: number, k: number) => {
    if (Math.abs(k) < EPS) return; // moving perpendicular to that axis never reaches it
    const s = (v - o) / k;
    if (Math.abs(s) <= gap) [gap, t] = [Math.abs(s), s];
  };
  for (const r of targets) {
    for (const v of xs(r)) consider(v, p.x, u.x);
    for (const v of ys(r)) consider(v, p.y, u.y);
  }
  return t;
}

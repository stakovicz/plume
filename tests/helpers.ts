import type { Pt, Rect } from '$lib/model/geometry';
import { newLayer } from '$lib/model/layer';

export const nearRect = (a: Rect, b: Rect, eps = 0.01) =>
  Math.abs(a.x - b.x) < eps && Math.abs(a.y - b.y) < eps && Math.abs(a.width - b.width) < eps && Math.abs(a.height - b.height) < eps;

export const near = (a: Pt, b: Pt, eps = 1e-6) => Math.hypot(a.x - b.x, a.y - b.y) < eps;

export const rect = (x0: number, y0: number, x1: number, y1: number, name = 'r') =>
  newLayer(name, 'rect', [{ x: x0, y: y0 }, { x: x1, y: y1 }]);

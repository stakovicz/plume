import { expect, test } from 'vitest';
import { cubicPoint, pt, type Pt } from '$lib/model/geometry';
import { fitCurve } from '$lib/model/curve-fit';

const wave = (): Pt[] => Array.from({ length: 201 }, (_, i) => pt(i, 40 * Math.sin((i / 200) * 2 * Math.PI)));

test('a straight line is one segment', () => {
  const pts = Array.from({ length: 51 }, (_, i) => pt(i * 2, i));
  const nodes = fitCurve(pts, 1);
  expect(nodes.length).toBe(2);
  expect(nodes[0].p).toEqual(pts[0]);
  expect(nodes[1].p).toEqual(pts[50]);
});

test('samples of a curve fit within tolerance with few nodes', () => {
  const pts = wave(), tol = 1;
  const nodes = fitCurve(pts, tol);
  expect(nodes.length).toBeLessThanOrEqual(6); // 201 samples → a handful of nodes
  const curve: Pt[] = [];
  for (let i = 0; i < nodes.length - 1; i++) {
    const a = nodes[i], b = nodes[i + 1];
    for (let k = 0; k <= 100; k++) curve.push(cubicPoint([a.p, a.cout, b.cin, b.p], k / 100));
  }
  const worst = Math.max(...pts.map((p) => Math.min(...curve.map((c) => Math.hypot(c.x - p.x, c.y - p.y)))));
  expect(worst).toBeLessThan(tol * 1.5);
});

test('joints are smooth', () => {
  for (const n of fitCurve(wave(), 0.5).slice(1, -1)) {
    const a = pt(n.p.x - n.cin.x, n.p.y - n.cin.y), b = pt(n.cout.x - n.p.x, n.cout.y - n.p.y);
    expect(Math.abs(a.x * b.y - a.y * b.x)).toBeLessThan(1e-6 * Math.hypot(a.x, a.y) * Math.hypot(b.x, b.y) + 1e-9); // collinear handles
  }
});

test('tiny input survives', () => {
  expect(fitCurve([pt(0, 0)], 1).length).toBe(1);
  expect(fitCurve([pt(0, 0), pt(5, 0)], 1).length).toBe(2);
});

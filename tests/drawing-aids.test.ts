import { describe, expect, test } from 'vitest';
import { Doc } from '$lib/document/doc.svelte';
import { pt } from '$lib/model/geometry';
import { bounds, flipped, resized, scaled, toWorld } from '$lib/model/layer';
import { pointRect, snapAlong, snapRect } from '$lib/model/snapping';
import { columnEdges, gridLines, snapToGrid } from '$lib/model/grid';
import { movedHandle, pointType, setPointType } from '$lib/model/point-editing';
import { decodeFile, encodeFile } from '$lib/model/codable';
import { newLayer } from '$lib/model/layer';
import { near, nearRect, rect } from './helpers';

const box = (x: number, y: number, width: number, height: number) => ({ x, y, width, height });

describe('smart guides', () => {
  test('edges and centers snap within the tolerance, with a guide along each alignment', () => {
    const target = box(0, 0, 10, 10);
    const s = snapRect(box(13, 22, 10, 10), [target], 4); // left edge 13 is 3 from the target's right edge 10
    expect(s.d).toEqual(pt(-3, 0));
    expect(s.guides).toEqual([{ axis: 'x', at: 10, from: 0, to: 32 }]);
    expect(snapRect(box(16, 22, 10, 10), [target], 4).d).toEqual(pt(0, 0)); // too far
    expect(snapRect(box(20, 2, 10, 10), [target], 4).d).toEqual(pt(0, -2)); // tops line up
  });

  test('closest alignment wins; axes can be limited', () => {
    const s = snapRect(box(0, 0, 0, 0), [box(3, 3, 10, 10), box(-1, 50, 10, 10)], 5);
    expect(s.d).toEqual(pt(-1, 3));
    expect(snapRect(box(0, 0, 0, 0), [box(3, 3, 10, 10)], 5, { x: false, y: true }).d).toEqual(pt(0, 3));
  });

  test('a rotated side handle slides along its axis to the exact alignment', () => {
    const u = pt(Math.SQRT1_2, Math.SQRT1_2), target = box(10, 100, 5, 5); // left edge x = 10
    const t = snapAlong(pt(8, 0), u, [target], 4);
    expect(8 + u.x * t).toBeCloseTo(10);
    expect(snapAlong(pt(0, 0), u, [target], 4)).toBe(0); // 10 / cos 45° ≈ 14 along the line: too far
    expect(snapRect(pointRect(pt(8 + u.x * t, u.y * t)), [target], 0).guides.map((g) => g.axis)).toEqual(['x']);
  });
});

describe('flip', () => {
  test('mirrors across the line, twice is identity', () => {
    const l = { ...rect(0, 0, 10, 20), rotation: 0.3 };
    const f = flipped(l, true, 50);
    // a corner's mirror image is a corner of the flipped layer
    const c = toWorld(l, pt(0, 0)), m = toWorld(f, pt(100, 0)); // local x mirrored about 5, then moved by 90
    expect(near(m, pt(100 - c.x, c.y), 1e-9)).toBe(true);
    expect(f.rotation).toBeCloseTo(-0.3);
    expect(nearRect(bounds(flipped(f, true, 50)), bounds(l))).toBe(true);
  });

  test('selection flips across its own center; one undo step', () => {
    const d = new Doc();
    d.layers = [rect(0, 0, 10, 10, 'a'), rect(20, 0, 40, 10, 'b')];
    d.selectedIDs = new Set(d.layers.map((l) => l.id));
    d.flip(true);
    expect(nearRect(bounds(d.layers[0]), box(30, 0, 10, 10))).toBe(true);
    expect(nearRect(bounds(d.layers[1]), box(0, 0, 20, 10))).toBe(true);
    d.undo();
    expect(nearRect(bounds(d.layers[0]), box(0, 0, 10, 10))).toBe(true);
  });
});

describe('nudge', () => {
  test('arrow presses in a row move the selection and undo at once; locked layers stay', () => {
    const d = new Doc();
    d.layers = [rect(0, 0, 10, 10, 'a'), { ...rect(0, 0, 10, 10, 'b'), locked: true }];
    d.selectedIDs = new Set(d.layers.map((l) => l.id));
    d.nudge(pt(1, 0));
    d.nudge(pt(0, 10));
    expect(bounds(d.layers[0])).toEqual(box(1, 10, 10, 10));
    expect(bounds(d.layers[1])).toEqual(box(0, 0, 10, 10));
    d.undo();
    expect(bounds(d.layers[0])).toEqual(box(0, 0, 10, 10));
  });
});

describe('point types', () => {
  const path = () => newLayer('p', 'path', [], { subpaths: [{ closed: false, nodes: [
    { p: pt(0, 0), cin: pt(0, 0), cout: pt(0, 0) },
    { p: pt(10, 0), cin: pt(8, -1), cout: pt(14, 2) }, // collinear, own lengths
    { p: pt(20, 0), cin: pt(20, 0), cout: pt(20, 0) },
  ] }] });
  const at = (l: ReturnType<typeof path>, n: number) => l.subpaths[0].nodes[n];

  test('read from the handles when not chosen', () => {
    const l = path();
    expect(pointType(at(l, 0))).toBe('straight');
    expect(pointType(at(l, 1))).toBe('asymmetric');
    expect(pointType({ p: pt(0, 0), cin: pt(-1, 0), cout: pt(1, 0) })).toBe('mirrored');
    expect(pointType({ p: pt(0, 0), cin: pt(-1, 1), cout: pt(1, 1) })).toBe('disconnected');
  });

  test('setting a type reshapes the handles and is kept', () => {
    const l = path(), r = { s: 0, n: 1 };
    setPointType(l, r, 'mirrored');
    const n = at(l, 1);
    expect(near(pt(n.cin.x + n.cout.x, n.cin.y + n.cout.y), pt(20, 0), 1e-9)).toBe(true);
    setPointType(l, r, 'disconnected');
    expect(pointType(at(l, 1))).toBe('disconnected'); // same handles, chosen type wins
    setPointType(l, { s: 0, n: 0 }, 'asymmetric'); // straight → handles pulled out
    expect(at(l, 0).cout).not.toEqual(at(l, 0).p);
    setPointType(l, r, 'straight');
    expect(at(l, 1).cin).toEqual(pt(10, 0));
    expect(decodeFile(encodeFile({ layers: [l], palette: [] })).layers[0].subpaths[0].nodes[1].type).toBe('straight');
  });

  test('a dragged handle moves the other one by the point type; ⌥ disconnects', () => {
    const n = at(path(), 1); // asymmetric: the other handle keeps its length, turns opposite
    const m = movedHandle(n, 'cout', pt(10, 5), false);
    expect(near(m.cin, pt(10, -Math.hypot(2, 1)), 1e-9)).toBe(true);
    expect(movedHandle({ ...n, type: 'mirrored' }, 'cout', pt(10, 5), false).cin).toEqual(pt(10, -5));
    const f = movedHandle({ ...n, type: 'mirrored' }, 'cout', pt(10, 5), true);
    expect([f.cin, f.type]).toEqual([n.cin, 'disconnected']);
  });
});

describe('file precision', () => {
  test('lengths to 3 decimals, rotation and gradients to 6', () => {
    const l = { ...rect(0.123456789, 1 / 3, 10, 20), rotation: 0.123456789, opacity: 0.333333 };
    l.fillGradient = { kind: 'linear', stops: [{ offset: 1 / 3, color: l.fill }], start: pt(1 / 3, 0), end: pt(1, 0), radius: 0,
      transform: { a: 1, b: 0, c: 0, d: 1, tx: 0, ty: 0 } };
    const back = decodeFile(encodeFile({ layers: [l], palette: [] })).layers[0];
    expect(back.points[0]).toEqual(pt(0.123, 0.333));
    expect(back.opacity).toBe(0.333);
    expect(back.rotation).toBe(0.123457);
    expect(back.fillGradient!.start.x).toBe(0.333333);
  });
});

describe('borders follow a resize', () => {
  test('a layer or a group shrunk by half has half-width borders and dashes', () => {
    const l = { ...rect(0, 0, 10, 10), strokeWidth: 4, dash: [6, 2] };
    const half = resized(l, 0.5, 0.5, pt(0, 0));
    expect([half.strokeWidth, half.dash]).toEqual([2, [3, 1]]);
    const g = newLayer('g', 'group', [], { children: [l] });
    expect(scaled(g, 0.5, 0.5, pt(0, 0)).children[0].strokeWidth).toBe(2);
    expect(resized(l, 4, 1, pt(0, 0)).strokeWidth).toBe(8); // non-uniform: the mean factor, √4
  });
});

describe('names', () => {
  test('a new group takes the next number used anywhere in the tree', () => {
    const d = new Doc();
    const inner = newLayer('Group 3', 'group', [], { children: [rect(0, 0, 1, 1, 'x')] });
    d.layers = [newLayer('Artboard 1', 'artboard', [pt(0, 0), pt(100, 100)], { children: [inner] }), rect(0, 0, 5, 5, 'a'), rect(0, 0, 5, 5, 'b')];
    d.selectedIDs = new Set([d.layers[1].id, d.layers[2].id]);
    d.group();
    expect(d.selected!.name).toBe('Group 4');
  });
});

describe('artboard grid', () => {
  const frame = box(100, 0, 200, 100), g = { size: 10, major: 5 };

  test('an edge snaps to the nearest line from the frame corner, within the tolerance', () => {
    expect(snapToGrid(box(123, 47, 10, 10), frame, { grid: g }, 4)).toEqual(pt(-3, 3)); // left edge 123 → 120, bottom 57 → 60
    expect(snapToGrid(box(125, 45, 10, 10), frame, { grid: g }, 4)).toEqual(pt(0, 0)); // 5 away from every line: nothing in reach
    expect(snapToGrid(box(123, 47, 10, 10), frame, { grid: g }, 4, { x: false, y: true })).toEqual(pt(0, 3));
  });

  test('column edges pull on x', () => {
    const c = { count: 2, gutter: 20, margin: 10 }; // columns 110–190 and 210–290
    expect(columnEdges(frame, c)).toEqual([[110, 190], [210, 290]]);
    expect(snapToGrid(box(207, 3, 0, 0), frame, { columns: c }, 4)).toEqual(pt(3, 0)); // no grid: columns only, x only
    expect(columnEdges(frame, { ...c, count: 20 })).toEqual([]); // no room
  });

  test('lines: major every N squares, dense lines left out when zoomed out', () => {
    const l = gridLines(box(0, 0, 60, 10), g, 1);
    expect(l.major).toBe('M50 0V10');
    expect(l.minor.match(/M/g)?.length).toBe(4); // x = 10, 20, 30, 40
    expect(gridLines(box(0, 0, 60, 10), g, 0.2)).toEqual({ minor: '', major: 'M50 0V10' }); // 2 px squares: majors only
  });
});

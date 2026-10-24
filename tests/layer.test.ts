import { describe, expect, test } from 'vitest';
import { apply, pt, node, pathBounds } from '$lib/model/geometry';
import { angleOf, colorAt, linearAt, radialIn } from '$lib/model/effects';
import {
  asPath, bounds, center, cornerRadii, drawnStrokeWidth, effectiveBorderPosition, hit, localBounds, mapped, keepingPlace,
  newLayer, resizeGesture, resized, rotated, moved, toWorld,
} from '$lib/model/layer';
import { insertNode, segmentAt, target, toggleCurve } from '$lib/model/point-editing';
import { ancestors } from '$lib/model/layer-tree';
import { decodeFile } from '$lib/model/codable';
import { near, nearRect, rect } from './helpers';

const r = () => rect(0, 0, 10, 20);

describe('layer', () => {
  test('rounded corners: four arcs, same bounds; stretching keeps them, a proportional resize scales them', () => {
    const l = { ...rect(0, 0, 100, 40), corners: [10, 10, 10, 10] };
    expect(asPath(l).subpaths[0].nodes.length).toBe(8);
    expect(bounds(asPath(l))).toEqual({ x: 0, y: 0, width: 100, height: 40 });
    expect(hit(l, pt(1, 1), 0)).toBe(false); // the cut corner
    expect(hit(l, pt(10, 1), 0)).toBe(true);
    expect(resized(l, 2, 1, pt(0, 0)).corners).toEqual([10, 10, 10, 10]);
    expect(resized(l, 2, 2, pt(0, 0)).corners).toEqual([20, 20, 20, 20]);
    expect(decodeFile(JSON.stringify([{ ...rect(0, 0, 1, 1), corners: undefined }])).layers[0].corners).toEqual([0, 0, 0, 0]);
  });

  test('corners one by one, scaled down together when they do not fit (like CSS)', () => {
    expect(asPath({ ...rect(0, 0, 100, 40), corners: [20, 0, 0, 0] }).subpaths[0].nodes.length).toBe(5);
    expect(cornerRadii({ ...rect(0, 0, 100, 40), corners: [50, 50, 50, 50] })).toEqual([20, 20, 20, 20]); // a pill
    expect(asPath({ ...rect(0, 0, 100, 40), corners: [50, 50, 50, 50] }).subpaths[0].nodes.length).toBe(6);
    expect(cornerRadii({ ...rect(0, 0, 100, 40), corners: [100, 100, 0, 0] })).toEqual([40, 40, 0, 0]); // the left side holds 40
  });

  test('bounds of a path too big to spread into Math.min', () => {
    const nodes = Array.from({ length: 200_000 }, (_, k) => node(pt(k, k % 7)));
    expect(pathBounds([{ nodes, closed: false }])).toEqual({ x: 0, y: 0, width: 199_999, height: 6 });
  });

  test('rect converts to path', () => {
    const l = asPath(r());
    expect(l.kind).toBe('path');
    expect(l.subpaths[0].nodes.length).toBe(4);
    expect(bounds(l)).toEqual({ x: 0, y: 0, width: 10, height: 20 });
  });

  test('toggle curve round trip', () => {
    const l = asPath(r());
    const ref = { s: 0, n: 1 };
    toggleCurve(l, ref);
    expect(l.subpaths[0].nodes[1].cout).not.toEqual(l.subpaths[0].nodes[1].p);
    expect(target(l, l.subpaths[0].nodes[1].cout, 1, ref)?.handle).toBe('cout');
    toggleCurve(l, ref);
    expect(l.subpaths[0].nodes[1]).toEqual(node(pt(10, 0)));
  });

  test('insert on straight segment stays straight', () => {
    const l = asPath(r());
    expect(segmentAt(l, pt(5, 0.5), 1)?.k).toBe(0);
    insertNode(l, 0, 0, 0.5);
    expect(l.subpaths[0].nodes[1]).toEqual(node(pt(5, 0)));
  });

  test('insert on closing curve keeps shape', () => {
    const l = asPath(newLayer('o', 'ellipse', [pt(0, 0), pt(40, 20)]));
    const shape = bounds(l), count = l.subpaths[0].nodes.length;
    insertNode(l, 0, count - 1, 0.3);
    expect(l.subpaths[0].nodes.length).toBe(count + 1);
    expect(nearRect(bounds(l), shape)).toBe(true);
  });

  test('scale', () => {
    expect(bounds(mapped(r(), (p) => pt(p.x * 2, p.y * 2)))).toEqual({ x: 0, y: 0, width: 20, height: 40 });
  });

  test('rotation is stored, not baked', () => {
    const l = { ...r(), rotation: Math.PI / 2 };
    expect(l.kind).toBe('rect');
    expect(nearRect(bounds(l), { x: -5, y: 5, width: 20, height: 10 })).toBe(true);
    expect(hit(l, pt(14, 10), 0)).toBe(true);
    expect(hit(l, pt(5, 1), 0)).toBe(false);
  });

  test('resizing a rotated layer keeps the opposite edge in place', () => {
    const l = { ...r(), rotation: Math.PI / 2 };
    const anchor = toWorld(l, pt(10, 10)); // right edge, stays put when dragging the left handle
    const wider = keepingPlace(mapped(l, (p) => pt(10 + (p.x - 10) * 2, p.y)), l);
    const shift = pt(wider.points[1].x - l.points[1].x, wider.points[1].y - l.points[1].y);
    expect(near(toWorld(wider, pt(10 + shift.x, 10 + shift.y)), anchor)).toBe(true);
    expect(Math.abs(localBounds(wider).width - 20)).toBeLessThan(1e-6);
  });

  test('hidden is not pickable, locked is', () => {
    expect(hit({ ...rect(0, 0, 10, 10), hidden: true }, pt(5, 5), 1)).toBe(false);
    expect(hit({ ...rect(0, 0, 10, 10), locked: true }, pt(5, 5), 1)).toBe(true); // locked: selectable, just inert
  });

  test('ellipse bounds are tight', () => {
    const e = asPath(newLayer('o', 'ellipse', [pt(0, 0), pt(40, 20)]));
    expect(nearRect(pathBounds(e.subpaths)!, { x: 0, y: 0, width: 40, height: 20 })).toBe(true);
  });
});

describe('border', () => {
  test('inside and outside strokes are drawn at double width', () => {
    const l = { ...rect(0, 0, 10, 10), strokeWidth: 3 };
    expect(drawnStrokeWidth(l)).toBe(3);
    expect(drawnStrokeWidth({ ...l, borderPosition: 'inside' })).toBe(6);
  });

  test('an open path is always centered', () => {
    const l = newLayer('p', 'path', [], { subpaths: [{ nodes: [node(pt(0, 0)), node(pt(5, 5))], closed: false }], borderPosition: 'outside' });
    expect(effectiveBorderPosition(l)).toBe('center');
  });

  test('documents saved before new properties still open', () => {
    const { layers } = decodeFile('[{"name":"Rectangle 1","kind":"rect","points":[[0,0],[10,10]]}]');
    expect(layers[0].borderPosition).toBe('center');
    expect(layers[0].dash).toEqual([]);
    expect(layers[0].rotation).toBe(0);
    expect(layers[0].points[1]).toEqual(pt(10, 10));
  });
});

describe('groups', () => {
  test('moving, rotating, resizing a group applies to children', () => {
    const g = newLayer('g', 'group', [], { children: [rect(0, 0, 10, 10, 'a'), rect(20, 0, 30, 10, 'b')] }); // 0,0 30×10
    expect(bounds(moved(g, pt(5, 5)))).toEqual({ x: 5, y: 5, width: 30, height: 10 });
    const turned = rotated(g, Math.PI / 2, center(g));
    expect(nearRect(bounds(turned), { x: 10, y: -10, width: 10, height: 30 })).toBe(true);
    expect(turned.children.every((c) => Math.abs(c.rotation - Math.PI / 2) < 1e-9)).toBe(true);
    expect(nearRect(bounds(resized(g, 2, 2, pt(0, 0))), { x: 0, y: 0, width: 60, height: 20 })).toBe(true);
  });

  test('resizing from the inspector keeps the origin', () => {
    const l = rect(5, 5, 15, 25);
    const b = localBounds(l);
    expect(localBounds(resized(l, 30 / b.width, 1, pt(b.x, b.y)))).toEqual({ x: 5, y: 5, width: 30, height: 20 });
  });

  test('ancestors are outermost first', () => {
    const leaf = rect(0, 0, 1, 1, 'leaf');
    const inner = newLayer('inner', 'group', [], { children: [leaf] });
    const outer = newLayer('outer', 'group', [], { children: [inner] });
    expect(ancestors([outer], leaf.id).map((l) => l.name)).toEqual(['outer', 'inner']);
    expect(ancestors([outer], outer.id)).toEqual([]);
  });
});

describe('resize gesture', () => {
  const b = { x: 0, y: 0, width: 100, height: 50 };

  test('free by default, from the opposite corner', () => {
    expect(resizeGesture(b, pt(1, 1), pt(100, 0))).toEqual({ sx: 2, sy: 1, anchor: pt(0, 0) });
  });

  test('proportional uses the largest factor', () => {
    const r = resizeGesture(b, pt(1, 1), pt(100, 0), { proportional: true });
    expect([r.sx, r.sy]).toEqual([2, 2]);
    const edge = resizeGesture(b, pt(0.5, 1), pt(0, 50), { proportional: true });
    expect([edge.sx, edge.sy]).toEqual([2, 2]);
  });

  test('from the center moves both edges', () => {
    expect(resizeGesture(b, pt(1, 0.5), pt(25, 0), { fromCenter: true })).toEqual({ sx: 1.5, sy: 1, anchor: pt(50, 25) });
  });
});

describe('gradient editing', () => {
  const box = { x: 0, y: 0, width: 100, height: 50 };
  const stops = [{ offset: 1, color: { r: 0, g: 0, b: 1, a: 1 } }, { offset: 0, color: { r: 1, g: 0, b: 0, a: 1 } }];

  test('linear at a CSS angle spans the box, angle reads back', () => {
    const down = linearAt(180, box, stops);
    expect(near(down.start, pt(50, 0)) && near(down.end, pt(50, 50))).toBe(true);
    expect(down.stops.map((s) => s.offset)).toEqual([0, 1]); // sorted
    expect(angleOf(down)).toBe(180);
    const right = linearAt(90, box, stops);
    expect(near(right.start, pt(0, 25)) && near(right.end, pt(100, 25))).toBe(true);
    expect(angleOf(linearAt(45, box, stops))).toBe(45);
  });

  test('radial fills the box as an ellipse', () => {
    const g = radialIn(box, stops);
    expect(apply(g.transform, pt(g.radius, 0))).toEqual(pt(100, 25));
    expect(apply(g.transform, pt(0, g.radius))).toEqual(pt(50, 50));
  });

  test('color between stops is interpolated', () => {
    expect(colorAt(stops, 0.25)).toEqual({ r: 0.75, g: 0, b: 0.25, a: 1 });
    expect(colorAt(stops, -1)).toEqual(stops[1].color);
  });
});

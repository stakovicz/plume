import { expect, test } from 'vitest';
import { Doc } from '$lib/document/doc.svelte';
import { pt } from '$lib/model/geometry';
import { type Layer, bounds, newArtboard } from '$lib/model/layer';
import { rect } from './helpers';

const docWith = (...layers: Layer[]) => {
  const d = new Doc();
  d.layers = layers;
  d.selectedIDs = new Set(layers.map((l) => l.id));
  return d;
};
const box = (d: Doc, name: string) => bounds(d.layers.find((l) => l.name === name)!);

test('align left: on the leftmost edge, one undo step', () => {
  const d = docWith(rect(10, 0, 20, 10, 'a'), rect(40, 30, 60, 50, 'b'));
  d.align('left');
  expect([box(d, 'a').x, box(d, 'b').x]).toEqual([10, 10]);
  expect(box(d, 'b').y).toBe(30);
  d.undo();
  expect(box(d, 'b').x).toBe(40);
});

test('align center and bottom: on the selection bounds', () => {
  const d = docWith(rect(0, 0, 10, 10, 'a'), rect(90, 40, 100, 100, 'b'));
  d.align('center');
  expect([box(d, 'a').x, box(d, 'b').x]).toEqual([45, 45]);
  d.align('bottom');
  expect([box(d, 'a').y, box(d, 'b').y]).toEqual([90, 40]);
});

test('a single layer aligns on its artboard; at the top level nothing moves', () => {
  const a = newArtboard('A', [pt(0, 0), pt(200, 100)]), r = rect(20, 20, 40, 40, 'r');
  a.children.push(r);
  const d = docWith(a);
  d.selection = r.id;
  d.align('right');
  d.align('middle');
  expect(bounds(d.get(r.id)!)).toEqual({ x: 180, y: 40, width: 20, height: 20 });
  const top = docWith(rect(5, 5, 10, 10, 'alone'));
  top.align('left');
  expect(top.canUndo).toBe(false);
});

test('a rotated layer aligns by its rotated bounds', () => {
  const t = { ...rect(0, 0, 20, 20, 't'), rotation: Math.PI / 4 };
  const d = docWith(rect(-50, 0, -40, 10, 'a'), t);
  d.align('left');
  expect(box(d, 't').x).toBeCloseTo(-50);
});

test('locked layers stay but count in the bounds; hidden ones are left out', () => {
  const lock = { ...rect(0, 0, 10, 10, 'lock'), locked: true }, hid = { ...rect(-100, 0, -90, 10, 'hid'), hidden: true };
  const d = docWith(lock, rect(50, 0, 60, 10, 'b'), hid);
  d.align('left');
  expect([box(d, 'lock').x, box(d, 'b').x, box(d, 'hid').x]).toEqual([0, 0, -100]);
});

test('distribute: equal gaps, the outermost layers stay put', () => {
  const d = docWith(rect(0, 0, 10, 10, 'a'), rect(70, 0, 100, 10, 'c'), rect(15, 0, 35, 10, 'b'));
  d.distribute(true);
  expect([box(d, 'a').x, box(d, 'b').x, box(d, 'c').x]).toEqual([0, 30, 70]);
  const two = docWith(rect(0, 0, 10, 10, 'a'), rect(50, 0, 60, 10, 'b'));
  two.distribute(true);
  expect(two.canUndo).toBe(false);
});

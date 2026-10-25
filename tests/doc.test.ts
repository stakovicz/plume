import { describe, expect, test } from 'vitest';
import { Doc, pushRecent } from '$lib/document/doc.svelte';
import { packFile, unpackFile } from '$lib/model/codable';
import { BLACK } from '$lib/model/color';
import { pt } from '$lib/model/geometry';
import { asPath, bounds, toWorld } from '$lib/model/layer';
import { near, nearRect, rect } from './helpers';

const docWith = (...layers: ReturnType<typeof rect>[]) => {
  const d = new Doc();
  d.layers = layers;
  return d;
};
const r10 = (x: number, name: string) => rect(x, 0, x + 10, 10, name);

describe('doc', () => {
  test('zoom keeps the cursor point fixed', () => {
    const d = new Doc();
    d.pan = pt(30, -10);
    const q = pt(200, 120), before = d.toDoc(q);
    d.zoomBy(3, q);
    expect(near(d.toDoc(q), before, 1e-9)).toBe(true);
    d.zoomToActualSize();
    expect(d.zoom).toBe(1);
  });

  test('undo, redo', () => {
    const d = new Doc();
    d.checkpoint();
    d.add('rect', pt(0, 0));
    d.undo();
    expect(d.layers).toEqual([]);
    d.redo();
    expect(d.layers.length).toBe(1);
  });

  test('an unchanged checkpoint is dropped', () => {
    const d = new Doc();
    d.checkpoint();
    d.dropCheckpointIfUnchanged();
    d.add('rect', pt(0, 0));
    d.undo(); // nothing to undo: the add was not checkpointed
    expect(d.layers.length).toBe(1);
  });

  test('deleting a node keeps a rotated path in place', () => {
    const l = { ...asPath(rect(0, 0, 10, 20)), rotation: 0.3 };
    const d = docWith(l);
    d.selection = l.id;
    d.enterEdit();
    const kept = toWorld(l, l.subpaths[0].nodes[0].p);
    d.selectedNode = { s: 0, n: 2 };
    d.deleteSelected();
    const after = d.layers[0];
    expect(after.subpaths[0].nodes.length).toBe(3);
    expect(near(toWorld(after, after.subpaths[0].nodes[0].p), kept)).toBe(true);
  });

  test('JSON round trip', () => {
    const d = new Doc();
    d.add('ellipse', pt(1, 2));
    const copy = new Doc();
    copy.load(d.json(), false);
    expect(copy.layers).toEqual(d.layers);
  });

  test('.plm round trip, smaller than the JSON', () => {
    const d = new Doc();
    for (let i = 0; i < 20; i++) d.add('rect', pt(i, i));
    const bytes = packFile(d.json());
    expect(bytes.length).toBeLessThan(d.json().length / 2);
    const copy = new Doc();
    copy.load(unpackFile(bytes), false);
    expect(copy.layers).toEqual(d.layers);
    expect(() => unpackFile(new TextEncoder().encode(d.json()))).toThrow();
  });

  test('dirty until saved', () => {
    const d = new Doc();
    expect(d.isDirty).toBe(false);
    d.add('rect', pt(0, 0));
    expect(d.isDirty).toBe(true);
    d.markSaved();
    expect(d.isDirty).toBe(false);
    d.undo(); // nothing checkpointed: still clean
    expect(d.isDirty).toBe(false);
  });

  test('loading starts a fresh undo history', () => {
    const d = new Doc();
    d.checkpoint();
    d.add('rect', pt(0, 0));
    d.load('[]', false);
    d.undo();
    expect(d.layers).toEqual([]);
  });

  test('recents: most recent first, no duplicates, capped at ten', () => {
    const paths = Array.from({ length: 12 }, (_, i) => `/tmp/f${i}.json`);
    let list: string[] = [];
    for (const p of paths) list = pushRecent(p, list);
    expect(list.length).toBe(10);
    expect(list[0]).toBe(paths[11]);
    list = pushRecent(paths[5], list);
    expect(list[0]).toBe(paths[5]);
    expect(list.filter((p) => p === paths[5]).length).toBe(1);
    expect(list.length).toBe(10);
  });
});

describe('style undo', () => {
  test('continuous edits of one layer are one step', () => {
    const l = rect(0, 0, 10, 10), d = docWith(l);
    for (let w = 1; w <= 20; w++) d.styleEdit(l.id, { ...d.get(l.id)!, strokeWidth: w }); // slider drag
    expect(d.get(l.id)!.strokeWidth).toBe(20);
    d.undo();
    expect(d.get(l.id)!.strokeWidth).toBe(1);
    d.redo();
    expect(d.get(l.id)!.strokeWidth).toBe(20);
  });

  test('another action starts a new step', () => {
    const l = rect(0, 0, 10, 10), d = docWith(l);
    d.styleEdit(l.id, { ...d.get(l.id)!, opacity: 0.5 });
    d.checkpoint();
    d.add('rect', pt(0, 0)); // a canvas action in between
    d.styleEdit(l.id, { ...d.get(l.id)!, opacity: 0.2 });
    d.undo();
    expect(d.get(l.id)!.opacity).toBe(0.5);
  });

  test('a no-op edit leaves no step', () => {
    const l = rect(0, 0, 10, 10), d = docWith(l);
    d.styleEdit(l.id, { ...d.get(l.id)! });
    d.add('rect', pt(0, 0));
    d.undo(); // nothing to undo: the layer count stays
    expect(d.layers.length).toBe(2);
  });

  test('palette changes are undoable, saved, and make the document dirty', () => {
    const d = new Doc();
    d.markSaved();
    d.addToPalette(BLACK);
    d.addToPalette({ ...BLACK }); // no duplicates
    expect(d.palette).toEqual([BLACK]);
    expect(d.isDirty).toBe(true);
    const copy = new Doc();
    copy.load(d.json(), false);
    expect(copy.palette).toEqual([BLACK]);
    d.removeFromPalette(0);
    d.undo();
    expect(d.palette).toEqual([BLACK]);
    d.undo();
    expect(d.palette).toEqual([]);
  });

  test('files from before the palette still open', () => {
    const d = new Doc();
    d.load('[{"name":"r","kind":"rect","points":[[0,0],[1,1]]}]', false);
    expect(d.layers.length).toBe(1);
    expect(d.palette).toEqual([]);
  });
});

describe('combine', () => {
  // a: 0…10, b: 5…15, overlapping on 5…10; c on top, untouched
  const overlapping = () => {
    const d = docWith(r10(0, 'a'), r10(5, 'b'), r10(40, 'c'));
    d.layers[0].fill = BLACK;
    d.selectedIDs = new Set([d.layers[0].id, d.layers[1].id]);
    return d;
  };

  test.each([
    ['union', { x: 0, y: 0, width: 15, height: 10 }, 1],
    ['subtract', { x: 0, y: 0, width: 5, height: 10 }, 1],
    ['intersect', { x: 5, y: 0, width: 5, height: 10 }, 1],
    ['difference', { x: 0, y: 0, width: 15, height: 10 }, 2],
  ] as const)('%s', (op, b, count) => {
    const d = overlapping();
    d.combine(op);
    expect(d.layers.map((l) => l.name)).toEqual(['a', 'c']);
    const r = d.layers[0];
    expect(r.kind).toBe('path');
    expect(r.subpaths.length).toBe(count);
    expect(nearRect(bounds(r), b)).toBe(true);
    expect(r.fill).toEqual(BLACK); // the bottom layer's style
    expect(d.selection).toBe(r.id);
  });

  test('undo brings the layers back; an empty result changes nothing', () => {
    const d = overlapping();
    d.combine('union');
    d.undo();
    expect(d.layers.map((l) => l.name)).toEqual(['a', 'b', 'c']);
    d.selectedIDs = new Set([d.layers[0].id, d.layers[2].id]);
    d.combine('intersect');
    expect(d.layers.length).toBe(3);
    expect(d.canUndo).toBe(false);
  });

  test('rotation is baked into the result', () => {
    const d = overlapping();
    d.layers[0].rotation = Math.PI / 4;
    const before = bounds(d.layers[0]);
    d.selectedIDs = new Set([d.layers[0].id, d.layers[2].id]);
    d.combine('union');
    const r = d.layers.find((l) => l.kind === 'path')!;
    expect(r.rotation).toBe(0);
    expect(r.subpaths.length).toBe(2);
    expect(bounds(r).x).toBeCloseTo(before.x);
    expect(bounds(r).height).toBeCloseTo(before.height);
  });
});

describe('convert to outlines', () => {
  const stroked = (extra: Partial<ReturnType<typeof rect>>) => {
    const d = docWith(Object.assign(rect(0, 0, 10, 10, 'a'), { stroke: BLACK, strokeWidth: 2 }, extra));
    d.selection = d.layers[0].id;
    d.outline();
    return d.layers[0];
  };

  test.each([
    ['center', { x: -1, y: -1, width: 12, height: 12 }],
    ['inside', { x: 0, y: 0, width: 10, height: 10 }],
    ['outside', { x: -2, y: -2, width: 14, height: 14 }],
  ] as const)('%s border becomes a ring filled with the border color', (borderPosition, b) => {
    const l = stroked({ borderPosition });
    expect(l.kind).toBe('path');
    expect(l.subpaths.length).toBe(2); // outer edge and hole
    expect(nearRect(bounds(l), b)).toBe(true);
    expect(l.fill).toEqual(BLACK);
    expect(l.strokeWidth).toBe(0);
    expect(l.stroke.a).toBe(0);
  });

  test('open path: caps', () => {
    const line = (lineCap: 'butt' | 'square' | 'round') => {
      const d = docWith(Object.assign(rect(0, 0, 1, 1), { kind: 'path' as const, stroke: BLACK, strokeWidth: 2, lineCap,
        subpaths: [{ closed: false, nodes: [{ x: 0, y: 0 }, { x: 10, y: 0 }].map((p) => ({ p, cin: p, cout: p })) }] }));
      d.selection = d.layers[0].id;
      d.outline();
      return bounds(d.layers[0]);
    };
    expect(nearRect(line('butt'), { x: 0, y: -1, width: 10, height: 2 })).toBe(true);
    expect(nearRect(line('square'), { x: -1, y: -1, width: 12, height: 2 })).toBe(true);
    expect(nearRect(line('round'), { x: -1, y: -1, width: 12, height: 2 })).toBe(true);
  });

  test('miter, round and bevel corners', () => {
    expect(nearRect(bounds(stroked({ lineJoin: 'round' })), { x: -1, y: -1, width: 12, height: 12 })).toBe(true);
    const bevel = stroked({ lineJoin: 'bevel' }); // corners cut: the outer edge has 8 nodes
    expect(Math.max(...bevel.subpaths.map((s) => s.nodes.length))).toBe(8);
  });

  test('a rotated layer stays in place; nothing without a border', () => {
    const l = stroked({ rotation: 0.5 });
    expect(l.rotation).toBe(0.5);
    expect(near(toWorld(l, pt(5, 5)), pt(5, 5), 1e-6)).toBe(true);
    const d = docWith(rect(0, 0, 10, 10));
    d.layers[0].strokeWidth = 0;
    d.selection = d.layers[0].id;
    d.outline();
    expect(d.layers[0].kind).toBe('rect');
    expect(d.canUndo).toBe(false);
  });
});

describe('arrange', () => {
  const names = (d: Doc) => d.layers.map((l) => l.name).join('');
  const arranged = (sel: string, to: 'forward' | 'backward' | 'front' | 'back') => {
    const d = docWith(...'abcde'.split('').map((n, i) => r10(i * 20, n)));
    d.selectedIDs = new Set(d.layers.filter((l) => sel.includes(l.name)).map((l) => l.id));
    d.arrange(to);
    return d;
  };

  test.each([
    ['b', 'forward', 'acbde'], ['bc', 'forward', 'adbce'], ['bd', 'forward', 'acbed'], ['e', 'forward', 'abcde'],
    ['d', 'backward', 'abdce'], ['bd', 'backward', 'badce'], ['a', 'backward', 'abcde'],
    ['bd', 'front', 'acebd'], ['bd', 'back', 'bdace'],
  ] as const)('%s %s → %s', (sel, to, out) => expect(names(arranged(sel, to))).toBe(out));

  test('within a group; no-op leaves no undo step; locked layers stay', () => {
    const d = arranged('e', 'forward');
    expect(d.canUndo).toBe(false);
    d.selectedIDs = new Set([d.layers[0].id, d.layers[1].id]);
    d.group();
    d.selection = d.layers[0].children[0].id;
    d.arrange('front');
    expect(d.layers[0].children.map((l) => l.name)).toEqual(['b', 'a']);
    d.layers[1].locked = true;
    d.selection = d.layers[1].id;
    d.arrange('back');
    expect(d.layers[1].name).toBe('c');
  });
});

describe('groups', () => {
  test('a group selected with its child: nudged once, in paint order', () => {
    const d = docWith(r10(0, 'a'), r10(20, 'b'));
    d.selectedIDs = new Set(d.layers.map((l) => l.id));
    d.group();
    const g = d.layers[0];
    d.selectedIDs = new Set([g.children[1].id, g.id, g.children[0].id]);
    expect(d.selectedLayers.map((l) => l.id)).toEqual([g.id]);
    d.nudge(pt(1, 0));
    expect(bounds(d.layers[0])).toEqual({ x: 1, y: 0, width: 30, height: 10 });
  });

  test('group keeps paint order and position', () => {
    const d = docWith(r10(0, 'a'), r10(20, 'b'), r10(40, 'c'), r10(60, 'd'));
    d.selectedIDs = new Set([d.layers[1].id, d.layers[2].id]);
    d.group();
    expect(d.layers.map((l) => l.name)).toEqual(['a', d.layers[1].name, 'd']);
    expect(d.layers[1].kind).toBe('group');
    expect(d.layers[1].children.map((l) => l.name)).toEqual(['b', 'c']);
    expect(d.selected?.kind).toBe('group');
    expect(bounds(d.layers[1])).toEqual({ x: 20, y: 0, width: 30, height: 10 });
  });

  test('ungroup restores children', () => {
    const d = docWith(r10(0, 'a'), r10(20, 'b'));
    d.selectedIDs = new Set(d.layers.map((l) => l.id));
    d.group();
    d.ungroup();
    expect(d.layers.map((l) => l.name)).toEqual(['a', 'b']);
    expect(d.selectedIDs.size).toBe(2);
  });

  test('only siblings can be grouped', () => {
    const d = docWith(r10(0, 'a'), r10(20, 'b'), r10(40, 'c'));
    d.selectedIDs = new Set([d.layers[0].id, d.layers[1].id]);
    d.group();
    d.selectedIDs = new Set([d.layers[0].children[0].id, d.layers[1].id]);
    expect(d.canGroup).toBe(false);
  });

  test('deleting inside a group prunes empty groups', () => {
    const d = docWith(r10(0, 'a'), r10(20, 'b'));
    d.selectedIDs = new Set(d.layers.map((l) => l.id));
    d.group();
    d.selectedIDs = new Set(d.layers[0].children.map((l) => l.id));
    d.deleteSelected();
    expect(d.layers).toEqual([]);
  });

  test('groups survive JSON', () => {
    const d = docWith(r10(0, 'a'), r10(20, 'b'));
    d.selectedIDs = new Set(d.layers.map((l) => l.id));
    d.group();
    const copy = new Doc();
    copy.load(d.json(), false);
    expect(copy.layers).toEqual(d.layers);
  });
});

describe('visibility and locking', () => {
  test('locked layers cannot be deleted or grouped', () => {
    const a = { ...r10(0, 'a'), locked: true }, b = r10(20, 'b');
    const d = docWith(a, b);
    d.selectedIDs = new Set([a.id, b.id]);
    expect(d.canGroup).toBe(false);
    d.deleteSelected();
    expect(d.layers.map((l) => l.id)).toEqual([a.id]);
    expect([...d.selectedIDs]).toEqual([a.id]);
  });

  test('toggle is undoable and all-or-nothing', () => {
    const a = { ...r10(0, 'a'), hidden: true }, b = r10(20, 'b');
    const d = docWith(a, b);
    d.toggleHidden([a.id, b.id]); // mixed → all hidden
    expect(d.layers.every((l) => l.hidden)).toBe(true);
    d.toggleHidden([a.id, b.id]); // all hidden → all shown
    expect(d.layers.every((l) => !l.hidden)).toBe(true);
    d.undo();
    expect(d.layers.every((l) => l.hidden)).toBe(true);
  });

  test('children inherit and keep their own state', () => {
    const a = r10(0, 'a'), b = { ...r10(0, 'b'), hidden: true };
    const d = new Doc();
    d.layers = [{ ...rect(0, 0, 0, 0, 'g'), kind: 'group', points: [], children: [a, b] }];
    const g = d.layers[0].id;
    d.toggleLocked([g]);
    d.toggleHidden([g]);
    expect(d.isLocked(a.id) && d.isHidden(a.id)).toBe(true);
    d.selectedIDs = new Set([a.id]);
    d.deleteSelected(); // locked by its group
    expect(d.get(a.id)).not.toBeNull();
    d.unlock(a.id); // unlocks the group that locks it
    d.toggleHidden([g]);
    expect(d.isLocked(a.id) || d.isHidden(a.id)).toBe(false);
    expect(d.isHidden(b.id)).toBe(true); // b keeps its own hidden flag
  });
});

describe('renaming', () => {
  test('is one undo step, refuses empty names and locked layers', () => {
    const l = rect(0, 0, 1, 1, 'old'), locked = { ...rect(0, 0, 1, 1, 'keep'), locked: true };
    const d = docWith(l, locked);
    d.startRename(l.id, 'list');
    expect(d.renaming).toEqual({ id: l.id, where: 'list' });
    d.rename(l.id, '  new  ');
    expect(d.get(l.id)!.name).toBe('new');
    expect(d.renaming).toBeNull();
    d.rename(l.id, '   ');
    expect(d.get(l.id)!.name).toBe('new');
    d.undo();
    expect(d.get(l.id)!.name).toBe('old');
    d.startRename(locked.id, 'list');
    expect(d.renaming).toBeNull();
    d.rename(locked.id, 'x');
    expect(d.get(locked.id)!.name).toBe('keep');
  });
});

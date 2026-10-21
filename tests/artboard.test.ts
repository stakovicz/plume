// @vitest-environment jsdom
import { describe, expect, test } from 'vitest';
import { Doc } from '$lib/document/doc.svelte';
import { pt } from '$lib/model/geometry';
import { bounds, hit, localBounds, newArtboard, resized, rotated } from '$lib/model/layer';
import { decodeFile, encodeFile } from '$lib/model/codable';
import { artboardSVG } from '$lib/svg/export';
import { importSVG } from '$lib/svg/import';
import { rect } from './helpers';

const board = (x = 0, y = 0, w = 100, h = 100) => newArtboard('A', [pt(x, y), pt(x + w, y + h)]);

describe('artboard model', () => {
  test('bounds are the frame, not the content', () => {
    const a = { ...board(), children: [rect(-50, -50, 200, 200)] };
    expect(bounds(a)).toEqual({ x: 0, y: 0, width: 100, height: 100 });
  });

  test('resizing changes the frame only; rotating does nothing', () => {
    const child = rect(10, 10, 20, 20), a = { ...board(), children: [child] };
    const big = resized(a, 2, 2, pt(0, 0));
    expect(localBounds(big)).toEqual({ x: 0, y: 0, width: 200, height: 200 });
    expect(big.children[0]).toEqual(child);
    expect(rotated(a, 1, pt(0, 0))).toBe(a);
  });

  test('content is clipped for picking, and the empty background is not hit', () => {
    const a = { ...board(), children: [rect(80, 80, 150, 150)] };
    expect(hit(a, pt(90, 90), 0)).toBe(true);
    expect(hit(a, pt(120, 120), 0)).toBe(false); // outside the frame
    expect(hit(a, pt(10, 10), 0)).toBe(false); // background
  });

  test('survives the file format', () => {
    const a = { ...board(), children: [rect(1, 1, 2, 2)] };
    expect(decodeFile(encodeFile({ layers: [a], palette: [] })).layers[0]).toEqual(a);
  });
});

describe('artboards in the document', () => {
  test('a shape drawn on an artboard goes into it; artboards stay top-level', () => {
    const d = new Doc();
    d.layers = [board()];
    d.add('rect', pt(50, 50));
    d.add('rect', pt(500, 500));
    d.add('artboard', pt(50, 50));
    expect(d.layers.map((l) => l.kind)).toEqual(['artboard', 'rect', 'artboard']);
    expect(d.layers[0].children.length).toBe(1);
  });

  test('a new artboard adopts the top-level layers entirely inside it', () => {
    const d = new Doc();
    d.layers = [rect(10, 10, 20, 20, 'in'), rect(90, 90, 150, 150, 'across')];
    d.add('artboard', pt(0, 0));
    const a = d.layers.at(-1)!;
    a.points = [pt(0, 0), pt(100, 100)];
    d.adopt(a.id);
    expect(d.layers.map((l) => l.name)).toEqual(['across', a.name]);
    expect(d.get(a.id)!.children.map((l) => l.name)).toEqual(['in']);
  });

  test('moving a layer onto or off an artboard rehomes it, groups keep their children', () => {
    const d = new Doc(), r = rect(500, 500, 510, 510, 'r');
    d.layers = [board(), r];
    d.set(r.id, { ...r, points: [pt(40, 40), pt(50, 50)] });
    d.rehome([r.id]);
    expect(d.layers[0].children.map((l) => l.id)).toEqual([r.id]);
    d.set(r.id, { ...d.get(r.id)!, points: [pt(300, 300), pt(310, 310)] });
    d.rehome([r.id]);
    expect(d.layers.map((l) => l.id)).toEqual([d.layers[0].id, r.id]);
  });

  test('artboards cannot be grouped', () => {
    const d = new Doc();
    d.layers = [board(), rect(500, 0, 510, 10)];
    d.selectedIDs = new Set(d.layers.map((l) => l.id));
    expect(d.canGroup).toBe(false);
  });

  test('a preset artboard lands right of the existing content', () => {
    const d = new Doc();
    d.layers = [rect(0, 0, 100, 50)];
    d.addArtboard('A4', 595, 842);
    expect(localBounds(d.layers[1])).toEqual({ x: 180, y: 0, width: 595, height: 842 });
    expect(d.selection).toBe(d.layers[1].id);
  });
});

test('an artboard exports to its own SVG, framed by its bounds', () => {
  const a = { ...board(20, 30, 100, 50), name: 'Home <1>', children: [rect(0, 0, 200, 200)] };
  const svg = artboardSVG(a);
  expect(svg).toContain('viewBox="20 30 100 50"');
  expect(svg).toContain('data-artboard="Home &lt;1&gt;"');
  const back = importSVG(svg);
  expect(back.length).toBe(1);
  expect(back[0]).toMatchObject({ kind: 'artboard', name: 'Home <1>' }); // round trip
});

describe('layer list drag and drop', () => {
  const names = (ls: { name: string; children: { name: string }[] }[]): unknown =>
    ls.map((l) => (l.children.length ? { [l.name]: names(l.children as never) } : l.name));

  test('reorders siblings, keeping the moved layers in paint order', () => {
    const d = new Doc();
    d.layers = [rect(0, 0, 1, 1, 'a'), rect(0, 0, 1, 1, 'b'), rect(0, 0, 1, 1, 'c'), rect(0, 0, 1, 1, 'd')];
    d.moveLayers([d.layers[2].id, d.layers[0].id], null, 4); // to the top
    expect(names(d.layers)).toEqual(['b', 'd', 'a', 'c']);
    d.undo();
    expect(names(d.layers)).toEqual(['a', 'b', 'c', 'd']);
  });

  test('moves into a group or an artboard and out again; an emptied group goes away', () => {
    const d = new Doc();
    const g = newLayerGroup('g', [rect(0, 0, 1, 1, 'x')]);
    d.layers = [board(), g, rect(0, 0, 1, 1, 'r')];
    const r = d.layers[2].id, x = g.children[0].id;
    d.moveLayers([r], g.id, 1);
    expect(names(d.layers)).toEqual(['A', { g: ['x', 'r'] }]);
    d.moveLayers([x, r], d.layers[0].id, 0);
    expect(names(d.layers)).toEqual([{ A: ['x', 'r'] }]);
    d.moveLayers([r], null, 1);
    expect(names(d.layers)).toEqual([{ A: ['x'] }, 'r']);
    expect(localBounds(d.get(r)!)).toEqual({ x: 0, y: 0, width: 1, height: 1 }); // geometry untouched
  });

  test('refuses artboards in containers, a group into itself, and locked layers', () => {
    const d = new Doc();
    const inner = newLayerGroup('inner', [rect(0, 0, 1, 1, 'i')]);
    const g = newLayerGroup('g', [inner]);
    d.layers = [board(), board(200), g, { ...rect(0, 0, 1, 1, 'locked'), locked: true }];
    expect(d.canMoveLayers([d.layers[1].id], d.layers[0].id)).toBe(false);
    expect(d.canMoveLayers([g.id], inner.id)).toBe(false);
    expect(d.canMoveLayers([d.layers[3].id], null)).toBe(false);
    expect(d.canMoveLayers([inner.id], null)).toBe(true);
  });
});

function newLayerGroup(name: string, children: ReturnType<typeof rect>[]) {
  return { ...rect(0, 0, 0, 0, name), kind: 'group' as const, points: [], children };
}

describe('dropping into an artboard from the list', () => {
  test('layers entirely outside the frame come to its center together; others stay', () => {
    const d = new Doc();
    d.layers = [board(0, 0, 100, 100), rect(500, 500, 510, 510, 'far1'), rect(520, 500, 530, 510, 'far2'), rect(90, 90, 120, 120, 'edge')];
    const [far1, far2, edge] = d.layers.slice(1).map((l) => l.id);
    d.moveLayers([far1, far2, edge], d.layers[0].id, 0);
    expect(localBounds(d.get(far1)!)).toEqual({ x: 35, y: 45, width: 10, height: 10 });
    expect(localBounds(d.get(far2)!)).toEqual({ x: 55, y: 45, width: 10, height: 10 }); // layout kept
    expect(localBounds(d.get(edge)!)).toEqual({ x: 90, y: 90, width: 30, height: 30 }); // partly visible: untouched
  });
});

describe('copy and paste', () => {
  const setup = () => {
    const d = new Doc();
    const a = { ...board(), name: 'A', children: [rect(10, 10, 20, 20, 'a1'), rect(40, 40, 50, 50, 'a2')] };
    const b = { ...board(200), name: 'B', children: [] };
    d.layers = [a, b, rect(500, 500, 510, 510, 'free')];
    return d;
  };
  const names = (ls: { name: string }[]) => ls.map((l) => l.name);

  test('duplicate: above the original, same place, new ids, selected', () => {
    const d = setup();
    const a1 = d.layers[0].children[0];
    d.selection = a1.id;
    d.duplicate();
    expect(names(d.layers[0].children)).toEqual(['a1', 'a1', 'a2']);
    const copy = d.layers[0].children[1];
    expect(copy.id).not.toBe(a1.id);
    expect(bounds(copy)).toEqual(bounds(a1));
    expect(d.selection).toBe(copy.id);
    d.undo();
    expect(names(d.layers[0].children)).toEqual(['a1', 'a2']);
  });

  test('paste into a selected artboard: outside its frame → centered in it', () => {
    const d = setup();
    d.selection = d.layers[0].children[0].id;
    const clip = d.copySelection();
    d.selection = d.layers[1].id;
    d.paste(clip);
    const pasted = d.layers[1].children[0];
    expect(pasted.name).toBe('a1');
    expect(bounds(pasted)).toEqual({ x: 245, y: 45, width: 10, height: 10 });
  });

  test('nothing selected: top level, then into the artboard under it', () => {
    const d = setup();
    d.selection = d.layers[0].children[1].id;
    const clip = d.copySelection();
    d.selection = null;
    d.paste(clip);
    expect(names(d.layers[0].children)).toEqual(['a1', 'a2', 'a2']);
    d.selection = d.layers[2].id;
    d.paste(clip); // above the free layer, at the top level, still lands in A by its center
    expect(names(d.layers[0].children)).toEqual(['a1', 'a2', 'a2', 'a2']);
  });

  test('dropped at a point: centered there, in the artboard under it, whatever the selection', () => {
    const d = setup();
    d.selection = d.layers[2].id;
    d.paste([rect(0, 0, 10, 20, 'svg')], pt(250, 50));
    const pasted = d.layers[1].children[0];
    expect(pasted.name).toBe('svg');
    expect(bounds(pasted)).toEqual({ x: 245, y: 40, width: 10, height: 20 });
  });

  test('an artboard pastes right of everything, with its content', () => {
    const d = setup();
    d.selection = d.layers[0].id;
    d.paste(d.copySelection());
    const copy = d.layers.at(-1)!;
    expect(copy.kind).toBe('artboard');
    expect(localBounds(copy).x).toBe(510 + 80);
    expect(copy.children.map((c) => c.id)).not.toContain(d.layers[0].children[0].id);
    expect(bounds(copy.children[0]).x - localBounds(copy).x).toBe(10);
  });
});

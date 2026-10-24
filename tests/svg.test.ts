// @vitest-environment jsdom
import { describe, expect, test } from 'vitest';
import { apply, pathBounds, pt } from '$lib/model/geometry';
import { BLACK, GRAY } from '$lib/model/color';
import { gradient, defaultShadow } from '$lib/model/effects';
import { asPath, bounds, localBounds, moved, newArtboard, newLayer } from '$lib/model/layer';
import { parsePath } from '$lib/model/path-data';
import { importSVG } from '$lib/svg/import';
import { artboardSVG, documentSVG, layerSVG } from '$lib/svg/export';
import { Doc } from '$lib/document/doc.svelte';
import { near, nearRect, rect } from './helpers';

/** What an import holds: the content of the artboard every SVG now opens into. */
const content = (svg: string) => {
  const top = importSVG(svg);
  return top.length === 1 && top[0].kind === 'artboard' ? top[0].children : top;
};
const roundTrip = (l: ReturnType<typeof rect>) => content(`<svg>${layerSVG(l)}</svg>`)[0];

describe('svg', () => {
  test('rounded rect: exported with rx (clamped), imported back with its corners', () => {
    const l = { ...rect(0, 0, 100, 40), radius: 50 };
    expect(layerSVG(l)).toContain('rx="20.00"');
    const back = roundTrip(l);
    expect(back.subpaths[0].nodes.length).toBe(6);
    expect(nearRect(bounds(back), { x: 0, y: 0, width: 100, height: 40 })).toBe(true);
    expect(content('<svg><rect width="10" height="10" ry="2"/></svg>')[0].subpaths[0].nodes.length).toBe(8); // rx takes ry
  });

  test('path data with relative commands after close', () => {
    const s = parsePath('M10 10 h20 v20 h-20 z m5 5 c1 1 2 2 3 3 s1 1 2 2');
    expect(s.length).toBe(2);
    expect(s[0].closed).toBe(true);
    expect(s[0].nodes.length).toBe(4);
    expect(s[1].nodes[0].p).toEqual(pt(15, 15));
    expect(s[1].nodes[s[1].nodes.length - 1].p).toEqual(pt(20, 20));
  });

  test('import applies group transforms and styles, skips defs', () => {
    const top = content(`<svg xmlns="http://www.w3.org/2000/svg"><g transform="translate(5,5)" fill="#f00">
      <rect x="0" y="0" width="10" height="10"/>
      <circle cx="50" cy="50" r="10" style="fill:none;stroke:#00f"/>
      <defs><rect width="99" height="99"/></defs>
    </g></svg>`);
    expect(top.length).toBe(1);
    expect(top[0].kind).toBe('group'); // <g> becomes a group
    const [a, b] = top[0].children;
    expect(top[0].children.length).toBe(2);
    expect(nearRect(bounds(a), { x: 5, y: 5, width: 10, height: 10 })).toBe(true);
    expect(a.fill.r).toBe(1);
    expect(nearRect(bounds(b), { x: 45, y: 45, width: 20, height: 20 })).toBe(true);
    expect(b.subpaths[0].closed && b.fill.a === 0 && b.stroke.b === 1).toBe(true);
  });

  test('stroke width scales with the transform', () => {
    const l = content('<svg><g transform="scale(3)"><line x1="0" y1="0" x2="1" y2="1" stroke="#000" stroke-width="2"/></g></svg>')[0].children[0];
    expect(Math.abs(l.strokeWidth - 6)).toBeLessThan(1e-9);
  });

  test('export then import keeps shapes', () => {
    const layers = [
      { ...rect(0, 0, 10, 20), rotation: Math.PI / 4 },
      newLayer('o', 'ellipse', [pt(30, 0), pt(70, 20)]),
      asPath(newLayer('p', 'ellipse', [pt(0, 0), pt(8, 8)])),
    ];
    const back = content(`<svg>${layers.map(layerSVG).join('')}</svg>`);
    expect(back.length).toBe(layers.length);
    back.forEach((b, i) => expect(nearRect(bounds(b), bounds(layers[i]))).toBe(true));
  });

  test('dash, cap and join survive a round trip', () => {
    const back = roundTrip({ ...rect(0, 0, 10, 10), dash: [4, 2], lineCap: 'round', lineJoin: 'bevel' });
    expect(back.dash).toEqual([4, 2]);
    expect(back.lineCap).toBe('round');
    expect(back.lineJoin).toBe('bevel');
  });

  test('hidden survives export, display none / visibility hidden import hidden', () => {
    expect(roundTrip({ ...rect(0, 0, 10, 10), hidden: true }).hidden).toBe(true);
    expect(content('<svg><rect width="5" height="5" style="visibility:hidden"/></svg>')[0].hidden).toBe(true);
  });

  test('groups survive SVG', () => {
    const d = new Doc();
    d.layers = [rect(0, 0, 10, 10, 'a'), rect(20, 0, 30, 10, 'b')];
    d.selectedIDs = new Set(d.layers.map((l) => l.id));
    d.group();
    const svg = importSVG(documentSVG(d.layers)); // the exported viewBox becomes an artboard
    expect(svg.length).toBe(1);
    expect(svg[0].kind).toBe('artboard');
    expect(svg[0].children[0].kind).toBe('group');
    expect(svg[0].children[0].children.length).toBe(2);
  });
});

describe('effects', () => {
  test('linear gradient in bounding box units', () => {
    const l = content(`<svg><defs><linearGradient id="g"><stop offset="0" stop-color="#f00"/><stop offset="100%" stop-color="#00f" stop-opacity=".5"/></linearGradient></defs>
      <rect x="10" y="20" width="100" height="50" fill="url(#g)"/></svg>`)[0];
    const g = l.fillGradient!;
    expect(g.kind).toBe('linear');
    expect(g.stops.length).toBe(2);
    expect(g.stops[1].color.a).toBe(0.5);
    expect(near(apply(g.transform, g.end), pt(110, 20))).toBe(true); // gradient space 0…1 maps onto the rect
    expect(l.fill.r).toBe(1); // representative color
  });

  test('gradient stops follow href', () => {
    const l = content(`<svg><defs><linearGradient id="s"><stop offset="0" stop-color="#0f0"/></linearGradient>
      <linearGradient id="g" xlink:href="#s" x1="0" y1="0" x2="5" y2="0" gradientUnits="userSpaceOnUse" gradientTransform="scale(2)"/></defs>
      <path d="M0 0 H10 V10 Z" fill="url(#g)"/></svg>`)[0];
    const g = l.fillGradient!;
    expect(g.stops[0].color.g).toBe(1);
    expect(near(apply(g.transform, g.end), pt(10, 0))).toBe(true);
  });

  test('a mask with <use> becomes a clip in element space', () => {
    const l = content(`<svg><defs><polygon id="p" points="0 0 10 0 10 10 0 10"/><mask id="m"><use xlink:href="#p"/></mask></defs>
      <g transform="translate(100,0)"><rect width="50" height="50" mask="url(#m)"/></g></svg>`)[0].children[0];
    expect(nearRect(pathBounds(l.clip)!, { x: 100, y: 0, width: 10, height: 10 })).toBe(true);
  });

  test('opacity, blur and shadow', () => {
    const top = content(`<svg><defs><filter id="b"><feGaussianBlur stdDeviation="3"/></filter>
      <filter id="s"><feOffset dx="1" dy="2"/><feGaussianBlur stdDeviation="4"/><feColorMatrix values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 0.25 0"/><feMerge/></filter></defs>
      <g opacity="0.5"><rect width="1" height="1" filter="url(#b)"/><rect width="1" height="1" filter="url(#s)"/></g></svg>`);
    expect(top[0].opacity).toBe(0.5);
    expect(top[0].children[0].blur).toBe(3);
    expect(top[0].children[1].shadow).toEqual({ x: 1, y: 2, blur: 4, color: { r: 0, g: 0, b: 0, a: 0.25 } });
  });

  test('moving keeps gradient and clip attached', () => {
    const l = {
      ...rect(0, 0, 10, 10),
      fillGradient: gradient({ kind: 'linear', stops: [], start: pt(0, 0), end: pt(1, 0) }),
      clip: [{ nodes: [pt(0, 0), pt(5, 5)].map((p) => ({ p, cin: p, cout: p })), closed: true }],
    };
    const m = moved(l, pt(3, 4));
    expect(near(apply(m.fillGradient!.transform, pt(0, 0)), pt(3, 4))).toBe(true);
    expect(m.clip[0].nodes[0].p).toEqual(pt(3, 4));
  });

  test('effects survive SVG export', () => {
    const back = roundTrip({
      ...rect(0, 0, 10, 10),
      fillGradient: gradient({ kind: 'radial', stops: [{ offset: 0, color: BLACK }, { offset: 1, color: GRAY }], start: pt(5, 5), end: pt(0, 0), radius: 5 }),
      opacity: 0.4,
      blur: 2,
      shadow: defaultShadow(),
      clip: [{ nodes: [pt(0, 0), pt(8, 0), pt(8, 8)].map((p) => ({ p, cin: p, cout: p })), closed: true }],
    });
    expect(back.fillGradient?.kind).toBe('radial');
    expect(back.fillGradient?.stops.length).toBe(2);
    expect(back.opacity).toBe(0.4);
    expect(back.clip.length).toBeGreaterThan(0);
    expect(back.shadow).toBeDefined();
    expect(back.blur).toBe(2);
  });
});

describe('artboard from the SVG canvas', () => {
  test('the viewBox becomes an artboard named after the file, holding the content', () => {
    const top = importSVG('<svg viewBox="10 20 300 200"><rect width="5" height="5"/><circle r="3"/></svg>', 'logo');
    expect(top.length).toBe(1);
    expect(top[0]).toMatchObject({ kind: 'artboard', name: 'logo' });
    expect(localBounds(top[0])).toEqual({ x: 10, y: 20, width: 300, height: 200 });
    expect(top[0].children.length).toBe(2);
  });

  test('width/height when there is no viewBox, else the bounds of the content', () => {
    expect(localBounds(importSVG('<svg width="64px" height="32"><rect width="5" height="5"/></svg>')[0])).toEqual({ x: 0, y: 0, width: 64, height: 32 });
    const box = { x: 10, y: 20, width: 40, height: 30 };
    const content = '<rect x="10" y="20" width="10" height="10"/><rect x="40" y="40" width="10" height="10"/>';
    for (const svg of [`<svg>${content}</svg>`, `<svg width="100%" height="100%">${content}</svg>`]) {
      const [a] = importSVG(svg);
      expect(a.kind).toBe('artboard');
      expect(localBounds(a)).toEqual(box);
    }
    expect(importSVG('<svg></svg>')).toEqual([]); // nothing to frame
  });

  test('our artboard export comes back as the same artboards, not wrapped again', () => {
    const a = { ...newArtboard('Home', [pt(0, 0), pt(100, 50)]), fill: { r: 1, g: 0, b: 0, a: 1 }, children: [rect(10, 10, 20, 20, 'r')] };
    const b = { ...newArtboard('About', [pt(200, 0), pt(300, 50)]), children: [] };
    const back = importSVG(documentSVG([a, b]));
    expect(back.map((l) => [l.kind, l.name])).toEqual([['artboard', 'Home'], ['artboard', 'About']]);
    expect(localBounds(back[0])).toEqual({ x: 0, y: 0, width: 100, height: 50 });
    expect(back[0].fill).toEqual({ r: 1, g: 0, b: 0, a: 1 });
    expect(back[0].children.length).toBe(1);
    const single = importSVG(artboardSVG(a));
    expect(single.length).toBe(1);
    expect(single[0].name).toBe('Home');
  });
});

test('imported shapes resize freely, imported groups keep proportions', () => {
  const [a] = importSVG('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="10" height="10"/><g><rect width="5" height="5"/><circle r="3"/></g></svg>');
  const [r, g] = a.children;
  expect(r.lockRatio).toBe(false);
  expect(g.lockRatio).toBe(true);
  expect(g.children.every((c) => !c.lockRatio)).toBe(true);
});

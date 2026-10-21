// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import { beforeAll, describe, expect, test } from 'vitest';
import { pathBounds, pt } from '$lib/model/geometry';
import { BLACK } from '$lib/model/color';
import { type Layer, bounds, localBounds, newLayer, resized, rotated } from '$lib/model/layer';
import { DEFAULT_TEXT, FONTS, type TextStyle, fitted, measure, registerFont, textLines } from '$lib/model/text';
import { outlined } from '$lib/model/outline';
import { decodeFile, encodeFile } from '$lib/model/codable';
import { importSVG } from '$lib/svg/import';
import { layerSVG } from '$lib/svg/export';
import { Doc } from '$lib/document/doc.svelte';
import { nearRect } from './helpers';

beforeAll(() => {
  for (const f of FONTS) for (const [w, file] of Object.entries(f.files)) {
    const b = readFileSync(`static/fonts/${file}`);
    registerFont(f.family, +w, b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength));
  }
});

const text = (content: string, style: Partial<TextStyle> = {}, x = 10, y = 20, width = 0): Layer =>
  fitted(newLayer('t', 'text', [pt(x, y), pt(x + width, y)], { fill: BLACK, strokeWidth: 0, text: { ...DEFAULT_TEXT, content, ...style } }));

describe('text', () => {
  test('auto width fits the widest line, height fits the lines', () => {
    const l = text('Hello\nWorld!');
    const t = l.text!, b = localBounds(l);
    expect(b.x).toBe(10);
    expect(b.y).toBe(20);
    expect(b.width).toBeCloseTo(Math.max(measure(t, 'Hello'), measure(t, 'World!')));
    expect(b.height).toBeCloseTo(2 * 16 * 1.2);
    expect(measure(t, 'Hello')).toBeGreaterThan(20); // real metrics, not the estimate
  });

  test('a fixed-width box wraps at words', () => {
    const l = text('one two three four five', { autoWidth: false }, 0, 0, 60);
    const lines = textLines(l.text!, 60);
    expect(lines.length).toBeGreaterThan(1);
    expect(lines.join(' ')).toBe('one two three four five');
    for (const s of lines) if (s.includes(' ')) expect(measure(l.text!, s)).toBeLessThanOrEqual(60.01);
    expect(localBounds(l).width).toBe(60);
    expect(localBounds(l).height).toBeCloseTo(lines.length * 16 * 1.2);
  });

  test('centered auto width grows around its center', () => {
    const l = text('ab', { align: 'center' }), c = localBounds(l).x + localBounds(l).width / 2;
    const longer = fitted({ ...l, text: { ...l.text!, content: 'abcdef' } });
    expect(localBounds(longer).x + localBounds(longer).width / 2).toBeCloseTo(c);
  });

  test('proportional resize scales the type; free resize changes the width and rewraps', () => {
    const l = text('Hello world');
    const big = resized(l, 2, 2, pt(10, 20));
    expect(big.text!.size).toBe(32);
    expect(localBounds(big).width).toBeCloseTo(localBounds(l).width * 2);
    const narrow = resized(l, 0.5, 1, pt(10, 20));
    expect(narrow.text!.autoWidth).toBe(false);
    expect(narrow.text!.size).toBe(16);
    expect(localBounds(narrow).width).toBeCloseTo(localBounds(l).width / 2);
    expect(localBounds(narrow).height).toBeCloseTo(2 * 16 * 1.2); // two lines now
  });

  test('saved and reopened', () => {
    const l = text('Saved', { font: 'PT Serif', weight: 700, align: 'right', letterSpacing: 2 });
    expect(decodeFile(encodeFile({ layers: [l], palette: [] })).layers[0]).toEqual(l);
  });

  test('SVG export and import round trip', () => {
    const l = rotated(text('Line one\nLine two', { size: 24, align: 'center', weight: 700 }), Math.PI / 6, pt(50, 50));
    const svg = layerSVG(l);
    expect(svg).toContain('<tspan');
    expect(svg).toContain('font-family="Fira Sans"');
    const top = importSVG(`<svg xmlns="http://www.w3.org/2000/svg">${svg}</svg>`);
    const back = top[0].kind === 'artboard' ? top[0].children[0] : top[0];
    expect(back.kind).toBe('text');
    expect(back.text).toMatchObject({ content: 'Line one\nLine two', size: 24, align: 'center', weight: 700 });
    expect(back.text!.lineHeight).toBeCloseTo(1.2);
    expect(back.rotation).toBeCloseTo(Math.PI / 6);
    expect(nearRect(localBounds(back), localBounds(l), 0.01)).toBe(true);
    expect(nearRect(bounds(back), bounds(l), 0.01)).toBe(true);
  });

  test('imports text written by other apps', () => {
    const top = importSVG('<svg viewBox="0 0 100 100"><text x="5" y="30" font-size="20" fill="red" text-anchor="end">Hi <tspan>there</tspan></text></svg>');
    const l = top[0].children[0];
    expect(l.text).toMatchObject({ content: 'Hi there', size: 20, align: 'right' });
    expect(localBounds(l).x + localBounds(l).width).toBeCloseTo(5);
    expect(l.fill.r).toBe(1);
  });

  test('convert to outlines gives the glyphs, inside the box', () => {
    const l = text('Ag');
    const o = outlined(l)!;
    expect(o.kind).toBe('path');
    expect(o.text).toBeUndefined();
    expect(o.subpaths.length).toBeGreaterThanOrEqual(3); // A (outer + counter) and g
    const g = pathBounds(o.subpaths)!, b = localBounds(l);
    expect(g.x).toBeGreaterThanOrEqual(b.x - 1);
    expect(g.y).toBeGreaterThanOrEqual(b.y - 1);
    expect(g.x + g.width).toBeLessThanOrEqual(b.x + b.width + 1);
    expect(g.y + g.height).toBeLessThanOrEqual(b.y + b.height + 1);
  });

  test('typing: one undo step; text left empty is deleted', () => {
    const doc = new Doc();
    doc.checkpoint(); // the drawing gesture's
    doc.add('text', pt(0, 0));
    const id = doc.selection!;
    doc.editText(id, true);
    doc.setText('Hello');
    doc.endTextEdit();
    expect(doc.get(id)!.name).toBe('Hello');
    expect(localBounds(doc.get(id)!).width).toBeGreaterThan(0);

    doc.editText(id);
    doc.setText('');
    doc.endTextEdit();
    expect(doc.get(id)).toBeNull();
    doc.undo();
    expect(doc.get(id)!.text!.content).toBe('Hello');
    doc.undo();
    expect(doc.layers).toEqual([]);

    doc.redo();
    doc.checkpoint();
    doc.add('text', pt(0, 0));
    doc.editText(doc.selection!, true);
    doc.endTextEdit(); // nothing typed: no layer, no undo step
    expect(doc.layers.length).toBe(1);
    doc.undo();
    expect(doc.layers).toEqual([]);
  });
});

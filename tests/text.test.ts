// @vitest-environment jsdom
import { existsSync, readFileSync } from 'node:fs';
import { type Font, type FontCollection, create } from 'fontkit';
import { jsPDF } from 'jspdf';
import { beforeAll, describe, expect, test } from 'vitest';
import { pathBounds, pt } from '#lib/model/geometry';
import { BLACK } from '#lib/model/color';
import { type Layer, bounds, localBounds, newLayer, resized, rotated, scaled } from '#lib/model/layer';
import { DEFAULT_TEXT, FONTS, type TextStyle, firstBaseline, fitted, layout, measure, registerFont, textLines, trueTypeFace } from '#lib/model/text';
import { outlined } from '#lib/model/outline';
import { decodeFile, encodeFile } from '#lib/model/codable';
import { importSVG } from '#lib/svg/import';
import { layerSVG } from '#lib/svg/export';
import { Doc } from '#lib/document/doc.svelte';
import { near, nearRect } from './helpers';

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
    const back = decodeFile(encodeFile({ layers: [l], palette: [] })).layers[0];
    expect({ ...back, points: [] }).toEqual({ ...l, points: [] }); // points: rounded on save
    back.points.forEach((p, i) => expect(near(p, l.points[i], 1e-3)).toBe(true));
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

describe('text block', () => {
  const RED = { r: 1, g: 0, b: 0, a: 1 };
  const block = (content: string, style: Partial<TextStyle> = {}, height = 0, extra: Partial<Layer> = {}) => {
    const l = text(content, style, 0, 0, 100);
    const b = localBounds(l);
    return fitted({ ...l, ...extra, points: height ? [pt(b.x, b.y), pt(b.x + b.width, b.y + height)] : l.points });
  };

  test('padding: the box is the content plus the padding, the lines sit inside it', () => {
    const l = text('Hi', { padding: [4, 8, 6, 10] }, 0, 0);
    const b = localBounds(l), w = measure(l.text!, 'Hi');
    expect(b.width).toBeCloseTo(w + 18);
    expect(b.height).toBeCloseTo(16 * 1.2 + 10);
    const [line] = layout(l);
    expect(line.x).toBeCloseTo(10);
    expect(line.y).toBeCloseTo(4 + firstBaseline(l.text!));
    const right = fitted({ ...l, text: { ...l.text!, align: 'right' } });
    expect(layout(right)[0].x).toBeCloseTo(localBounds(right).x + localBounds(right).width - 8);
  });

  test('padding narrows the width lines wrap at', () => {
    const plain = block('one two three four five six', { autoWidth: false });
    const padded = block('one two three four five six', { autoWidth: false, padding: [0, 20, 0, 20] });
    expect(layout(padded).length).toBeGreaterThan(layout(plain).length);
    expect(localBounds(padded).width).toBe(100);
  });

  test('fixed height: the lines sit at the top, middle or bottom, and overflow it', () => {
    const at = (verticalAlign: TextStyle['verticalAlign'], height = 100) =>
      layout(block('Hi', { autoWidth: false, autoHeight: false, verticalAlign, padding: [10, 0, 10, 0] }, height))[0].y - firstBaseline(DEFAULT_TEXT);
    const line = 16 * 1.2;
    expect(at('top')).toBeCloseTo(10);
    expect(at('middle')).toBeCloseTo(50 - line / 2);
    expect(at('bottom')).toBeCloseTo(90 - line);
    const small = block('a\nb\nc\nd', { autoWidth: false, autoHeight: false }, 20);
    expect(localBounds(small).height).toBe(20); // kept, the lines overflow
    expect(layout(small).length).toBe(4);
  });

  test('justified: wrapped lines fill the width, the last line of a paragraph stays left', () => {
    const l = block('aaa bb cccc dd eee f gggg hh', { autoWidth: false, align: 'justify' });
    const lines = layout(l);
    expect(lines.length).toBeGreaterThan(1);
    for (const line of lines.slice(0, -1)) {
      const last = line.words!.at(-1)!;
      expect(line.words![0].x).toBeCloseTo(0);
      expect(last.x + measure(l.text!, last.text)).toBeCloseTo(100);
    }
    expect(lines.at(-1)!.words).toBeUndefined();
    expect(layout(text('a b', { align: 'justify' }))[0].words).toBeUndefined(); // auto width: nothing to fill
  });

  test('resizing a block changes its box, not its type; a plain text dragged vertically gets a fixed height', () => {
    const l = block('Button', {}, 0, { background: RED });
    const big = resized(l, 2, 2, pt(0, 0));
    expect(big.text!.size).toBe(16);
    expect(localBounds(big).width).toBeCloseTo(localBounds(l).width * 2);
    expect(localBounds(big).height).toBeCloseTo(localBounds(l).height * 2);
    expect(big.text!.autoHeight).toBe(false);
    const inGroup = scaled(l, 3, 3, pt(0, 0));
    expect(inGroup.text!.size).toBe(16);
    expect(localBounds(inGroup).width).toBeCloseTo(localBounds(l).width * 3);

    const plain = text('Plain');
    const taller = resized(plain, 1, 3, pt(10, 20));
    expect(taller.text!).toMatchObject({ size: 16, autoHeight: false, autoWidth: true });
    expect(localBounds(taller).height).toBeCloseTo(3 * 16 * 1.2);
    expect(resized(plain, 2, 2, pt(10, 20)).text!.size).toBe(32); // plain text: proportional still scales the type
  });

  test('saved and reopened; older files get the defaults', () => {
    const l = block('Saved', { autoHeight: false, verticalAlign: 'middle', padding: [1, 2, 3, 4], align: 'justify' }, 80, { background: RED });
    const back = decodeFile(encodeFile({ layers: [l], palette: [] })).layers[0];
    expect(back.text).toEqual(l.text);
    expect(back.background).toEqual(RED);
    const { autoHeight, verticalAlign, padding, ...old } = l.text!;
    const { background, ...oldLayer } = l;
    const reopened = decodeFile(JSON.stringify([{ ...oldLayer, text: old }])).layers[0];
    expect(reopened.text).toMatchObject({ autoHeight: true, verticalAlign: 'top', padding: [0, 0, 0, 0] });
    expect(reopened.background.a).toBe(0);
  });

  test('SVG export: the box under the text, in one group with the effects', () => {
    const g = { kind: 'linear' as const, start: pt(0, 0), end: pt(1, 0), radius: 1, transform: { a: 100, b: 0, c: 0, d: 1, tx: 0, ty: 0 }, stops: [{ offset: 0, color: RED }, { offset: 1, color: BLACK }] };
    const l = block('OK', {}, 0, { background: RED, backgroundGradient: g, corners: [4, 4, 4, 4], stroke: BLACK, strokeWidth: 2, opacity: 0.5 });
    const svg = layerSVG(l);
    expect(svg).toMatch(/^<g opacity="0.5"><linearGradient[^>]*>.*<\/linearGradient><rect [^>]*rx="4.00"[^>]*fill="url\(#fill-[^"]*\)"[^>]*stroke="#000000"[^>]*\/><text /);
    expect(svg.match(/<text[^>]*>/)![0]).not.toContain('stroke');
    expect(svg.match(/<text[^>]*>/)![0]).not.toMatch(/ opacity=/);
    expect(layerSVG(text('Plain'))).toMatch(/^<text /);
    const justified = layerSVG(block('aaa bb cccc dd eee f gggg hh', { autoWidth: false, align: 'justify' }));
    expect(justified.match(/<tspan/g)!.length).toBeGreaterThan(3); // one per word on the stretched lines
  });

  test('convert to outlines: a block becomes its box under its glyphs, grouped', () => {
    const l = block('Ag', {}, 0, { background: RED, opacity: 0.5 });
    const o = outlined(l, 'Fond')!;
    expect(o.kind).toBe('group');
    expect(o.id).toBe(l.id);
    expect(o.opacity).toBe(0.5);
    expect(o.children.map((c) => c.kind)).toEqual(['rect', 'path']);
    expect(o.children[0]).toMatchObject({ name: 'Fond', fill: RED, opacity: 1 });
    expect(nearRect(localBounds(o.children[0]), localBounds(l), 1e-9)).toBe(true);
    expect(outlined(text('Ag'))!.kind).toBe('path');
  });
});

const HELVETICA = '/System/Library/Fonts/Helvetica.ttc'; // a system collection (macOS only)
describe.skipIf(!existsSync(HELVETICA))('installed fonts', () => {
  test('a collection face comes out as a TrueType file jsPDF embeds', () => {
    const ttc = new Uint8Array(readFileSync(HELVETICA));
    const face = trueTypeFace(ttc, 1)!;
    expect((create(face) as Font).postscriptName).toBe((create(ttc) as FontCollection).fonts[1].postscriptName);
    const pdf = new jsPDF();
    pdf.addFileToVFS('h.ttf', Buffer.from(face).toString('base64'));
    pdf.addFont('h.ttf', 'H', 'normal');
    pdf.setFont('H');
    pdf.text('Hello', 10, 10);
    expect(pdf.output().length).toBeGreaterThan(1000);
  });
});

test('a TrueType file is embedded as is, CFF (.otf) is not', () => {
  const ttf = new Uint8Array(readFileSync('static/fonts/FiraSans-Regular.ttf'));
  expect(trueTypeFace(ttf)).toBe(ttf);
  expect(trueTypeFace(new Uint8Array([0x4f, 0x54, 0x54, 0x4f, 0, 0, 0, 0]))).toBeNull();
});

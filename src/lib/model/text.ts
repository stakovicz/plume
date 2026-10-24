import { type Font, type GlyphRun, type PathCommand, create } from 'fontkit';
import { type Node, type Pt, type Rect, type Subpath, midX, node, pt, rectOf } from './geometry';
import type { Layer } from './layer';

/** Text layers: `points` are the text box, `text` the content and its style, one style per layer.
 *  An auto-width box fits its widest line; a fixed-width one wraps at word boundaries. Either way the
 *  height fits the lines. Layout, measuring and outlines all come from the same font files (bundled in
 *  static/fonts or installed on the system, registered by the app or the tests), so the canvas, exports and outlines agree. */

export const TEXT_ALIGNS = ['left', 'center', 'right'] as const;
export type TextAlign = (typeof TEXT_ALIGNS)[number];

export type TextStyle = {
  content: string;
  font: string; // CSS font-family
  size: number;
  weight: number; // 400 or 700 (what svg2pdf maps to normal/bold); measured with the family's nearest face
  lineHeight: number; // multiple of the size
  letterSpacing: number; // px, after each character (like CSS)
  align: TextAlign;
  autoWidth: boolean;
};

export const DEFAULT_TEXT: TextStyle = {
  content: '', font: 'Fira Sans', size: 16, weight: 400, lineHeight: 1.2, letterSpacing: 0, align: 'left', autoWidth: true,
};

/** Bundled fonts, by family and weight → file in static/fonts. */
export const FONTS = [
  { family: 'Fira Sans', files: { 400: 'FiraSans-Regular.ttf', 700: 'FiraSans-Bold.ttf' } },
  { family: 'PT Serif', files: { 400: 'PT_Serif-Web-Regular.ttf', 700: 'PT_Serif-Web-Bold.ttf' } },
  { family: 'Fira Mono', files: { 400: 'FiraMono-Regular.ttf', 700: 'FiraMono-Bold.ttf' } },
] as const;

const fonts = new Map<string, Map<number, Font>>(); // family → weight → face
const variations = new Map<string, Font>(); // `family|weight` → variable face at that weight

/** A face of `family`: `data` is a font file, `index` its face in a collection (.ttc). */
export function registerFont(family: string, weight: number, data: ArrayBuffer | Uint8Array, index = 0) {
  const f = create(data instanceof Uint8Array ? data : new Uint8Array(data));
  if (!fonts.has(family)) fonts.set(family, new Map());
  fonts.get(family)!.set(weight, 'fonts' in f ? f.fonts[index] : f);
}

export const hasFamily = (family: string) => fonts.has(family);

/** One face of a font file as a standalone TrueType file: a collection's (.ttc) face `index` is copied
 *  out with its tables (offsets rewritten), a single font is returned as is. Null for CFF outlines
 *  (.otf, `OTTO`), which jsPDF can't embed. */
export function trueTypeFace(data: Uint8Array, index = 0): Uint8Array | null {
  const v = new DataView(data.buffer, data.byteOffset, data.byteLength);
  const tag = (at: number) => String.fromCharCode(...data.subarray(at, at + 4));
  const start = tag(0) === 'ttcf' ? v.getUint32(12 + 4 * index) : 0;
  if (tag(start) === 'OTTO') return null;
  if (start === 0) return data;
  const n = v.getUint16(start + 4), dir = 12 + 16 * n;
  const tables = Array.from({ length: n }, (_, i) => {
    const r = start + 12 + 16 * i;
    return { record: data.subarray(r, r + 16), body: data.subarray(v.getUint32(r + 8), v.getUint32(r + 8) + v.getUint32(r + 12)) };
  });
  const out = new Uint8Array(tables.reduce((s, t) => s + ((t.body.length + 3) & ~3), dir));
  const w = new DataView(out.buffer);
  out.set(data.subarray(start, start + 12));
  let at = dir;
  tables.forEach((t, i) => {
    out.set(t.record, 12 + 16 * i);
    w.setUint32(12 + 16 * i + 8, at);
    out.set(t.body, at);
    at += (t.body.length + 3) & ~3; // tables start on 4-byte boundaries
  });
  return out;
}

/** The first family of a CSS font-family list, unquoted. */
export const familyOf = (font: string) => font.split(',')[0].trim().replace(/^['"]|['"]$/g, '');

/** The layer's font: the family's face nearest to its weight (a variable face set to it); a family not
 *  registered (imported SVG, system font not loaded) is measured and outlined with the default one. */
function fontOf(t: TextStyle): Font | undefined {
  let family = familyOf(t.font);
  if (!fonts.has(family)) family = DEFAULT_TEXT.font;
  const faces = fonts.get(family);
  if (!faces) return undefined;
  const w = [...faces.keys()].reduce((a, b) => (Math.abs(b - t.weight) < Math.abs(a - t.weight) ? b : a));
  const f = faces.get(w)!, k = `${family}|${t.weight}`;
  if (w === t.weight || !f.variationAxes.wght) return f;
  if (!variations.has(k)) {
    try {
      variations.set(k, f.getVariation({ wght: t.weight }));
    } catch {
      variations.set(k, f); // CFF-flavoured variable font: fontkit can't vary it
    }
  }
  return variations.get(k);
}

/** Shaped glyphs; like CSS, letter spacing turns ligatures off. */
const shaped = (f: Font, t: TextStyle, s: string): GlyphRun => f.layout(s, t.letterSpacing ? { liga: false, clig: false } : undefined);

/** Width of one line as drawn, letter spacing included. Before the fonts are loaded: an estimate. */
export function measure(t: TextStyle, s: string): number {
  const f = fontOf(t);
  if (!f) return s.length * (t.size * 0.55 + t.letterSpacing);
  const r = shaped(f, t, s);
  return (r.advanceWidth * t.size) / f.unitsPerEm + r.glyphs.length * t.letterSpacing;
}

/** Lines as drawn: the content's own line breaks, plus word wrap in a fixed-width box.
 *  ponytail: a word longer than the box overflows instead of breaking. */
export function textLines(t: TextStyle, width: number): string[] {
  const paragraphs = t.content.split('\n');
  if (t.autoWidth) return paragraphs;
  return paragraphs.flatMap((para) => {
    const lines: string[] = [];
    let line = '';
    for (const word of para.split(' ')) {
      const next = line ? `${line} ${word}` : word;
      if (line && measure(t, next) > width + 0.01) {
        lines.push(line);
        line = word;
      } else line = next;
    }
    return [...lines, line];
  });
}

const lineBox = (t: TextStyle) => t.size * t.lineHeight;

/** Baseline of the first line below the box top: the glyphs (ascent + descent) centered in the line box, like CSS. */
export function firstBaseline(t: TextStyle) {
  const f = fontOf(t);
  const asc = f ? (f.ascent / f.unitsPerEm) * t.size : 0.8 * t.size, desc = f ? (-f.descent / f.unitsPerEm) * t.size : 0.2 * t.size;
  return (lineBox(t) - asc - desc) / 2 + asc;
}

/** Each line with its anchor `x` (left, center or right per `align`) and baseline `y`, in the layer's local space. */
export function layout(l: Layer): { text: string; x: number; y: number }[] {
  const t = l.text!, b = rectOf(l.points)!;
  const x = t.align === 'left' ? b.x : t.align === 'center' ? midX(b) : b.x + b.width;
  const y0 = b.y + firstBaseline(t);
  return textLines(t, b.width).map((text, i) => ({ text, x, y: y0 + i * lineBox(t) }));
}

/** The box fitted to the content: height = the lines; width = the widest line when auto-width, keeping the
 *  left edge, center or right edge per alignment. Local space; the caller keeps rotated layers in place. */
export function fitted(l: Layer): Layer {
  const t = l.text!, b: Rect = rectOf(l.points)!;
  const lines = textLines(t, b.width);
  let x = b.x, w = b.width;
  if (t.autoWidth) {
    w = Math.max(0, ...lines.map((s) => measure(t, s)));
    x = t.align === 'left' ? b.x : t.align === 'center' ? midX(b) - w / 2 : b.x + b.width - w;
  }
  return { ...l, points: [pt(x, b.y), pt(x + w, b.y + lines.length * lineBox(t))] };
}

/** Text with size and spacing scaled by `k` about its box center (proportional resize). */
export function textScaled(l: Layer, k: number): Layer {
  const t = l.text!, b = rectOf(l.points)!, c = pt(midX(b), b.y + b.height / 2);
  return {
    ...l,
    points: l.points.map((p) => pt(c.x + (p.x - c.x) * k, c.y + (p.y - c.y) * k)),
    text: { ...t, size: t.size * k, letterSpacing: t.letterSpacing * k },
  };
}

/** The glyphs as Bézier subpaths (local space, nonzero fill); empty before the fonts are loaded. */
export function glyphOutlines(l: Layer): Subpath[] {
  const t = l.text!, f = fontOf(t);
  if (!f) return [];
  return layout(l).flatMap(({ text, x, y }) => {
    const w = measure(t, text), k = t.size / f.unitsPerEm, r = shaped(f, t, text);
    let pen = t.align === 'left' ? x : t.align === 'center' ? x - w / 2 : x - w;
    return r.glyphs.flatMap((g, i) => {
      const p = r.positions[i], ox = pen + p.xOffset * k, oy = y - p.yOffset * k;
      pen += p.xAdvance * k + t.letterSpacing;
      return subpaths(g.path.commands, (gx, gy) => pt(ox + gx * k, oy - gy * k));
    });
  });
}

/** fontkit glyph path commands (font units, y up) → subpaths placed by `at` (quadratic curves raised to cubic). */
function subpaths(commands: PathCommand[], at: (x: number, y: number) => Pt): Subpath[] {
  const out: Subpath[] = [];
  let nodes: Node[] = [];
  const last = () => nodes[nodes.length - 1];
  const lerp = (a: Pt, b: Pt, k: number) => pt(a.x + (b.x - a.x) * k, a.y + (b.y - a.y) * k);
  for (const { command, args: a } of commands) {
    const p = at(a[a.length - 2], a[a.length - 1]);
    switch (command) {
      case 'moveTo':
        nodes = [node(p)];
        out.push({ nodes, closed: false });
        break;
      case 'lineTo': nodes.push(node(p)); break;
      case 'bezierCurveTo':
        last().cout = at(a[0], a[1]);
        nodes.push({ p, cin: at(a[2], a[3]), cout: p });
        break;
      case 'quadraticCurveTo': {
        const q = at(a[0], a[1]);
        last().cout = lerp(last().p, q, 2 / 3);
        nodes.push({ p, cin: lerp(p, q, 2 / 3), cout: p });
        break;
      }
      case 'closePath': {
        out[out.length - 1].closed = true;
        const first = nodes[0], end = last();
        if (nodes.length > 1 && Math.abs(end.p.x - first.p.x) < 1e-9 && Math.abs(end.p.y - first.p.y) < 1e-9) {
          first.cin = end.cin; // the closing point is the first one again
          nodes.pop();
        }
      }
    }
  }
  return out.filter((s) => s.nodes.length > 1);
}

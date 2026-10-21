import { type Font, type PathCommand, parse } from 'opentype.js';
import { type Node, type Pt, type Rect, type Subpath, midX, node, pt, rectOf } from './geometry';
import type { Layer } from './layer';

/** Text layers: `points` are the text box, `text` the content and its style, one style per layer.
 *  An auto-width box fits its widest line; a fixed-width one wraps at word boundaries. Either way the
 *  height fits the lines. Layout, measuring and outlines all come from the same font files (bundled in
 *  static/fonts, registered by the app or the tests), so the canvas, exports and outlines agree. */

export const TEXT_ALIGNS = ['left', 'center', 'right'] as const;
export type TextAlign = (typeof TEXT_ALIGNS)[number];

export type TextStyle = {
  content: string;
  font: string; // CSS font-family
  size: number;
  weight: number; // 400 or 700: the weights bundled (and what svg2pdf maps to normal/bold)
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

const fonts = new Map<string, Font>();
const key = (family: string, weight: number) => `${family}|${weight >= 600 ? 700 : 400}`;

export function registerFont(family: string, weight: number, data: ArrayBuffer) { fonts.set(key(family, weight), parse(data)); }

/** The layer's font; a family that isn't bundled (imported SVG) is measured and outlined with the default one.
 *  ponytail: system fonts aren't read; load them through Rust if imported files need exact metrics. */
function fontOf(t: TextStyle): Font | undefined {
  const family = t.font.split(',')[0].trim().replace(/^['"]|['"]$/g, '');
  return fonts.get(key(family, t.weight)) ?? fonts.get(key(DEFAULT_TEXT.font, t.weight));
}

/** Width of one line as drawn, letter spacing included. Before the fonts are loaded: an estimate. */
export function measure(t: TextStyle, s: string): number {
  const f = fontOf(t);
  return f ? f.getAdvanceWidth(s, t.size, { letterSpacing: t.letterSpacing / t.size }) : s.length * (t.size * 0.55 + t.letterSpacing);
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
  const asc = f ? (f.ascender / f.unitsPerEm) * t.size : 0.8 * t.size, desc = f ? (-f.descender / f.unitsPerEm) * t.size : 0.2 * t.size;
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
    const w = measure(t, text), start = t.align === 'left' ? x : t.align === 'center' ? x - w / 2 : x - w;
    return subpaths(f.getPath(text, start, y, t.size, { letterSpacing: t.letterSpacing / t.size }).commands);
  });
}

/** opentype.js path commands → subpaths (quadratic curves raised to cubic). */
function subpaths(commands: PathCommand[]): Subpath[] {
  const out: Subpath[] = [];
  let nodes: Node[] = [];
  const last = () => nodes[nodes.length - 1];
  const lerp = (a: Pt, b: Pt, k: number) => pt(a.x + (b.x - a.x) * k, a.y + (b.y - a.y) * k);
  for (const c of commands) {
    const p = pt(c.x, c.y);
    switch (c.type) {
      case 'M':
        nodes = [node(p)];
        out.push({ nodes, closed: false });
        break;
      case 'L': nodes.push(node(p)); break;
      case 'C':
        last().cout = pt(c.x1, c.y1);
        nodes.push({ p, cin: pt(c.x2, c.y2), cout: p });
        break;
      case 'Q': {
        const q = pt(c.x1, c.y1);
        last().cout = lerp(last().p, q, 2 / 3);
        nodes.push({ p, cin: lerp(p, q, 2 / 3), cout: p });
        break;
      }
      case 'Z': {
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

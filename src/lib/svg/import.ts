import { L } from '$lib/i18n';
import { type Affine, type Rect, type Subpath, IDENTITY, apply, concat, determinant, mapSubpaths, pt, translate, union } from '$lib/model/geometry';
import { type RGBA, GRAY } from '$lib/model/color';
import { type GradientFill, gradient as makeGradient } from '$lib/model/effects';
import { type Layer, LINE_CAPS, LINE_JOINS, bounds, localBounds, mapped, newArtboard, newLayer, rotated } from '$lib/model/layer';
import { DEFAULT_TEXT, TEXT_ALIGNS, fitted, firstBaseline } from '$lib/model/text';
import { defaultColumns, defaultGrid } from '$lib/model/grid';
import { number, parsePath, shapeData, tokens } from '$lib/model/path-data';
import { paint, parseTransform, strict } from './syntax';

/** Turns an SVG into layers. The XML becomes a plain element tree (so `<use>`, masks and gradients
 *  can be referenced before they're defined), then tree → layers. Shapes become Bézier paths, `<g>`
 *  become groups, transforms are baked into the points. Interpreted: linear/radial gradients, opacity,
 *  mask/clipPath (as a clip), Gaussian blur and drop shadows.
 *  The root's viewBox (else its width/height, else the content's bounds) becomes an artboard named `name`
 *  holding everything,
 *  unless the file already has artboards (`<g data-artboard>`, our own export), which come back as such.
 *  Text: one layer per <text>, a line per positioned <tspan>; one style (the <text>'s).
 *  ponytail: no textPath, per-span styles, patterns, images, CSS <style>, other filter effects, luminance masks (a mask's
 *  shapes act as a clip) or compact arc flags ("a1 1 0 011 1"); add when real files need them. */

type El = { name: string; attrs: Record<string, string>; children: El[]; text: string };

function tree(e: Element): El {
  return {
    name: e.localName,
    attrs: Object.fromEntries([...e.attributes].map((a) => [a.name, a.value])),
    children: [...e.children].map(tree),
    text: e.localName === 'text' || e.localName === 'tspan' ? (e.textContent ?? '') : '',
  };
}

export function importSVG(text: string, name = L('Artboard')): Layer[] {
  let dom = new DOMParser().parseFromString(text, 'image/svg+xml');
  // Strict XML rejects what browsers render anyway (undeclared xlink prefix, stray &): retry like inline SVG.
  if (dom.getElementsByTagName('parsererror').length) dom = new DOMParser().parseFromString(text, 'text/html');
  const svg = dom.querySelector('svg');
  if (!svg) throw new Error('Not an SVG file');
  const root: El = { name: '#document', attrs: {}, children: [tree(svg)], text: '' };
  const layers = new Builder(root).layers(root.children, {}, IDENTITY);
  if (!layers.length || layers.some((l) => l.kind === 'artboard')) return layers;
  const frame = viewport(root.children[0].attrs) ?? layers.reduce<Rect | null>((r, l) => union(r, bounds(l)), null);
  if (!frame) return layers;
  return [{ ...newArtboard(name, [pt(frame.x, frame.y), pt(frame.x + frame.width, frame.y + frame.height)]), children: layers }];
}

/** The SVG's canvas in user units: its viewBox, else its width/height (percentages don't say). */
function viewport(a: Record<string, string>): Rect | null {
  const vb = tokens(a.viewBox ?? '').map(Number);
  if (vb.length === 4 && vb[2] > 0 && vb[3] > 0) return { x: vb[0], y: vb[1], width: vb[2], height: vb[3] };
  const size = (s: string | undefined) => (s && !s.trim().endsWith('%') ? number(s) : null); // ponytail: mm/pt/em read as px
  const w = size(a.width), h = size(a.height);
  return w && h && w > 0 && h > 0 ? { x: 0, y: 0, width: w, height: h } : null;
}

type Style = Record<string, string>;

const INHERITED = new Set(['fill', 'stroke', 'stroke-width', 'fill-opacity', 'stroke-opacity', 'fill-rule',
  'stroke-dasharray', 'stroke-linecap', 'stroke-linejoin', 'font-family', 'font-size', 'font-weight', 'text-anchor', 'letter-spacing']);
/** Never drawn directly; some are referenced (gradients, masks, symbols via <use>). */
const HIDDEN = new Set(['defs', 'clipPath', 'mask', 'symbol', 'pattern', 'marker', 'linearGradient',
  'radialGradient', 'filter', 'style', 'title', 'desc', 'metadata', 'image']);

const href = (e: El) => e.attrs.href ?? e.attrs['xlink:href'];
const scaleOf = (t: Affine) => Math.sqrt(Math.abs(determinant(t)));

/** "url(#id)" → "id" */
const urlID = (s: string | undefined) => s?.match(/url\(\s*['"]?#([^)'"]+)/)?.[1] ?? null;

/** "50%" → 0.5, "0.5" → 0.5 */
function fraction(s: string | undefined | null): number | null {
  if (s == null) return null;
  s = s.trim();
  if (!s.endsWith('%')) return strict(s);
  const v = strict(s.slice(0, -1));
  return v == null ? null : v / 100;
}

class Builder {
  byID = new Map<string, El>();
  pathCount = 0;
  depth = 0; // guards against <use> cycles

  constructor(root: El) {
    const index = (e: El) => {
      if (e.attrs.id) this.byID.set(e.attrs.id, e);
      e.children.forEach(index);
    };
    index(root);
  }

  layers(elements: El[], style: Style, ctm: Affine): Layer[] {
    return elements.flatMap((e) => this.convert(e, style, ctm));
  }

  /** One element and its subtree. `parentStyle` is the parent's computed style, `parentCTM` its transform to document space. */
  convert(e: El, parentStyle: Style, parentCTM: Affine): Layer[] {
    if (HIDDEN.has(e.name) || this.depth >= 32) return [];
    const style = this.computedStyle(e, parentStyle);
    const ctm = concat(parseTransform(e.attrs.transform ?? ''), parentCTM);

    let out: Layer[];
    switch (e.name) {
      case '#document': case 'svg': case 'a': case 'switch':
        return this.layers(e.children, style, ctm);
      case 'g': {
        if (e.attrs['data-artboard'] != null) return [this.artboard(e, style, ctm)];
        const kids = this.layers(e.children, style, ctm);
        if (!kids.length) return [];
        out = [this.group(kids, e.attrs.id)];
        break;
      }
      case 'use': {
        const target = this.ref(href(e));
        if (!target) return [];
        const shift = concat(translate(number(e.attrs.x) ?? 0, number(e.attrs.y) ?? 0), ctm);
        this.depth++;
        out = target.name === 'symbol' ? this.layers(target.children, style, shift) : this.convert(target, style, shift);
        this.depth--;
        if (!out.length) return [];
        if (out.length > 1) out = [this.group(out, e.attrs.id)];
        break;
      }
      case 'text': {
        const t = this.text(e, style, ctm);
        if (!t) return [];
        out = [t];
        break;
      }
      default: {
        const d = shapeData(e.name, e.attrs);
        if (d == null) return [];
        out = [this.shape(d, style, ctm, e.attrs.id)];
      }
    }

    const l = out[0];
    l.hidden = style.display === 'none' || style.visibility === 'hidden';
    // Per-element (non-inherited) effects
    l.opacity *= strict(style.opacity) ?? 1;
    const m = this.byID.get(urlID(style.mask) ?? urlID(style['clip-path']) ?? '');
    if (m) l.clip = this.clipShapes(m.children, ctm);
    const f = this.byID.get(urlID(style.filter) ?? '');
    if (f) this.applyFilter(f, l, scaleOf(ctm));
    return out;
  }

  /** Our own artboard export: `<g data-artboard="name">` = clipPath, background rect, clipped content group. */
  artboard(e: El, style: Style, ctm: Affine): Layer {
    const bg = e.children.find((c) => c.name === 'rect'), content = e.children.find((c) => c.name === 'g');
    const n = (k: string) => number(bg?.attrs[k]) ?? 0;
    const a = newArtboard(e.attrs['data-artboard'] || L('Artboard'), [
      apply(ctm, pt(n('x'), n('y'))), apply(ctm, pt(n('x') + n('width'), n('y') + n('height'))),
    ]);
    if (bg) a.fill = paint(bg.attrs.fill ?? 'white', strict(bg.attrs['fill-opacity']) ?? 1);
    a.children = content ? this.layers(content.children, style, ctm) : [];
    a.hidden = style.display === 'none';
    try {
      if (e.attrs['data-grid']) a.grid = { ...defaultGrid(), ...JSON.parse(e.attrs['data-grid']) };
      if (e.attrs['data-columns']) a.columns = { ...defaultColumns(), ...JSON.parse(e.attrs['data-columns']) };
    } catch { /* settings from another version or hand-edited: left out */ }
    return a;
  }

  group(kids: Layer[], id: string | undefined) {
    // groups keep their proportions, as with ⌘G (distorting artwork is almost always an accident); shapes resize freely
    return newLayer(id ?? L('Group'), 'group', [], { children: kids, lockRatio: true });
  }

  computedStyle(e: El, parent: Style): Style {
    const style: Style = Object.fromEntries(Object.entries(parent).filter(([k]) => INHERITED.has(k)));
    Object.assign(style, e.attrs);
    for (const decl of (e.attrs.style ?? '').split(';')) {
      const i = decl.indexOf(':');
      if (i > 0) style[decl.slice(0, i).trim()] = decl.slice(i + 1).trim();
    }
    return style;
  }

  shape(d: string, style: Style, ctm: Affine, id: string | undefined): Layer {
    this.pathCount++;
    let l = newLayer(id ?? `${L('Path')} ${this.pathCount}`, 'path', [], { subpaths: parsePath(d) });
    const userBounds = localBounds(l); // before ctm: objectBoundingBox gradients are relative to it
    l = mapped(l, (p) => apply(ctm, p));

    const fillOpacity = strict(style['fill-opacity']) ?? 1, strokeOpacity = strict(style['stroke-opacity']) ?? 1;
    const fill = style.fill ?? 'black', stroke = style.stroke ?? 'none';
    const fg = this.gradient(urlID(fill), userBounds, ctm, fillOpacity);
    if (fg) l.fillGradient = fg;
    l.fill = fg ? (fg.stops[0]?.color ?? GRAY) : paint(fill, fillOpacity); // representative color: inspector, hit-testing
    const sg = this.gradient(urlID(stroke), userBounds, ctm, strokeOpacity);
    if (sg) l.strokeGradient = sg;
    l.stroke = sg ? (sg.stops[0]?.color ?? GRAY) : paint(stroke, strokeOpacity);
    const s = scaleOf(ctm);
    l.strokeWidth = (number(style['stroke-width']) ?? 1) * s;
    l.dash = tokens(style['stroke-dasharray'] ?? '').map(Number).filter((x) => !Number.isNaN(x)).map((x) => x * s); // "none" → []
    l.lineCap = LINE_CAPS.find((c) => c === style['stroke-linecap']) ?? 'butt';
    l.lineJoin = LINE_JOINS.find((j) => j === style['stroke-linejoin']) ?? 'miter';
    l.evenOdd = style['fill-rule'] === 'evenodd';
    return l;
  }

  /** `x`/`y` place the first baseline at the anchor (start, middle or end per text-anchor); each <tspan> with
   *  its own `y` starts a line (our export), the gap between the first two gives the line height. */
  text(e: El, style: Style, ctm: Affine): Layer | null {
    const spans = e.children.filter((c) => c.name === 'tspan');
    const lines = spans.some((c) => c.attrs.y != null)
      ? spans.reduce<{ text: string; y: number | null }[]>((acc, c) => {
        const y = number(c.attrs.y);
        if (y != null || !acc.length) acc.push({ text: c.text, y });
        else acc[acc.length - 1].text += c.text;
        return acc;
      }, [])
      : [{ text: e.text, y: null }];
    const content = lines.map((l) => l.text).join('\n');
    if (!content.trim()) return null;
    const s = scaleOf(ctm), size = number(style['font-size']) ?? 16;
    const weight = style['font-weight'] === 'bold' || (number(style['font-weight']) ?? 400) >= 600 ? 700 : 400;
    const first = spans.find((c) => c.attrs.y != null)?.attrs;
    const x = number(e.attrs.x) ?? number(first?.x) ?? 0, y = number(e.attrs.y) ?? lines[0].y ?? 0;
    const gap = lines.length > 1 && lines[0].y != null && lines[1].y != null ? (lines[1].y - lines[0].y) / size : null;
    const anchor = { start: 'left', middle: 'center', end: 'right' }[style['text-anchor'] ?? 'start'];
    const text = {
      ...DEFAULT_TEXT, content, size: size * s, weight, font: style['font-family'] ?? DEFAULT_TEXT.font,
      lineHeight: gap && gap > 0 ? gap : DEFAULT_TEXT.lineHeight, letterSpacing: (number(style['letter-spacing']) ?? 0) * s,
      align: TEXT_ALIGNS.find((a) => a === anchor) ?? 'left',
    };
    const at = apply(ctm, pt(x, y)), top = at.y - firstBaseline(text);
    const l = fitted(newLayer(content.split('\n')[0].slice(0, 40), 'text', [pt(at.x, top), pt(at.x, top)], {
      text, strokeWidth: 0, fill: paint(style.fill ?? 'black', strict(style['fill-opacity']) ?? 1),
    }));
    const angle = Math.atan2(ctm.b, ctm.a);
    return angle ? rotated(l, angle, at) : l;
  }

  // MARK: References

  /** "#id" → element */
  ref(h: string | undefined) { return h?.startsWith('#') ? this.byID.get(h.slice(1)) : undefined; }

  /** Shapes inside a mask/clipPath (following <use> and nested groups), in document space. */
  clipShapes(elements: El[], ctm: Affine, depth = 0): Subpath[] {
    if (depth >= 16) return [];
    return elements.flatMap((e) => {
      const t = concat(parseTransform(e.attrs.transform ?? ''), ctm);
      const target = e.name === 'use' ? this.ref(href(e)) : undefined;
      if (target) return this.clipShapes([target], concat(translate(number(e.attrs.x) ?? 0, number(e.attrs.y) ?? 0), t), depth + 1);
      const d = shapeData(e.name, e.attrs);
      if (d != null) return mapSubpaths(parsePath(d), (p) => apply(t, p)).map((s) => ({ ...s, closed: true }));
      return this.clipShapes(e.children, t, depth + 1);
    });
  }

  /** Gradient attribute, following `href` chains (Inkscape keeps stops in one gradient, geometry in another). */
  gradientAttr(e: El, key: string, hops = 0): string | undefined {
    if (key in e.attrs) return e.attrs[key];
    const next = hops < 8 ? this.ref(href(e)) : undefined;
    return next && this.gradientAttr(next, key, hops + 1);
  }

  gradientStops(e: El, opacity: number, hops = 0): GradientFill['stops'] {
    const stops = e.children.filter((c) => c.name === 'stop');
    const next = !stops.length && hops < 8 ? this.ref(href(e)) : undefined;
    if (next) return this.gradientStops(next, opacity, hops + 1);
    return stops.map((s) => {
      const st = this.computedStyle(s, {});
      const a = (strict(st['stop-opacity']) ?? 1) * opacity;
      return { offset: Math.min(Math.max(fraction(st.offset) ?? 0, 0), 1), color: paint(st['stop-color'] ?? 'black', a) };
    });
  }

  gradient(id: string | null, userBounds: Rect, ctm: Affine, opacity: number): GradientFill | null {
    const e = id ? this.byID.get(id) : undefined;
    if (!e || (e.name !== 'linearGradient' && e.name !== 'radialGradient')) return null;
    const stops = this.gradientStops(e, opacity);
    if (!stops.length) return null;
    const v = (k: string, fallback: number) => fraction(this.gradientAttr(e, k)) ?? fallback;

    // gradient space → user space → document space
    let t = parseTransform(this.gradientAttr(e, 'gradientTransform') ?? '');
    if (this.gradientAttr(e, 'gradientUnits') !== 'userSpaceOnUse') { // objectBoundingBox: 0…1 over the shape's box
      const b = userBounds;
      t = concat(t, { a: b.width, b: 0, c: 0, d: b.height, tx: b.x, ty: b.y });
    }
    t = concat(t, ctm);
    // ponytail: radial focal point (fx/fy) and spreadMethod reflect/repeat are ignored (pad)
    return e.name === 'linearGradient'
      ? makeGradient({ kind: 'linear', stops, start: pt(v('x1', 0), v('y1', 0)), end: pt(v('x2', 1), v('y2', 0)), transform: t })
      : makeGradient({ kind: 'radial', stops, start: pt(v('cx', 0.5), v('cy', 0.5)), end: pt(0, 0), radius: v('r', 0.5), transform: t });
  }

  /** Gaussian blur, feDropShadow, or the offset + blur + flood/matrix + merge pattern Figma/Illustrator export. */
  applyFilter(f: El, l: Layer, s: number) {
    const first = (name: string) => f.children.find((c) => c.name === name);
    const num = (e: El | undefined, k: string) => tokens(e?.attrs[k] ?? '').map(Number)[0] ?? 0;
    const flood = (e: El): RGBA => {
      const st = this.computedStyle(e, {});
      return paint(st['flood-color'] ?? 'black', strict(st['flood-opacity']) ?? 1);
    };

    const ds = first('feDropShadow'), off = first('feOffset'), blur = first('feGaussianBlur');
    if (ds) {
      l.shadow = { x: num(ds, 'dx') * s, y: num(ds, 'dy') * s, blur: num(ds, 'stdDeviation') * s, color: flood(ds) };
      l.blur = num(blur, 'stdDeviation') * s; // blur → shadow chain (our own export)
    } else if (off && blur) {
      let color: RGBA = { r: 0, g: 0, b: 0, a: 0.5 };
      const fl = first('feFlood'), m = first('feColorMatrix');
      if (fl) color = flood(fl);
      else if (m) {
        const vals = tokens(m.attrs.values ?? '').map(Number);
        if (vals.length === 20) color = { r: vals[4], g: vals[9], b: vals[14], a: vals[18] }; // applied to SourceAlpha
      }
      l.shadow = { x: num(off, 'dx') * s, y: num(off, 'dy') * s, blur: num(blur, 'stdDeviation') * s, color };
    } else if (blur) {
      l.blur = num(blur, 'stdDeviation') * s;
    }
  }
}

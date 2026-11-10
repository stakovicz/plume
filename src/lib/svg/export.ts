import { type Rect, inset, midX, midY, union } from '#lib/model/geometry';
import { type RGBA, hex } from '#lib/model/color';
import type { GradientFill } from '#lib/model/effects';
import { type Layer, bounds, cornerRadii, imageFlip, localBounds, localShape, textBox } from '#lib/model/layer';
import { dataURL } from '#lib/model/images';
import { pathData } from '#lib/model/path-data';
import { layout } from '#lib/model/text';

/** Layer → SVG markup. Gradients, clips and filters are written as <defs> right before the element
 *  that uses them, with ids derived from the layer id. */
export function layerSVG(l: Layer): string {
  const b = localBounds(l), key = l.id.slice(0, 8);
  const defs: string[] = [];
  let attrs = '';
  const f = (v: number) => v.toFixed(2);

  const paintAttr = (c: RGBA, g: GradientFill | undefined, attr: string) => {
    if (g) {
      const gid = `${attr}-${key}`;
      defs.push(gradientDef(g, gid));
      return `${attr}="url(#${gid})"`;
    }
    return c.a === 0 ? `${attr}="none"` : `${attr}="${hex(c)}" ${attr}-opacity="${c.a}"`;
  };

  // Effects (apply to groups too)
  if (l.hidden) attrs += ' display="none"';
  if (l.opacity < 1) attrs += ` opacity="${l.opacity}"`;
  if (l.clip.length) {
    defs.push(`<clipPath id="clip-${key}"><path d="${pathData(l.clip)}"/></clipPath>`);
    attrs += ` clip-path="url(#clip-${key})"`;
  }
  if (l.blur > 0 || l.shadow) {
    let prims = '';
    if (l.blur > 0) prims += `<feGaussianBlur stdDeviation="${l.blur}" result="blur"/>`;
    const s = l.shadow;
    if (s) {
      prims += `<feDropShadow${l.blur > 0 ? ' in="blur"' : ''} dx="${s.x}" dy="${s.y}" stdDeviation="${s.blur}" flood-color="${hex(s.color)}" flood-opacity="${s.color.a}"/>`;
    }
    defs.push(`<filter id="fx-${key}" x="-50%" y="-50%" width="200%" height="200%">${prims}</filter>`);
    attrs += ` filter="url(#fx-${key})"`;
  }
  if (l.kind === 'group') return defs.join('') + `<g${attrs}>${l.children.map(layerSVG).join('')}</g>`;
  if (l.kind === 'artboard') { // background + content clipped to the frame; import recognizes data-artboard (and its grid settings, never drawn)
    const box = `x="${f(b.x)}" y="${f(b.y)}" width="${f(b.width)}" height="${f(b.height)}"`;
    return defs.join('') + `<g${attrs} data-artboard="${escapeXML(l.name)}"${l.grid ? ` data-grid="${escapeXML(JSON.stringify(l.grid))}"` : ''}${l.columns ? ` data-columns="${escapeXML(JSON.stringify(l.columns))}"` : ''}><clipPath id="ab-${key}"><rect ${box}/></clipPath>` +
      `<rect ${box} ${paintAttr(l.fill, l.fillGradient, 'fill')}/><g clip-path="url(#ab-${key})">${l.children.map(layerSVG).join('')}</g></g>`;
  }

  if (l.image) { // embedded, so the SVG stands alone; mirrored about its center, inside the rotation
    const fl = imageFlip(l), cx = midX(b), cy = midY(b), href = dataURL(l.image.src);
    const rotate = l.rotation ? `rotate(${f((l.rotation * 180) / Math.PI)} ${f(cx)} ${f(cy)})` : '';
    const flip = fl.x < 0 || fl.y < 0 ? `matrix(${fl.x} 0 0 ${fl.y} ${f((1 - fl.x) * cx)} ${f((1 - fl.y) * cy)})` : '';
    const img = (t: string) => `<image x="${f(b.x)}" y="${f(b.y)}" width="${f(b.width)}" height="${f(b.height)}" preserveAspectRatio="none"` +
      `${t ? ` transform="${t}"` : ''} href="${href}"`;
    // a clip is in the unmirrored frame: a mirrored, clipped image keeps the clip on a <g> around it
    if (flip && l.clip.length) return defs.join('') + `<g${attrs}${rotate ? ` transform="${rotate}"` : ''}>${img(flip)}/></g>`;
    return defs.join('') + `${img([rotate, flip].filter(Boolean).join(' '))}${attrs}/>`;
  }

  const fx = attrs; // a text block puts them on the <g> holding its box and its text
  attrs += ` ${paintAttr(l.fill, l.fillGradient, 'fill')}`;
  if (!l.text) attrs += ` ${paintAttr(l.stroke, l.strokeGradient, 'stroke')} stroke-width="${l.strokeWidth}"`; // a text's border is its box's
  // ponytail: inside/outside borders export centered (SVG has no stroke alignment); add a clipPath/mask export if needed
  if (l.dash.length) attrs += ` stroke-dasharray="${l.dash.map(f).join(' ')}"`;
  if (l.lineCap !== 'butt') attrs += ` stroke-linecap="${l.lineCap}"`;
  if (l.lineJoin !== 'miter') attrs += ` stroke-linejoin="${l.lineJoin}"`;
  if (l.rotation !== 0) attrs += ` transform="rotate(${f((l.rotation * 180) / Math.PI)} ${f(midX(b))} ${f(midY(b))})"`;

  if (l.text) { // one <tspan> per line as laid out here (per word when justified), so wrapping looks the same in any viewer
    const t = l.text, anchor = { left: 'start', center: 'middle', right: 'end', justify: 'start' }[t.align];
    const box = textBox(l);
    attrs += ` font-family="${escapeXML(t.font)}" font-size="${f(t.size)}" font-weight="${t.weight}" text-anchor="${anchor}" xml:space="preserve"`;
    if (t.letterSpacing) attrs += ` letter-spacing="${f(t.letterSpacing)}"`;
    const spans = layout(l).flatMap((s) => s.words?.map((w) => ({ ...w, y: s.y })) ?? [s])
      .map((s) => `<tspan x="${f(s.x)}" y="${f(s.y)}">${escapeXML(s.text)}</tspan>`).join('');
    if (!box) return defs.join('') + `<text${attrs}>${spans}</text>`;
    return defs.join('') + `<g${fx}>${layerSVG(box)}<text${attrs.slice(fx.length)}>${spans}</text></g>`;
  }

  const radii = l.kind === 'rect' ? cornerRadii(l) : [];
  const element =
    l.kind === 'rect' && radii.some((r) => r !== radii[0]) ? `<path d="${pathData(localShape(l))}"${attrs}/>` // corners SVG's rx can't say
    : l.kind === 'rect' ? `<rect x="${f(b.x)}" y="${f(b.y)}" width="${f(b.width)}" height="${f(b.height)}"${radii[0] > 0 ? ` rx="${f(radii[0])}"` : ''}${attrs}/>`
    : l.kind === 'ellipse' ? `<ellipse cx="${f(midX(b))}" cy="${f(midY(b))}" rx="${f(b.width / 2)}" ry="${f(b.height / 2)}"${attrs}/>`
    : `<path d="${pathData(l.subpaths)}"${attrs}${l.evenOdd ? ' fill-rule="evenodd"' : ''}/>`;
  return defs.join('') + element;
}

/** userSpaceOnUse gradient in the element's own coordinates (the layer's local space). */
export function gradientDef(g: GradientFill, id: string): string {
  const t = g.transform;
  const m = `matrix(${t.a} ${t.b} ${t.c} ${t.d} ${t.tx} ${t.ty})`;
  const stops = g.stops.map((s) => `<stop offset="${s.offset}" stop-color="${hex(s.color)}" stop-opacity="${s.color.a}"/>`).join('');
  return g.kind === 'linear'
    ? `<linearGradient id="${id}" gradientUnits="userSpaceOnUse" gradientTransform="${m}" x1="${g.start.x}" y1="${g.start.y}" x2="${g.end.x}" y2="${g.end.y}">${stops}</linearGradient>`
    : `<radialGradient id="${id}" gradientUnits="userSpaceOnUse" gradientTransform="${m}" cx="${g.start.x}" cy="${g.start.y}" r="${g.radius}">${stops}</radialGradient>`;
}

const escapeXML = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

/** A standalone SVG whose canvas is `frame` (document units, 1 unit = 1 px), with its size: what PNG/JPG/PDF rasterize or lay out. */
export type Framed = { svg: string; width: number; height: number };

function framed(body: string, b: Rect): Framed {
  const n = (v: number) => +v.toFixed(2);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${n(b.x)} ${n(b.y)} ${n(b.width)} ${n(b.height)}" width="${n(b.width)}" height="${n(b.height)}">\n${body}\n</svg>\n`;
  return { svg, width: b.width, height: b.height };
}

/** `ls` without its hidden layers, at any depth (groups left empty go too): exports leave them out. */
const shown = (ls: Layer[]): Layer[] => ls.filter((l) => !l.hidden)
  .map((l) => (l.children.length ? { ...l, children: shown(l.children) } : l))
  .filter((l) => l.kind !== 'group' || l.children.length);

/** One artboard (exported even when hidden itself): its frame is the canvas. */
export const framedArtboard = (a: Layer) => framed('  ' + layerSVG({ ...a, hidden: false, children: shown(a.children) }), localBounds(a));

/** Visible layers on a canvas fitted to their bounds, plus `padding` all round. */
export function framedLayers(layers: Layer[], padding = 0): Framed {
  layers = shown(layers);
  const u = layers.reduce<Rect | null>((r, l) => union(r, bounds(l)), null);
  return framed(layers.map((l) => '  ' + layerSVG(l)).join('\n'), u ? inset(u, -padding) : { x: 0, y: 0, width: 100, height: 100 });
}

/** Layers on the canvas `frame`, as they sit there: what the eyedropper reads a pixel of. */
export const framedRegion = (layers: Layer[], frame: Rect) => framed(layers.map((l) => '  ' + layerSVG(l)).join('\n'), frame);

export const artboardSVG = (a: Layer) => framedArtboard(a).svg;
export const documentSVG = (layers: Layer[]) => framedLayers(layers, 10).svg;

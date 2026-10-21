import {
  type Affine, type Pt, type Rect, type Subpath, IDENTITY, apply, inset, invert, mapSubpaths, midX, midY,
  pathBounds, pathContains, pt, rectCenter, rectContains, rectOf, rotateAround, sub, union,
} from './geometry';
import { type RGBA, BLACK, GRAY } from './color';
import { type GradientFill, type Shadow, mapGradient } from './effects';
import { parsePath, shapeData } from './path-data';
import { type TextStyle, fitted, glyphOutlines, textScaled } from './text';

export type Kind = 'rect' | 'ellipse' | 'path' | 'group' | 'artboard' | 'text';
export const BORDER_POSITIONS = ['center', 'inside', 'outside'] as const;
export const LINE_CAPS = ['butt', 'round', 'square'] as const;
export const LINE_JOINS = ['miter', 'round', 'bevel'] as const;
export type BorderPosition = (typeof BORDER_POSITIONS)[number];
export type LineCap = (typeof LINE_CAPS)[number];
export type LineJoin = (typeof LINE_JOINS)[number];

/** A shape on the canvas. Geometry is stored unrotated ("local"); `rotation` is applied around the
 *  center of `localBounds` when drawing, hit-testing and exporting.
 *  A group has no geometry or transform of its own: its children are stored in document space and
 *  group-level moves/rotations/resizes are applied to them.
 *  An artboard is a top-level frame: `points` are its corners, `fill` its background; its
 *  children are in document space too, drawn clipped to the frame. It never rotates, and resizing it
 *  changes the frame only, not the content.
 *  New property → add its default in `newLayer` (old files decode with it) and to SVG import/export. */
export type Layer = {
  id: string;
  name: string;
  kind: Kind;
  points: Pt[]; // rect/ellipse: two opposite corners
  subpaths: Subpath[]; // path
  children: Layer[]; // group, bottom to top
  fill: RGBA;
  stroke: RGBA;
  strokeWidth: number;
  borderPosition: BorderPosition;
  dash: number[]; // [dash, gap]; empty = solid
  lineCap: LineCap;
  lineJoin: LineJoin;
  evenOdd: boolean;
  rotation: number; // radians
  lockRatio: boolean; // resize keeps proportions without ⇧ (the padlock)
  hidden: boolean; // not drawn, not clickable on the canvas
  locked: boolean; // selectable, but can't be moved, transformed, edited or deleted
  fillGradient?: GradientFill; // overrides `fill` when set (`fill` keeps a representative color)
  strokeGradient?: GradientFill;
  opacity: number; // whole layer, composited as one
  clip: Subpath[]; // clipping region (SVG mask/clipPath), same space as the geometry; empty = none
  blur: number;
  shadow?: Shadow;
  text?: TextStyle; // text layers only; `points` is the text box (model/text.ts)
};

export function newLayer(name: string, kind: Kind, points: Pt[] = [], extra: Partial<Layer> = {}): Layer {
  return {
    id: crypto.randomUUID(), name, kind, points, subpaths: [], children: [],
    fill: GRAY, stroke: BLACK, strokeWidth: 1, borderPosition: 'center', dash: [], lineCap: 'butt', lineJoin: 'miter',
    evenOdd: false, rotation: 0, lockRatio: false, hidden: false, locked: false, opacity: 1, clip: [], blur: 0,
    ...extra,
  };
}

const EMPTY: Rect = { x: 0, y: 0, width: 0, height: 0 };

export const isContainer = (l: Layer) => l.kind === 'group' || l.kind === 'artboard';

export const newArtboard = (name: string, points: Pt[]) =>
  newLayer(name, 'artboard', points, { fill: { r: 1, g: 1, b: 1, a: 1 }, stroke: { r: 0, g: 0, b: 0, a: 0 }, strokeWidth: 0 });

/** Unrotated bounds of the stored geometry. */
export function localBounds(l: Layer): Rect {
  switch (l.kind) {
    case 'group': return l.children.reduce<Rect | null>((r, c) => union(r, bounds(c)), null) ?? EMPTY;
    case 'path': return pathBounds(l.subpaths) ?? EMPTY;
    default: return rectOf(l.points) ?? EMPTY;
  }
}

/** Axis-aligned bounds of the rotated shape, in document space. */
export const bounds = (l: Layer): Rect =>
  l.rotation === 0 ? localBounds(l) : pathBounds(l.kind === 'text' ? mapSubpaths(boxShape(l), (p) => apply(transform(l), p)) : shape(l)) ?? EMPTY;

/** A text layer's frame is its box, not its glyphs. */
const boxShape = (l: Layer) => parsePath(boxData('rect', localBounds(l)));

/** Rotation pivot, same in both spaces. */
export const center = (l: Layer): Pt => rectCenter(localBounds(l));

export const transform = (l: Layer): Affine => (l.rotation === 0 ? IDENTITY : rotateAround(center(l), l.rotation));
export const toWorld = (l: Layer, p: Pt) => (l.rotation === 0 ? p : apply(transform(l), p));
export const toLocal = (l: Layer, p: Pt) => (l.rotation === 0 ? p : apply(invert(transform(l)), p));

/** Geometry as subpaths in the layer's local space. */
export function localShape(l: Layer): Subpath[] {
  switch (l.kind) {
    case 'group': return l.children.flatMap(shape);
    case 'path': return l.subpaths;
    case 'artboard': return boxShape(l);
    case 'text': return glyphOutlines(l); // what Combine and Convert to Outlines work on
    default: return parsePath(boxData(l.kind, localBounds(l)));
  }
}

/** Geometry in document space. */
export const shape = (l: Layer): Subpath[] => {
  const t = transform(l);
  return l.rotation === 0 ? localShape(l) : mapSubpaths(localShape(l), (p) => apply(t, p));
};

function boxData(kind: 'rect' | 'ellipse', b: Rect) {
  const a = { x: b.x, y: b.y, width: b.width, height: b.height, cx: midX(b), cy: midY(b), rx: b.width / 2, ry: b.height / 2 };
  return shapeData(kind, Object.fromEntries(Object.entries(a).map(([k, v]) => [k, String(v)])))!;
}

/** Clip region in document space, null when the layer isn't clipped. */
export const clipShape = (l: Layer): Subpath[] | null => {
  const t = transform(l);
  return l.clip.length ? mapSubpaths(l.clip, (p) => apply(t, p)) : null;
};

export const hasVisibleStroke = (l: Layer) => l.strokeWidth > 0 && (l.stroke.a > 0 || l.strokeGradient != null);

/** Rect/ellipse converted to an editable Bézier path. */
export function asPath(l: Layer): Layer {
  if (l.kind !== 'rect' && l.kind !== 'ellipse') return l;
  return { ...l, kind: 'path', points: [], subpaths: parsePath(boxData(l.kind, localBounds(l))) };
}

export function mapped(l: Layer, f: (p: Pt) => Pt): Layer {
  return {
    ...l,
    points: l.points.map(f),
    subpaths: mapSubpaths(l.subpaths, f),
    children: l.children.map((c) => mapped(c, f)),
    clip: mapSubpaths(l.clip, f),
    fillGradient: l.fillGradient && mapGradient(l.fillGradient, f),
    strokeGradient: l.strokeGradient && mapGradient(l.strokeGradient, f),
  };
}

/** Moving local geometry by d moves the rendered shape by d too, whatever the rotation. */
export const moved = (l: Layer, d: Pt) => mapped(l, (p) => pt(p.x + d.x, p.y + d.y));

/** After a local edit the rotation pivot (bounds center) shifts; this puts untouched geometry back where it was on screen. */
export const keepingPlace = (l: Layer, original: Layer) => moved(l, sub(toWorld(original, pt(0, 0)), toWorld(l, pt(0, 0))));

/** A text layer after a change to its content or style: box fitted to the lines, rotated text kept in place. */
export const refit = (l: Layer, original: Layer) => keepingPlace(fitted(l), original);

/** Document-space vector expressed in the layer's local (unrotated) frame. */
export function localDelta(l: Layer, d: Pt): Pt {
  const cs = Math.cos(l.rotation), sn = Math.sin(l.rotation);
  return pt(d.x * cs + d.y * sn, -d.x * sn + d.y * cs);
}

/** Canvas picking, `p` in document space. Hidden layers are never hit (they stay selectable from the list). */
export function hit(l: Layer, p: Pt, tol: number): boolean {
  if (l.hidden) return false;
  if (l.kind === 'group') return l.children.some((c) => hit(c, p, tol));
  if (l.kind === 'artboard') return rectContains(localBounds(l), p) && l.children.some((c) => hit(c, p, tol)); // content is clipped; the background is picked by its name
  const q = toLocal(l, p);
  if (l.kind === 'text') return rectContains(inset(localBounds(l), -tol), q); // the box, not just the glyphs
  return l.fill.a > 0 ? pathContains(localShape(l), q, l.evenOdd) : rectContains(inset(localBounds(l), -tol), q);
}

// MARK: Border

/** Inside/outside only make sense on closed shapes; open paths always stroke centered. */
export const isClosed = (l: Layer) => l.kind !== 'path' || l.subpaths.some((s) => s.closed);
export const effectiveBorderPosition = (l: Layer): BorderPosition => (isClosed(l) ? l.borderPosition : 'center');
/** Inside/outside strokes are drawn at twice the width, then clipped to the shape or its outside. */
export const drawnStrokeWidth = (l: Layer) => (effectiveBorderPosition(l) === 'center' ? l.strokeWidth : l.strokeWidth * 2);

// MARK: Whole-layer transforms (also work on groups: applied to each child)

const rotatePoint = (p: Pt, g: Pt, a: number) => {
  const cs = Math.cos(a), sn = Math.sin(a);
  return pt(g.x + (p.x - g.x) * cs - (p.y - g.y) * sn, g.y + (p.x - g.x) * sn + (p.y - g.y) * cs);
};
const scalePoint = (p: Pt, a: Pt, sx: number, sy: number) => pt(a.x + (p.x - a.x) * sx, a.y + (p.y - a.y) * sy);

/** A group's own clip is in document space and follows group-level transforms. */
const mappingClip = (l: Layer, f: (p: Pt) => Pt): Layer => ({ ...l, clip: mapSubpaths(l.clip, f) });

/** Rotates around document point `g`. A non-group keeps its geometry and gains `rotation`. */
export function rotated(l: Layer, a: number, g: Pt): Layer {
  if (l.kind === 'artboard') return l;
  if (l.kind === 'group') {
    return { ...mappingClip(l, (p) => rotatePoint(p, g, a)), children: l.children.map((c) => rotated(c, a, g)) };
  }
  const c = center(l);
  const m = moved(l, sub(rotatePoint(c, g, a), c));
  return { ...m, rotation: m.rotation + a };
}

/** Borders follow a resize: width and dashes scale by the mean of the two factors (√|sx·sy|). */
export function strokeScaled(l: Layer, sx: number, sy: number): Layer {
  const k = Math.sqrt(Math.abs(sx * sy));
  return k === 1 ? l : { ...l, strokeWidth: l.strokeWidth * k, dash: l.dash.map((d) => d * k) };
}

/** Scales in the layer's own frame about local point `a` (a group's frame is the document). */
export function resized(l: Layer, sx: number, sy: number, a: Pt): Layer {
  if (l.kind === 'group') return scaled(l, sx, sy, a);
  if (l.kind === 'artboard') return { ...l, points: l.points.map((p) => scalePoint(p, a, sx, sy)) }; // the frame, not the content
  if (l.kind === 'text') { // proportional: the type scales; otherwise the box width changes and the lines rewrap
    const t = l.text!, k = Math.abs(sx);
    if (k === Math.abs(sy)) {
      return keepingPlace(strokeScaled({ ...mapped(l, (p) => scalePoint(p, a, k, k)), text: { ...t, size: t.size * k, letterSpacing: t.letterSpacing * k } }, k, k), l);
    }
    return sx === 1 ? l : refit({ ...mapped(l, (p) => scalePoint(p, a, sx, 1)), text: { ...t, autoWidth: false } }, l);
  }
  return keepingPlace(strokeScaled(mapped(l, (p) => scalePoint(p, a, sx, sy)), sx, sy), l);
}

/** Scales in document space about document point `a`. */
// ponytail: a rotated child under a non-uniform scale is scaled along its own axes (approximation);
// exact would need skew. Uniform scales (the default, proportional resize) are exact.
export function scaled(l: Layer, sx: number, sy: number, a: Pt): Layer {
  if (l.kind === 'artboard') return resized(l, sx, sy, a);
  if (l.kind === 'group') {
    return { ...mappingClip(l, (p) => scalePoint(p, a, sx, sy)), children: l.children.map((c) => scaled(c, sx, sy, a)) };
  }
  const c = center(l), s = strokeScaled(l, sx, sy);
  if (l.kind === 'text') return moved(textScaled(s, Math.sqrt(Math.abs(sx * sy))), sub(scalePoint(c, a, sx, sy), c)); // keeps its proportions
  if (l.rotation === 0) return mapped(s, (p) => scalePoint(p, a, sx, sy));
  return moved(mapped(s, (p) => scalePoint(p, c, sx, sy)), sub(scalePoint(c, a, sx, sy), c));
}

/** Mirrors across the vertical (`horizontal`) or horizontal line through document coordinate `axis`.
 *  Exact under rotation: the local geometry is mirrored about its center and the rotation negated.
 *  Text moves but its glyphs aren't mirrored; artboards don't flip. */
export function flipped(l: Layer, horizontal: boolean, axis: number): Layer {
  const f = (p: Pt) => (horizontal ? pt(2 * axis - p.x, p.y) : pt(p.x, 2 * axis - p.y));
  if (l.kind === 'artboard') return l;
  if (l.kind === 'group') return { ...mappingClip(l, f), children: l.children.map((c) => flipped(c, horizontal, axis)) };
  const c = center(l), to = sub(f(c), c);
  if (l.kind === 'text') return moved(l, to);
  const own = (p: Pt) => (horizontal ? pt(2 * c.x - p.x, p.y) : pt(p.x, 2 * c.y - p.y));
  return moved({ ...mapped(l, own), rotation: -l.rotation }, to);
}

/** Handle drag → scale factors and fixed point, in the layer's local frame.
 *  `handle` is in unit coordinates of `b` (0, 0.5, 1); `d` is the drag in local space.
 *  `proportional`: ⇧ or the layer's ratio lock; `fromCenter`: ⌥. */
export function resizeGesture(b: Rect, h: Pt, d: Pt, { proportional = false, fromCenter = false } = {}) {
  const dx = h.x * 2 - 1, dy = h.y * 2 - 1; // -1, 0, 1: which edge moves
  const k = fromCenter ? 2 : 1; // from the center, both opposite edges move
  let sx = dx === 0 || b.width === 0 ? 1 : (b.width + k * dx * d.x) / b.width;
  let sy = dy === 0 || b.height === 0 ? 1 : (b.height + k * dy * d.y) / b.height;
  if (proportional) {
    if (dx === 0) sx = Math.abs(sy);
    else if (dy === 0) sy = Math.abs(sx);
    else {
      const s = Math.max(Math.abs(sx), Math.abs(sy));
      [sx, sy] = [sx < 0 ? -s : s, sy < 0 ? -s : s];
    }
  }
  const anchor = fromCenter ? rectCenter(b) : pt(b.x + (1 - h.x) * b.width, b.y + (1 - h.y) * b.height); // opposite handle
  return { sx, sy, anchor };
}

import { type Affine, type Pt, type Rect, IDENTITY, apply, mapAffine, pt } from './geometry';
import { type RGBA, css } from './color';

/** Linear or radial gradient. Geometry is in "gradient space"; `transform` maps it to the layer's
 *  local space (like SVG's gradientTransform, with objectBoundingBox already resolved). */
export type GradientFill = {
  kind: 'linear' | 'radial';
  stops: { offset: number; color: RGBA }[]; // offset 0…1
  start: Pt; // linear: first point; radial: center
  end: Pt; // linear: second point
  radius: number; // radial
  transform: Affine;
};

export const gradient = (g: Omit<GradientFill, 'radius' | 'transform'> & Partial<GradientFill>): GradientFill =>
  ({ radius: 0, transform: IDENTITY, ...g });

export const mapGradient = (g: GradientFill, f: (p: Pt) => Pt): GradientFill => ({ ...g, transform: mapAffine(g.transform, f) });

// MARK: Editing (the color panel)

export type Stop = GradientFill['stops'][number];

export const sortStops = (stops: Stop[]) => stops.toSorted((a, b) => a.offset - b.offset);

/** Color of the gradient at `offset`, interpolated between the surrounding stops (sorted). */
export function colorAt(stops: Stop[], offset: number): RGBA {
  const s = sortStops(stops);
  const j = s.findIndex((x) => x.offset >= offset);
  if (j <= 0) return { ...(j === 0 ? s[0] : s[s.length - 1]).color };
  const a = s[j - 1], b = s[j], t = b.offset === a.offset ? 0 : (offset - a.offset) / (b.offset - a.offset);
  const mix = (k: 'r' | 'g' | 'b' | 'a') => a.color[k] + (b.color[k] - a.color[k]) * t;
  return { r: mix('r'), g: mix('g'), b: mix('b'), a: mix('a') };
}

/** Linear gradient across `b` (the layer's local bounds) at a CSS angle: 0° points up, 180° = top to bottom.
 *  Like CSS, it spans the box exactly along that direction. */
export function linearAt(deg: number, b: Rect, stops: Stop[]): GradientFill {
  const a = (deg * Math.PI) / 180, ux = Math.sin(a), uy = -Math.cos(a);
  const half = (Math.abs(b.width * ux) + Math.abs(b.height * uy)) / 2, cx = b.x + b.width / 2, cy = b.y + b.height / 2;
  return gradient({ kind: 'linear', stops: sortStops(stops), start: pt(cx - ux * half, cy - uy * half), end: pt(cx + ux * half, cy + uy * half) });
}

/** Radial gradient filling `b`: an ellipse from its center to its edges. */
export const radialIn = (b: Rect, stops: Stop[]): GradientFill =>
  gradient({ kind: 'radial', stops: sortStops(stops), start: pt(0, 0), end: pt(0, 0), radius: 1,
    transform: { a: b.width / 2, b: 0, c: 0, d: b.height / 2, tx: b.x + b.width / 2, ty: b.y + b.height / 2 } });

/** CSS angle of a linear gradient, measured in layer space. */
export function angleOf(g: GradientFill): number {
  const s = apply(g.transform, g.start), e = apply(g.transform, g.end);
  const deg = (Math.atan2(e.x - s.x, -(e.y - s.y)) * 180) / Math.PI;
  return ((Math.round(deg * 10) / 10) % 360 + 360) % 360;
}

/** CSS background previewing the gradient (swatches, the stops bar). */
export function gradientCSS(g: GradientFill, kind: 'as-is' | 'bar' = 'as-is'): string {
  const stops = sortStops(g.stops).map((s) => `${css(s.color)} ${s.offset * 100}%`).join(', ');
  if (kind === 'bar') return `linear-gradient(to right, ${stops})`;
  return g.kind === 'linear' ? `linear-gradient(${angleOf(g)}deg, ${stops})` : `radial-gradient(${stops})`;
}

/** Drop shadow. */
export type Shadow = { x: number; y: number; blur: number; color: RGBA };
export const defaultShadow = (): Shadow => ({ x: 0, y: 2, blur: 4, color: { r: 0, g: 0, b: 0, a: 0.5 } });

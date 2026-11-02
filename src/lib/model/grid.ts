import { type Pt, type Rect, pt } from './geometry';

/** An artboard's square grid (`grid` on the artboard; none when unset): squares of `size` from the frame's
 *  top-left corner, a stronger line every `major` squares (0: none). Drawn on the canvas only, never exported. */
export type Grid = { size: number; major: number };
/** An artboard's layout columns (`columns`; none when unset): `count` columns separated by `gutter`,
 *  `margin` in from the left and right edges. */
export type Columns = { count: number; gutter: number; margin: number };

export const defaultGrid = (): Grid => ({ size: 8, major: 8 });
export const defaultColumns = (): Columns => ({ count: 6, gutter: 16, margin: 16 });

/** Left and right edges of each layout column. */
export function columnEdges(frame: Rect, c: Columns): [number, number][] {
  if (c.count < 1) return [];
  const w = (frame.width - 2 * c.margin - (c.count - 1) * c.gutter) / c.count;
  if (w <= 0) return [];
  return Array.from({ length: c.count }, (_, i) => {
    const x = frame.x + c.margin + i * (w + c.gutter);
    return [x, x + w];
  });
}

const MIN_PX = 6; // lines closer than this on screen are left out: a solid tint says nothing

/** Path data of the square grid inside `frame` at `zoom`: minor and major lines apart (drawn differently). */
export function gridLines(frame: Rect, g: Grid, zoom: number): { minor: string; major: string } {
  let minor = '', major = '';
  if (g.size <= 0) return { minor, major };
  const showMinor = g.size * zoom >= MIN_PX, showMajor = g.major > 0 && g.size * g.major * zoom >= MIN_PX;
  const each = (length: number, line: (at: number) => string) => {
    for (let k = 1; k * g.size < length; k++) {
      const isMajor = g.major > 0 && k % g.major === 0;
      if (isMajor ? showMajor : showMinor) {
        if (isMajor) major += line(k * g.size);
        else minor += line(k * g.size);
      }
    }
  };
  const { x, y, width, height } = frame;
  each(width, (d) => `M${x + d} ${y}V${y + height}`);
  each(height, (d) => `M${x} ${y + d}H${x + width}`);
  return { minor, major };
}

/** Offset that brings an edge of `r` onto the closest grid line or column edge of artboard `a` within `tol`,
 *  per axis (0 when none is in reach). Columns are vertical: they only pull on x. */
export function snapToGrid(r: Rect, frame: Rect, a: { grid?: Grid; columns?: Columns }, tol: number, axes = { x: true, y: true }): Pt {
  const best = (own: number[], origin: number, extra: number[]) => {
    let d = 0, gap = tol;
    for (const o of own) {
      const s = a.grid?.size ?? 0, lines = s > 0 ? [origin + Math.round((o - origin) / s) * s, ...extra] : extra;
      for (const v of lines) if (Math.abs(v - o) <= gap) [gap, d] = [Math.abs(v - o), v - o];
    }
    return d;
  };
  return pt(
    axes.x ? best([r.x, r.x + r.width], frame.x, a.columns ? columnEdges(frame, a.columns).flat() : []) : 0,
    axes.y ? best([r.y, r.y + r.height], frame.y, []) : 0,
  );
}

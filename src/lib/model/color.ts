export type RGBA = { r: number; g: number; b: number; a: number };

export const CLEAR: RGBA = { r: 0, g: 0, b: 0, a: 0 };
export const BLACK: RGBA = { r: 0, g: 0, b: 0, a: 1 };
export const GRAY: RGBA = { r: 0.85, g: 0.86, b: 0.9, a: 1 };
/** Fill of a newly drawn rectangle or oval: #FF6F00 at 70 %. */
export const SHAPE_FILL: RGBA = { r: 1, g: 0x6f / 255, b: 0, a: 0.7 };

export const eqColor = (x: RGBA, y: RGBA) => x.r === y.r && x.g === y.g && x.b === y.b && x.a === y.a;

const byte = (v: number) => Math.trunc(v * 255).toString(16).toUpperCase().padStart(2, '0');
export const hex = (c: RGBA) => `#${byte(c.r)}${byte(c.g)}${byte(c.b)}`;
export const css = (c: RGBA) => `rgb(${c.r * 255} ${c.g * 255} ${c.b * 255} / ${c.a})`;

/** "#RGB", "#RRGGBB" or "#RRGGBBAA", with or without "#". */
export function fromHex(s: string): RGBA | null {
  s = s.trim().replace(/^#/, '');
  if (s.length === 3) s = [...s].map((c) => c + c).join('');
  if ((s.length !== 6 && s.length !== 8) || !/^[0-9a-f]+$/i.test(s)) return null;
  if (s.length === 6) s += 'FF';
  const v = (i: number) => parseInt(s.slice(i, i + 2), 16) / 255;
  return { r: v(0), g: v(2), b: v(4), a: v(6) };
}

// HSB (the custom color picker works in HSB)

export function fromHSV(h: number, s: number, v: number, a = 1): RGBA {
  const i = Math.floor(h * 6) % 6, f = h * 6 - Math.floor(h * 6);
  const p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  const [r, g, b] = [[v, t, p], [q, v, p], [p, v, t], [p, q, v], [t, p, v], [v, p, q]][i];
  return { r, g, b, a };
}

/** Hue, saturation, brightness in 0…1. Hue is 0 for grays. */
export function hsv({ r, g, b }: RGBA): { h: number; s: number; v: number } {
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn;
  if (d <= 0) return { h: 0, s: 0, v: mx };
  let h = mx === r ? (g - b) / d : mx === g ? 2 + (b - r) / d : 4 + (r - g) / d;
  h /= 6;
  if (h < 0) h += 1;
  return { h, s: d / mx, v: mx };
}

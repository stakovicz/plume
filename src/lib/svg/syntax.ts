import { type Affine, IDENTITY, concat, rotate, scale, translate } from '$lib/model/geometry';
import { type RGBA, CLEAR, BLACK } from '$lib/model/color';
import { tokens } from '$lib/model/path-data';

/** SVG micro-syntaxes: transforms, colors, strict numbers. */

/** Strict number ("0.5"); empty or garbage → null. */
export function strict(s: string | undefined): number | null {
  if (s == null || s.trim() === '') return null;
  const v = Number(s);
  return Number.isNaN(v) ? null : v;
}

export function parseTransform(s: string): Affine {
  let t = IDENTITY;
  for (const m of s.matchAll(/(\w+)\s*\(([^)]*)\)/g)) {
    const v = tokens(m[2]).map(Number).filter((x) => !Number.isNaN(x));
    if (!v.length) continue;
    let f: Affine;
    switch (m[1]) {
      case 'matrix':
        if (v.length !== 6) continue;
        f = { a: v[0], b: v[1], c: v[2], d: v[3], tx: v[4], ty: v[5] };
        break;
      case 'translate': f = translate(v[0], v[1] ?? 0); break;
      case 'scale': f = scale(v[0], v[1] ?? v[0]); break;
      case 'rotate': {
        const r = rotate((v[0] * Math.PI) / 180);
        f = v.length === 3 ? concat(concat(translate(-v[1], -v[2]), r), translate(v[1], v[2])) : r;
        break;
      }
      case 'skewX': f = { ...IDENTITY, c: Math.tan((v[0] * Math.PI) / 180) }; break;
      case 'skewY': f = { ...IDENTITY, b: Math.tan((v[0] * Math.PI) / 180) }; break;
      default: continue;
    }
    t = concat(f, t); // "A B" applies B first, then A
  }
  return t;
}

const named: Record<string, number> = {
  black: 0x000000, white: 0xffffff, red: 0xff0000, green: 0x008000, blue: 0x0000ff,
  gray: 0x808080, grey: 0x808080, yellow: 0xffff00, orange: 0xffa500, purple: 0x800080,
  currentcolor: 0x000000,
};

export function paint(s: string, alpha: number): RGBA {
  s = s.trim().toLowerCase();
  if (s === 'none' || s === 'transparent') return CLEAR;
  const split = (v: number) => [v >> 16, (v >> 8) & 0xff, v & 0xff].map((x) => x / 255);
  let rgb: number[];
  if (s.startsWith('#')) {
    let h = s.slice(1);
    if (h.length === 3) h = [...h].map((c) => c + c).join('');
    rgb = split(parseInt(h.slice(0, 6), 16) || 0);
  } else if (s.startsWith('rgb')) {
    rgb = tokens(s).map(Number).filter((x) => !Number.isNaN(x)).slice(0, 3).map((x) => x / 255);
  } else if (s in named) {
    rgb = split(named[s]);
  } else {
    return { r: 0.5, g: 0.5, b: 0.5, a: alpha }; // url(#gradient) and unknown names
  }
  if (rgb.length !== 3) return BLACK;
  return { r: rgb[0], g: rgb[1], b: rgb[2], a: alpha };
}

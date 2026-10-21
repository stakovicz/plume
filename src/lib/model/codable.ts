import type { RGBA } from './color';
import { type Layer, newLayer } from './layer';

/** On-disk format: `{ layers, palette }`, points as `[x, y]`.
 *  Files saved before the palette existed are a bare `[Layer]` array. */
export type DocFile = { layers: Layer[]; palette: RGBA[] };

const isPt = (v: unknown): v is { x: number; y: number } =>
  typeof v === 'object' && v !== null && !Array.isArray(v) && Object.keys(v).length === 2 && 'x' in v && 'y' in v;

/** Numbers are written to 3 decimals: a thousandth of a pixel, invisible even at the 6400 % zoom, and colors
 *  and opacity stay exact to 8 bits. Angles and gradients (unit space, scaled up by `transform`) keep 6. */
const FINE = new Set(['rotation', 'fillGradient', 'strokeGradient']);
function rounded(v: unknown, digits = 3): unknown {
  if (typeof v === 'number') return Math.round(v * 10 ** digits) / 10 ** digits || 0; // || 0: no -0
  if (Array.isArray(v)) return v.map((x) => rounded(x, digits));
  if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, rounded(x, FINE.has(k) ? 6 : digits)]));
  return v;
}

export const encodeFile = (f: DocFile) => JSON.stringify(rounded(f), (_, v) => (isPt(v) ? [v.x, v.y] : v));

// ponytail: any `[number, number]` becomes a point except under `dash`; name the key here if another numeric pair is added
const revive = (key: string, v: unknown) =>
  key !== 'dash' && Array.isArray(v) && v.length === 2 && typeof v[0] === 'number' && typeof v[1] === 'number'
    ? { x: v[0], y: v[1] }
    : v;

/** Tolerant decoding: properties added after a file was saved fall back to their defaults. */
function decodeLayer(raw: any): Layer {
  if (typeof raw?.name !== 'string' || typeof raw?.kind !== 'string') throw new Error('Not a layer');
  const l = newLayer(raw.name, raw.kind);
  return { ...l, ...raw, id: raw.id ?? l.id, children: (raw.children ?? []).map(decodeLayer) };
}

export function decodeFile(text: string): DocFile {
  const raw = JSON.parse(text, revive);
  const file = Array.isArray(raw) ? { layers: raw, palette: [] } : raw;
  if (!Array.isArray(file?.layers)) throw new Error('Not a Plume document');
  return { layers: file.layers.map(decodeLayer), palette: file.palette ?? [] };
}

import type { RGBA } from './color';
import { type Layer, newLayer } from './layer';

/** On-disk format: `{ layers, palette }`, points as `[x, y]`.
 *  Files saved before the palette existed are a bare `[Layer]` array. */
export type DocFile = { layers: Layer[]; palette: RGBA[] };

const isPt = (v: object): v is { x: number; y: number } => 'x' in v && 'y' in v && Object.keys(v).length === 2;

/** Numbers are written to 3 decimals: a thousandth of a pixel, invisible even at the 6400 % zoom, and colors
 *  and opacity stay exact to 8 bits. Angles and gradients (unit space, scaled up by `transform`) keep 6.
 *  One pass that also turns points into pairs: documents are megabytes. */
const FINE = new Set(['rotation', 'fillGradient', 'strokeGradient']);
function encoded(v: unknown, k = 1e3): unknown {
  if (typeof v === 'number') return Math.round(v * k) / k || 0; // || 0: no -0
  if (Array.isArray(v)) return v.map((x) => encoded(x, k));
  if (!v || typeof v !== 'object') return v;
  if (isPt(v)) return [encoded(v.x, k), encoded(v.y, k)];
  const out: Record<string, unknown> = {};
  for (const [key, x] of Object.entries(v)) out[key] = encoded(x, FINE.has(key) ? 1e6 : k);
  return out;
}

export const encodeFile = (f: DocFile) => JSON.stringify(encoded(f));

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

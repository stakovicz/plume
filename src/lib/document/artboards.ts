import { type Pt, type Rect, rectCenter, rectContains } from '$lib/model/geometry';
import { type Layer, bounds, localBounds } from '$lib/model/layer';

/** Artboards are top-level only. Layers live either at the top level or directly
 *  in an artboard; a layer whose center sits on an artboard belongs to it. */

export const artboards = (layers: Layer[]) => layers.filter((l) => l.kind === 'artboard');

/** Topmost visible artboard whose frame contains `p`. */
export const artboardAt = (layers: Layer[], p: Pt, except?: string) =>
  artboards(layers).findLast((a) => a.id !== except && !a.hidden && rectContains(localBounds(a), p)) ?? null;

/** Where a layer dropped at its current place belongs: the artboard under its center, or the top level. */
export const homeOf = (layers: Layer[], l: Layer) => artboardAt(layers, rectCenter(bounds(l)), l.id);

export const inside = (r: Rect, frame: Rect) =>
  r.x >= frame.x && r.y >= frame.y && r.x + r.width <= frame.x + frame.width && r.y + r.height <= frame.y + frame.height;

/** Sizes offered by the artboard tool and the inspector: generic screen and paper formats, no device or brand.
 *  Names are format names, not translated. */
export const PRESETS: { group: 'Desktop' | 'Paper'; name: string; width: number; height: number }[] = [
  { group: 'Desktop', name: 'Desktop', width: 1440, height: 1024 },
  { group: 'Desktop', name: 'Full HD', width: 1920, height: 1080 },
  { group: 'Paper', name: 'A4', width: 595, height: 842 },
  { group: 'Paper', name: 'Letter', width: 612, height: 792 },
];

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

/** Sizes offered by the artboard tool and the inspector. Names are product names, not translated. */
export const PRESETS: { group: 'Phone' | 'Tablet' | 'Desktop' | 'Paper' | 'Social'; name: string; width: number; height: number }[] = [
  { group: 'Phone', name: 'iPhone 16', width: 393, height: 852 },
  { group: 'Phone', name: 'iPhone 16 Pro Max', width: 440, height: 956 },
  { group: 'Phone', name: 'Android', width: 412, height: 917 },
  { group: 'Tablet', name: 'iPad', width: 820, height: 1180 },
  { group: 'Tablet', name: 'iPad Pro 13"', width: 1032, height: 1376 },
  { group: 'Desktop', name: 'Desktop', width: 1440, height: 1024 },
  { group: 'Desktop', name: 'Full HD', width: 1920, height: 1080 },
  { group: 'Paper', name: 'A4', width: 595, height: 842 },
  { group: 'Paper', name: 'Letter', width: 612, height: 792 },
  { group: 'Social', name: 'Instagram post', width: 1080, height: 1080 },
  { group: 'Social', name: 'Story', width: 1080, height: 1920 },
];

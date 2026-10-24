import { L } from '$lib/i18n';
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
 *  Names are format names, not translated (but Square, a plain word). */
export const PRESETS: { group: 'Screen' | 'Paper'; name: string; width: number; height: number }[] = [
  { group: 'Screen', name: 'HD', width: 1280, height: 720 },
  { group: 'Screen', name: 'Desktop', width: 1440, height: 1024 },
  { group: 'Screen', name: 'Full HD', width: 1920, height: 1080 },
  { group: 'Screen', name: 'QHD', width: 2560, height: 1440 },
  { group: 'Screen', name: '4K UHD', width: 3840, height: 2160 },
  { group: 'Screen', name: L('Square'), width: 1080, height: 1080 },
  // paper in points (1 pt = 1 px, as PDF export writes them)
  { group: 'Paper', name: 'A5', width: 420, height: 595 },
  { group: 'Paper', name: 'A4', width: 595, height: 842 },
  { group: 'Paper', name: 'A3', width: 842, height: 1191 },
  { group: 'Paper', name: 'Letter', width: 612, height: 792 },
  { group: 'Paper', name: 'Legal', width: 612, height: 1008 },
];

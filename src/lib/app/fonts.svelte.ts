import { isTauri, invoke } from '@tauri-apps/api/core';
import { base } from '$app/paths';
import type { Layer } from '$lib/model/layer';
import { FONTS, familyOf, hasFamily, registerFont, trueTypeFace } from '$lib/model/text';

/** The bundled fonts (static/fonts), loaded once at launch: registered with the model (measuring, outlines),
 *  with the page (canvas, text field), and kept for exports (PNG/JPG embed them, PDF registers them).
 *  Installed fonts (Tauri only) are listed at launch and registered with the model when a layer uses them;
 *  the web view draws them itself, exports get their faces as TrueType files (none for .otf: Times in PDF). */

export type FontFile = { family: string; weight: number; file: string; data: ArrayBuffer | Uint8Array };

const files: FontFile[] = [];

/** Settles once every font is loaded or failed (a missing font falls back to an estimate, not a blank canvas). */
export const fontsReady: Promise<void> = Promise.allSettled(
  FONTS.flatMap((f) => Object.entries(f.files).map(async ([w, file]) => {
    const data = await (await fetch(`${base}/fonts/${file}`)).arrayBuffer();
    registerFont(f.family, +w, data);
    document.fonts.add(new FontFace(f.family, data, { weight: w }));
    files.push({ family: f.family, weight: +w, file, data });
  })),
).then(() => {});

type SystemFont = { family: string; weight: number; path: string; index: number };
const installed = new Map<string, SystemFont[]>();
const loading = new Map<string, Promise<void>>();

/** Installed families (not bundled), sorted; `loaded` counts the ones registered since launch (the canvas
 *  redraws with their metrics). */
export const systemFonts = $state({ families: [] as string[], loaded: 0 });

if (isTauri()) {
  invoke<SystemFont[]>('system_fonts').then((list) => {
    for (const f of list) if (!FONTS.some((b) => b.family === f.family)) installed.set(f.family, [...(installed.get(f.family) ?? []), f]);
    systemFonts.families = [...installed.keys()].sort((a, b) => a.localeCompare(b));
  }, () => {});
}

/** Registers an installed family's faces nearest to regular and bold; no-op for a bundled, loaded or unknown one.
 *  ponytail: two faces per family (the weights text has); load more when text gets other weights. */
export function loadFamily(family: string): Promise<void> {
  const faces = installed.get(family);
  if (!faces || hasFamily(family)) return Promise.resolve();
  if (!loading.has(family)) {
    const nearest = (w: number) => faces.reduce((a, b) => (Math.abs(b.weight - w) < Math.abs(a.weight - w) ? b : a));
    const bytes = new Map<string, Promise<ArrayBuffer>>(); // a collection holds both faces: read it once
    // regular and bold may be one face (then embedded as both, so PDF bold text keeps the family)
    loading.set(family, Promise.allSettled([400, 700].map(async (w) => {
      const f = nearest(w);
      if (!bytes.has(f.path)) bytes.set(f.path, invoke<ArrayBuffer>('read_bytes', { path: f.path }));
      const data = new Uint8Array(await bytes.get(f.path)!);
      registerFont(family, f.weight, data, f.index);
      const face = trueTypeFace(data, f.index);
      if (face) files.push({ family, weight: w, file: `${family}-${w}.ttf`, data: face });
    })).then(() => { if (hasFamily(family)) systemFonts.loaded++; }));
  }
  return loading.get(family)!;
}

/** Loads the installed families the layers use. */
export function loadUsedFonts(ls: Layer[]) {
  for (const l of ls) {
    if (l.text) loadFamily(familyOf(l.text.font));
    loadUsedFonts(l.children);
  }
}

/** Bundled fonts a standalone SVG uses (as written by svg/export). */
export const fontsIn = (svg: string) => files.filter((f) => svg.includes(`font-family="${f.family}"`));

export function base64(data: ArrayBuffer | Uint8Array) {
  const bytes = data instanceof Uint8Array ? data : new Uint8Array(data);
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}

import { FONTS, registerFont } from '$lib/model/text';

/** The bundled fonts (static/fonts), loaded once at launch: registered with the model (measuring, outlines),
 *  with the page (canvas, text field), and kept for exports (PNG/JPG embed them, PDF registers them). */

export type FontFile = { family: string; weight: number; file: string; data: ArrayBuffer };

const files: FontFile[] = [];

/** Settles once every font is loaded or failed (a missing font falls back to an estimate, not a blank canvas). */
export const fontsReady: Promise<void> = Promise.allSettled(
  FONTS.flatMap((f) => Object.entries(f.files).map(async ([w, file]) => {
    const data = await (await fetch(`/fonts/${file}`)).arrayBuffer();
    registerFont(f.family, +w, data);
    document.fonts.add(new FontFace(f.family, data, { weight: w }));
    files.push({ family: f.family, weight: +w, file, data });
  })),
).then(() => {});

/** Bundled fonts a standalone SVG uses (as written by svg/export). */
export const fontsIn = (svg: string) => files.filter((f) => svg.includes(`font-family="${f.family}"`));

export function base64(data: ArrayBuffer) {
  const bytes = new Uint8Array(data);
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}

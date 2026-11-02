/** Bitmap images placed in a document (PNG, JPEG, WebP, GIF). A layer keeps only a key (`Layer.image.src`,
 *  "<hash>.<ext>"); the bytes live here for the session, so undo snapshots stay small and an image placed twice
 *  is kept once. Never dropped while the app runs: undo may bring back a layer that uses one. On disk they are
 *  `.plm` entries `images/<key>` (`packFile`), only those the layers use. */

export type ImageType = 'image/png' | 'image/jpeg' | 'image/webp' | 'image/gif';
/** A placed image: its key and its size in pixels. */
export type ImageRef = { src: string; width: number; height: number };

const EXT: Record<ImageType, string> = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp', 'image/gif': 'gif' };
type Stored = { bytes: Uint8Array; type: ImageType; url?: string };
// one store across hot reloads in development: a reloaded copy of this module would otherwise start empty, and the
// canvas and the exports could each be reading a different one
const store: Map<string, Stored> = import.meta.hot ? (import.meta.hot.data.store ??= new Map()) : new Map();

/** Stores the bytes of an image file; null if they aren't one of the supported formats. */
export function addImage(bytes: Uint8Array): ImageRef | null {
  const info = imageInfo(bytes);
  if (!info) return null;
  const src = `${hash(bytes)}.${EXT[info.type]}`;
  if (!store.has(src)) store.set(src, { bytes, type: info.type });
  return { src, width: info.width, height: info.height };
}

/** Stores bytes under a key read from a file (a `.plm` entry, the clipboard). */
export function putImage(src: string, bytes: Uint8Array) {
  const info = imageInfo(bytes);
  if (info && !store.has(src)) store.set(src, { bytes, type: info.type });
}

export const imageBytes = (src: string) => store.get(src)?.bytes ?? null;

/** For drawing on the canvas: a `blob:` URL, made once per image. Empty when the bytes are missing. */
export function imageURL(src: string): string {
  const s = store.get(src);
  if (!s) return '';
  s.url ??= URL.createObjectURL(new Blob([s.bytes as Uint8Array<ArrayBuffer>], { type: s.type }));
  return s.url;
}

/** For standalone SVG (export, clipboard): the image as a `data:` URL. Empty when the bytes are missing. */
export function dataURL(src: string): string {
  const s = store.get(src);
  return s ? `data:${s.type};base64,${base64(s.bytes)}` : '';
}

/** `data:image/…;base64,…` → bytes; null for anything else (percent-encoded data, http URLs, files). */
export function fromDataURL(url: string): Uint8Array | null {
  const m = url.trim().match(/^data:[^,;]*(?:;[^,;]*)*;base64,(.*)$/s);
  if (!m) return null;
  try {
    return Uint8Array.from(atob(m[1].replace(/\s+/g, '')), (c) => c.charCodeAt(0));
  } catch {
    return null;
  }
}

/** The keys of the images used by `layers` and their children. */
export function imagesUsed(layers: { image?: ImageRef; children: unknown[] }[], into = new Set<string>()): Set<string> {
  for (const l of layers) {
    if (l.image) into.add(l.image.src);
    imagesUsed(l.children as typeof layers, into);
  }
  return into;
}

export function base64(data: ArrayBuffer | Uint8Array) {
  const bytes = data instanceof Uint8Array ? data : new Uint8Array(data);
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}

// ponytail: 53-bit hash, not SHA-256 (synchronous, so SVG import and .plm reading stay synchronous); the byte
// length in the key makes a collision between two images of one document practically impossible
function hash(b: Uint8Array) {
  let h1 = 0xdeadbeef, h2 = 0x41c6ce57;
  for (let i = 0; i < b.length; i++) {
    h1 = Math.imul(h1 ^ b[i], 2654435761);
    h2 = Math.imul(h2 ^ b[i], 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(16) + b.length.toString(16);
}

/** Format and size in pixels, read from the file header (no decoding). A JPEG whose EXIF orientation turns it a
 *  quarter turn reports its displayed size, as browsers draw it; `orientation` (2–8) when it isn't upright.
 *  GIF: the first frame's canvas. */
export function imageInfo(b: Uint8Array): { type: ImageType; width: number; height: number; orientation?: number } | null {
  const u16 = (i: number, le = false) => (le ? b[i] | (b[i + 1] << 8) : (b[i] << 8) | b[i + 1]);
  const u24le = (i: number) => b[i] | (b[i + 1] << 8) | (b[i + 2] << 16);
  const u32 = (i: number) => ((b[i] << 24) | (b[i + 1] << 16) | (b[i + 2] << 8) | b[i + 3]) >>> 0;
  const ascii = (i: number, n: number) => String.fromCharCode(...b.subarray(i, i + n));
  const sized = (type: ImageType, width: number, height: number) => (width > 0 && height > 0 ? { type, width, height } : null);
  if (b.length < 30) return null;
  if (u32(0) === 0x89504e47) return sized('image/png', u32(16), u32(20));
  if (ascii(0, 4) === 'GIF8') return sized('image/gif', u16(6, true), u16(8, true));
  if (ascii(0, 4) === 'RIFF' && ascii(8, 4) === 'WEBP') {
    const chunk = ascii(12, 4);
    if (chunk === 'VP8 ') return sized('image/webp', u16(26, true) & 0x3fff, u16(28, true) & 0x3fff);
    if (chunk === 'VP8L') return sized('image/webp', 1 + (((b[22] & 0x3f) << 8) | b[21]), 1 + (((b[24] & 0xf) << 10) | (b[23] << 2) | ((b[22] & 0xc0) >> 6)));
    if (chunk === 'VP8X') return sized('image/webp', 1 + u24le(24), 1 + u24le(27));
    return null;
  }
  if (u16(0) !== 0xffd8) return null;
  let orientation = 1;
  for (let i = 2; i + 9 < b.length;) {
    if (b[i] !== 0xff) return null;
    const m = b[i + 1];
    if (m === 0xff) { i++; continue; } // padding
    if (m >= 0xc0 && m <= 0xcf && m !== 0xc4 && m !== 0xc8 && m !== 0xcc) { // start of frame
      const h = u16(i + 5), w = u16(i + 7);
      const s = orientation >= 5 ? sized('image/jpeg', h, w) : sized('image/jpeg', w, h);
      return s && orientation !== 1 ? { ...s, orientation } : s;
    }
    if (m === 0xe1 && ascii(i + 4, 4) === 'Exif') orientation = exifOrientation(b, i + 10);
    i += 2 + u16(i + 2);
  }
  return null;
}

/** EXIF orientation (1–8) from the TIFF header at `t`; 1 when absent. */
function exifOrientation(b: Uint8Array, t: number): number {
  const le = b[t] === 0x49; // "II": little endian
  const u16 = (i: number) => (le ? b[i] | (b[i + 1] << 8) : (b[i] << 8) | b[i + 1]);
  const u32 = (i: number) => (le ? (b[i] | (b[i + 1] << 8) | (b[i + 2] << 16) | (b[i + 3] << 24)) : ((b[i] << 24) | (b[i + 1] << 16) | (b[i + 2] << 8) | b[i + 3])) >>> 0;
  const ifd = t + u32(t + 4);
  if (ifd + 2 > b.length) return 1;
  for (let k = 0, n = u16(ifd); k < n; k++) {
    const e = ifd + 2 + k * 12;
    if (e + 12 > b.length) return 1;
    if (u16(e) === 0x0112) return u16(e + 8);
  }
  return 1;
}

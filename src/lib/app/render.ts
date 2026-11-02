import type { Framed } from '$lib/svg/export';
import { base64, fromDataURL, imageInfo } from '$lib/model/images';
import { fontsIn } from './fonts.svelte';

/** Export formats: SVG is written as is, PNG/JPG are rendered by the web view, PDF is laid out by
 *  jsPDF + svg2pdf.js (vector; 1 px = 1 pt). Needs a DOM: app layer, not model. */
export const FORMATS = ['pdf', 'svg', 'png', 'jpg'] as const;
export type Format = (typeof FORMATS)[number];

const encoder = new TextEncoder();

export async function render(f: Framed, format: Format, scale = 1): Promise<Uint8Array<ArrayBuffer>> {
  if (format === 'svg') return encoder.encode(f.svg);
  if (format === 'pdf') return pdf(f);
  return raster(f, format, scale);
}

/** The browser's own SVG renderer, so blur and shadows look as on the canvas. */
async function raster(f: Framed, format: 'png' | 'jpg', scale: number): Promise<Uint8Array<ArrayBuffer>> {
  // an SVG drawn as an image sees none of the page's fonts: embed the ones it uses
  const faces = fontsIn(f.svg).map((ff) => `@font-face{font-family:"${ff.family}";font-weight:${ff.weight};src:url(data:font/ttf;base64,${base64(ff.data)})}`);
  const svg = faces.length ? f.svg.replace(/<svg[^>]*>/, (open) => `${open}<style>${faces.join('')}</style>`) : f.svg;
  const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(f.width * scale));
    canvas.height = Math.max(1, Math.round(f.height * scale));
    const ctx = canvas.getContext('2d')!;
    if (format === 'jpg') { // no alpha in JPEG: transparent areas come out white
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((done) => canvas.toBlob(done, format === 'jpg' ? 'image/jpeg' : 'image/png', 0.9));
    if (!blob) throw new Error('canvas.toBlob failed');
    return new Uint8Array(await blob.arrayBuffer());
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** A JPEG goes into a PDF as is, and PDF readers ignore its EXIF orientation (a phone photo would come out turned
 *  and stretched over its frame): those are redrawn upright first, as the web view shows them. */
async function uprightJPEGs(svg: string): Promise<string> {
  const urls = [...new Set(svg.match(/data:image\/jpeg;base64,[^"]+/g) ?? [])];
  for (const url of urls) {
    const bytes = fromDataURL(url);
    if (!bytes || !imageInfo(bytes)?.orientation) continue;
    const img = new Image();
    img.src = url;
    await img.decode();
    const canvas = Object.assign(document.createElement('canvas'), { width: img.naturalWidth, height: img.naturalHeight });
    canvas.getContext('2d')!.drawImage(img, 0, 0); // drawn with its orientation applied (CSS image-orientation: from-image)
    svg = svg.replaceAll(url, canvas.toDataURL('image/jpeg', 0.92));
  }
  return svg;
}

// ponytail: svg2pdf.js ignores SVG filters, so layer blur and shadows are dropped from PDFs
async function pdf(f: Framed): Promise<Uint8Array<ArrayBuffer>> {
  const [{ jsPDF }] = await Promise.all([import('jspdf'), import('svg2pdf.js')]); // loaded on first PDF export only
  const w = Math.max(f.width, 1), h = Math.max(f.height, 1);
  const doc = new jsPDF({ unit: 'pt', format: [w, h], orientation: w > h ? 'landscape' : 'portrait' });
  for (const ff of fontsIn(f.svg)) { // real, selectable text; svg2pdf picks fonts by family and normal/bold
    doc.addFileToVFS(ff.file, base64(ff.data));
    doc.addFont(ff.file, ff.family, ff.weight >= 600 ? 'bold' : 'normal');
  }
  // ponytail: fonts not loaded (imported SVG) or .otf (CFF) come out in Times; convert to outlines for exact type
  const svg = new DOMParser().parseFromString(await uprightJPEGs(f.svg), 'image/svg+xml').documentElement;
  // svg2pdf only warns when an image fails (and leaves it out): make it an export error instead
  const failed: string[] = [], warn = console.warn;
  console.warn = (...a: unknown[]) => (String(a[0]).startsWith('Could not load image') ? failed.push(String(a[0]).replace(/data:[^\s.]{60,}/g, (u) => `${u.slice(0, 30)}…`)) : warn(...a));
  try {
    await doc.svg(svg, { x: 0, y: 0, width: w, height: h });
  } finally {
    console.warn = warn;
  }
  if (failed.length) throw new Error(failed.join('\n'));
  return new Uint8Array(doc.output('arraybuffer'));
}

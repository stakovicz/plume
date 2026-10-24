import type { Framed } from '$lib/svg/export';
import { base64, fontsIn } from './fonts.svelte';

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
  const svg = new DOMParser().parseFromString(f.svg, 'image/svg+xml').documentElement;
  await doc.svg(svg, { x: 0, y: 0, width: w, height: h });
  return new Uint8Array(doc.output('arraybuffer'));
}

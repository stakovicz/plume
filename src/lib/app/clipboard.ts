import { L } from '#lib/i18n';
import type { Doc } from '#lib/document/doc.svelte';
import { decodeFile, encodeFile } from '#lib/model/codable';
import { pt } from '#lib/model/geometry';
import { type Layer, newLayer } from '#lib/model/layer';
import { importSVG } from '#lib/svg/import';
import { framedLayers } from '#lib/svg/export';
import { addImage, dataURL, fromDataURL, imagesUsed, putImage } from '#lib/model/images';

/** ⌘C / ⌘X / ⌘V on layers, through the DOM clipboard events: the native Edit menu (Tauri) and the
 *  browser both fire them, and text fields keep their own copy/paste. Copied layers go out as our JSON
 *  (lossless, between Plume windows) plus SVG as text (pastes into other apps); an SVG copied
 *  elsewhere (as code, as a file, or inside a web page selection) pastes in as layers.
 *  Bitmaps (a screenshot, an image copied from a browser) paste in as image layers.
 *  SVG and image files dropped on the window land where they're dropped. */

const MIME = 'application/x-plume+json';

export const isTyping = (t: EventTarget | null) =>
  t instanceof HTMLElement && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName));

const looksSVG = (text: string) => text.trimStart().startsWith('<') && /<svg[\s>]/i.test(text);
const isSVGFile = (f: File) => f.type === 'image/svg+xml' || f.name.toLowerCase().endsWith('.svg');
const isBitmap = (f: File) => /^image\/(png|jpeg|webp|gif)$/.test(f.type) || /\.(png|jpe?g|webp|gif)$/i.test(f.name);

/** Our clipboard JSON: the layers, plus the images they use as `data:` URLs (another window has none of them). */
const clipJSON = (layers: Layer[]) => {
  const images = Object.fromEntries([...imagesUsed(layers)].map((src) => [src, dataURL(src)]));
  return JSON.stringify({ ...JSON.parse(encodeFile({ layers, palette: [] })), images });
};

function fromClipJSON(json: string): Layer[] {
  const images: Record<string, string> = JSON.parse(json).images ?? {};
  for (const [src, url] of Object.entries(images)) {
    const b = fromDataURL(url);
    if (b) putImage(src, b);
  }
  return decodeFile(json).layers;
}

/** An image file as an image layer; false if it isn't one we can read. */
async function placeBitmap(doc: Doc, f: File, at?: { x: number; y: number }) {
  const image = addImage(new Uint8Array(await f.arrayBuffer()));
  if (image) doc.placeImage(image, f.name && f.name !== 'image.png' ? f.name.replace(/\.[^.]+$/, '') : undefined, at); // image.png: what a pasted bitmap is called
  return !!image;
}

/** Layers from an SVG made elsewhere: its content, as one group when there are several. */
function fromSVG(text: string): Layer[] {
  let ls = importSVG(text);
  if (ls.length === 1 && ls[0].kind === 'artboard' && !text.includes('data-artboard')) ls = ls[0].children; // the frame built from its viewBox
  return ls.length > 1 ? [newLayer(L('Group'), 'group', [], { children: ls, lockRatio: true })] : ls;
}

/** The first inline <svg> of copied web content (a page selection), as markup. */
function svgInHTML(html: string): string | null {
  const svg = new DOMParser().parseFromString(html, 'text/html').querySelector('svg');
  if (!svg) return null;
  if (!svg.getAttribute('xmlns')) svg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  return svg.outerHTML;
}

export function installClipboard(doc: Doc): () => void {
  // Last copy, for when the web view drops our custom type (WebKit may): recognized by its SVG text.
  let last: { svg: string; json: string } | null = null;

  const ignored = (e: Event) => isTyping(e.target) || (e.target instanceof Element && !!e.target.closest('dialog'));

  // WebKit greys out Copy/Cut/Paste when nothing editable has focus, unless the page claims them by
  // cancelling these "before" events; without this the menu (and ⌘C/⌘V in Tauri) does nothing on layers.
  const claimCopy = (e: Event) => !ignored(e) && doc.selectedIDs.size && e.preventDefault();
  const claimPaste = (e: Event) => !ignored(e) && e.preventDefault();

  function copy(e: ClipboardEvent) {
    if (ignored(e) || !doc.selectedIDs.size || !e.clipboardData) return;
    const layers = doc.copySelection();
    last = { svg: framedLayers(layers).svg, json: clipJSON(layers) };
    e.clipboardData.setData(MIME, last.json);
    e.clipboardData.setData('text/plain', last.svg);
    e.preventDefault();
    if (e.type === 'cut') {
      doc.editing = null; // cut takes layers, not the selected point
      doc.deleteSelected();
    }
  }

  async function paste(e: ClipboardEvent) {
    const data = e.clipboardData;
    if (ignored(e) || !data) return;
    const text = data.getData('text/plain'), html = data.getData('text/html');
    const json = data.getData(MIME) || (last && text === last.svg ? last.json : '');
    const file = [...data.files].find(isSVGFile), bitmap = [...data.files].find(isBitmap);
    const svg = data.getData('image/svg+xml') || (looksSVG(text) ? text : '') || (html && svgInHTML(html));
    if (!json && !svg && !file && !bitmap) return; // plain text…: nothing we can paste
    e.preventDefault();
    try {
      if (!json && !svg && !file) await placeBitmap(doc, bitmap!);
      else doc.paste(json ? fromClipJSON(json) : fromSVG(svg || (await file!.text())));
    } catch { /* not a readable SVG or image after all */ }
  }

  function dragover(e: DragEvent) {
    if (e.dataTransfer?.types.includes('Files')) {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'copy';
    }
  }

  async function drop(e: DragEvent) {
    const files = [...(e.dataTransfer?.files ?? [])].filter((f) => isSVGFile(f) || isBitmap(f));
    if (!e.dataTransfer?.types.includes('Files')) return;
    e.preventDefault(); // never let the web view navigate to a dropped file
    const canvas = document.querySelector('.canvas')?.getBoundingClientRect();
    const at = canvas && doc.toDoc(pt(e.clientX - canvas.left, e.clientY - canvas.top));
    doc.selectedIDs = new Set();
    for (const f of files) {
      try {
        if (isSVGFile(f)) doc.paste(fromSVG(await f.text()), at);
        else await placeBitmap(doc, f, at ?? undefined);
      } catch { /* skip files that aren't SVG or images after all */ }
    }
  }

  const listeners: [string, (e: never) => unknown][] = [
    ['beforecopy', claimCopy], ['beforecut', claimCopy], ['beforepaste', claimPaste],
    ['copy', copy], ['cut', copy], ['paste', paste], ['dragover', dragover], ['drop', drop],
  ];
  for (const [type, f] of listeners) document.addEventListener(type, f as EventListener);
  return () => { for (const [type, f] of listeners) document.removeEventListener(type, f as EventListener); };
}

import { isTauri, invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { base } from '$app/paths';
import { message, open as openPanel, save as savePanel } from '@tauri-apps/plugin-dialog';
import { L } from '$lib/i18n';
import { type Doc, pushRecent } from '$lib/document/doc.svelte';
import { packFile, unpackFile } from '$lib/model/codable';
import { type Framed, framedArtboard, framedLayers } from '$lib/svg/export';
import { artboards } from '$lib/document/artboards';
import { type Format, render } from './render';

/** What the export dialog exports: the whole document, one file per visible artboard, or the selected layers. */
export type ExportTarget = 'document' | 'artboards' | 'selection';

/** File menu actions around `doc.load` / `doc.json` (zipped as `.plm`) / exports: native panels and the Rust
 *  read/write commands under Tauri, file input and downloads in a plain browser. */

const baseName = (path: string) => path.split(/[\\/]/).pop() ?? path;
const isSVG = (path: string) => path.toLowerCase().endsWith('.svg');
const plmFilter = { name: L('Plume document'), extensions: ['plm'] };
const svgFilter = { name: L('SVG image'), extensions: ['svg'] };
const fileName = (s: string) => s.replace(/[\\/:*?"<>|]/g, '-').trim();

/** File › Examples: SVGs bundled with the app (static/exemples/), by file name, with their menu title. */
export const EXAMPLES = [
  ['illustration', L('Illustration')], ['icone-app', L('App Icon')], ['affiche', L('Poster')],
  ['tableau-de-bord', L('Dashboard')], ['pictogrammes', L('Pictograms')], ['motif', L('Pattern')],
] as const;

/** Most recent first; the first one is reopened at launch. Per-machine convenience → localStorage. */
function loadRecents(): string[] {
  try {
    return JSON.parse(localStorage.getItem('recents') ?? '[]');
  } catch {
    return [];
  }
}

export class Files {
  recents = $state<string[]>(loadRecents());

  constructor(private doc: Doc) {
    $effect.root(() => {
      $effect(() => {
        try {
          localStorage.setItem('recents', JSON.stringify(this.recents));
        } catch { /* private mode: recents just don't persist */ }
      });
    });
  }

  title() { return this.doc.filePath ? baseName(this.doc.filePath) : L('Untitled'); }

  async newDocument() {
    if (!(await this.confirmDiscardChanges())) return;
    this.doc.replace([]);
    this.doc.filePath = null;
    this.doc.markSaved();
  }

  async open() {
    if (!(await this.confirmDiscardChanges())) return;
    if (!isTauri()) return this.#browserOpen();
    const path = await openPanel({ filters: [{ name: 'Plume', extensions: ['plm', 'svg'] }, plmFilter, svgFilter] });
    if (path) await this.openPath(path);
  }

  async openRecent(path: string) {
    if (await this.confirmDiscardChanges()) await this.openPath(path);
  }

  clearRecents() { this.recents = []; }

  async openPath(path: string) {
    let content: string | Uint8Array;
    try {
      content = isSVG(path) ? await invoke<string>('read_text', { path }) : new Uint8Array(await invoke<ArrayBuffer>('read_bytes', { path }));
    } catch (e) {
      this.recents = this.recents.filter((p) => p !== path);
      return this.#error(L('Could not open the file.'), e);
    }
    this.#load(content, path);
  }

  /** An example, as a new untitled document (its artboard named `title`); not added to the recents. */
  async openExample(file: string, title: string) {
    if (!(await this.confirmDiscardChanges())) return;
    try {
      const r = await fetch(`${base}/exemples/${file}.svg`);
      if (!r.ok) throw new Error(`${file}.svg: HTTP ${r.status}`);
      this.doc.load(await r.text(), true, title);
    } catch (e) {
      return this.#error(L('Could not open the file.'), e);
    }
    this.doc.filePath = null;
    this.doc.markSaved();
  }

  /** At launch: the file given on the command line or by the Finder, else the last document. In a browser: the
   *  first example, so the web version shows something to try. Later Finder opens arrive as `open-file`. */
  async openAtLaunch() {
    if (!isTauri()) return this.openExample(...EXAMPLES[0]);
    listen<string>('open-file', (e) => this.openRecent(e.payload));
    const path = (await invoke<string | null>('launch_file')) ?? this.recents[0];
    if (path) await this.openPath(path).catch(() => {});
  }

  /** `content`: an SVG's text, or a `.plm` file's bytes. */
  #load(content: string | Uint8Array, path: string) {
    try {
      const text = typeof content === 'string' ? content : unpackFile(content);
      this.doc.load(text, isSVG(path), baseName(path).replace(/\.svg$/i, ''));
    } catch (e) {
      return this.#error(L('Could not open the file.'), e);
    }
    // An SVG import is an untitled document (saving writes a .plm) but starts clean: the
    // source file is untouched, so quitting without edits doesn't ask to save.
    this.doc.filePath = isSVG(path) ? null : path;
    this.doc.markSaved();
    if (isTauri()) this.recents = pushRecent(path, this.recents);
  }

  /** Writes to the current file, or asks where when the document was never saved. */
  async save(): Promise<boolean> {
    const path = this.doc.filePath;
    return path && isTauri() ? this.#write(path) : this.saveAs(); // browser: always a download
  }

  async saveAs(): Promise<boolean> {
    const name = this.doc.filePath ? baseName(this.doc.filePath) : `${L('Untitled')}.plm`;
    if (!isTauri()) {
      download(name, packFile(this.doc.json()), 'application/zip');
      this.doc.markSaved();
      return true;
    }
    const path = await savePanel({ defaultPath: name, filters: [plmFilter] });
    return path ? this.#write(path) : false;
  }

  /** Whether `what` has anything to export now (the dialog disables the others). */
  canExport(what: ExportTarget) {
    if (what === 'artboards') return artboards(this.doc.layers).some((a) => !a.hidden);
    if (what === 'selection') return this.doc.selectedIDs.size > 0;
    return this.doc.layers.length > 0;
  }

  #exports(what: ExportTarget): { base: string; framed: Framed }[] {
    const title = this.title().replace(/\.plm$/i, '');
    if (what === 'document') return [{ base: title, framed: framedLayers(this.doc.layers, 10) }];
    if (what === 'artboards') {
      return artboards(this.doc.layers).filter((a) => !a.hidden).map((a) => ({ base: fileName(a.name) || L('Artboard'), framed: framedArtboard(a) }));
    }
    const ls = this.doc.selectedLayers;
    return ls.length ? [{ base: (ls.length === 1 && fileName(ls[0].name)) || title, framed: framedLayers(ls) }] : [];
  }

  /** One file (save panel), or one per artboard in a folder the user picks; downloads in a browser.
   *  Raster files at another scale than 1 are suffixed (`Name@2x.png`). */
  async export(what: ExportTarget, format: Format, scale = 1) {
    const items = this.#exports(what);
    if (!items.length) return;
    const suffix = (format === 'png' || format === 'jpg') && scale !== 1 ? `@${scale}x` : '';
    const used = new Set<string>();
    const named = items.map((it) => {
      let name = `${it.base}${suffix}.${format}`;
      for (let i = 2; used.has(name.toLowerCase()); i++) name = `${it.base} ${i}${suffix}.${format}`;
      used.add(name.toLowerCase());
      return { name, framed: it.framed };
    });
    let files: { name: string; bytes: Uint8Array<ArrayBuffer> }[];
    try {
      files = await Promise.all(named.map(async (n) => ({ name: n.name, bytes: await render(n.framed, format, scale) })));
    } catch (e) {
      return this.#error(L('Could not export.'), e);
    }
    if (!isTauri()) return files.forEach((f) => download(f.name, f.bytes, MIME[format]));
    let paths: string[];
    if (files.length === 1) {
      const path = await savePanel({ defaultPath: files[0].name, filters: [{ name: format.toUpperCase(), extensions: [format] }] });
      if (!path) return;
      paths = [path];
    } else {
      const dir = await openPanel({ directory: true, title: L('Export…') });
      if (!dir) return;
      paths = files.map((f) => `${dir}/${f.name}`);
    }
    try {
      for (const [i, f] of files.entries()) await invoke('write_bytes', withPath(paths[i], f.bytes));
    } catch (e) {
      this.#error(L('Could not save the file.'), e);
    }
  }

  /** Save / Don't Save / Cancel when there are unsaved changes. Resolves false to abort. */
  async confirmDiscardChanges(): Promise<boolean> {
    if (!this.doc.isDirty) return true;
    const question = L('Do you want to save the changes?'), detail = L("Your changes will be lost if you don't save them.");
    if (!isTauri()) return confirm(`${question}\n${detail}`);
    const answer = await message(detail, {
      title: question,
      kind: 'warning',
      buttons: { yes: L('Save'), no: L("Don't Save"), cancel: L('Cancel') },
    });
    if (answer === L('Save') || answer === 'Yes') return this.save();
    return answer === L("Don't Save") || answer === 'No';
  }

  async #write(path: string) {
    try {
      await invoke('write_bytes', withPath(path, packFile(this.doc.json())));
    } catch (e) {
      this.#error(L('Could not save the file.'), e);
      return false;
    }
    this.doc.filePath = path;
    this.doc.markSaved();
    this.recents = pushRecent(path, this.recents);
    return true;
  }

  #browserOpen() {
    const input = Object.assign(document.createElement('input'), { type: 'file', accept: '.plm,.svg' });
    input.onchange = async () => {
      const f = input.files?.[0];
      if (f) this.#load(isSVG(f.name) ? await f.text() : new Uint8Array(await f.arrayBuffer()), f.name);
    };
    input.click();
  }

  async #error(title: string, e: unknown) {
    if (isTauri()) await message(String(e), { title, kind: 'error' });
    else alert(`${title}\n${e}`);
  }
}

const MIME: Record<Format, string> = { pdf: 'application/pdf', svg: 'image/svg+xml', png: 'image/png', jpg: 'image/jpeg' };

/** `write_bytes` body: the path, a NUL byte, the data. */
function withPath(path: string, bytes: Uint8Array) {
  const p = new TextEncoder().encode(path), body = new Uint8Array(p.length + 1 + bytes.length);
  body.set(p);
  body.set(bytes, p.length + 1);
  return body;
}

function download(name: string, data: BlobPart, type: string) {
  const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(new Blob([data], { type })), download: name });
  a.click();
  URL.revokeObjectURL(a.href);
}

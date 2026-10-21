import { isTauri, invoke } from '@tauri-apps/api/core';
import { message, open as openPanel, save as savePanel } from '@tauri-apps/plugin-dialog';
import { L } from '$lib/i18n';
import { type Doc, pushRecent } from '$lib/document/doc.svelte';
import { type Framed, framedArtboard, framedLayers } from '$lib/svg/export';
import { artboards } from '$lib/document/artboards';
import { type Format, render } from './render';

/** What the export dialog exports: the whole document, one file per visible artboard, or the selected layers. */
export type ExportTarget = 'document' | 'artboards' | 'selection';

/** File menu actions around `doc.load` / `doc.json` / exports: native panels and the Rust
 *  read/write commands under Tauri, file input and downloads in a plain browser. */

const baseName = (path: string) => path.split(/[\\/]/).pop() ?? path;
const isSVG = (path: string) => path.toLowerCase().endsWith('.svg');
const jsonFilter = { name: L('Plume document'), extensions: ['json'] };
const svgFilter = { name: L('SVG image'), extensions: ['svg'] };
const fileName = (s: string) => s.replace(/[\\/:*?"<>|]/g, '-').trim();

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
    const path = await openPanel({ filters: [{ name: 'Plume', extensions: ['json', 'svg'] }, jsonFilter, svgFilter] });
    if (path) await this.openPath(path);
  }

  async openRecent(path: string) {
    if (await this.confirmDiscardChanges()) await this.openPath(path);
  }

  clearRecents() { this.recents = []; }

  async openPath(path: string) {
    let text: string;
    try {
      text = await invoke<string>('read_text', { path });
    } catch (e) {
      this.recents = this.recents.filter((p) => p !== path);
      return this.#error(L('Could not open the file.'), e);
    }
    this.#load(text, path);
  }

  /** At launch: the file given on the command line, else the last document. */
  async openAtLaunch() {
    if (!isTauri()) return;
    const path = (await invoke<string | null>('launch_file')) ?? this.recents[0];
    if (path) await this.openPath(path).catch(() => {});
  }

  #load(text: string, path: string) {
    try {
      this.doc.load(text, isSVG(path), baseName(path).replace(/\.svg$/i, ''));
    } catch (e) {
      return this.#error(L('Could not open the file.'), e);
    }
    // An SVG import is an untitled document (saving writes a .json) but starts clean: the
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
    const name = this.doc.filePath ? baseName(this.doc.filePath) : `${L('Untitled')}.json`;
    if (!isTauri()) {
      download(name, this.doc.json(), 'application/json');
      this.doc.markSaved();
      return true;
    }
    const path = await savePanel({ defaultPath: name, filters: [jsonFilter] });
    return path ? this.#write(path) : false;
  }

  /** Whether `what` has anything to export now (the dialog disables the others). */
  canExport(what: ExportTarget) {
    if (what === 'artboards') return artboards(this.doc.layers).some((a) => !a.hidden);
    if (what === 'selection') return this.doc.selectedIDs.size > 0;
    return this.doc.layers.length > 0;
  }

  #exports(what: ExportTarget): { base: string; framed: Framed }[] {
    const title = this.title().replace(/\.json$/i, '');
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
      await invoke('write_text', { path, contents: this.doc.json() });
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
    const input = Object.assign(document.createElement('input'), { type: 'file', accept: '.json,.svg' });
    input.onchange = async () => {
      const f = input.files?.[0];
      if (f) this.#load(await f.text(), f.name);
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

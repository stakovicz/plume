import { invoke, isTauri } from '@tauri-apps/api/core';
import { IconMenuItem, Menu, MenuItem, PredefinedMenuItem, Submenu } from '@tauri-apps/api/menu';
import { Image } from '@tauri-apps/api/image';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { L } from '$lib/i18n';
import type { Doc } from '$lib/document/doc.svelte';
import { TOOLS, toolKey, toolTitle } from '$lib/document/tool';
import { type IconName, iconSVG } from '$lib/ui/kit/Icon.svelte';
import { type Files, EXAMPLES } from './files.svelte';
import { isTyping } from './clipboard';

/** The menu bar, defined once: native menus under Tauri, the same shortcuts by keydown in a browser. */

/** `key`: a shortcut handled elsewhere (tool keys, on the canvas), shown in the browser menu bar only, like `icon`. */
export type Command = { text: string; accelerator?: string; key?: string; icon?: IconName; enabled?: boolean; run: () => unknown };
type Native = { native: 'Separator' | 'Cut' | 'Copy' | 'Paste' | 'Hide' | 'HideOthers' | 'ShowAll' | 'Services' | 'Minimize' | 'CloseWindow' | 'About' };
export type Item = Command | Native | { submenu: string; icon?: IconName; items: Item[] };
export type MenuSpec = { text: string; items: Item[] };

const sep: Native = { native: 'Separator' };

/** macOS or not: Linux has no Services/Hide items, its predefined Minimize/Close do nothing, and ⌃ is ⌘'s stand-in. */
export const mac = /Mac/.test(globalThis.navigator?.platform ?? '');
/** Bring to Front / Send to Back modifiers: ⌃⌥⌘ on macOS; elsewhere Ctrl is CmdOrCtrl already, so add Shift. */
const FRONT = mac ? 'Ctrl+Alt+CmdOrCtrl' : 'Shift+Alt+CmdOrCtrl';

/** Closing the window or quitting goes through the save prompt; Cancel keeps the window. */
export async function quit(files: Files) {
  if (await files.confirmDiscardChanges()) await getCurrentWindow().destroy();
}

/** ⌘A: the text of the focused field, else the layers. */
function selectAll(doc: Doc) {
  const t = document.activeElement;
  if (t instanceof HTMLInputElement || t instanceof HTMLTextAreaElement) t.select();
  else if (!isTyping(t)) doc.selectAll();
}

/** Window parts the menus open or toggle: side panels (View menu), the export dialog. */
export type Panels = { toggle: (which: 'navigator' | 'inspector') => void; openExport: () => void };

export function menus(doc: Doc, files: Files, panels: Panels): MenuSpec[] {
  return [
    {
      text: 'Plume',
      items: [{ native: 'About' }, sep, ...(mac ? [{ native: 'Services' }, sep, { native: 'Hide' }, { native: 'HideOthers' }, { native: 'ShowAll' }, sep] as Native[] : []),
        { text: L('Quit Plume'), accelerator: 'CmdOrCtrl+Q', run: () => quit(files) }],
    },
    {
      text: L('File'),
      items: [
        { text: L('New'), accelerator: 'CmdOrCtrl+N', run: () => files.newDocument() },
        { text: L('Open…'), accelerator: 'CmdOrCtrl+O', run: () => files.open() },
        {
          submenu: L('Open Recent'),
          items: [
            ...files.recents.map((p) => ({ text: p.split(/[\\/]/).pop()!, run: () => files.openRecent(p) })),
            sep,
            { text: L('Clear Menu'), enabled: files.recents.length > 0, run: () => files.clearRecents() },
          ],
        },
        { submenu: L('Examples'), items: EXAMPLES.map(([file, title]) => ({ text: title, run: () => files.openExample(file, title) })) },
        sep,
        { text: L('Save'), accelerator: 'CmdOrCtrl+S', run: () => files.save() },
        { text: L('Save As…'), accelerator: 'CmdOrCtrl+Shift+S', run: () => files.saveAs() },
        sep,
        { text: L('Export…'), accelerator: 'CmdOrCtrl+E', run: () => panels.openExport() },
      ],
    },
    {
      text: L('Edit'),
      items: [
        { text: L('Undo'), accelerator: 'CmdOrCtrl+Z', run: () => doc.undo() },
        { text: L('Redo'), accelerator: 'CmdOrCtrl+Shift+Z', run: () => doc.redo() },
        sep,
        // native: text fields need them on macOS; on layers they fire the DOM clipboard events (app/clipboard.ts)
        { native: 'Cut' }, { native: 'Copy' }, { native: 'Paste' },
        { text: L('Duplicate'), accelerator: 'CmdOrCtrl+D', run: () => doc.duplicate() },
        // not the native item: it would select the page's text, never layers; text fields still get their own
        { text: L('Select All'), accelerator: 'CmdOrCtrl+A', run: () => selectAll(doc) },
      ],
    },
    // single-letter accelerators: the native menu disables them while typing (see installNativeMenu); in a
    // browser runShortcut skips them and the canvas handles the keys
    { text: L('Tools'), items: TOOLS.flatMap((t): Item[] => [
      { text: toolTitle(t), icon: t, accelerator: toolKey[t]?.toUpperCase(), key: toolKey[t] ? undefined : 'Esc', run: () => (doc.tool = t) },
      ...(t === 'select' || t === 'artboard' ? [sep] : []),
    ]).concat([
      sep,
      {
        submenu: L('Combine'),
        icon: 'union',
        items: [
          { text: L('Union'), icon: 'union', accelerator: 'Alt+CmdOrCtrl+U', run: () => doc.combine('union') },
          { text: L('Subtract'), icon: 'subtract', accelerator: 'Alt+CmdOrCtrl+S', run: () => doc.combine('subtract') },
          { text: L('Intersect'), icon: 'intersect', accelerator: 'Alt+CmdOrCtrl+I', run: () => doc.combine('intersect') },
          { text: L('Difference'), icon: 'difference', accelerator: 'Alt+CmdOrCtrl+X', run: () => doc.combine('difference') },
        ],
      },
      { text: L('Convert to Outlines'), icon: 'outline', accelerator: 'Alt+CmdOrCtrl+O', run: () => doc.outline() },
      sep,
      { text: L('Flip Horizontal'), icon: 'flip-horizontal', run: () => doc.flip(true) },
      { text: L('Flip Vertical'), icon: 'flip-vertical', run: () => doc.flip(false) },
    ]) },
    {
      text: L('Arrange'),
      items: [
        { text: L('Group Layers'), icon: 'group', accelerator: 'CmdOrCtrl+G', run: () => doc.group() },
        { text: L('Ungroup'), icon: 'ungroup', accelerator: 'CmdOrCtrl+Shift+G', run: () => doc.ungroup() },
        sep,
        { text: L('Bring Forward'), icon: 'forward', accelerator: 'Alt+CmdOrCtrl+Up', run: () => doc.arrange('forward') },
        { text: L('Send Backward'), icon: 'backward', accelerator: 'Alt+CmdOrCtrl+Down', run: () => doc.arrange('backward') },
        { text: L('Bring to Front'), icon: 'front', accelerator: `${FRONT}+Up`, run: () => doc.arrange('front') },
        { text: L('Send to Back'), icon: 'back', accelerator: `${FRONT}+Down`, run: () => doc.arrange('back') },
        sep,
        { text: L('Show/Hide'), icon: 'eye', accelerator: 'CmdOrCtrl+Shift+H', run: () => doc.toggleHidden(doc.selectedIDs) },
        { text: L('Lock/Unlock'), icon: 'lock', accelerator: 'CmdOrCtrl+Shift+L', run: () => doc.toggleLocked(doc.selectedIDs) },
      ],
    },
    {
      text: L('View'),
      items: [
        { text: L('Zoom In'), accelerator: 'CmdOrCtrl+=', run: () => doc.zoomBy(2) },
        { text: L('Zoom Out'), accelerator: 'CmdOrCtrl+-', run: () => doc.zoomBy(0.5) },
        { text: L('Actual Size'), accelerator: 'CmdOrCtrl+0', run: () => doc.zoomToActualSize() },
        { text: L('Zoom to Fit'), accelerator: 'CmdOrCtrl+1', run: () => doc.zoomToFit() },
        sep,
        { text: L('Show/Hide Navigator'), accelerator: 'Alt+CmdOrCtrl+1', run: () => panels.toggle('navigator') },
        { text: L('Show/Hide Inspector'), accelerator: 'Alt+CmdOrCtrl+2', run: () => panels.toggle('inspector') },
      ],
    },
    { text: L('Window'), items: mac ? [{ native: 'Minimize' }, { native: 'CloseWindow' }] : [ // Linux: the native ones do nothing
      { text: L('Minimize'), run: () => getCurrentWindow().minimize() },
      { text: L('Close Window'), accelerator: 'CmdOrCtrl+W', run: () => quit(files) },
    ] },
    { text: L('Help'), items: [{ text: L('Plume Documentation'), run: () => openURL(DOCS) }] },
  ];
}

const SITE = 'https://github.com/stakovicz/plume';
const DOCS = 'https://stakovicz.github.io/plume/docs/';

/** A web page in the default browser (the app's web view would replace the editor). */
const openURL = (url: string) => (isTauri() ? invoke('open_url', { url }) : window.open(url, '_blank', 'noopener'));
/** The About panel. macOS shows the copyright and credits (plain text, links aren't clickable);
 *  authors, comments, license and website are for Windows and Linux. The version comes from the bundle. */
const about = () => ({
  name: 'Plume',
  copyright: `© 2026 Stakovicz · ${L('MIT License')}`,
  credits: `${L('Vector editor.')}\n${SITE}\n\n${L('Fonts: Fira Sans, Fira Mono and PT Serif (SIL Open Font License).')}`,
  authors: ['Stakovicz'],
  comments: L('Vector editor.'),
  license: 'MIT',
  website: SITE,
  websiteLabel: 'GitHub',
});

/** Titles of the standard items, which macOS leaves in English (the app bundle has no localizations). */
const nativeText = (): Partial<Record<Native['native'], string>> => ({
  About: L('About Plume'), Services: L('Services'), Hide: L('Hide Plume'), HideOthers: L('Hide Others'), ShowAll: L('Show All'),
  Cut: L('Cut'), Copy: L('Copy'), Paste: L('Paste'), Minimize: L('Minimize'), CloseWindow: L('Close Window'),
});

/** Items with a modifier-less accelerator (tool keys), disabled while a text field has focus so the key reaches it:
 *  a disabled item doesn't take its key equivalent (AppKit's validateMenuItem). */
let plainKeys: (MenuItem | IconMenuItem)[] = [];
const syncPlainKeys = () => setTimeout(() => plainKeys.forEach((i) => i.setEnabled(!isTyping(document.activeElement))));
let listening = false;

/** Menu icons: Tauri takes no template images, so they're drawn in the menu text color of the current
 *  appearance, and the menu is rebuilt when it changes. 36 px: macOS shows them 18 pt high. */
const ICON_PX = 36;
const dark = matchMedia('(prefers-color-scheme: dark)');
const rasters = new Map<string, Promise<Image>>();
function menuIcon(name: IconName): Promise<Image> {
  const color = dark.matches ? '#f2f2f4' : '#1d1d1f', key = `${name} ${color}`;
  if (!rasters.has(key)) {
    rasters.set(key, (async () => {
      const svg = new window.Image(ICON_PX, ICON_PX);
      svg.src = `data:image/svg+xml,${encodeURIComponent(iconSVG(name, color))}`;
      await svg.decode();
      const c = document.createElement('canvas');
      c.width = c.height = ICON_PX;
      const g = c.getContext('2d')!;
      g.drawImage(svg, 0, 0, ICON_PX, ICON_PX);
      return Image.new(new Uint8Array(g.getImageData(0, 0, ICON_PX, ICON_PX).data.buffer), ICON_PX, ICON_PX);
    })());
  }
  return rasters.get(key)!;
}
let installed: MenuSpec[] = [];

export async function installNativeMenu(specs: MenuSpec[]) {
  installed = specs;
  const plain: (MenuItem | IconMenuItem)[] = [];
  const build = (items: Item[]): Promise<MenuItem | Submenu | PredefinedMenuItem>[] =>
    items.map(async (i) => {
      if ('native' in i) return PredefinedMenuItem.new({ item: i.native === 'About' ? { About: about() } : i.native, text: nativeText()[i.native] });
      if ('submenu' in i) {
        const sub = await Submenu.new({ text: i.submenu, items: await Promise.all(build(i.items)) });
        if (i.icon) await sub.setIcon(await menuIcon(i.icon));
        return sub;
      }
      const opts = { text: i.text, accelerator: i.accelerator, enabled: i.enabled ?? true, action: () => void i.run() };
      const item = i.icon ? await IconMenuItem.new({ ...opts, icon: await menuIcon(i.icon) }) : await MenuItem.new(opts);
      if (i.accelerator && !i.accelerator.includes('+')) plain.push(item);
      return item;
    });
  const menu = await Menu.new({
    items: await Promise.all(specs.map(async (m) => Submenu.new({ text: m.text, items: await Promise.all(build(m.items)) }))),
  });
  await menu.setAsAppMenu();
  plainKeys = plain;
  syncPlainKeys();
  if (!listening) {
    listening = true;
    addEventListener('focusin', syncPlainKeys);
    addEventListener('focusout', syncPlainKeys);
    dark.addEventListener('change', () => installNativeMenu(installed));
  }
}

/** Browser only (Tauri's native menu handles accelerators itself). Returns true when handled. */
export function runShortcut(specs: MenuSpec[], e: KeyboardEvent): boolean {
  if (isTauri() || !(e.metaKey || e.ctrlKey)) return false;
  // ⌥ changes e.key on macOS (⌥1 = ¡, ⌥U = dead key): digits, and letters with ⌥, are read from the physical key
  // ponytail: ⌥ + letter uses the QWERTY position (wrong for AZERTY's A/Q/Z/W/M); map by layout if it bites
  const key = e.code.startsWith('Digit') ? e.code.slice(5)
    : e.altKey && e.code.startsWith('Key') ? e.code.slice(3).toLowerCase()
    : e.key === '+' ? '=' : e.key.replace(/^Arrow/, '').toLowerCase();
  const all = (items: Item[]): Command[] => items.flatMap((i) => ('native' in i ? [] : 'submenu' in i ? all(i.items) : [i]));
  const cmd = specs.flatMap((m) => all(m.items)).find((c) => {
    const parts = c.accelerator?.toLowerCase().split('+');
    return parts?.includes('cmdorctrl') && parts.at(-1) === key && parts.includes('shift') === e.shiftKey && parts.includes('alt') === e.altKey
      && parts.includes('ctrl') === (e.metaKey && e.ctrlKey); // 'Ctrl+…CmdOrCtrl' = ⌃⌘ (macOS). ponytail: unreachable in a browser elsewhere (⌃ is already ⌘'s stand-in)
  });
  if (!cmd || cmd.text === L('Quit Plume')) return false;
  e.preventDefault();
  cmd.run();
  return true;
}

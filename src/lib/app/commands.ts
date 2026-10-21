import { isTauri } from '@tauri-apps/api/core';
import { Menu, MenuItem, PredefinedMenuItem, Submenu } from '@tauri-apps/api/menu';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { L } from '$lib/i18n';
import type { Doc } from '$lib/document/doc.svelte';
import { TOOLS, toolKey, toolTitle } from '$lib/document/tool';
import type { IconName } from '$lib/ui/kit/Icon.svelte';
import type { Files } from './files.svelte';
import { isTyping } from './clipboard';

/** The menu bar, defined once: native menus under Tauri, the same shortcuts by keydown in a browser. */

/** `key`: a shortcut handled elsewhere (tool keys, on the canvas), shown in the browser menu bar only, like `icon`. */
export type Command = { text: string; accelerator?: string; key?: string; icon?: IconName; enabled?: boolean; run: () => unknown };
type Native = { native: 'Separator' | 'Cut' | 'Copy' | 'Paste' | 'SelectAll' | 'Hide' | 'HideOthers' | 'ShowAll' | 'Services' | 'Minimize' | 'CloseWindow' | 'About' };
export type Item = Command | Native | { submenu: string; items: Item[] };
export type MenuSpec = { text: string; items: Item[] };

const sep: Native = { native: 'Separator' };

/** Closing the window or quitting goes through the save prompt; Cancel keeps the window. */
export async function quit(files: Files) {
  if (await files.confirmDiscardChanges()) await getCurrentWindow().destroy();
}

/** Window parts the menus open or toggle: side panels (View menu), the export dialog. */
export type Panels = { toggle: (which: 'navigator' | 'inspector') => void; openExport: () => void };

export function menus(doc: Doc, files: Files, panels: Panels): MenuSpec[] {
  return [
    {
      text: 'Plume',
      items: [{ native: 'About' }, sep, { native: 'Services' }, sep, { native: 'Hide' }, { native: 'HideOthers' }, { native: 'ShowAll' }, sep,
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
        { native: 'SelectAll' },
      ],
    },
    // single-letter accelerators: the native menu disables them while typing (see installNativeMenu); in a
    // browser runShortcut skips them and the canvas handles the keys. ponytail: no native icons; IconMenuItem + PNGs if wanted
    { text: L('Tools'), items: TOOLS.flatMap((t): Item[] => [
      { text: toolTitle(t), icon: t, accelerator: toolKey[t]?.toUpperCase(), key: toolKey[t] ? undefined : 'Esc', run: () => (doc.tool = t) },
      ...(t === 'select' || t === 'artboard' ? [sep] : []),
    ]) },
    {
      text: L('Arrange'),
      items: [
        { text: L('Group Layers'), accelerator: 'CmdOrCtrl+G', run: () => doc.group() },
        { text: L('Ungroup'), accelerator: 'CmdOrCtrl+Shift+G', run: () => doc.ungroup() },
        {
          submenu: L('Combine'),
          items: [
            { text: L('Union'), accelerator: 'Alt+CmdOrCtrl+U', run: () => doc.combine('union') },
            { text: L('Subtract'), accelerator: 'Alt+CmdOrCtrl+S', run: () => doc.combine('subtract') },
            { text: L('Intersect'), accelerator: 'Alt+CmdOrCtrl+I', run: () => doc.combine('intersect') },
            { text: L('Difference'), accelerator: 'Alt+CmdOrCtrl+X', run: () => doc.combine('difference') },
          ],
        },
        { text: L('Convert to Outlines'), accelerator: 'Alt+CmdOrCtrl+O', run: () => doc.outline() },
        sep,
        { text: L('Bring Forward'), accelerator: 'Alt+CmdOrCtrl+Up', run: () => doc.arrange('forward') },
        { text: L('Send Backward'), accelerator: 'Alt+CmdOrCtrl+Down', run: () => doc.arrange('backward') },
        { text: L('Bring to Front'), accelerator: 'Ctrl+Alt+CmdOrCtrl+Up', run: () => doc.arrange('front') },
        { text: L('Send to Back'), accelerator: 'Ctrl+Alt+CmdOrCtrl+Down', run: () => doc.arrange('back') },
        sep,
        { text: L('Show/Hide'), accelerator: 'CmdOrCtrl+Shift+H', run: () => doc.toggleHidden(doc.selectedIDs) },
        { text: L('Lock/Unlock'), accelerator: 'CmdOrCtrl+Shift+L', run: () => doc.toggleLocked(doc.selectedIDs) },
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
    { text: L('Window'), items: [{ native: 'Minimize' }, { native: 'CloseWindow' }] },
  ];
}

/** Items with a modifier-less accelerator (tool keys), disabled while a text field has focus so the key reaches it:
 *  a disabled item doesn't take its key equivalent (AppKit's validateMenuItem). */
let plainKeys: MenuItem[] = [];
const syncPlainKeys = () => setTimeout(() => plainKeys.forEach((i) => i.setEnabled(!isTyping(document.activeElement))));
let listening = false;

export async function installNativeMenu(specs: MenuSpec[]) {
  const plain: MenuItem[] = [];
  const build = (items: Item[]): Promise<MenuItem | Submenu | PredefinedMenuItem>[] =>
    items.map(async (i) => {
      if ('native' in i) return PredefinedMenuItem.new({ item: i.native === 'About' ? { About: null } : i.native });
      if ('submenu' in i) return Submenu.new({ text: i.submenu, items: await Promise.all(build(i.items)) });
      const item = await MenuItem.new({ text: i.text, accelerator: i.accelerator, enabled: i.enabled ?? true, action: () => void i.run() });
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

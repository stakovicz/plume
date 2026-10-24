import { expect, test, vi } from 'vitest';
import { Doc } from '$lib/document/doc.svelte';

// commands.ts reads, at load, the platform (menus differ on macOS) and the color scheme (menu icons)
vi.stubGlobal('navigator', { language: 'en', platform: 'Linux x86_64' });
vi.stubGlobal('matchMedia', () => ({ matches: false, addEventListener() {} }));

test('no shortcut is used twice (outside macOS, where Ctrl is CmdOrCtrl)', async () => {
  const { menus } = await import('$lib/app/commands');
  type Item = { accelerator?: string; items?: Item[] };
  const accelerators = (items: Item[]): string[] => items.flatMap((i) => (i.items ? accelerators(i.items) : i.accelerator ? [i.accelerator] : []));
  const files = { recents: [] } as never;
  const all = menus(new Doc(), files, { toggle() {}, openExport() {} }).flatMap((m) => accelerators(m.items as Item[]));
  // what each accelerator becomes on Linux: CmdOrCtrl and Ctrl are the same key
  const linux = all.map((a) => [...new Set(a.replace(/CmdOrCtrl/g, 'Ctrl').split('+'))].toSorted().join('+'));
  expect(linux.filter((a, i) => linux.indexOf(a) !== i)).toEqual([]);
});

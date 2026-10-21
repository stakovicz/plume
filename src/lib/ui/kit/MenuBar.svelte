<script lang="ts">
  import { L } from '$lib/i18n';
  import Icon from './Icon.svelte';
  import type { Command, Item, MenuSpec } from '$lib/app/commands';

  /** Menu bar for the browser (Tauri shows the native one), from the same specs: each menu a native
   *  popover, submenus nested in it. Shortcuts are only shown here; `runShortcut` handles the keys.
   *  ponytail: mouse and Esc only, no arrow keys nor hover-switching between menus; Bits UI Menubar if needed. */
  let { menus }: { menus: MenuSpec[] } = $props();
  const uid = $props.id();

  // Native items a page can't run are dropped; Cut/Copy fire the DOM clipboard events (app/clipboard.ts).
  // Paste can't be triggered by a page: listed for its shortcut only.
  const clipboard: Partial<Record<string, Item>> = {
    Cut: { text: L('Cut'), accelerator: 'CmdOrCtrl+X', run: () => document.execCommand('cut') },
    Copy: { text: L('Copy'), accelerator: 'CmdOrCtrl+C', run: () => document.execCommand('copy') },
    Paste: { text: L('Paste'), accelerator: 'CmdOrCtrl+V', enabled: false, run: () => {} },
  };
  const isSep = (i: Item) => 'native' in i && i.native === 'Separator';
  function web(items: Item[]): Item[] {
    const out: Item[] = [];
    for (const i of items) {
      const x = !('native' in i) ? ('submenu' in i ? { ...i, items: web(i.items) } : i) : isSep(i) ? i : clipboard[i.native];
      if (x && (!isSep(x) || (out.length && !isSep(out.at(-1)!)))) out.push(x); // no leading or doubled separators
    }
    if (out.length && isSep(out.at(-1)!)) out.pop();
    return out;
  }
  const shown = $derived(menus.map((m) => ({ ...m, items: web(m.items) })).filter((m) => m.items.length));

  const glyph: Record<string, string> = { ctrl: '⌃', alt: '⌥', shift: '⇧', cmdorctrl: '⌘', up: '↑', down: '↓' };
  const order = Object.keys(glyph);
  function shortcut(accelerator: string) {
    const parts = accelerator.toLowerCase().split('+'), key = parts.pop()!;
    return parts.sort((a, b) => order.indexOf(a) - order.indexOf(b)).map((p) => glyph[p]).join('') + (glyph[key] ?? key.toUpperCase());
  }

  function run(item: Command, e: MouseEvent) {
    (e.currentTarget as HTMLElement).closest<HTMLElement>('.menu.root')?.hidePopover(); // closes its submenus too
    item.run();
  }
</script>

{#snippet list(items: Item[], path: string)}
  {#each items as item, j (j)}
    {#if 'native' in item}
      <hr />
    {:else if 'submenu' in item}
      <button type="button" class="item" popovertarget="{path}-{j}" style:anchor-name="--{path}-{j}">
        {#if item.icon}<Icon name={item.icon} />{/if}
        <span class="text">{item.submenu}</span><span class="hint">▸</span>
      </button>
      <div id="{path}-{j}" class="menu sub" popover="auto" style:position-anchor="--{path}-{j}">
        {@render list(item.items, `${path}-${j}`)}
      </div>
    {:else}
      <button type="button" class="item" disabled={item.enabled === false} onclick={(e) => run(item, e)}>
        {#if item.icon}<Icon name={item.icon} />{/if}
        <span class="text">{item.text}</span><span class="hint">{item.accelerator ? shortcut(item.accelerator) : (item.key ?? '')}</span>
      </button>
    {/if}
  {/each}
{/snippet}

<nav class="bar" aria-label={L('Menu')}>
  {#each shown as m, i (m.text)}
    <button type="button" class="title" popovertarget="menu-{uid}-{i}" style:anchor-name="--menu-{uid}-{i}">{m.text}</button>
    <div id="menu-{uid}-{i}" class="menu root" popover="auto" style:position-anchor="--menu-{uid}-{i}">
      {@render list(m.items, `menu-${uid}-${i}`)}
    </div>
  {/each}
</nav>

<style>
  .bar {
    display: flex;
    align-items: center;
    height: 24px;
    padding: 0 var(--space-1);
    background: var(--panel);
    border-bottom: var(--hairline) solid var(--border);
  }
  button {
    border: none;
    background: none;
  }
  .title {
    padding: 2px var(--space-2);
    border-radius: var(--radius-1);
  }
  .title:first-child {
    font-weight: 600;
  }
  .title:hover,
  .title:has(+ :popover-open) {
    background: var(--hover);
  }
  .menu {
    /* WebKit keeps the popover's UA `inset: 0`: size it to its content (see ColorField) */
    inset: auto;
    height: max-content;
    min-width: 200px;
    margin: 0;
    padding: var(--space-1);
    border: none;
    border-radius: var(--radius-2);
    background: var(--panel);
    color: var(--text);
    box-shadow: var(--shadow);
  }
  .menu.root {
    position-area: bottom span-right;
  }
  .menu.sub {
    position-area: right span-bottom;
    position-try-fallbacks: flip-inline;
  }
  .menu:popover-open {
    display: grid;
  }
  .item {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    padding: 3px var(--space-2);
    border-radius: var(--radius-1);
    text-align: left;
  }
  .item:hover:not(:disabled),
  .item:has(+ :popover-open) {
    background: var(--accent);
    color: var(--on-accent);
  }
  .item:disabled {
    color: var(--text-3);
  }
  .text {
    flex: 1;
    margin-right: var(--space-4);
  }
  .hint {
    color: inherit;
    opacity: 0.6;
  }
  hr {
    width: 100%;
    margin: var(--space-1) 0;
    border: none;
    border-top: var(--hairline) solid var(--border);
  }
</style>

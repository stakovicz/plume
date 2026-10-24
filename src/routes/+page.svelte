<script lang="ts">
  import { onMount } from 'svelte';
  import { isTauri } from '@tauri-apps/api/core';
  import { getCurrentWindow } from '@tauri-apps/api/window';
  import { L } from '$lib/i18n';
  import { Doc } from '$lib/document/doc.svelte';
  import { TOOLS, toolTooltip } from '$lib/document/tool';
  import { Files } from '$lib/app/files.svelte';
  import { installNativeMenu, menus, quit, runShortcut } from '$lib/app/commands';
  import { installClipboard, isTyping } from '$lib/app/clipboard';
  import Canvas from '$lib/ui/canvas/Canvas.svelte';
  import Inspector from '$lib/ui/Inspector.svelte';
  import LayerList from '$lib/ui/LayerList.svelte';
  import IconButton from '$lib/ui/kit/IconButton.svelte';
  import MenuBar from '$lib/ui/kit/MenuBar.svelte';
  import ExportDialog from '$lib/ui/ExportDialog.svelte';
  import { fontsReady, loadUsedFonts, systemFonts } from '$lib/app/fonts.svelte';

  const doc = new Doc();
  const files = new Files(doc);
  // Side panels, collapsible (⌥⌘1 / ⌥⌘2, or the buttons over the canvas). Per-machine convenience → localStorage.
  type Which = 'navigator' | 'inspector';
  let open = $state<Record<Which, boolean>>({ navigator: true, inspector: true });
  try { Object.assign(open, JSON.parse(localStorage.getItem('panels') ?? '{}')); } catch { /* defaults */ }
  function toggle(which: Which) {
    // the canvas's left edge moves with the navigator: shift the view so the drawing stays put on screen
    if (which === 'navigator') {
      const w = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--sidebar-w'));
      doc.pan = { x: doc.pan.x + (open.navigator ? w : -w), y: doc.pan.y };
    }
    open[which] = !open[which];
    try { localStorage.setItem('panels', JSON.stringify(open)); } catch { /* not persisted */ }
  }
  let exporting = $state(false);
  let fontsLoaded = $state(false); // text is laid out with the bundled fonts' metrics
  fontsReady.then(() => (fontsLoaded = true));
  $effect(() => loadUsedFonts(doc.layers));
  const specs = $derived(menus(doc, files, { toggle, openExport: () => (exporting = true) }));



  $effect(() => {
    if (isTauri()) installNativeMenu(specs); // rebuilt when recents change
  });

  $effect(() => {
    if (doc.dragging) return; // isDirty serializes the document: once the drag ends, not on every mouse move
    const title = `${files.title()}${doc.isDirty ? ` — ${L('Edited')}` : ''}`;
    if (isTauri()) getCurrentWindow().setTitle(title);
    else document.title = title;
  });

  onMount(() => installClipboard(doc));

  onMount(() => {
    files.openAtLaunch();
    if (!isTauri()) {
      const guard = (e: BeforeUnloadEvent) => doc.isDirty && e.preventDefault();
      addEventListener('beforeunload', guard);
      return () => removeEventListener('beforeunload', guard);
    }
    // no web page context menu (Reload, Inspect Element) in the app; text fields keep theirs (copy, paste)
    addEventListener('contextmenu', (e) => !isTyping(e.target) && e.preventDefault());
    // Red button / ⌘W: save prompt first, Cancel keeps the window (single-window app: closing quits).
    const unlisten = getCurrentWindow().onCloseRequested((e) => {
      e.preventDefault();
      quit(files);
    });
    return () => void unlisten.then((f) => f());
  });

  function keydown(e: KeyboardEvent) {
    if (e.key === 'Shift' || e.key === 'Alt') {
      doc.shift = e.shiftKey;
      doc.option = e.altKey;
    }
    if (exporting || runShortcut(specs, e) || isTyping(e.target)) return; // a modal dialog has the keyboard
    if ((e.key === 'Backspace' || e.key === 'Delete') && !e.metaKey) {
      e.preventDefault();
      doc.deleteSelected();
    }
  }

  function keyup(e: KeyboardEvent) {
    doc.shift = e.shiftKey;
    doc.option = e.altKey;
  }
</script>

<svelte:window onkeydown={keydown} onkeyup={keyup} onblur={() => (doc.shift = doc.option = false)} />

<ExportDialog {files} open={exporting} onclose={() => (exporting = false)} />

<div class="app" class:no-navigator={!open.navigator} class:no-inspector={!open.inspector}>
  {#if !isTauri()}<div class="menubar"><MenuBar menus={specs} /></div>{/if}
  {#if open.navigator}
    <aside class="layers">
      <header>
        <h2>{L('Navigator')}</h2>
        <IconButton quiet icon="sidebar-left" label="{L('Show/Hide Navigator')} (⌥⌘1)" onclick={() => toggle('navigator')} />
      </header>
      <LayerList {doc} />
    </aside>
  {/if}
  <div class="stage">
    {#if fontsLoaded}{#key systemFonts.loaded}<Canvas {doc} />{/key}{/if}
    <!-- a hidden panel's header is gone with it: this brings it back -->
    {#if !open.navigator}
      <div class="float left">
        <IconButton quiet icon="sidebar-left" label="{L('Show/Hide Navigator')} (⌥⌘1)" onclick={() => toggle('navigator')} />
      </div>
    {/if}
    {#if !open.inspector}
      <div class="float right">
        <IconButton quiet icon="sidebar-right" label="{L('Show/Hide Inspector')} (⌥⌘2)" onclick={() => toggle('inspector')} />
      </div>
    {/if}
  </div>
  {#if open.inspector}
    <aside class="inspector">
      <header>
        <div class="tools" role="toolbar" aria-label={L('Tools')}>
          {#each TOOLS.filter((t) => t !== 'artboard') as t (t)}
            <IconButton icon={t} label={toolTooltip(t)} active={doc.tool === t} onclick={() => (doc.tool = t)} />
          {/each}
        </div>
        <button type="button" class="zoom" title={L('Double-click: 100%')} ondblclick={() => doc.zoomToActualSize()}>
          {Math.round(doc.zoom * 100)}%
        </button>
        <IconButton quiet icon="sidebar-right" label="{L('Show/Hide Inspector')} (⌥⌘2)" onclick={() => toggle('inspector')} />
      </header>
      <Inspector {doc} />
    </aside>
  {/if}
</div>

<style>
  .app {
    display: grid;
    grid-template-columns: var(--sidebar-w) 1fr var(--inspector-w);
    grid-template-rows: auto 1fr; /* the browser's menu bar (empty under Tauri), then the panels */
    height: 100vh;
  }
  .app > :global(*) {
    grid-row: 2;
  }
  .app > .menubar {
    grid-row: 1;
    grid-column: 1 / -1;
  }
  .app.no-navigator {
    grid-template-columns: 1fr var(--inspector-w);
  }
  .app.no-inspector {
    grid-template-columns: var(--sidebar-w) 1fr;
  }
  .app.no-navigator.no-inspector {
    grid-template-columns: 1fr;
  }
  .stage {
    position: relative;
    display: grid;
    min-width: 0;
  }
  /* panel toggles over the canvas corners, always there to bring a hidden panel back */
  .float {
    position: absolute;
    top: var(--space-2);
    padding: var(--hairline);
    border-radius: var(--radius-2);
    background: var(--panel);
    box-shadow: var(--shadow);
  }
  .float.left {
    left: var(--space-2);
  }
  .float.right {
    right: var(--space-2);
  }
  /* both side panels' headers: one height, border included, so they line up */
  header {
    box-sizing: border-box;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-2);
    height: var(--toolbar-h);
    padding: 0 var(--space-2);
    border-bottom: var(--hairline) solid var(--border);
  }
  .tools {
    display: flex;
    gap: var(--hairline);
  }
  .zoom {
    min-width: 4em;
    margin-left: auto;
    border: none;
    background: none;
    font-size: var(--text-12);
    font-variant-numeric: tabular-nums;
    color: var(--text-2);
  }
  aside {
    display: grid;
    min-height: 0;
    background: var(--panel);
  }
  .layers {
    grid-template-rows: auto 1fr; /* title (same height as the tools on the right), then the tree */
    border-right: var(--hairline) solid var(--border);
  }
  h2 {
    margin: 0;
    padding: 0 var(--space-1);
    font-size: var(--text-12);
    font-weight: 600;
    color: var(--text-2);
  }
  .inspector {
    grid-template-rows: auto 1fr; /* tools, then the scrolling inspector */
    border-left: var(--hairline) solid var(--border);
  }
</style>

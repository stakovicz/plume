<script lang="ts">
  import { tick } from 'svelte';
  import { SvelteSet } from 'svelte/reactivity';
  import { L } from '$lib/i18n';
  import type { Doc } from '$lib/document/doc.svelte';
  import { type Layer, isContainer } from '$lib/model/layer';
  import { ancestors, find, parent } from '$lib/model/layer-tree';
  import Icon, { type IconName } from '$lib/ui/kit/Icon.svelte';
  import IconButton from '$lib/ui/kit/IconButton.svelte';
  import InlineName from '$lib/ui/kit/InlineName.svelte';

  /** Left column: the layer tree, top of the stack first; ⌘/⇧-click for several.
   *  Follows the selection: groups containing a layer selected on the canvas open, and the list scrolls to it. */
  let { doc }: { doc: Doc } = $props();

  const expanded = new SvelteSet<string>();
  let list: HTMLElement;
  const icons: Record<Layer['kind'], IconName> = { rect: 'rect', ellipse: 'ellipse', path: 'path', group: 'group', artboard: 'artboard', text: 'text' };

  $effect(() => {
    const ids = [...doc.selectedIDs];
    for (const id of ids) for (const a of ancestors(doc.layers, id)) expanded.add(a.id);
    if (ids[0]) tick().then(() => list.querySelector(`[data-id="${ids[0]}"]`)?.scrollIntoView({ block: 'nearest' }));
  });

  // Drag and drop: rows move by pointer events (HTML5 drag and drop can be swallowed by Tauri's file-drop handler).
  // Above/below a row = insert next to it (the list is top of the stack first); the middle of a group or
  // artboard row = into it, at the top.
  type Drop = { id: string; zone: 'above' | 'below' | 'into' };
  let drag = $state<{ ids: string[]; over: Drop | null } | null>(null);

  /** Where the dragged layers would land, as (parent, index in its children), or null if they can't. */
  function destination(ids: string[], over: Drop): { parentID: string | null; index: number } | null {
    const target = find(doc.layers, over.id);
    if (!target) return null;
    let dest: { parentID: string | null; index: number };
    if (over.zone === 'into' || (over.zone === 'below' && isContainer(target) && expanded.has(target.id))) {
      dest = { parentID: target.id, index: target.children.length };
    } else {
      const p = parent(doc.layers, target.id), list = p ? p.children : doc.layers;
      const i = list.findIndex((l) => l.id === target.id);
      dest = { parentID: p?.id ?? null, index: over.zone === 'above' ? i + 1 : i };
    }
    return doc.canMoveLayers(ids, dest.parentID) ? dest : null;
  }

  function startDrag(e: PointerEvent, id: string) {
    if (e.button !== 0 || e.metaKey || e.shiftKey) return;
    const x0 = e.clientX, y0 = e.clientY;
    const ids = doc.selectedIDs.has(id) ? [...doc.selectedIDs] : [id];
    const move = (ev: PointerEvent) => {
      if (!drag && Math.hypot(ev.clientX - x0, ev.clientY - y0) < 4) return;
      drag ??= { ids, over: null };
      const row = document.elementFromPoint(ev.clientX, ev.clientY)?.closest<HTMLElement>('li[data-id]');
      const target = row && find(doc.layers, row.dataset.id!);
      if (!row || !target) return void (drag.over = null);
      const r = row.getBoundingClientRect(), f = (ev.clientY - r.top) / r.height;
      const zone = isContainer(target) ? (f < 0.25 ? 'above' : f > 0.75 ? 'below' : 'into') : f < 0.5 ? 'above' : 'below';
      const over: Drop = { id: target.id, zone };
      drag.over = destination(ids, over) ? over : null;
    };
    const up = () => {
      removeEventListener('pointermove', move);
      removeEventListener('pointerup', up);
      const over = drag?.over, dest = over && destination(ids, over);
      if (over && dest) {
        if (dest.parentID) expanded.add(dest.parentID);
        doc.moveLayers(ids, dest.parentID, dest.index);
      } else if (!drag) {
        doc.selection = id; // plain click, no drag
      }
      drag = null;
    };
    addEventListener('pointermove', move);
    addEventListener('pointerup', up);
  }

  /** Keyboard, Finder-style: ↑/↓ go to the previous/next visible row (⇧ extends the selection; ↓ on a
   *  closed group with nothing below opens it and goes in),
   *  → opens a group/artboard (then goes to its top layer), ← closes it (then goes to its parent),
   *  Return renames. Acts on the focused row. */
  function keydown(e: KeyboardEvent) {
    const id = (e.target as HTMLElement).closest<HTMLElement>('li[data-id]')?.dataset.id;
    const l = id ? find(doc.layers, id) : null;
    if (!l || doc.renaming || e.metaKey || e.ctrlKey) return; // ⌥⌘↑/↓ reorder: menu shortcuts, not row navigation
    let next: string | null = null;
    if (e.key === 'Enter') doc.startRename(l.id, 'list');
    else if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      const rows = [...list.querySelectorAll<HTMLElement>('li[data-id]')]; // visible rows, in display order
      const i = rows.findIndex((r) => r.dataset.id === l.id) + (e.key === 'ArrowUp' ? -1 : 1);
      const to = rows[i]?.dataset.id;
      if (!to && e.key === 'ArrowDown' && isContainer(l) && !expanded.has(l.id) && l.children.length) {
        e.preventDefault(); // nothing below a closed group: open it and go in
        expanded.add(l.id);
        next = l.children.at(-1)!.id;
        doc.selection = next;
        const target = next;
        tick().then(() => list.querySelector<HTMLElement>(`li[data-id="${target}"]`)?.focus());
        return;
      }
      if (!to) return e.preventDefault();
      e.preventDefault();
      if (e.shiftKey) doc.selectedIDs = new Set([...doc.selectedIDs, to]);
      else doc.selection = to;
      rows[i].focus();
      return;
    }    else if (e.key === 'ArrowRight') {
      if (!isContainer(l)) return;
      if (!expanded.has(l.id)) expanded.add(l.id);
      else next = l.children.at(-1)?.id ?? null; // the list shows the top of the stack first
    } else if (e.key === 'ArrowLeft') {
      if (isContainer(l) && expanded.has(l.id)) expanded.delete(l.id);
      else next = parent(doc.layers, l.id)?.id ?? null;
    } else return;
    e.preventDefault();
    if (next) {
      doc.selection = next;
      const target = next;
      tick().then(() => list.querySelector<HTMLElement>(`li[data-id="${target}"]`)?.focus());
    }
  }

  function select(e: MouseEvent, id: string) {
    if (e.metaKey || e.shiftKey) {
      const ids = new Set(doc.selectedIDs);
      if (ids.has(id)) ids.delete(id);
      else ids.add(id);
      doc.selectedIDs = ids;
    } else if (!(doc.selectedIDs.has(id) && doc.selectedIDs.size > 1)) {
      doc.selection = id; // a click inside a multiple selection narrows it on release, so the selection can be dragged
    }
  }
</script>

{#snippet rows(layers: Layer[], depth: number, hiddenByGroup: boolean, lockedByGroup: boolean)}
  {#each layers.toReversed() as l (l.id)}
    {@const open = expanded.has(l.id)}
    <!-- svelte-ignore a11y_click_events_have_key_events -- keys are handled by the tree (ul onkeydown) -->
    <li
      data-id={l.id}
      class:selected={doc.selectedIDs.has(l.id)}
      class:dim={l.hidden || hiddenByGroup}
      class:hidden-own={l.hidden}
      class:locked-own={l.locked}
      style:--depth={depth}
      role="treeitem"
      aria-selected={doc.selectedIDs.has(l.id)}
      aria-expanded={isContainer(l) ? open : undefined}
      class:drop-above={drag?.over?.id === l.id && drag.over.zone === 'above'}
      class:drop-below={drag?.over?.id === l.id && drag.over.zone === 'below'}
      class:drop-into={drag?.over?.id === l.id && drag.over.zone === 'into'}
      onpointerdown={(e) => { select(e, l.id); startDrag(e, l.id); }}
      tabindex="-1"
      onclick={(e) => e.detail === 3 && doc.startRename(l.id, 'list')}

    >
      {#if isContainer(l)}
        <button type="button" class="disclosure" class:open aria-label={l.name}
          onpointerdown={(e) => e.stopPropagation()}
          onclick={() => (open ? expanded.delete(l.id) : expanded.add(l.id))}><Icon name="chevron" /></button>
      {:else}
        <span class="disclosure"></span>
      {/if}
      <Icon name={icons[l.kind]} />
      {#if doc.renaming?.id === l.id && doc.renaming.where === 'list'}
        <span class="name"><InlineName label={L('Name')} value={l.name} oncommit={(n) => doc.rename(l.id, n)} oncancel={() => (doc.renaming = null)} /></span>
      {:else}
        <span class="name">{l.name}</span>
      {/if}
      <!-- padlock and eye: on hover, or always when active; inherited ones faint, not toggles -->
      <span class="toggles" onpointerdown={(e) => e.stopPropagation()} role="presentation">
        {#if lockedByGroup && !l.locked}
          <span class="inherited" title={L('Locked by its group')}><Icon name="lock" /></span>
        {/if}
        <span class="toggle lock"><IconButton quiet icon={l.locked ? 'lock' : 'lock-open'} label={L('Lock/Unlock')} onclick={() => doc.toggleLocked([l.id])} /></span>
        {#if hiddenByGroup && !l.hidden}
          <span class="inherited" title={L('Hidden by its group')}><Icon name="eye-off" /></span>
        {/if}
        <span class="toggle eye"><IconButton quiet icon={l.hidden ? 'eye-off' : 'eye'} label={L('Show/Hide')} onclick={() => doc.toggleHidden([l.id])} /></span>
      </span>
    </li>
    {#if isContainer(l) && open}
      {@render rows(l.children, depth + 1, hiddenByGroup || l.hidden, lockedByGroup || l.locked)}
    {/if}
  {/each}
{/snippet}

<!-- svelte-ignore a11y_no_noninteractive_element_interactions -- tree keyboard handling, delegated from the rows -->
<ul bind:this={list} class:dragging={!!drag} onkeydown={keydown} role="tree" aria-label={L('Layers')} aria-multiselectable="true">
  {@render rows(doc.layers, 0, false, false)}
</ul>

<style>
  ul {
    margin: 0;
    padding: var(--space-1) 0;
    list-style: none;
    overflow: auto;
  }
  li {
    display: flex;
    align-items: center;
    gap: var(--space-1);
    height: var(--control-h);
    margin: 0 var(--space-1);
    padding-left: calc(var(--depth) * var(--space-3) + var(--space-1));
    padding-right: var(--space-1);
    border-radius: var(--radius-1);
    font-size: var(--text-12);
  }
  li:hover {
    background: var(--hover);
  }
  li.selected {
    background: var(--accent);
    color: var(--on-accent);
  }
  ul.dragging,
  ul.dragging li {
    cursor: grabbing;
  }
  li.drop-above {
    box-shadow: inset 0 calc(2 * var(--hairline)) var(--accent);
  }
  li.drop-below {
    box-shadow: inset 0 calc(-2 * var(--hairline)) var(--accent);
  }
  li.drop-into {
    background: var(--accent-soft);
    box-shadow: inset 0 0 0 calc(2 * var(--hairline)) var(--accent);
  }
  li.dim > :global(svg),
  li.dim > .name {
    opacity: 0.4;
  }
  .name {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .disclosure {
    display: grid;
    place-items: center;
    flex: none;
    width: var(--icon);
    height: var(--icon);
    padding: 0;
    border: none;
    background: none;
    color: inherit;
  }
  .disclosure :global(svg) {
    transition: transform 0.12s;
  }
  .disclosure.open :global(svg) {
    transform: rotate(90deg);
  }
  .toggles {
    display: flex;
    gap: var(--hairline);
  }
  .toggles :global(button) {
    color: inherit;
  }
  .inherited {
    display: grid;
    color: var(--text-3);
  }
  /* Inherited state replaces the toggle until hover, which shows the layer's own toggle instead. */
  .toggle {
    display: none;
  }
  .inherited + .toggle {
    display: none !important;
  }
  li:hover .toggle,
  li.locked-own .toggle.lock,
  li.hidden-own .toggle.eye {
    display: grid;
  }
  li:hover .inherited {
    display: none;
  }
  li:hover .inherited + .toggle {
    display: grid !important;
  }
  /* keep the column width stable when no toggle shows */
  .toggles {
    min-width: calc(2 * var(--control-h) - var(--space-1));
    justify-content: flex-end;
  }
</style>

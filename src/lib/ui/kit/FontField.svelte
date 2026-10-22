<script lang="ts">
  import { L } from '$lib/i18n';

  /** Font family picker: a button showing the family in its own face, opening a list (native popover)
   *  where each family previews itself, with a filter field. ↑/↓ move, Return picks, Escape closes.
   *  `options` as for Select: a family not in the list (imported file) is shown as is. */
  let { value, options, onchange, label, disabled = false }: {
    value: string; options: { value: string; title: string; group?: string }[]; onchange: (v: string) => void;
    label: string; disabled?: boolean;
  } = $props();

  const uid = $props.id();
  let query = $state(''), active = $state(0), panel = $state<HTMLElement>(), field = $state<HTMLInputElement>();

  const shown = $derived(options.filter((o) => o.title.toLowerCase().includes(query.trim().toLowerCase())));
  const groups = $derived([...new Set(shown.map((o) => o.group))]);
  const family = (f: string) => `"${f.replace(/"/g, '')}", var(--font)`;

  function pick(v: string) {
    panel?.hidePopover();
    if (v !== value) onchange(v);
  }
  function move(to: number) {
    active = Math.min(Math.max(to, 0), shown.length - 1);
    panel?.querySelector(`#font-${uid}-${active}`)?.scrollIntoView({ block: 'nearest' });
  }
  function keys(e: KeyboardEvent) {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      move(active + (e.key === 'ArrowDown' ? 1 : -1));
    } else if (e.key === 'Enter' && shown[active]) {
      e.preventDefault();
      pick(shown[active].value);
    }
  }
</script>

<button type="button" class="field" aria-label={label} title={value} {disabled} popovertarget="font-{uid}"
  style:anchor-name="--font-{uid}" style:font-family={family(value)}>
  <span>{value}</span>
</button>

<div
  id="font-{uid}"
  class="panel"
  popover="auto"
  bind:this={panel}
  style:position-anchor="--font-{uid}"
  ontoggle={(e) => {
    if (e.newState !== 'open') return;
    query = '';
    move(Math.max(0, options.findIndex((o) => o.value === value)));
    field?.focus();
  }}
>
  <input
    bind:this={field}
    class="filter"
    role="combobox"
    aria-label={L('Search')}
    aria-expanded="true"
    aria-controls="font-{uid}-list"
    aria-activedescendant={shown[active] ? `font-${uid}-${active}` : undefined}
    placeholder={L('Search')}
    spellcheck="false"
    bind:value={query}
    oninput={() => (active = 0)}
    onkeydown={keys}
  />
  <div class="list" id="font-{uid}-list" role="listbox" aria-label={label}>
    {#each groups as g (g)}
      {#if g}<div class="group" role="presentation">{g}</div>{/if}
      {#each shown as o, i (o.value)}
        {#if o.group === g}
          <div
            id="font-{uid}-{i}"
            class="option"
            class:active={i === active}
            role="option"
            aria-selected={o.value === value}
            tabindex="-1"
            style:font-family={family(o.value)}
            onpointerenter={() => (active = i)}
            onclick={() => pick(o.value)}
            onkeydown={keys}
          >{o.title}</div>
        {/if}
      {/each}
    {/each}
    {#if !shown.length}<div class="empty">{L('No match')}</div>{/if}
  </div>
</div>

<style>
  .field {
    display: flex;
    align-items: center;
    height: var(--control-h);
    min-width: 0;
    padding: 0 var(--space-1);
    border: var(--hairline) solid var(--border-strong);
    border-radius: var(--radius-1);
    background: var(--field);
    color: var(--text);
    font-size: var(--text-12);
    text-align: start;
  }
  .field span {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .field:focus-visible {
    border-color: var(--accent);
    outline: none;
  }
  .field:disabled {
    opacity: 0.5;
  }

  .panel {
    /* WebKit keeps the popover's UA `inset: 0`: size it to its content (as ColorField) */
    inset: auto;
    height: max-content;
    position-area: left center;
    position-try-fallbacks: flip-inline, flip-block;
    width: 240px;
    margin: var(--space-2);
    padding: var(--space-2);
    border: none;
    border-radius: var(--radius-2);
    background: var(--panel);
    color: var(--text);
    box-shadow: var(--shadow);
  }
  .panel:popover-open {
    display: grid;
    gap: var(--space-2);
  }

  .filter {
    height: var(--control-h);
    padding: 0 var(--space-1);
    border: var(--hairline) solid var(--border-strong);
    border-radius: var(--radius-1);
    background: var(--field);
    font-size: var(--text-12);
    outline: none;
    user-select: text;
    -webkit-user-select: text;
  }
  .filter:focus {
    border-color: var(--accent);
  }

  .list {
    max-height: 320px;
    overflow-y: auto;
  }
  .group,
  .empty {
    padding: var(--space-1);
    font-size: var(--text-11);
    color: var(--text-2);
  }
  .option {
    padding: var(--space-1);
    border-radius: var(--radius-1);
    font-size: var(--text-13);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    cursor: default;
    /* hundreds of faces: only the visible ones are laid out */
    content-visibility: auto;
    contain-intrinsic-size: auto 24px;
  }
  .option.active {
    background: var(--hover);
  }
  .option[aria-selected='true'] {
    color: var(--accent);
  }
</style>

<script lang="ts">
  /** Native drop-down (a pop-up button on macOS). `placeholder` shows when `value` matches no option. */
  let { value, options, onchange, label, placeholder = '', disabled = false }: {
    value: string; options: { value: string; title: string; group?: string }[]; onchange: (v: string) => void;
    label: string; placeholder?: string; disabled?: boolean;
  } = $props();

  const groups = $derived([...new Set(options.map((o) => o.group))]);
</script>

<select aria-label={label} {disabled} value={options.some((o) => o.value === value) ? value : ''} onchange={(e) => onchange(e.currentTarget.value)}>
  {#if placeholder}<option value="" disabled>{placeholder}</option>{/if}
  {#each groups as g (g)}
    {#if g}
      <optgroup label={g}>
        {#each options.filter((o) => o.group === g) as o (o.value)}<option value={o.value}>{o.title}</option>{/each}
      </optgroup>
    {:else}
      {#each options.filter((o) => !o.group) as o (o.value)}<option value={o.value}>{o.title}</option>{/each}
    {/if}
  {/each}
</select>

<style>
  select {
    height: var(--control-h);
    padding: 0 var(--space-1);
    border: var(--hairline) solid var(--border-strong);
    border-radius: var(--radius-1);
    background: var(--field);
    font-size: var(--text-12);
    outline: none;
  }
  select:focus {
    border-color: var(--accent);
  }
  select:disabled {
    opacity: 0.5;
  }
</style>

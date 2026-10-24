<script lang="ts">
  import { L } from '$lib/i18n';

  /** Number input. Commits on Return/blur (one undo step), Escape reverts. `NaN`: values differ (multiple selection).
   *  ↑/↓ keys or the stepper buttons step by `step`, ⇧ by 10 × step, committed at once. */
  let { value, onchange, label, step = 1, digits = 1, min = -Infinity, max = Infinity, suffix = '', disabled = false }: {
    value: number; onchange: (v: number) => void; label: string;
    step?: number; digits?: number; min?: number; max?: number; suffix?: string; disabled?: boolean;
  } = $props();

  const format = (v: number) => (Number.isNaN(v) ? '' : String(Math.round(v * 10 ** digits) / 10 ** digits));
  let draft = $state<string | null>(null); // text being typed; null = show `value`

  function commit(v: number) {
    draft = null;
    if (Number.isFinite(v)) onchange(Math.min(Math.max(v, min), max));
  }

  /** From what's typed, if it's a number, else from `value`. */
  function stepBy(sign: 1 | -1, shift: boolean) {
    const base = parseFloat(draft ?? '');
    commit((Number.isFinite(base) ? base : value) + sign * step * (shift ? 10 : 1));
  }

  function keydown(e: KeyboardEvent) {
    const input = e.currentTarget as HTMLInputElement;
    if (e.key === 'Enter') commit(parseFloat(input.value));
    else if (e.key === 'Escape') { draft = null; input.blur(); }
    else if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      e.preventDefault();
      stepBy(e.key === 'ArrowUp' ? 1 : -1, e.shiftKey);
    }
  }
</script>

<label class:disabled>
  <!-- the unit sits right after the number: an invisible copy of the text pushes it along, the input lies on top -->
  {#if suffix && !Number.isNaN(value)}<span class="unit" aria-hidden="true"><span class="ghost">{draft ?? format(value)}</span>{suffix}</span>{/if}
  <input
    type="text"
    inputmode="decimal"
    aria-label={label}
    title={label}
    {disabled}
    placeholder={Number.isNaN(value) ? L('Multiple') : undefined}
    value={draft ?? format(value)}
    oninput={(e) => (draft = e.currentTarget.value)}
    onkeydown={keydown}
    onblur={() => draft !== null && commit(parseFloat(draft))}
  />
  <!-- not in the tab order (↑/↓ do the same from the keyboard); mousedown kept from stealing the input's focus -->
  <div class="stepper">
    {#each [[1, L('Increase'), 'm4 6.5 3-3 3 3'], [-1, L('Decrease'), 'm4 2.5 3 3 3-3']] as const as [sign, text, d] (sign)}
      <button type="button" tabindex="-1" aria-label={text} {disabled}
        onmousedown={(e) => e.preventDefault()} onclick={(e) => stepBy(sign, e.shiftKey)}>
        <svg viewBox="0 0 14 9" aria-hidden="true"><path {d} /></svg>
      </button>
    {/each}
  </div>
</label>

<style>
  label {
    position: relative;
    display: flex;
    align-items: center;
    height: var(--control-h);
    padding: 0 var(--space-1) 0 0;
    border: var(--hairline) solid var(--border-strong);
    border-radius: var(--radius-1);
    background: var(--field);
  }
  label:focus-within {
    border-color: var(--accent);
  }
  label.disabled {
    opacity: 0.5;
  }
  input {
    flex: 1;
    min-width: 0;
    height: 100%;
    padding: 0 var(--space-1);
    border: none;
    background: none;
    font-family: var(--font-numeric);
    font-size: var(--text-12);
    font-variant-numeric: tabular-nums slashed-zero;
    outline: none;
    user-select: text;
    -webkit-user-select: text;
  }
  .unit {
    position: absolute;
    inset: 0 auto 0 0;
    display: flex;
    align-items: center;
    padding: 0 var(--space-1);
    font-family: var(--font-numeric);
    font-size: var(--text-12);
    color: var(--text-2);
    white-space: pre;
    pointer-events: none;
  }
  .ghost {
    font-variant-numeric: tabular-nums slashed-zero; /* same width as the field's text: the unit follows it */
    visibility: hidden;
  }
  .stepper {
    display: grid;
    grid-template-rows: 1fr 1fr;
    align-self: stretch;
    margin-left: var(--space-1);
  }
  .stepper button {
    display: grid;
    place-items: center;
    width: var(--stepper-w);
    padding: 0;
    border: none;
    background: none;
    color: var(--text-3);
  }
  .stepper button:hover:not(:disabled) {
    color: var(--text);
  }
  .stepper svg {
    width: var(--stepper-w);
    fill: none;
    stroke: currentColor;
    stroke-width: 1.3;
    stroke-linecap: round;
    stroke-linejoin: round;
  }
</style>

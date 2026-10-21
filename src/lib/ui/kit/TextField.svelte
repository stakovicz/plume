<script lang="ts">
  /** Text input that reports every keystroke (the caller coalesces undo). Escape leaves the field. */
  let { value, oninput, label, disabled = false }: {
    value: string; oninput: (v: string) => void; label: string; disabled?: boolean;
  } = $props();
</script>

<input
  type="text"
  aria-label={label}
  placeholder={label}
  spellcheck="false"
  {disabled}
  {value}
  oninput={(e) => oninput(e.currentTarget.value)}
  onkeydown={(e) => (e.key === 'Enter' || e.key === 'Escape') && e.currentTarget.blur()}
/>

<style>
  input {
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
  input:focus {
    border-color: var(--accent);
  }
  input:disabled {
    opacity: 0.5;
  }
</style>

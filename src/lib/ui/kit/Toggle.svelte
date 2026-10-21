<script lang="ts">
  let { checked, onchange, label, disabled = false }: {
    checked: boolean; onchange: (v: boolean) => void; label: string; disabled?: boolean;
  } = $props();
</script>

<label class:disabled>
  <input type="checkbox" {checked} {disabled} onchange={(e) => onchange(e.currentTarget.checked)} />
  {label}
</label>

<style>
  label {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    min-height: var(--control-h);
    font-size: var(--text-12);
  }
  label.disabled {
    opacity: 0.5;
  }
  input {
    margin: 0;
    accent-color: var(--accent);
  }
</style>

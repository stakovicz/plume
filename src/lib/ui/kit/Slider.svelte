<script lang="ts">
  /** Range slider; reports continuously (the caller coalesces undo). */
  let { value, oninput, label, min = 0, max = 1, step = 0.01, disabled = false }: {
    value: number; oninput: (v: number) => void; label: string; min?: number; max?: number; step?: number; disabled?: boolean;
  } = $props();
</script>

<input type="range" aria-label={label} {min} {max} {step} {value} {disabled} oninput={(e) => oninput(e.currentTarget.valueAsNumber)} />

<style>
  input {
    height: var(--control-h);
    margin: 0;
    accent-color: var(--accent);
  }
</style>

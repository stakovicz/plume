<script lang="ts">
  /** Rename in place: focused with its text selected; Return or leaving the field commits, Escape cancels.
   *  Stops pointer and key events so the list/canvas underneath doesn't react while typing. */
  let { value, oncommit, oncancel, label }: {
    value: string; oncommit: (v: string) => void; oncancel: () => void; label: string;
  } = $props();

  let done = false; // Return/Escape end the edit before blur fires
  const finish = (commit: boolean, v: string) => {
    if (done) return;
    done = true;
    const name = v.trim();
    if (commit && name && name !== value) oncommit(name);
    else oncancel();
  };
  const focus = (el: HTMLInputElement) => {
    el.focus();
    el.select();
  };
</script>

<input
  use:focus
  type="text"
  aria-label={label}
  spellcheck="false"
  {value}
  onpointerdown={(e) => e.stopPropagation()}
  onclick={(e) => e.stopPropagation()}
  onkeydown={(e) => {
    e.stopPropagation();
    if (e.key === 'Enter') finish(true, e.currentTarget.value);
    else if (e.key === 'Escape') finish(false, value);
  }}
  onblur={(e) => finish(true, e.currentTarget.value)}
/>

<style>
  input {
    width: 100%;
    min-width: 0;
    height: calc(var(--control-h) - 4px);
    margin: 0;
    padding: 0 3px;
    border: var(--hairline) solid var(--accent);
    border-radius: 3px;
    background: var(--field);
    color: var(--text);
    font: inherit;
    outline: none;
    box-sizing: border-box;
    user-select: text;
    -webkit-user-select: text;
  }
</style>

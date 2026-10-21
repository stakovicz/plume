<script lang="ts">
  import { dev } from '$app/environment';
  import { BLACK, GRAY, type RGBA } from '$lib/model/color';
  import Button from '$lib/ui/kit/Button.svelte';
  import ColorField from '$lib/ui/kit/ColorField.svelte';
  import Dialog from '$lib/ui/kit/Dialog.svelte';
  import Icon from '$lib/ui/kit/Icon.svelte';
  import IconButton from '$lib/ui/kit/IconButton.svelte';
  import MenuBar from '$lib/ui/kit/MenuBar.svelte';
  import NumberField from '$lib/ui/kit/NumberField.svelte';
  import Row from '$lib/ui/kit/Row.svelte';
  import Section from '$lib/ui/kit/Section.svelte';
  import Segmented from '$lib/ui/kit/Segmented.svelte';
  import Select from '$lib/ui/kit/Select.svelte';
  import InlineName from '$lib/ui/kit/InlineName.svelte';
  import Slider from '$lib/ui/kit/Slider.svelte';
  import TextField from '$lib/ui/kit/TextField.svelte';
  import Toggle from '$lib/ui/kit/Toggle.svelte';

  /** Dev-only gallery: every primitive in every state, light and dark side by side, to spot drift. */
  const icons = ['select', 'pen', 'pencil', 'rect', 'ellipse', 'path', 'group', 'artboard', 'eye', 'eye-off', 'lock', 'lock-open', 'plus', 'rotate', 'chevron', 'union', 'subtract', 'intersect', 'difference', 'sidebar-left', 'sidebar-right'] as const;
  let dialog = $state(false);
  let renaming = $state(false), pick = $state(''), n = $state(42), text = $state('Rectangle 1'), seg = $state<'a' | 'b' | 'c'>('a'), on = $state(true), v = $state(0.6);
  let color = $state<RGBA>({ r: 0.2, g: 0.5, b: 0.9, a: 0.8 }), palette = $state<RGBA[]>([BLACK, GRAY]);
</script>

<Dialog open={dialog} title="Dialog" onclose={() => (dialog = false)}>
  <Row label="Format"><Segmented label="seg" value={seg} onchange={(x) => (seg = x)} options={[{ value: 'a', title: 'PDF' }, { value: 'b', title: 'SVG' }, { value: 'c', title: 'PNG' }]} /></Row>
  {#snippet actions()}
    <Button onclick={() => (dialog = false)}>Cancel</Button>
    <Button primary onclick={() => (dialog = false)}>OK</Button>
  {/snippet}
</Dialog>

{#snippet gallery(disabled: boolean)}
  <Section title={disabled ? 'Disabled' : 'Enabled'}>
    <Row label="Icons">{#each icons as i (i)}<Icon name={i} />{/each}</Row>
    <Row label="IconButton">
      <IconButton icon="rect" label="rect" {disabled} onclick={() => {}} />
      <IconButton icon="ellipse" label="active" active {disabled} onclick={() => {}} />
      <IconButton icon="lock" label="quiet" quiet {disabled} onclick={() => {}} />
    </Row>
    <Row label="Button">
      <Button {disabled} onclick={() => {}}>Ungroup</Button>
      <Button primary {disabled} onclick={() => {}}>Export</Button>
    </Row>
    <Row label="MenuBar">
      <MenuBar menus={[
        { text: 'App', items: [{ native: 'About' }, { native: 'Separator' }, { text: 'Quit', accelerator: 'CmdOrCtrl+Q', run: () => {} }] },
        { text: 'Edit', items: [{ text: 'Undo', accelerator: 'CmdOrCtrl+Z', run: () => {} }, { native: 'Copy' }, { native: 'Paste' },
          { native: 'Separator' }, { submenu: 'Combine', items: [{ text: 'Union', accelerator: 'Alt+CmdOrCtrl+U', run: () => {} }] },
          { text: 'Disabled', enabled: false, run: () => {} }] },
      ]} />
    </Row>
    <Row label="Dialog"><Button {disabled} onclick={() => (dialog = true)}>Open…</Button></Row>
    <Row label="Number">
      <NumberField label="n" value={n} {disabled} onchange={(x) => (n = x)} />
      <NumberField label="%" value={n} suffix="%" {disabled} onchange={(x) => (n = x)} />
    </Row>
    <Row label="InlineName">
      {#if renaming && !disabled}
        <InlineName label="Name" value={text} oncommit={(x) => { text = x; renaming = false; }} oncancel={() => (renaming = false)} />
      {:else}
        <Button {disabled} onclick={() => (renaming = true)}>{text}</Button>
      {/if}
    </Row>
    <Row label="Row single + reserve" single reserve><NumberField label="r" value={n} suffix="°" {disabled} onchange={(x) => (n = x)} /></Row>
    <Row label="Text"><TextField label="Name" value={text} {disabled} oninput={(x) => (text = x)} /></Row>
    <Row label="Segmented">
      <Segmented label="seg" value={seg} {disabled} onchange={(x) => (seg = x)}
        options={[{ value: 'a', title: 'Center' }, { value: 'b', title: 'Inside' }, { value: 'c', title: 'Outside' }]} />
    </Row>
    <Row label="Select">
      <Select label="preset" value={pick} placeholder="Custom" {disabled} onchange={(x) => (pick = x)}
        options={[{ value: 'a4', title: 'A4', group: 'Paper' }, { value: 'hd', title: 'Full HD', group: 'Desktop' }]} />
    </Row>
    <Row label="Slider"><Slider label="v" value={v} {disabled} oninput={(x) => (v = x)} /></Row>
    <Row label="Color">
      <ColorField label="color" {color} {palette} {disabled} onchange={(c) => (color = c)}
        onaddtopalette={(c) => (palette = [...palette, c])} onremovefrompalette={(i) => (palette = palette.filter((_, j) => j !== i))} />
    </Row>
    <Toggle label="Shadow" checked={on} {disabled} onchange={(x) => (on = x)} />
  </Section>
{/snippet}

{#if dev}
  <main>
    {#each ['light', 'dark'] as scheme (scheme)}
      <div class="column" style:color-scheme={scheme} data-scheme={scheme}>
        <h2>{scheme}</h2>
        {@render gallery(false)}
        {@render gallery(true)}
      </div>
    {/each}
  </main>
{:else}
  <p>Dev only.</p>
{/if}

<style>
  main {
    display: grid;
    grid-template-columns: repeat(2, var(--inspector-w));
    gap: var(--space-4);
    height: 100vh;
    padding: var(--space-4);
    overflow: auto;
    box-sizing: border-box;
  }
  .column {
    align-self: start;
    border-radius: var(--radius-2);
    background: var(--panel);
    color: var(--text);
  }
  h2 {
    margin: 0;
    padding: var(--space-3) var(--space-3) 0;
    font-size: var(--text-13);
  }
</style>

<script lang="ts">
  import { L } from '$lib/i18n';
  import type { ExportTarget, Files } from '$lib/app/files.svelte';
  import { type Format, FORMATS } from '$lib/app/render';
  import Button from '$lib/ui/kit/Button.svelte';
  import Dialog from '$lib/ui/kit/Dialog.svelte';
  import Row from '$lib/ui/kit/Row.svelte';
  import Segmented from '$lib/ui/kit/Segmented.svelte';

  /** ⌘E: what to export (document, artboards, selection), as what (PDF, SVG, PNG, JPG), at which scale.
   *  Format and scale are kept between openings; the target starts at the selection when there is one. */
  let { files, open, onclose }: { files: Files; open: boolean; onclose: () => void } = $props();

  const TARGETS = [['selection', L('Selection')], ['artboards', L('Artboards')], ['document', L('Document')]] as const;
  let what = $state<ExportTarget>('document'), format = $state<Format>('png'), scale = $state(1);
  const targets = $derived(open ? TARGETS.filter(([t]) => files.canExport(t)) : []);
  const raster = $derived(format === 'png' || format === 'jpg');

  $effect(() => { // on opening: the first available of selection, artboards, document
    if (open && targets.length) what = targets[0][0];
  });

  function run() {
    onclose();
    files.export(what, format, raster ? scale : 1);
  }
</script>

<Dialog {open} title={L('Export')} {onclose}>
  {#if targets.length}
    <Row label={L('Content')}>
      <Segmented label={L('Content')} value={what} onchange={(v) => (what = v)} options={targets.map(([value, title]) => ({ value, title }))} />
    </Row>
    <Row label={L('Format')}>
      <Segmented label={L('Format')} value={format} onchange={(v) => (format = v)} options={FORMATS.map((f) => ({ value: f, title: f.toUpperCase() }))} />
    </Row>
    {#if raster}
      <Row label={L('Scale')}>
        <Segmented label={L('Scale')} value={String(scale)} onchange={(v) => (scale = Number(v))}
          options={['1', '2', '3'].map((s) => ({ value: s, title: `${s}×` }))} />
      </Row>
    {/if}
  {:else}
    <span>{L('Nothing to export.')}</span>
  {/if}
  {#snippet actions()}
    <Button onclick={onclose}>{L('Cancel')}</Button>
    <Button primary disabled={!targets.length} onclick={run}>{L('Export')}</Button>
  {/snippet}
</Dialog>

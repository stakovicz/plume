<script lang="ts">
  import { L } from '$lib/i18n';
  import type { Doc } from '$lib/document/doc.svelte';
  import type { RGBA } from '$lib/model/color';
  import { defaultShadow } from '$lib/model/effects';
  import { apply, pt, rectOf } from '$lib/model/geometry';
  import {
    type Layer, BORDER_POSITIONS, LINE_CAPS, LINE_JOINS, center, isClosed, localBounds, moved, refit, resized, rotated,
  } from '$lib/model/layer';
  import { type TextStyle, FONTS, TEXT_ALIGNS } from '$lib/model/text';
  import Button from '$lib/ui/kit/Button.svelte';
  import Select from '$lib/ui/kit/Select.svelte';
  import { PRESETS } from '$lib/document/artboards';
  import ColorField from '$lib/ui/kit/ColorField.svelte';
  import IconButton from '$lib/ui/kit/IconButton.svelte';
  import NumberField from '$lib/ui/kit/NumberField.svelte';
  import Row from '$lib/ui/kit/Row.svelte';
  import Section from '$lib/ui/kit/Section.svelte';
  import Segmented from '$lib/ui/kit/Segmented.svelte';
  import Slider from '$lib/ui/kit/Slider.svelte';
  import TextField from '$lib/ui/kit/TextField.svelte';
  import Toggle from '$lib/ui/kit/Toggle.svelte';

  /** Right column, in order: what it is, where it is, then how it looks.
   *  Continuous edits (slider, typing, picker) go through `styleEdit` and merge into one undo step;
   *  committed fields (geometry) are one checkpointed edit each. */
  let { doc }: { doc: Doc } = $props();

  // L() keys stay literal so the localization test finds them
  const COMBINE = [['union', L('Union'), 'U'], ['subtract', L('Subtract'), 'S'], ['intersect', L('Intersect'), 'I'], ['difference', L('Difference'), 'X']] as const;

  const l = $derived(doc.selected);
  const locked = $derived(!!l && doc.isLocked(l.id));
  const r = $derived(l && localBounds(l)); // once per change: costly for big groups
  const b = $derived.by(() => {
    const p = doc.preview; // live while dragging (written on mouse-up); approximate when rotating
    if (!r || !l || !p?.ids.has(l.id)) return r;
    return rectOf([pt(r.x, r.y), pt(r.x + r.width, r.y), pt(r.x, r.y + r.height), pt(r.x + r.width, r.y + r.height)].map((q) => apply(p.t, q)))!;
  });

  const current = () => {
    const c = doc.selected;
    return c && ($state.snapshot(c) as Layer);
  };
  /** Continuous style change, coalesced per layer. */
  function style(patch: Partial<Layer>) {
    const c = current();
    if (c) doc.styleEdit(c.id, { ...c, ...patch });
  }
  /** Continuous text style change: the box refits to the restyled lines. */
  function textStyle(patch: Partial<TextStyle>) {
    const c = current();
    if (c?.text) doc.styleEdit(c.id, refit({ ...c, text: { ...c.text, ...patch } }, c));
  }
  const fontOptions = (font: string) =>
    [...FONTS.map((f) => f.family), ...(FONTS.some((f) => f.family === font) ? [] : [font])].map((value) => ({ value, title: value }));

  /** One undoable change to the selected layer. */
  function edit(f: (l: Layer) => Layer) {
    const c = current();
    if (!c) return;
    doc.checkpoint();
    doc.selected = f(c);
    doc.dropCheckpointIfUnchanged();
  }

  /** X/Y/W/H of the unrotated frame. */
  function geometry(field: 'x' | 'y' | 'width' | 'height', v: number) {
    edit((l) => {
      const b = localBounds(l);
      switch (field) {
        case 'x': return moved(l, pt(v - b.x, 0));
        case 'y': return moved(l, pt(0, v - b.y));
        case 'width': {
          if (b.width <= 0 || v <= 0) return l;
          const s = v / b.width;
          return resized(l, s, l.lockRatio ? s : 1, pt(b.x, b.y));
        }
        case 'height': {
          if (b.height <= 0 || v <= 0) return l;
          const s = v / b.height;
          return resized(l, l.lockRatio ? s : 1, s, pt(b.x, b.y));
        }
      }
    });
  }

  /** Dash/gap fields over `dash`: dash 0 = solid, gap 0 = same as dash. */
  function dashPart(k: 0 | 1, v: number) {
    const dash = l!.dash;
    const d = dash.length === 2 ? [...dash] : [0, 0];
    d[k] = Math.max(0, v);
    style({ dash: d[0] > 0 ? [d[0], d[1] > 0 ? d[1] : d[0]] : [] });
  }

  const titles: Record<string, string> = {
    center: L('Center'), inside: L('Inside'), outside: L('Outside'),
    left: L('Left'), right: L('Right'), regular: L('Regular'), bold: L('Bold'), auto: L('Auto'), fixed: L('Fixed'),
    butt: L('Butt'), round: L('Round'), square: L('Square'), miter: L('Miter'), bevel: L('Bevel'),
  };
  const options = <T extends string>(all: readonly T[]) => all.map((value) => ({ value, title: titles[value] }));

  const presetGroups = { Phone: L('Phone'), Tablet: L('Tablet'), Desktop: L('Desktop'), Paper: L('Paper'), Social: L('Social') };
  const presetOptions = PRESETS.map((p) => ({ value: p.name, title: `${p.name} — ${p.width}×${p.height}`, group: presetGroups[p.group] }));
  /** Inspector preset for an artboard: same origin, new size. */
  function applyPreset(name: string) {
    const p = PRESETS.find((x) => x.name === name);
    if (!p) return;
    edit((x) => {
      const b = localBounds(x);
      return { ...x, points: [pt(b.x, b.y), pt(b.x + p.width, b.y + p.height)] };
    });
  }

  const palette = $derived({
    palette: doc.palette,
    onaddtopalette: (c: RGBA) => doc.addToPalette(c),
    onremovefrompalette: (i: number) => doc.removeFromPalette(i),
  });
</script>

<div class="inspector">
  {#if doc.tool === 'artboard'}
    <!-- with the artboard tool, the inspector offers sizes; drawing on the canvas works too -->
    {#each Object.entries(presetGroups) as [key, title] (key)}
      <Section {title}>
        {#each PRESETS.filter((p) => p.group === key) as p (p.name)}
          <Row label={p.name}><Button onclick={() => doc.addArtboard(p.name, p.width, p.height)}>{p.width} × {p.height}</Button></Row>
        {/each}
      </Section>
    {/each}
  {:else if l && b}
    {#if locked}
      <!-- everything below is read-only until unlocked (the layer or a parent group) -->
      <Section>
        <Row label={L('Locked')}><Button onclick={() => doc.unlock(l.id)}>{L('Unlock')}</Button></Row>
      </Section>
    {/if}

    <Section title={L('Layer')}>
      <Row label={L('Name')}><TextField label={L('Name')} value={l.name} disabled={locked} oninput={(name) => style({ name })} /></Row>
      {#if l.kind !== 'artboard'}<Row label={L('Opacity')}>
        <Slider label={L('Opacity')} value={l.opacity} disabled={locked} oninput={(opacity) => style({ opacity })} />
        <NumberField label={L('Opacity')} value={l.opacity * 100} digits={0} min={0} max={100} suffix="%" disabled={locked}
          onchange={(v) => style({ opacity: v / 100 })} />
      </Row>{/if}
      {#if l.kind === 'group'}
        <Row><Button disabled={locked} onclick={() => doc.ungroup()}>{L('Ungroup')}</Button></Row>
      {/if}
    </Section>

    <Section title={L('Geometry')}>
      <Row label={L('Position')} reserve>
        <NumberField label="X" value={b.x} disabled={locked} onchange={(v) => geometry('x', v)} />
        <NumberField label="Y" value={b.y} disabled={locked} onchange={(v) => geometry('y', v)} />
      </Row>
      <Row label={L('Size')}>
        <NumberField label={L('W')} value={b.width} min={0} disabled={locked} onchange={(v) => geometry('width', v)} />
        <NumberField label={L('H')} value={b.height} min={0} disabled={locked} onchange={(v) => geometry('height', v)} />
        <IconButton quiet icon={l.lockRatio ? 'lock' : 'lock-open'} label={L('Lock proportions')} active={l.lockRatio} disabled={locked}
          onclick={() => edit((x) => ({ ...x, lockRatio: !x.lockRatio }))} />
      </Row>
      {#if l.kind === 'artboard'}
        <Row label={L('Preset')}>
          <Select label={L('Preset')} placeholder={L('Custom')} options={presetOptions} disabled={locked} onchange={applyPreset}
            value={PRESETS.find((p) => p.width === Math.round(b.width) && p.height === Math.round(b.height))?.name ?? ''} />
        </Row>
      {:else if l.kind !== 'group'}
        <!-- groups and artboards have no rotation of their own -->
        <Row label={L('Rotation')} single reserve>
          <NumberField label={L('Rotation')} value={(l.rotation * 180) / Math.PI} suffix="°" disabled={locked}
            onchange={(v) => edit((x) => rotated(x, (v * Math.PI) / 180 - x.rotation, center(x)))} />
        </Row>
      {/if}
    </Section>

    {#if l.kind === 'artboard'}
      <Section title={L('Background')}>
        <Row label={L('Color')} single>
          <ColorField label={L('Background')} color={l.fill} disabled={locked} {...palette} onchange={(fill) => style({ fill })} />
        </Row>
      </Section>
    {:else if l.text}
      {@const t = l.text}
      <Section title={L('Text')}>
        <Row label={L('Font')} single>
          <Select label={L('Font')} options={fontOptions(t.font)} value={t.font} disabled={locked} onchange={(font) => textStyle({ font })} />
        </Row>
        <Row label={L('Weight')}>
          <Segmented label={L('Weight')} value={t.weight >= 600 ? 'bold' : 'regular'} options={options(['regular', 'bold'])} disabled={locked}
            onchange={(w) => textStyle({ weight: w === 'bold' ? 700 : 400 })} />
        </Row>
        <Row label={L('Size')} single>
          <NumberField label={L('Size')} value={t.size} min={1} disabled={locked} onchange={(size) => textStyle({ size })} />
        </Row>
        <Row label={L('Line / Letter')}>
          <NumberField label={L('Line height')} value={t.lineHeight} digits={2} min={0.5} max={5} suffix="×" disabled={locked}
            onchange={(lineHeight) => textStyle({ lineHeight })} />
          <NumberField label={L('Letter spacing')} value={t.letterSpacing} digits={1} disabled={locked} onchange={(letterSpacing) => textStyle({ letterSpacing })} />
        </Row>
        <Row label={L('Alignment')}>
          <Segmented label={L('Alignment')} value={t.align} options={options(TEXT_ALIGNS)} disabled={locked} onchange={(align) => textStyle({ align })} />
        </Row>
        <Row label={L('Width')}>
          <!-- auto: fits the longest line; fixed: lines wrap at the box width (resize the box to change it) -->
          <Segmented label={L('Width')} value={t.autoWidth ? 'auto' : 'fixed'} options={options(['auto', 'fixed'])} disabled={locked}
            onchange={(w) => textStyle({ autoWidth: w === 'auto' })} />
        </Row>
        <Row label={l.fillGradient ? L('Gradient') : L('Color')} single>
          <ColorField label={L('Text color')} color={l.fill} disabled={locked} {...palette} bounds={localBounds(l)} gradient={l.fillGradient}
            onchange={(fill) => style({ fill, fillGradient: undefined })}
            ongradient={(g) => style(g ? { fillGradient: g, fill: g.stops[0].color } : { fillGradient: undefined })} />
        </Row>
      </Section>
    {:else if l.kind !== 'group'}
      <Section title={L('Fill')}>
        <!-- fill type (color, linear, radial gradient) is picked in the color panel -->
        <Row label={l.fillGradient ? L('Gradient') : L('Color')} single>
          <ColorField label={L('Fill')} color={l.fill} disabled={locked} {...palette} bounds={localBounds(l)} gradient={l.fillGradient}
            onchange={(fill) => style({ fill, fillGradient: undefined })}
            ongradient={(g) => style(g ? { fillGradient: g, fill: g.stops[0].color } : { fillGradient: undefined })} />
        </Row>
      </Section>

      <Section title={L('Border')}>
        <Row label={l.strokeGradient ? L('Gradient') : L('Color')} single>
          <ColorField label={L('Border')} color={l.stroke} disabled={locked} {...palette} bounds={localBounds(l)} gradient={l.strokeGradient}
            onchange={(stroke) => style({ stroke, strokeGradient: undefined })}
            ongradient={(g) => style(g ? { strokeGradient: g, stroke: g.stops[0].color } : { strokeGradient: undefined })} />
        </Row>
        <Row label={L('Width')} single>
          <!-- whole, non-negative pixels; 0 = no border -->
          <NumberField label={L('Width')} value={l.strokeWidth} digits={0} min={0} disabled={locked} onchange={(v) => style({ strokeWidth: Math.round(v) })} />
        </Row>
        <Row label={L('Position')}>
          <!-- open paths are always centered -->
          <Segmented label={L('Position')} value={l.borderPosition} options={options(BORDER_POSITIONS)} disabled={locked || !isClosed(l)}
            onchange={(borderPosition) => style({ borderPosition })} />
        </Row>
        <Row label={L('Dash / Gap')}>
          <NumberField label={L('Dash')} value={l.dash[0] ?? 0} min={0} disabled={locked} onchange={(v) => dashPart(0, v)} />
          <NumberField label={L('Gap')} value={l.dash[1] ?? 0} min={0} disabled={locked} onchange={(v) => dashPart(1, v)} />
        </Row>
        <Row label={L('Ends')}>
          <Segmented label={L('Ends')} value={l.lineCap} options={options(LINE_CAPS)} disabled={locked} onchange={(lineCap) => style({ lineCap })} />
        </Row>
        <Row label={L('Joins')}>
          <Segmented label={L('Joins')} value={l.lineJoin} options={options(LINE_JOINS)} disabled={locked} onchange={(lineJoin) => style({ lineJoin })} />
        </Row>
      </Section>
    {/if}

    {#if l.kind !== 'artboard'}
    <Section title={L('Effects')}>
      <Toggle label={L('Shadow')} checked={!!l.shadow} disabled={locked} onchange={(on) => style({ shadow: on ? defaultShadow() : undefined })} />
      {#if l.shadow}
        {@const s = l.shadow}
        <Row label={L('Color')} single>
          <ColorField label={L('Shadow')} color={s.color} disabled={locked} {...palette} onchange={(color) => style({ shadow: { ...s, color } })} />
        </Row>
        <Row label="X / Y">
          <NumberField label="X" value={s.x} disabled={locked} onchange={(x) => style({ shadow: { ...s, x } })} />
          <NumberField label="Y" value={s.y} disabled={locked} onchange={(y) => style({ shadow: { ...s, y } })} />
        </Row>
        <Row label={L('Blur')} single>
          <NumberField label={L('Blur')} value={s.blur} min={0} max={100} disabled={locked} onchange={(blur) => style({ shadow: { ...s, blur } })} />
        </Row>
      {/if}
      <Row label={L('Layer blur')} single>
        <NumberField label={L('Layer blur')} value={l.blur} min={0} max={100} disabled={locked} onchange={(blur) => style({ blur })} />
      </Row>
    </Section>
    {/if}
  {:else if doc.selectedIDs.size > 1}
    <div class="empty">
      <span>{L('%d layers selected', doc.selectedIDs.size)}</span>
      <Button disabled={!doc.canGroup} onclick={() => doc.group()}>{L('Group Layers')}</Button>
      <div class="combine" role="toolbar" aria-label={L('Combine')}>
        {#each COMBINE as [op, text, key] (op)}
          <IconButton icon={op} label="{text} (⌥⌘{key})" disabled={!doc.canGroup} onclick={() => doc.combine(op)} />
        {/each}
      </div>
    </div>
  {:else}
    <div class="empty"><span>{L('No selection')}</span></div>
  {/if}
</div>

<style>
  .inspector {
    overflow-y: auto;
  }
  .combine {
    display: flex;
    gap: var(--space-1);
  }
  .empty {
    display: grid;
    place-items: center;
    align-content: center;
    gap: var(--space-3);
    height: 100%;
    color: var(--text-2);
  }
</style>

<script lang="ts">
  import { L } from '$lib/i18n';
  import type { Doc } from '$lib/document/doc.svelte';
  import type { RGBA } from '$lib/model/color';
  import { defaultShadow } from '$lib/model/effects';
  import { type Columns, type Grid, defaultColumns, defaultGrid } from '$lib/model/grid';
  import { type Rect, POINT_TYPES, apply, pt, rectOf, union } from '$lib/model/geometry';
  import { pointType } from '$lib/model/point-editing';
  import { parent } from '$lib/model/layer-tree';
  import {
    type Layer, BORDER_POSITIONS, LINE_CAPS, LINE_JOINS, bounds, center, isClosed, isContainer, localBounds, moved, refit, resized, rotated, scaled,
  } from '$lib/model/layer';
  import { type TextStyle, FONTS, TEXT_ALIGNS } from '$lib/model/text';
  import { loadFamily, systemFonts } from '$lib/app/fonts.svelte';
  import Button from '$lib/ui/kit/Button.svelte';
  import Select from '$lib/ui/kit/Select.svelte';
  import FontField from '$lib/ui/kit/FontField.svelte';
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
  const ALIGN = [
    ['left', L('Align Left'), 'A'], ['center', L('Align Horizontal Centers'), 'H'], ['right', L('Align Right'), 'D'],
    ['top', L('Align Top'), 'W'], ['middle', L('Align Vertical Centers'), 'V'], ['bottom', L('Align Bottom'), 'S'],
  ] as const;
  const DISTRIBUTE = [[true, 'distribute-horizontal', L('Distribute Horizontally'), 'H'], [false, 'distribute-vertical', L('Distribute Vertically'), 'V']] as const;

  /** Several layers: the sections they all have, values shown when they agree (`same`), edits applied to all
   *  the unlocked ones as one undo step. `l` is the first one, the reference for what is shown. */
  const sel = $derived(doc.selectedLayers);
  const multi = $derived(sel.length > 1);
  const l = $derived(sel[0] ?? null);
  const all = (f: (x: Layer) => boolean) => sel.every(f);
  /** `f` of the selected layers if they agree, else `mixed` (NaN: a number field shows "Multiple"). */
  function same<T>(f: (x: Layer) => T, mixed: T): T {
    const v = f(sel[0]), k = JSON.stringify(v);
    return sel.every((x) => JSON.stringify(f(x)) === k) ? v : mixed;
  }
  const num = (f: (x: Layer) => number) => same(f, NaN);
  const pick = <T extends string>(f: (x: Layer) => T) => same<T | ''>(f, '') as T; // '': no segment lit

  /** What fill, border and text sections show and change: the selected layers, a group standing for the layers
   *  in it (its own opacity and effects stay the group's). Same helpers as above, over these. */
  const leaves = (ls: Layer[]): Layer[] => ls.flatMap((x) => (x.kind === 'group' ? leaves(x.children) : [x]));
  const painted = $derived(leaves(sel));
  const lp = $derived(painted[0] ?? null);
  const pMulti = $derived(painted.length > 1);
  const pAll = (f: (x: Layer) => boolean) => painted.length > 0 && painted.every(f);
  function pSame<T>(f: (x: Layer) => T, mixed: T): T {
    const v = f(painted[0]), k = JSON.stringify(v);
    return painted.every((x) => JSON.stringify(f(x)) === k) ? v : mixed;
  }
  const pNum = (f: (x: Layer) => number) => pSame(f, NaN);
  const pPick = <T extends string>(f: (x: Layer) => T) => pSame<T | ''>(f, '') as T;
  /** The selected node, in point-edit mode. */
  const node = $derived(doc.editing && doc.selectedNode && doc.editingLayer?.subpaths[doc.selectedNode.s]?.nodes[doc.selectedNode.n]);
  const pointTypes = POINT_TYPES.map((t) => ({
    value: t, icon: t, title: { straight: L('Straight'), mirrored: L('Mirrored'), disconnected: L('Disconnected'), asymmetric: L('Asymmetric') }[t],
  }));
  const locked = $derived(sel.length > 0 && all((x) => doc.isLocked(x.id)));
  /** A single layer aligns on its group or artboard: none at the top level. */
  const alignable = $derived(!locked && (multi || (!!l && !!parent(doc.layers, l.id))));
  // frame: the layer's unrotated one; several layers: their bounds together. Once per change: costly for big groups
  const r = $derived(multi ? sel.map(bounds).reduce<Rect | null>(union, null) : l && localBounds(l));
  const b = $derived.by(() => {
    const p = doc.preview; // live while dragging (written on mouse-up); approximate when rotating
    if (!r || !l || !p?.ids.has(l.id)) return r;
    return rectOf([pt(r.x, r.y), pt(r.x + r.width, r.y), pt(r.x, r.y + r.height), pt(r.x + r.width, r.y + r.height)].map((q) => apply(p.t, q)))!;
  });

  /** Corner radius fields shown one by one (always, when the corners differ). */
  let corners = $state(false);

  /** Snapshots of the layers an edit applies to. */
  const targets = (ls = sel) => ls.filter((x) => !doc.isLocked(x.id)).map((x) => $state.snapshot(x) as Layer);
  type Patch = Partial<Layer> | ((c: Layer) => Partial<Layer>);
  const patched = (ls: Layer[], patch: Patch): [string, Layer][] =>
    targets(ls).map((c) => [c.id, { ...c, ...(typeof patch === 'function' ? patch(c) : patch) }]);
  /** Continuous style change, coalesced; a function computes each layer's own patch. */
  const style = (patch: Patch) => doc.styleEdits(patched(sel, patch));
  /** Same, for fill, border and text (`painted`). */
  const pStyle = (patch: Patch) => doc.styleEdits(patched(painted, patch));
  /** Continuous grid or columns change (artboards). */
  const gridStyle = (patch: Partial<Grid>) => style((c) => ({ grid: { ...c.grid!, ...patch } }));
  const columnsStyle = (patch: Partial<Columns>) => style((c) => ({ columns: { ...c.columns!, ...patch } }));
  /** Continuous text style change: each box refits to its restyled lines. */
  function textStyle(patch: Partial<TextStyle>) {
    doc.styleEdits(targets(painted).filter((c) => c.text).map((c) => [c.id, refit({ ...c, text: { ...c.text!, ...patch } }, c)]));
  }
  /** Bundled families first (an unknown one, from an imported file, with them), then the installed ones. */
  const fontOptions = (font: string) => [
    ...(FONTS.some((f) => f.family === font) || systemFonts.families.includes(font) || !font ? [] : [{ value: font, title: font }]),
    ...FONTS.map((f) => ({ value: f.family, title: f.family })),
    ...systemFonts.families.map((value) => ({ value, title: value, group: L('Installed') })),
  ];

  /** One undoable change to the selected layers. */
  function edit(f: (l: Layer) => Layer) {
    const ts = targets();
    if (!ts.length) return;
    doc.checkpoint();
    for (const c of ts) doc.set(c.id, f(c));
    doc.dropCheckpointIfUnchanged();
  }

  /** X/Y/W/H of the unrotated frame; several layers: of their bounds, all moved or scaled from its corner. */
  function geometry(field: 'x' | 'y' | 'width' | 'height', v: number) {
    if (multi) {
      const g = r!, o = pt(g.x, g.y);
      if (field === 'x') return edit((x) => moved(x, pt(v - g.x, 0)));
      if (field === 'y') return edit((x) => moved(x, pt(0, v - g.y)));
      const k = field === 'width' ? g.width : g.height;
      if (k <= 0 || v <= 0) return;
      return edit((x) => (field === 'width' ? scaled(x, v / k, 1, o) : scaled(x, 1, v / k, o)));
    }
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
    pStyle((c) => {
      const d = c.dash.length === 2 ? [...c.dash] : [0, 0];
      d[k] = Math.max(0, v);
      return { dash: d[0] > 0 ? [d[0], d[1] > 0 ? d[1] : d[0]] : [] };
    });
  }

  const titles: Record<string, string> = {
    center: L('Center'), inside: L('Inside'), outside: L('Outside'),
    left: L('Left'), right: L('Right'), regular: L('Regular'), bold: L('Bold'), auto: L('Auto'), fixed: L('Fixed'),
    butt: L('Butt'), round: L('Round'), square: L('Square'), miter: L('Miter'), bevel: L('Bevel'),
  };
  const options = <T extends string>(all: readonly T[]) => all.map((value) => ({ value, title: titles[value] }));

  const presetGroups = { Screen: L('Screen'), Paper: L('Paper') };
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
    <Section>
      <div class="align" role="toolbar" aria-label={L('Align')}>
        {#each ALIGN as [to, text, key] (to)}
          <IconButton quiet icon="align-{to}" label="{text} (⌥{key})" disabled={!alignable} onclick={() => doc.align(to)} />
        {/each}
        {#each DISTRIBUTE as [horizontal, icon, text, key] (icon)}
          <IconButton quiet {icon} label="{text} (⌥⇧{key})" disabled={locked || sel.length < 3} onclick={() => doc.distribute(horizontal)} />
        {/each}
      </div>
    </Section>
    {#if multi}
      <!-- several layers: what can be done with them together, then the sections they all have -->
      <Section title={L('%d layers selected', sel.length)}>
        <Row>
          <Button disabled={!doc.canGroup} onclick={() => doc.group()}>{L('Group Layers')}</Button>
          <div class="combine" role="toolbar" aria-label={L('Combine')}>
            {#each COMBINE as [op, text, key] (op)}
              <IconButton quiet icon={op} label="{text} (⌥⌘{key})" disabled={!doc.canGroup} onclick={() => doc.combine(op)} />
            {/each}
          </div>
        </Row>
      </Section>
    {/if}
    {#if locked}
      <!-- everything below is read-only until unlocked (the layer or a parent group) -->
      <Section>
        <Row label={L('Locked')}><Button onclick={() => sel.forEach((x) => doc.unlock(x.id))}>{L('Unlock')}</Button></Row>
      </Section>
    {/if}

    {#if !multi || all((x) => x.kind !== 'artboard')}
    <Section title={L('Layer')}>
      {#if !multi}<Row label={L('Name')}><TextField label={L('Name')} value={l.name} disabled={locked} oninput={(name) => style({ name })} /></Row>{/if}
      {#if all((x) => x.kind !== 'artboard')}<Row label={L('Opacity')}>
        <Slider label={L('Opacity')} value={l.opacity} disabled={locked} oninput={(opacity) => style({ opacity })} />
        <NumberField label={L('Opacity')} value={num((x) => x.opacity) * 100} digits={0} min={0} max={100} suffix="%" disabled={locked}
          onchange={(v) => style({ opacity: v / 100 })} />
      </Row>{/if}
      {#if !multi && l.kind === 'group'}
        <Row><Button disabled={locked} onclick={() => doc.ungroup()}>{L('Ungroup')}</Button></Row>
      {/if}
    </Section>
    {/if}

    <Section title={L('Geometry')}>
      <Row label={L('Position')} reserve>
        <NumberField label="X" value={b.x} disabled={locked} onchange={(v) => geometry('x', v)} />
        <NumberField label="Y" value={b.y} disabled={locked} onchange={(v) => geometry('y', v)} />
      </Row>
      <Row label={L('Size')} reserve={multi}>
        <NumberField label={L('W')} value={b.width} min={0} disabled={locked} onchange={(v) => geometry('width', v)} />
        <NumberField label={L('H')} value={b.height} min={0} disabled={locked} onchange={(v) => geometry('height', v)} />
        {#if !multi}<IconButton quiet icon={l.lockRatio ? 'lock' : 'lock-open'} label={L('Lock proportions')} active={l.lockRatio} disabled={locked}
          onclick={() => edit((x) => ({ ...x, lockRatio: !x.lockRatio }))} />{/if}
      </Row>
      {#if all((x) => x.kind === 'rect')}
        {@const uneven = !all((x) => x.corners.every((r) => r === x.corners[0]))}
        <Row label={L('Radius')} single>
          <NumberField label={L('Corner radius')} value={uneven ? NaN : num((x) => x.corners[0])} min={0} disabled={locked}
            onchange={(r) => edit((x) => ({ ...x, corners: [r, r, r, r] }))} />
          <IconButton quiet icon="corners" label={L('Independent corners')} active={corners || uneven} disabled={locked}
            onclick={() => (uneven ? edit((x) => ({ ...x, corners: x.corners.map(() => x.corners[0]) })) : (corners = !corners))} />
        </Row>
        {#if corners || uneven}
          {#each [[L('Top'), 0, 1, L('Top left'), L('Top right')], [L('Bottom'), 3, 2, L('Bottom left'), L('Bottom right')]] as const as [row, a, b, la, lb] (row)}
            <Row label={row} reserve>
              {#each [[a, la], [b, lb]] as const as [i, label] (i)}
                <NumberField {label} value={num((x) => x.corners[i])} min={0} disabled={locked}
                  onchange={(r) => edit((x) => ({ ...x, corners: x.corners.map((c, j) => (j === i ? r : c)) }))} />
              {/each}
            </Row>
          {/each}
        {/if}
      {/if}
      {#if multi}
        <!-- several layers: no preset, no shared rotation -->
      {:else if l.kind === 'artboard'}
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

    {#if node}
      <Section title={L('Point')}>
        <Row label={L('Type')}>
          <Segmented label={L('Point Type')} value={pointType(node)} options={pointTypes} onchange={(t) => doc.setPointType(t)} />
        </Row>
      </Section>
    {/if}

    <!-- several layers (or a group's): colors show the first one's; gradients are edited one layer at a time -->
    {#if pAll((x) => x.kind === 'artboard')}
      <Section title={L('Background')}>
        <Row label={L('Color')} single>
          <ColorField label={L('Background')} color={lp.fill} disabled={locked} {...palette} onchange={(fill) => pStyle({ fill })} />
        </Row>
      </Section>
    {:else if pAll((x) => !!x.text)}
      <Section title={L('Text')}>
        <Row label={L('Font')}>
          <FontField label={L('Font')} options={fontOptions(pPick((x) => x.text!.font))} value={pPick((x) => x.text!.font)} disabled={locked}
            onchange={(font) => loadFamily(font).then(() => textStyle({ font }))} />
        </Row>
        <Row label={L('Weight')}>
          <Segmented label={L('Weight')} value={pPick((x) => (x.text!.weight >= 600 ? 'bold' : 'regular'))} options={options(['regular', 'bold'])} disabled={locked}
            onchange={(w) => textStyle({ weight: w === 'bold' ? 700 : 400 })} />
        </Row>
        <Row label={L('Size')} single>
          <NumberField label={L('Size')} value={pNum((x) => x.text!.size)} min={1} disabled={locked} onchange={(size) => textStyle({ size })} />
        </Row>
        <Row label={L('Line height')} single>
          <NumberField label={L('Line height')} value={pNum((x) => x.text!.lineHeight)} digits={2} min={0.5} max={5} suffix="×" disabled={locked}
            onchange={(lineHeight) => textStyle({ lineHeight })} />
        </Row>
        <Row label={L('Tracking')} single>
          <NumberField label={L('Letter spacing')} value={pNum((x) => x.text!.letterSpacing)} digits={1} disabled={locked}
            onchange={(letterSpacing) => textStyle({ letterSpacing })} />
        </Row>
        <Row label={L('Alignment')}>
          <Segmented label={L('Alignment')} value={pPick((x) => x.text!.align)} options={options(TEXT_ALIGNS)} disabled={locked} onchange={(align) => textStyle({ align })} />
        </Row>
        <Row label={L('Box width')}>
          <!-- auto: fits the longest line; fixed: lines wrap at the box width (resize the box to change it) -->
          <Segmented label={L('Box width')} value={pPick((x) => (x.text!.autoWidth ? 'auto' : 'fixed'))} options={options(['auto', 'fixed'])} disabled={locked}
            onchange={(w) => textStyle({ autoWidth: w === 'auto' })} />
        </Row>
        <Row label={!pMulti && lp.fillGradient ? L('Gradient') : L('Color')} single>
          <ColorField label={L('Text color')} color={lp.fill} disabled={locked} {...palette} bounds={localBounds(lp)} gradient={pMulti ? null : lp.fillGradient}
            onchange={(fill) => pStyle({ fill, fillGradient: undefined })}
            ongradient={pMulti ? undefined : (g) => pStyle(g ? { fillGradient: g, fill: g.stops[0].color } : { fillGradient: undefined })} />
        </Row>
      </Section>
    {:else if pAll((x) => !isContainer(x) && !x.text)}
      <Section title={L('Fill')}>
        <!-- fill type (color, linear, radial gradient) is picked in the color panel -->
        <Row label={!pMulti && lp.fillGradient ? L('Gradient') : L('Color')} single>
          <ColorField label={L('Fill')} color={lp.fill} disabled={locked} {...palette} bounds={localBounds(lp)} gradient={pMulti ? null : lp.fillGradient}
            onchange={(fill) => pStyle({ fill, fillGradient: undefined })}
            ongradient={pMulti ? undefined : (g) => pStyle(g ? { fillGradient: g, fill: g.stops[0].color } : { fillGradient: undefined })} />
        </Row>
      </Section>

      <Section title={L('Border')}>
        <Row label={!pMulti && lp.strokeGradient ? L('Gradient') : L('Color')} single>
          <ColorField label={L('Border')} color={lp.stroke} disabled={locked} {...palette} bounds={localBounds(lp)} gradient={pMulti ? null : lp.strokeGradient}
            onchange={(stroke) => pStyle({ stroke, strokeGradient: undefined })}
            ongradient={pMulti ? undefined : (g) => pStyle(g ? { strokeGradient: g, stroke: g.stops[0].color } : { strokeGradient: undefined })} />
        </Row>
        <Row label={L('Width')} single>
          <!-- non-negative; 0 = no border. Fractional once a resize has scaled it -->
          <NumberField label={L('Width')} value={pNum((x) => x.strokeWidth)} min={0} disabled={locked} onchange={(v) => pStyle({ strokeWidth: v })} />
        </Row>
        <Row label={L('Position')}>
          <!-- open paths are always centered -->
          <Segmented label={L('Position')} value={pPick((x) => x.borderPosition)} options={options(BORDER_POSITIONS)} disabled={locked || !pAll(isClosed)}
            onchange={(borderPosition) => pStyle({ borderPosition })} />
        </Row>
        <Row label={L('Dash')} single>
          <NumberField label={L('Dash')} value={pNum((x) => x.dash[0] ?? 0)} min={0} disabled={locked} onchange={(v) => dashPart(0, v)} />
        </Row>
        <Row label={L('Gap')} single>
          <NumberField label={L('Gap')} value={pNum((x) => x.dash[1] ?? 0)} min={0} disabled={locked} onchange={(v) => dashPart(1, v)} />
        </Row>
        <Row label={L('Ends')}>
          <Segmented label={L('Ends')} value={pPick((x) => x.lineCap)} options={options(LINE_CAPS)} disabled={locked} onchange={(lineCap) => pStyle({ lineCap })} />
        </Row>
        <Row label={L('Joins')}>
          <Segmented label={L('Joins')} value={pPick((x) => x.lineJoin)} options={options(LINE_JOINS)} disabled={locked} onchange={(lineJoin) => pStyle({ lineJoin })} />
        </Row>
      </Section>
    {/if}

    {#if !multi && l.kind === 'artboard'}
      <!-- drawn on the canvas only; View › Show/Hide Grids and Snap to Grid apply to all of them -->
      <Section title={L('Grid')}>
        {#snippet action()}
          <Toggle label={L('Grid')} checked={!!l.grid} disabled={locked} onchange={(on) => style((c) => ({ grid: on ? (c.grid ?? defaultGrid()) : undefined }))} />
        {/snippet}
        {#if l.grid}
          {@const g = l.grid}
          <Row label={L('Size')} single>
            <NumberField label={L('Grid size')} value={g.size} min={1} disabled={locked} onchange={(size) => gridStyle({ size })} />
          </Row>
          <Row label={L('Major')} single>
            <!-- a stronger line every N squares; 0: none -->
            <NumberField label={L('Major line every')} value={g.major} min={0} digits={0} disabled={locked} onchange={(major) => gridStyle({ major: Math.round(major) })} />
          </Row>
        {/if}
      </Section>
      <Section title={L('Columns')}>
        {#snippet action()}
          <Toggle label={L('Columns')} checked={!!l.columns} disabled={locked}
            onchange={(on) => style((c) => ({ columns: on ? (c.columns ?? defaultColumns()) : undefined }))} />
        {/snippet}
        {#if l.columns}
          {@const c = l.columns}
          <Row label={L('Number')} single>
            <NumberField label={L('Number of columns')} value={c.count} min={1} max={48} digits={0} disabled={locked} onchange={(count) => columnsStyle({ count: Math.round(count) })} />
          </Row>
          <Row label={L('Gutter')} single>
            <NumberField label={L('Gutter')} value={c.gutter} min={0} disabled={locked} onchange={(gutter) => columnsStyle({ gutter })} />
          </Row>
          <Row label={L('Margin')} single>
            <NumberField label={L('Margin')} value={c.margin} min={0} disabled={locked} onchange={(margin) => columnsStyle({ margin })} />
          </Row>
        {/if}
      </Section>
    {/if}

    {#if all((x) => x.kind !== 'artboard')}
    <Section title={L('Shadow')}>
      <!-- several layers: the shadow's fields appear when they all have one -->
      {#snippet action()}
        <Toggle label={L('Shadow')} checked={all((x) => !!x.shadow)} disabled={locked}
          onchange={(on) => style((c) => ({ shadow: on ? (c.shadow ?? defaultShadow()) : undefined }))} />
      {/snippet}
      {#if all((x) => !!x.shadow)}
        {@const s = l.shadow!}
        <Row label={L('Color')} single>
          <ColorField label={L('Shadow')} color={s.color} disabled={locked} {...palette} onchange={(color) => style((c) => ({ shadow: { ...c.shadow!, color } }))} />
        </Row>
        <Row label="X / Y">
          <NumberField label="X" value={num((x) => x.shadow!.x)} disabled={locked} onchange={(v) => style((c) => ({ shadow: { ...c.shadow!, x: v } }))} />
          <NumberField label="Y" value={num((x) => x.shadow!.y)} disabled={locked} onchange={(v) => style((c) => ({ shadow: { ...c.shadow!, y: v } }))} />
        </Row>
        <Row label={L('Blur')} single>
          <NumberField label={L('Blur')} value={num((x) => x.shadow!.blur)} min={0} max={100} disabled={locked}
            onchange={(blur) => style((c) => ({ shadow: { ...c.shadow!, blur } }))} />
        </Row>
      {/if}
    </Section>
    <Section title={L('Effects')}>
      <Row label={L('Layer blur')} single>
        <NumberField label={L('Layer blur')} value={num((x) => x.blur)} min={0} max={100} disabled={locked} onchange={(blur) => style({ blur })} />
      </Row>
    </Section>
    {/if}
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
  .align {
    display: flex;
    justify-content: space-between;
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

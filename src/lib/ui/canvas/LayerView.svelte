<script lang="ts">
  import Self from './LayerView.svelte';
  import { css } from '$lib/model/color';
  import type { GradientFill } from '$lib/model/effects';
  import { type Affine, inset } from '$lib/model/geometry';
  import { pathData } from '$lib/model/path-data';
  import {
    type Layer, bounds, center, clipShape, drawnStrokeWidth, effectiveBorderPosition, hasVisibleStroke, localBounds, localShape,
  } from '$lib/model/layer';
  import { layout } from '$lib/model/text';
  import { columnEdges, gridLines } from '$lib/model/grid';

  /** One layer as SVG, in document space. Order: clip → opacity/filters
   *  composited over the whole layer (a group as one image) → content. */
  let { l, preview = null, typing = null, gridZoom = null }: {
    l: Layer;
    preview?: { ids: Set<string>; t: Affine } | null;
    typing?: string | null; // text layer being typed into: the canvas's text field draws it
    gridZoom?: number | null; // the canvas's zoom when artboard grids are shown
  } = $props();

  const id = $derived(l.id);
  const clip = $derived(clipShape(l));
  const hasFx = $derived(l.blur > 0 || l.shadow != null);
  const fxRegion = $derived.by(() => {
    const s = l.shadow, m = l.blur * 3 + (s ? Math.max(Math.abs(s.x), Math.abs(s.y)) + s.blur * 3 : 0) + l.strokeWidth * 5;
    return inset(bounds(l), -m - 1);
  });

  // Leaf content, in local space under the rotation transform
  const d = $derived(l.kind === 'group' || l.kind === 'text' ? '' : pathData(localShape(l), 3));
  const lines = $derived(l.kind === 'text' ? layout(l) : []);
  const frame = $derived(l.kind === 'artboard' ? localBounds(l) : null);
  const gridPaths = $derived(frame && l.grid && gridZoom ? gridLines(frame, l.grid, gridZoom) : null);
  const columns = $derived(frame && l.columns && gridZoom ? columnEdges(frame, l.columns) : []);
  const rotate = $derived(l.rotation ? `rotate(${(l.rotation * 180) / Math.PI} ${center(l).x} ${center(l).y})` : undefined);
  const border = $derived(effectiveBorderPosition(l));
  const mask = $derived(inset(localBounds(l), -l.strokeWidth * 10 - 1)); // outside border: everything but the shape

  const paint = (c: Layer['fill'], g: GradientFill | undefined, key: string) => (g ? `url(#${key}-${id})` : c.a > 0 ? css(c) : 'none');
  const matrix = (t: Affine) => `matrix(${t.a} ${t.b} ${t.c} ${t.d} ${t.tx} ${t.ty})`;
</script>

{#snippet gradientDef(g: GradientFill, gid: string)}
  {#if g.kind === 'linear'}
    <linearGradient id={gid} gradientUnits="userSpaceOnUse" gradientTransform={matrix(g.transform)} x1={g.start.x} y1={g.start.y} x2={g.end.x} y2={g.end.y}>
      {#each g.stops as s, i (i)}<stop offset={s.offset} stop-color={css(s.color)} />{/each}
    </linearGradient>
  {:else}
    <radialGradient id={gid} gradientUnits="userSpaceOnUse" gradientTransform={matrix(g.transform)} cx={g.start.x} cy={g.start.y} r={g.radius}>
      {#each g.stops as s, i (i)}<stop offset={s.offset} stop-color={css(s.color)} />{/each}
    </radialGradient>
  {/if}
{/snippet}

{#if !l.hidden}
  <g
    transform={preview?.ids.has(id) ? matrix(preview.t) : undefined}
    clip-path={clip ? `url(#clip-${id})` : undefined}
    opacity={l.opacity < 1 ? l.opacity : undefined}
    filter={hasFx ? `url(#fx-${id})` : undefined}
  >
    <defs>
      {#if clip}<clipPath id="clip-{id}"><path d={pathData(clip, 3)} /></clipPath>{/if}
      {#if hasFx}
        <filter id="fx-{id}" filterUnits="userSpaceOnUse" x={fxRegion.x} y={fxRegion.y} width={fxRegion.width} height={fxRegion.height}>
          {#if l.blur > 0}<feGaussianBlur stdDeviation={l.blur} result="blur" />{/if}
          {#if l.shadow}
            <feDropShadow in={l.blur > 0 ? 'blur' : 'SourceGraphic'} dx={l.shadow.x} dy={l.shadow.y} stdDeviation={l.shadow.blur}
              flood-color={css({ ...l.shadow.color, a: 1 })} flood-opacity={l.shadow.color.a} />
          {/if}
        </filter>
      {/if}
      {#if l.fillGradient}{@render gradientDef(l.fillGradient, `fill-${id}`)}{/if}
      {#if l.strokeGradient}{@render gradientDef(l.strokeGradient, `stroke-${id}`)}{/if}
      {#if border === 'inside'}<clipPath id="in-{id}"><path {d} clip-rule={l.evenOdd ? 'evenodd' : undefined} /></clipPath>{/if}
      {#if border === 'outside'}
        <mask id="out-{id}" maskUnits="userSpaceOnUse" x={mask.x} y={mask.y} width={mask.width} height={mask.height}>
          <rect x={mask.x} y={mask.y} width={mask.width} height={mask.height} fill="white" />
          <path {d} fill="black" fill-rule={l.evenOdd ? 'evenodd' : undefined} />
        </mask>
      {/if}
    </defs>

    {#if l.kind === 'group'}
      {#each l.children as c (c.id)}<Self l={c} {preview} {typing} />{/each}
    {:else if frame}
      <!-- artboard: background, then the content clipped to the frame -->
      <clipPath id="ab-{id}"><rect x={frame.x} y={frame.y} width={frame.width} height={frame.height} /></clipPath>
      <rect x={frame.x} y={frame.y} width={frame.width} height={frame.height} fill={paint(l.fill, l.fillGradient, 'fill')} />
      <!-- grid and columns: canvas only (svg/export.ts leaves them out); lines one screen pixel wide at any zoom -->
      {#each columns as [x0, x1], i (i)}
        <rect x={x0} y={frame.y} width={x1 - x0} height={frame.height} fill="var(--grid)" pointer-events="none" />
      {/each}
      {#if gridPaths}
        <path d={gridPaths.minor} stroke="var(--grid)" opacity="0.5" vector-effect="non-scaling-stroke" pointer-events="none" />
        <path d={gridPaths.major} stroke="var(--grid)" vector-effect="non-scaling-stroke" pointer-events="none" />
      {/if}
      <g clip-path="url(#ab-{id})">
        {#each l.children as c (c.id)}<Self l={c} {preview} {typing} />{/each}
      </g>
    {:else if l.text}
      {@const t = l.text}
      <text transform={rotate} fill={paint(l.fill, l.fillGradient, 'fill')} font-family={t.font} font-size={t.size} font-weight={t.weight}
        letter-spacing={t.letterSpacing || undefined} text-anchor={{ left: 'start', center: 'middle', right: 'end' }[t.align]}
        visibility={typing === id ? 'hidden' : undefined} style:white-space="pre"
        >{#each lines as line, i (i)}<tspan x={line.x} y={line.y}>{line.text}</tspan>{/each}</text>
    {:else}
      <path {d} transform={rotate} fill={paint(l.fill, l.fillGradient, 'fill')} fill-rule={l.evenOdd ? 'evenodd' : undefined} />
      {#if hasVisibleStroke(l)}
        <!-- inside/outside: double width, clipped to the shape or masked to its outside -->
        <path
          {d}
          transform={rotate}
          fill="none"
          stroke={paint(l.stroke, l.strokeGradient, 'stroke')}
          stroke-width={drawnStrokeWidth(l)}
          stroke-dasharray={l.dash.length ? l.dash.join(' ') : undefined}
          stroke-linecap={l.lineCap}
          stroke-linejoin={l.lineJoin}
          stroke-miterlimit="10"
          clip-path={border === 'inside' ? `url(#in-${id})` : undefined}
          mask={border === 'outside' ? `url(#out-${id})` : undefined}
        />
      {/if}
    {/if}
  </g>
{/if}

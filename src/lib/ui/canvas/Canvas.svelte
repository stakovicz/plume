<script lang="ts">
  import { untrack } from 'svelte';
  import type { Doc } from '$lib/document/doc.svelte';
  import { TOOLS, toolKey } from '$lib/document/tool';
  import { type Node, type Pt, type Rect, apply, eqPt, mapNode, pt } from '$lib/model/geometry';
  import { type Layer, bounds, localBounds, shape, toWorld } from '$lib/model/layer';
  import { css } from '$lib/model/color';
  import { parent } from '$lib/model/layer-tree';
  import { pathData } from '$lib/model/path-data';
  import { L } from '$lib/i18n';
  import Icon from '$lib/ui/kit/Icon.svelte';
  import InlineName from '$lib/ui/kit/InlineName.svelte';
  import LayerView from './LayerView.svelte';
  import { Gestures, HANDLES, LABEL_PX, handlePoint, labelRect } from './gestures.svelte';
  import { artboards } from '$lib/document/artboards';

  /** The drawing surface: SVG rendering, overlays (selection, handles, nodes) and input wiring.
   *  Overlays are in document space with sizes divided by the zoom, so they keep a constant screen size. */
  let { doc }: { doc: Doc } = $props();

  // svelte-ignore state_referenced_locally -- one document for the canvas's whole life
  const gestures = new Gestures(doc);
  let el: HTMLDivElement;
  const px = $derived(1 / doc.zoom); // one screen pixel in document units

  const view = (e: MouseEvent): Pt => {
    const r = el.getBoundingClientRect();
    return pt(e.clientX - r.left, e.clientY - r.top);
  };

  $effect(() => {
    el.focus(); // tool keys work right away
    const ro = new ResizeObserver(([entry]) => {
      const first = !doc.viewSize.width;
      doc.viewSize = { width: entry.contentRect.width, height: entry.contentRect.height };
      if (first) doc.zoomToFit(); // a document opened at launch is framed once the size is known
    });
    ro.observe(el);
    return () => ro.disconnect();
  });

  $effect(() => {
    void doc.shift, void doc.option;
    untrack(() => gestures.modifiersChanged()); // depends on the modifiers only, not on what the drag reads
  });

  function pointerdown(e: PointerEvent) {
    if (e.button !== 0) return;
    e.preventDefault(); // no native mousedown focus change: it would blur a rename field opened by this click
    el.focus();
    el.setPointerCapture(e.pointerId);
    gestures.down(view(e), e.shiftKey);
  }

  function pointermove(e: PointerEvent) {
    doc.hover = view(e);
    gestures.move(view(e));
  }

  /** Scroll = pan, ⌘-scroll / pinch (ctrl-wheel in WebKit) = zoom around the cursor. */
  function wheel(e: WheelEvent) {
    e.preventDefault();
    const k = e.deltaMode === 1 ? 16 : 1;
    if (e.ctrlKey || e.metaKey) doc.zoomBy(Math.exp(-e.deltaY * k * 0.01), view(e));
    else doc.pan = pt(doc.pan.x - e.deltaX * k, doc.pan.y - e.deltaY * k);
  }

  // Tool keys live here, not in the menus, so they never fire while typing in a text field.
  function keydown(e: KeyboardEvent) {
    if (e.target !== el || e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.key === 'Enter' || e.key === 'Escape') {
      if (e.key === 'Enter' && doc.tool === 'select' && !doc.editing) doc.enterEdit(); // Return edits points
      else doc.tool = 'select';
    } else {
      const t = TOOLS.find((t) => toolKey[t] === e.key.toLowerCase());
      if (!t) return;
      doc.tool = t;
    }
    e.preventDefault();
  }

  /** Local point → document, following the drag preview. Overlays map points instead of taking a
   *  transform so strokes and handles keep their screen size under a resize preview. */
  const follow = (l: Layer, p: Pt) => (doc.preview?.ids.has(l.id) ? apply(doc.preview.t, p) : p);
  const world = (l: Layer, q: Pt) => follow(l, toWorld(l, q));
  /** Local bounds of the selection, not recomputed on each preview frame (costly for big groups). */
  const selectedBounds = $derived(new Map(doc.selectedLayers.map((l) => [l.id, localBounds(l)])));
  const frame = (l: Layer) => {
    const b = selectedBounds.get(l.id) ?? localBounds(l);
    const corners = [pt(b.x, b.y), pt(b.x + b.width, b.y), pt(b.x + b.width, b.y + b.height), pt(b.x, b.y + b.height)].map((q) => world(l, q));
    return { b, corners: corners.map((p) => `${p.x},${p.y}`).join(' ') };
  };
  const parentBounds = (l: Layer): Rect | null => {
    const p = parent(doc.layers, l.id);
    return p && bounds(p);
  };
</script>

{#snippet nodeBox(n: Node, selected: boolean, handles: boolean, tint: string)}
  {@const r = 3 * px}
  {#if handles && (!eqPt(n.cin, n.p) || !eqPt(n.cout, n.p))}
    <polyline points="{n.cin.x},{n.cin.y} {n.p.x},{n.p.y} {n.cout.x},{n.cout.y}" fill="none" stroke="var(--edit)" stroke-width={px} />
    {#each [n.cin, n.cout] as h, i (i)}
      {#if !eqPt(h, n.p)}<circle cx={h.x} cy={h.y} {r} fill="var(--edit)" />{/if}
    {/each}
  {/if}
  <rect x={n.p.x - r} y={n.p.y - r} width={2 * r} height={2 * r} fill={selected ? tint : 'var(--handle-fill)'} stroke={tint} stroke-width={px} />
{/snippet}

<!-- svelte-ignore a11y_no_noninteractive_tabindex, a11y_no_noninteractive_element_interactions -- a drawing surface: role=application takes keys and pointer -->
<div
  bind:this={el}
  class="canvas"
  class:crosshair={doc.tool !== 'select'}
  tabindex="0"
  role="application"
  aria-label={L('Canvas')}
  onpointerdown={pointerdown}
  onpointermove={pointermove}
  onpointerup={() => gestures.up()}
  onpointercancel={() => gestures.up()}
  onpointerleave={() => !gestures.dragging && (doc.hover = null)}
  onwheel={wheel}
  onkeydown={keydown}
>
  <svg>
    <g transform="translate({doc.pan.x} {doc.pan.y}) scale({doc.zoom})">
      {#each doc.layers as l (l.id)}<LayerView {l} preview={doc.preview} typing={doc.editingText} />{/each}

      <g class="overlay">
        <!-- artboard names: how an artboard is picked (see labelRect) -->
        {#each artboards(doc.layers) as a (a.id)}
          {#if !a.hidden && !(doc.renaming?.id === a.id && doc.renaming.where === 'canvas')}
            {@const o = follow(a, labelRect(a, doc.zoom))}
            <text x={o.x} y={o.y + (LABEL_PX + 1) * px} font-size={LABEL_PX * px} class="label" class:selected={doc.selectedIDs.has(a.id)}>{a.name}</text>
          {/if}
        {/each}
        {#if doc.editingLayer}
          {@const l = doc.editingLayer}
          <!-- point-edit mode -->
          <path d={pathData(shape(l), 3)} fill="none" stroke="var(--accent)" stroke-width={px} />
          {#each l.subpaths as sp, s (s)}
            {#each sp.nodes as n, i (i)}
              {@const sel = doc.selectedNode?.s === s && doc.selectedNode?.n === i}
              {@render nodeBox(mapNode(n, (q) => toWorld(l, q)), sel, sel, 'var(--edit)')}
            {/each}
          {/each}
        {:else if doc.selected}
          {@const l = doc.selected}
          {@const { b, corners } = frame(l)}
          {@const pb = parentBounds(l)}
          {#if pb}
            <!-- context: the group being worked in -->
            <rect x={pb.x} y={pb.y} width={pb.width} height={pb.height} fill="none" stroke="var(--accent)" stroke-opacity="0.4"
              stroke-width={px} stroke-dasharray="{4 * px} {3 * px}" />
          {/if}
          <polygon points={corners} fill="none" stroke="var(--accent)" stroke-width={px} />
          {#if doc.tool === 'select' && !doc.isLocked(l.id)}
            <!-- locked: frame only, no handles -->
            {#if l.kind !== 'artboard'}
              <!-- artboards don't rotate -->
              {@const r = follow(l, gestures.rotateHandle(l, b))}
              {@const top = world(l, pt(b.x + b.width / 2, b.y))}
              <line x1={top.x} y1={top.y} x2={r.x} y2={r.y} stroke="var(--accent)" stroke-width={px} />
              <circle cx={r.x} cy={r.y} r={4 * px} fill="var(--handle-fill)" stroke="var(--accent)" stroke-width={px} />
            {/if}
            {#each HANDLES as h, i (i)}
              {@const q = world(l, handlePoint(h, b))}
              {@render nodeBox({ p: q, cin: q, cout: q }, false, false, 'var(--accent)')}
            {/each}
          {/if}
        {:else}
          <!-- multiple selection: frames only -->
          {#each doc.selectedLayers as l (l.id)}
            <polygon points={frame(l).corners} fill="none" stroke="var(--accent)" stroke-width={px} />
          {/each}
        {/if}

        {#if doc.penLayer}
          <!-- path being drawn with the pen -->
          {@const nodes = doc.penLayer.subpaths[0].nodes}
          {#each nodes as n, i (i)}{@render nodeBox(n, false, i === nodes.length - 1, 'var(--accent)')}{/each}
        {/if}
      </g>
    </g>
  </svg>

  {#if doc.renaming?.where === 'canvas'}
    {@const a = doc.get(doc.renaming.id)}
    {#if a}
      {@const r = labelRect(a, doc.zoom)}
      <div class="rename" style:left="{r.x * doc.zoom + doc.pan.x}px" style:top="{r.y * doc.zoom + doc.pan.y}px">
        <InlineName label={L('Name')} value={a.name} oncommit={(n) => doc.rename(a.id, n)} oncancel={() => (doc.renaming = null)} />
      </div>
    {/if}
  {/if}

  {#if doc.editingText}
    {@const l = doc.get(doc.editingText)}
    {#if l?.text}
      {@const t = l.text}
      {@const b = localBounds(l)}
      <!-- typing: a text field laid out like the SVG text it stands for (same font, box, line height) -->
      <textarea
        class="typing"
        aria-label={L('Text')}
        value={t.content}
        spellcheck="false"
        {@attach (ta: HTMLTextAreaElement) => { ta.focus(); ta.select(); }}
        style:left="{b.x * doc.zoom + doc.pan.x}px"
        style:top="{b.y * doc.zoom + doc.pan.y}px"
        style:width="{b.width * doc.zoom + 2}px"
        style:height="{b.height * doc.zoom}px"
        style:rotate={l.rotation ? `${l.rotation}rad` : undefined}
        style:font-family={t.font}
        style:font-size="{t.size * doc.zoom}px"
        style:font-weight={t.weight}
        style:line-height={t.lineHeight}
        style:letter-spacing="{t.letterSpacing * doc.zoom}px"
        style:text-align={t.align}
        style:color={css(l.fill)}
        style:white-space={t.autoWidth ? 'pre' : 'pre-wrap'}
        oninput={(e) => doc.setText(e.currentTarget.value)}
        onblur={() => doc.endTextEdit()}
        onkeydown={(e) => e.key === 'Escape' && el.focus()}
        onpointerdown={(e) => e.stopPropagation()}
      ></textarea>
    {/if}
  {/if}

  {#if gestures.hint}
    <div class="hint" style:left="{gestures.hint.at.x + 14}px" style:top="{gestures.hint.at.y + 14}px">
      <Icon name={gestures.hint.icon} />{gestures.hint.text}
    </div>
  {/if}
</div>

<style>
  .canvas {
    position: relative;
    overflow: hidden;
    background: var(--pasteboard);
    outline: none;
    touch-action: none;
  }
  .crosshair {
    cursor: crosshair;
  }
  svg {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
  }
  .overlay {
    pointer-events: none;
  }
  .label {
    fill: var(--text-2);
    font-family: var(--font);
  }
  .label.selected {
    fill: var(--accent);
  }
  .rename {
    position: absolute;
    width: 16em;
    font-size: var(--text-11);
  }
  .typing {
    position: absolute;
    box-sizing: content-box;
    margin: 0;
    padding: 0;
    border: none;
    outline: none;
    background: none;
    overflow: hidden;
    resize: none;
  }
  .hint {
    position: absolute;
    display: flex;
    align-items: center;
    gap: var(--space-1);
    padding: var(--space-1) var(--space-2);
    border-radius: var(--radius-pill);
    background: var(--panel);
    box-shadow: var(--shadow);
    color: var(--text);
    font-size: var(--text-11);
    white-space: nowrap;
    pointer-events: none;
  }
</style>

<script lang="ts">
  import { L } from '$lib/i18n';
  import { type RGBA, css, eqColor, fromHSV, fromHex, hex, hsv } from '$lib/model/color';
  import { type GradientFill, type Stop, angleOf, colorAt, gradientCSS, linearAt, radialIn, sortStops } from '$lib/model/effects';
  import type { Rect } from '$lib/model/geometry';
  import Swatch from './Swatch.svelte';
  import NumberField from './NumberField.svelte';
  import Segmented from './Segmented.svelte';
  import Icon from './Icon.svelte';

  /** Swatch that opens a color panel (native popover): saturation/brightness square, hue and opacity
   *  sliders, hex field, document palette. Reports every change; the caller coalesces undo (`styleEdit`).
   *  With `ongradient`, the panel also edits gradients (fill types): linear or radial, a stops bar
   *  (click adds a stop, drag moves it, Delete removes it, two at least) and, for linear, the angle; the
   *  color controls then edit the selected stop. `bounds` (layer local space) frames new gradients. */
  let { color, onchange, label, palette = [], onaddtopalette, onremovefrompalette, disabled = false,
    gradient = null, ongradient, bounds = { x: 0, y: 0, width: 1, height: 1 } }: {
    color: RGBA; onchange: (c: RGBA) => void; label: string;
    palette?: RGBA[]; onaddtopalette?: (c: RGBA) => void; onremovefrompalette?: (i: number) => void; disabled?: boolean;
    gradient?: GradientFill | null; ongradient?: (g: GradientFill | null) => void; bounds?: Rect;
  } = $props();

  const uid = $props.id();
  // Edited in HSB and kept here, so hue survives dragging through gray/black.
  let h = $state(0), s = $state(0), v = $state(0);
  let hexDraft = $state<string | null>(null);
  let sel = $state(0); // selected stop (index in sorted stops)

  const stops = $derived(gradient ? sortStops(gradient.stops) : []);
  /** What the color controls edit: the solid color, or the selected stop. */
  const current = $derived(gradient ? (stops[Math.min(sel, stops.length - 1)]?.color ?? color) : color);

  function syncFromColor(from = current) {
    const c = hsv(from);
    if (c.s > 0) h = c.h; // keep the current hue for grays
    s = c.s;
    v = c.v;
  }

  /** New geometry keeps the gradient's own transform (imported gradients stay as they were). */
  const withStops = (next: Stop[]) => ({ ...$state.snapshot(gradient!), stops: sortStops(next) }) as GradientFill;

  function setColor(c: RGBA) {
    if (!gradient) return onchange(c);
    const i = Math.min(sel, stops.length - 1);
    ongradient!(withStops(stops.map((x, j) => (j === i ? { ...x, color: c } : x))));
  }
  const push = () => setColor(fromHSV(h, s, v, current.a));
  const pure = $derived(css(fromHSV(h, 1, 1)));
  const opaque = $derived(css({ ...current, a: 1 }));

  // Fill type: color, linear, radial
  type Kind = 'color' | 'linear' | 'radial';
  const kind = $derived<Kind>(gradient?.kind ?? 'color');
  function setKind(k: Kind) {
    if (k === kind) return;
    if (k === 'color') return ongradient!(null);
    // from a color: that color fading out (the default); from the other kind: keep the stops
    const base: Stop[] = gradient ? $state.snapshot(stops) : [{ offset: 0, color: { ...color } }, { offset: 1, color: { ...color, a: 0 } }];
    sel = 0;
    ongradient!(k === 'linear' ? linearAt(180, bounds, base) : radialIn(bounds, base));
    syncFromColor(base[0].color);
  }

  // Stops bar
  function moveStop(i: number, offset: number) {
    const moved = stops.map((x, j) => (j === i ? { ...x, offset } : x));
    const order = moved.map((_, j) => j).sort((a, b) => moved[a].offset - moved[b].offset);
    sel = order.indexOf(i); // the selected stop follows its new place
    ongradient!(withStops(moved));
  }
  function dragStop(e: PointerEvent, bar: HTMLElement, i: number) {
    e.stopPropagation();
    const r = bar.getBoundingClientRect();
    let index = i;
    sel = i;
    syncFromColor(stops[i].color);
    (e.currentTarget as HTMLElement).focus();
    const move = (ev: PointerEvent) => {
      const offset = Math.min(Math.max((ev.clientX - r.left) / r.width, 0), 1);
      moveStop(index, offset);
      index = sel;
    };
    const up = () => { removeEventListener('pointermove', move); removeEventListener('pointerup', up); };
    addEventListener('pointermove', move);
    addEventListener('pointerup', up);
  }
  /** Click on the bar: a new stop there, with the color the gradient already has at that point. */
  function addStop(e: PointerEvent) {
    const bar = e.currentTarget as HTMLElement, r = bar.getBoundingClientRect();
    const offset = Math.min(Math.max((e.clientX - r.left) / r.width, 0), 1);
    const next = [...stops, { offset, color: colorAt(stops, offset) }];
    const i = sortStops(next).findIndex((x) => x.offset === offset);
    ongradient!(withStops(next));
    sel = i;
    syncFromColor(next.at(-1)!.color);
  }
  function stopKeys(e: KeyboardEvent, i: number) {
    if ((e.key === 'Delete' || e.key === 'Backspace') && stops.length > 2) {
      e.preventDefault();
      e.stopPropagation(); // not the layer's Delete
      sel = Math.max(0, i - 1);
      ongradient!(withStops(stops.filter((_, j) => j !== i)));
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      e.preventDefault();
      const k = (e.shiftKey ? 0.1 : 0.01) * (e.key === 'ArrowLeft' ? -1 : 1);
      moveStop(i, Math.min(Math.max(stops[i].offset + k, 0), 1));
    }
  }

  const clamp = (x: number) => Math.min(Math.max(x, 0), 1);
  /** Arrow keys → steps of 1 % (⇧: 10 %). */
  const arrows = (step: (dx: number, dy: number) => void) => (e: KeyboardEvent) => {
    const k = e.shiftKey ? 0.1 : 0.01;
    const d = { ArrowLeft: [-k, 0], ArrowRight: [k, 0], ArrowUp: [0, -k], ArrowDown: [0, k] }[e.key];
    if (!d) return;
    e.preventDefault();
    step(d[0], d[1]);
  };

  /** Pointer drag over an element → 0…1 coordinates. */
  function track(set: (x: number, y: number) => void) {
    return (e: PointerEvent) => {
      const el = e.currentTarget as HTMLElement, r = el.getBoundingClientRect();
      const move = (ev: PointerEvent) =>
        set(Math.min(Math.max((ev.clientX - r.left) / r.width, 0), 1), Math.min(Math.max((ev.clientY - r.top) / r.height, 0), 1));
      el.setPointerCapture(e.pointerId);
      move(e);
      el.onpointermove = move;
      el.onpointerup = () => (el.onpointermove = null);
    };
  }

  let bar = $state<HTMLElement>();
</script>

<button
  type="button"
  class="swatch"
  aria-label={label}
  title={gradient ? L('Gradient') : hex(color)}
  {disabled}
  popovertarget="color-{uid}"
  style:anchor-name="--color-{uid}"
>
  <Swatch {color} paint={gradient ? gradientCSS(gradient) : undefined} />
</button>

<div
  id="color-{uid}"
  class="panel"
  popover="auto"
  style:position-anchor="--color-{uid}"
  ontoggle={(e) => { if (e.newState === 'open') { sel = 0; syncFromColor(); } }}
>
  {#if ongradient}
    <Segmented label={L('Fill type')} value={kind} onchange={setKind}
      options={[{ value: 'color', title: L('Color') }, { value: 'linear', title: L('Linear') }, { value: 'radial', title: L('Radial') }]} />
  {/if}
  {#if gradient}
    <!-- svelte-ignore a11y_no_static_element_interactions -- pointer shortcut; stops are reachable and editable by keyboard -->
    <div class="stops" bind:this={bar} style:--g={gradientCSS(gradient, 'bar')} onpointerdown={addStop} title={L('Click to add a stop')}>
      {#each stops as st, i (i)}
        <button
          type="button"
          class="stop"
          class:selected={i === Math.min(sel, stops.length - 1)}
          style:left="{st.offset * 100}%"
          style:--c={css(st.color)}
          aria-label="{L('Stop')} {Math.round(st.offset * 100)}%"
          onpointerdown={(e) => dragStop(e, bar!, i)}
          onkeydown={(e) => stopKeys(e, i)}
        ></button>
      {/each}
    </div>
    {#if gradient.kind === 'linear'}
      <div class="fields">
        <span class="caption">{L('Angle')}</span>
        <NumberField label={L('Angle')} value={angleOf(gradient)} suffix="°" onchange={(deg) => ongradient!(linearAt(deg, bounds, stops))} />
      </div>
    {/if}
  {/if}
  <div
    class="square"
    role="slider"
    tabindex="0"
    aria-label={L('Saturation and brightness')}
    aria-valuenow={Math.round(s * 100)}
    aria-valuetext="{Math.round(s * 100)}%, {Math.round(v * 100)}%"
    style:--hue={pure}
    onpointerdown={track((x, y) => { s = x; v = 1 - y; push(); })}
    onkeydown={arrows((dx, dy) => { s = clamp(s + dx); v = clamp(v - dy); push(); })}
  >
    <i style:left="{s * 100}%" style:top="{(1 - v) * 100}%"></i>
  </div>
  <div class="bar hue" role="slider" tabindex="0" aria-label={L('Hue')} aria-valuenow={Math.round(h * 360)} aria-valuemin={0} aria-valuemax={360}
    onpointerdown={track((x) => { h = Math.min(x, 0.9999); push(); })}
    onkeydown={arrows((dx) => { h = Math.min(clamp(h + dx), 0.9999); push(); })}>
    <i style:left="{h * 100}%"></i>
  </div>
  <div class="bar alpha" role="slider" tabindex="0" aria-label={L('Opacity')} aria-valuenow={Math.round(current.a * 100)} style:--c={opaque}
    onpointerdown={track((x) => setColor({ ...current, a: x }))}
    onkeydown={arrows((dx) => setColor({ ...current, a: clamp(current.a + dx) }))}>
    <i style:left="{current.a * 100}%"></i>
  </div>
  <div class="fields">
    <input
      class="hex"
      aria-label={L('Hex')}
      spellcheck="false"
      value={hexDraft ?? hex(current)}
      oninput={(e) => (hexDraft = e.currentTarget.value)}
      onkeydown={(e) => {
        if (e.key !== 'Enter') return;
        const c = fromHex(e.currentTarget.value);
        hexDraft = null;
        if (c) { setColor({ ...c, a: current.a }); syncFromColor(c); }
      }}
      onblur={() => (hexDraft = null)}
    />
    <NumberField label={L('Opacity')} value={current.a * 100} digits={0} min={0} max={100} suffix="%" onchange={(x) => setColor({ ...current, a: x / 100 })} />
  </div>
  {#if onaddtopalette}
    <div class="palette">
      <span>{L('Document colors')}</span>
      <div class="grid">
        {#each palette as c, i (i)}
          <button
            type="button"
            class="chip"
            class:current={eqColor(c, current)}
            title="{hex(c)} — {L('Right-click to remove')}"
            onclick={() => { setColor(c); syncFromColor(c); }}
            oncontextmenu={(e) => { e.preventDefault(); onremovefrompalette?.(i); }}
          ><Swatch color={c} /></button>
        {/each}
        <button type="button" class="chip add" title={L('Add the current color to the document')} onclick={() => onaddtopalette(current)}>
          <Icon name="plus" />
        </button>
      </div>
    </div>
  {/if}
</div>

<style>
  .swatch {
    height: 20px; /* width: the row's (a wide target, like the other fields) */
    padding: 0;
    border: none;
    border-radius: var(--radius-1);
    background: none;
  }
  .swatch:disabled {
    opacity: 0.5;
  }

  .panel {
    /* WebKit keeps the popover's UA `inset: 0` and stretches it over the whole anchor area: size it to its content */
    inset: auto;
    height: max-content;
    align-content: start;
    position-area: left center;
    position-try-fallbacks: flip-inline, flip-block;
    width: 240px;
    margin: var(--space-2);
    padding: var(--space-3);
    border: none;
    border-radius: var(--radius-2);
    background: var(--panel);
    color: var(--text);
    box-shadow: var(--shadow);
  }
  .panel:popover-open {
    display: grid;
    gap: var(--space-2);
  }

  .square,
  .bar {
    position: relative;
    touch-action: none;
  }
  /* stylelint-disable color-named, function-disallowed-list -- a color picker's own gradients and handles are the colors themselves, not theme */
  .square {
    height: 150px;
    border-radius: var(--radius-2);
    background:
      linear-gradient(transparent, black),
      linear-gradient(to right, white, transparent),
      var(--hue);
  }
  .bar {
    height: 14px;
    border-radius: 7px;
  }
  .hue {
    background: linear-gradient(to right, red, yellow, lime, cyan, blue, magenta, red);
  }
  .alpha {
    background:
      linear-gradient(to right, transparent, var(--c)),
      repeating-conic-gradient(var(--checker) 0 25%, var(--canvas) 0 50%) 0 0 / 10px 10px;
  }
  i {
    position: absolute;
    width: 12px;
    height: 12px;
    border: 2px solid white;
    border-radius: 50%;
    box-shadow: 0 0 2px black;
    transform: translate(-50%, -50%);
    pointer-events: none;
  }
  .bar i {
    top: 50%;
    background: white;
  }

  .fields {
    display: grid;
    grid-template-columns: 1fr 64px;
    align-items: center;
    gap: var(--space-1);
  }
  .caption {
    font-size: var(--text-12);
    color: var(--text-2);
  }

  /* Gradient stops: the gradient over a checkerboard, a handle per stop */
  .stops {
    position: relative;
    height: 18px;
    margin: 0 7px;
    border-radius: var(--radius-1);
    background:
      var(--g),
      repeating-conic-gradient(var(--checker) 0 25%, var(--canvas) 0 50%) 0 0 / 10px 10px;
    box-shadow: inset 0 0 0 var(--hairline) var(--border-strong);
    cursor: copy;
    touch-action: none;
  }
  .stop {
    position: absolute;
    top: 50%;
    width: 14px;
    height: 22px;
    padding: 0;
    border: 2px solid white;
    border-radius: 4px;
    background: var(--c);
    box-shadow: 0 0 0 var(--hairline) rgb(0 0 0 / 0.4), 0 1px 3px rgb(0 0 0 / 0.3);
    transform: translate(-50%, -50%);
    cursor: grab;
  }
  .stop.selected {
    outline: 2px solid var(--accent);
    outline-offset: 1px;
  }
  .hex {
    height: var(--control-h);
    padding: 0 var(--space-1);
    border: var(--hairline) solid var(--border-strong);
    border-radius: var(--radius-1);
    background: var(--field);
    font-family: var(--font-mono);
    font-size: var(--text-12);
    outline: none;
    user-select: text;
    -webkit-user-select: text;
  }
  .hex:focus {
    border-color: var(--accent);
  }

  .palette {
    display: grid;
    gap: var(--space-1);
    padding-top: var(--space-2);
    border-top: var(--hairline) solid var(--border);
  }
  .palette > span {
    font-size: var(--text-11);
    color: var(--text-2);
  }
  .grid {
    display: grid;
    grid-template-columns: repeat(8, 20px);
    gap: 6px;
  }
  .chip {
    width: 20px;
    height: 20px;
    padding: 0;
    border: none;
    border-radius: var(--radius-1);
    background: none;
  }
  .chip.current {
    outline: 2px solid var(--accent);
    outline-offset: 1px;
  }
  .add {
    display: grid;
    place-items: center;
    color: var(--text-2);
  }
  .add:hover {
    background: var(--hover);
  }
</style>

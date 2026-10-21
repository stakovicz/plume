<script lang="ts">
  import { type RGBA, css } from '$lib/model/color';

  /** Color chip; transparency shows over a checkerboard. `paint`: a CSS image instead (a gradient preview). */
  let { color, paint }: { color: RGBA; paint?: string } = $props();
</script>

<span style:--c={css(color)} style:--paint={paint}></span>

<style>
  span {
    display: block;
    width: 100%;
    height: 100%;
    border-radius: var(--radius-1);
    box-shadow: inset 0 0 0 var(--hairline) var(--border-strong);
    background:
      var(--paint, linear-gradient(var(--c), var(--c))),
      repeating-conic-gradient(var(--checker) 0 25%, var(--canvas) 0 50%) 0 0 / 10px 10px;
  }
</style>

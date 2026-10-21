<script lang="ts" module>
  /** 16×16 line icons, drawn with currentColor. */
  const paths = {
    select: '<path d="M4.5 2.5v10l2.6-2.4 2 4.4 1.6-.7-2-4.3h3.6z" fill="currentColor" stroke-linejoin="round"/>',
    pen: '<path d="M8 2 12 8.5 9.5 14h-3L4 8.5Z"/><path d="M8 2v6.5"/><circle cx="8" cy="9" r=".8" fill="currentColor"/>',
    pencil: '<path d="m11 2.5 2.5 2.5L5.5 13 2.5 13.5 3 10.5Z"/><path d="m9.5 4 2.5 2.5"/>',
    rect: '<rect x="2.5" y="3.5" width="11" height="9" rx="1"/>',
    ellipse: '<circle cx="8" cy="8" r="5.5"/>',
    text: '<path d="M3.5 4V2.5h9V4M8 2.5v11M6 13.5h4"/>',
    path: '<path d="M2 12C4 3 7 3 8 8s4 5 6-3"/>',
    group: '<path d="M2 4.5h4l1.5 1.5h6.5v6.5H2Z"/>',
    artboard: '<path d="M4.5 1.5v13M11.5 1.5v13M1.5 4.5h13M1.5 11.5h13"/>',
    eye: '<path d="M1.5 8c2-3.5 11-3.5 13 0-2 3.5-11 3.5-13 0Z"/><circle cx="8" cy="8" r="2"/>',
    'eye-off': '<path d="M1.5 8c2-3.5 11-3.5 13 0-2 3.5-11 3.5-13 0Z"/><circle cx="8" cy="8" r="2"/><path d="M3 13 13 3"/>',
    lock: '<rect x="3.5" y="7" width="9" height="6.5" rx="1"/><path d="M5.5 7V5a2.5 2.5 0 0 1 5 0v2"/>',
    'lock-open': '<rect x="3.5" y="7" width="9" height="6.5" rx="1"/><path d="M5.5 7V5a2.5 2.5 0 0 1 5 0"/>',
    plus: '<path d="M8 3v10M3 8h10"/>',
    rotate: '<path d="M13 8a5 5 0 1 1-1.5-3.6"/><path d="M12 1.8v2.8H9.2"/>',
    chevron: '<path d="m6 4 4 4-4 4"/>',
    // Combine: two overlapping squares, the result filled
    union: '<path d="M2.5 2.5h7v4h4v7h-7v-4h-4Z" fill="currentColor"/>',
    subtract: '<path d="M2.5 2.5h7v4h-3v3h-4Z" fill="currentColor"/><rect x="6.5" y="6.5" width="7" height="7"/>',
    intersect: '<rect x="2.5" y="2.5" width="7" height="7"/><rect x="6.5" y="6.5" width="7" height="7"/><rect x="6.5" y="6.5" width="3" height="3" fill="currentColor"/>',
    difference: '<path d="M2.5 2.5h7v4h-3v3h-4ZM9.5 6.5h4v7h-7v-4h3Z" fill="currentColor"/><rect x="6.5" y="6.5" width="3" height="3"/>',
    'sidebar-left': '<rect x="1.5" y="2.5" width="13" height="11" rx="1.5"/><path d="M6 2.5v11"/>',
    'sidebar-right': '<rect x="1.5" y="2.5" width="13" height="11" rx="1.5"/><path d="M10 2.5v11"/>',
  };
  export type IconName = keyof typeof paths;
</script>

<script lang="ts">
  let { name }: { name: IconName } = $props();
</script>

<svg viewBox="0 0 16 16" aria-hidden="true">{@html paths[name]}</svg>

<style>
  svg {
    width: var(--icon);
    height: var(--icon);
    flex: none;
    fill: none;
    stroke: currentColor;
    stroke-width: 1.3;
    stroke-linecap: round;
    stroke-linejoin: round;
  }
</style>

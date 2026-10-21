import { L } from '$lib/i18n';

export const TOOLS = ['select', 'artboard', 'pen', 'pencil', 'rect', 'ellipse', 'text'] as const;
export type Tool = (typeof TOOLS)[number];

/** Tool shortcuts; select is reached with Esc/Return. */
export const toolKey: Record<Tool, string | null> = { select: null, artboard: 'a', pen: 'v', pencil: 'p', rect: 'r', ellipse: 'o', text: 't' };

export const toolTitle = (t: Tool) =>
  ({ select: L('Select'), artboard: L('Artboard'), pen: L('Pen'), pencil: L('Pencil'), rect: L('Rectangle'), ellipse: L('Oval'), text: L('Text') })[t];

/** Toolbar tooltip: name, shortcut, how to use it. */
export function toolTooltip(t: Tool) {
  const usage = {
    select: L('Click to select, drag to move. Double-click or Return to edit points.'),
    artboard: L('Drag to draw an artboard, or pick a size in the inspector.'),
    pen: L('Click for a corner point, drag for a curve. Click the first point to close, Return to finish.'),
    pencil: L('Drag to draw freehand; smoothed into curves on release.'),
    rect: L('Drag to draw. ⇧ for a square, ⌥ from the center.'),
    ellipse: L('Drag to draw. ⇧ for a circle, ⌥ from the center.'),
    text: L('Click to type, drag for a box that wraps lines. Esc to finish.'),
  }[t];
  return `${toolTitle(t)} (${toolKey[t]?.toUpperCase() ?? 'Esc'})\n${usage}`;
}

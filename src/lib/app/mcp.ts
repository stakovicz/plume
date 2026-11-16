import type { Align, Doc } from '#lib/document/doc.svelte';
import { type RGBA, CLEAR, fromHex, hex } from '#lib/model/color';
import { pt } from '#lib/model/geometry';
import { base64 } from '#lib/model/images';
import { type Layer, bounds, center, hasVisibleStroke, isContainer, localBounds, moved, refit, reshaped, resized, rotated } from '#lib/model/layer';
import { remove } from '#lib/model/layer-tree';
import type { BooleanOp } from '#lib/model/boolean';
import { importSVG } from '#lib/svg/import';
import { type Framed, framedArtboard, framedLayers } from '#lib/svg/export';
import { version } from '../../../package.json'; // serverInfo: the app's version

/** MCP (Model Context Protocol) as Plume speaks it: what an agent reads and calls. The Rust shell only carries the
 *  messages (src-tauri/src/mcp.rs); everything the protocol says lives here, testable without a window.
 *  Adding a tool: an entry in TOOLS, a case in `call`, a test in tests/mcp.test.ts, a row in docs/reference/mcp.md. */

/** Protocol versions this server can speak; the client's is echoed when known, else the first. */
export const PROTOCOL_VERSIONS = ['2025-06-18', '2025-11-25', '2025-03-26', '2024-11-05'];

export const INSTRUCTIONS = `Plume is a vector editor; these tools read and edit the document open in its window, live, while the user watches.
- Coordinates are document pixels, x to the right, y down. Bounds are [x, y, width, height] of the rotated shape.
- Artboards are top-level frames (kind "artboard"); a layer lives at the top level or directly in one. Groups hold children.
- Layer ids are stable between calls: read the tree once with get_document, then address layers by id.
- To see a shape's exact geometry, use get_svg; to check what the user sees, use screenshot.
- Hidden layers are listed (hidden: true) but left out of get_svg and screenshot.
- To draw, write SVG and pass it to add_svg: it becomes editable layers. Then adjust with update_layers and arrange.
- Every edit is one undo step for the user (Edit › Undo). Locked layers can't be changed: ask the user to unlock them.
- Edits are refused while the user is typing text, editing points or drawing with the pen: ask them to finish (Esc).`;

type Schema = { type: 'object'; properties: Record<string, object>; required?: string[]; additionalProperties: false };
type Annotations = { readOnlyHint: boolean; destructiveHint?: boolean; idempotentHint?: boolean };
export type Tool = { name: string; title: string; description: string; inputSchema: Schema; annotations: Annotations };

const schema = (properties: Record<string, object> = {}, required?: string[]): Schema =>
  ({ type: 'object', properties, ...(required && { required }), additionalProperties: false });
const ids = { type: 'array', items: { type: 'string' }, description: 'Layer ids from get_document. Default: the selection, else the whole document.' };
const someIDs = (what: string) => ({ type: 'array', items: { type: 'string' }, minItems: 1, description: `Ids of the layers to ${what}, from get_document.` });
const color = (what: string) => ({ type: 'string', description: `${what}: "#RRGGBB", "#RRGGBBAA" (with opacity) or "none".` });
const EDIT = { readOnlyHint: false, destructiveHint: false };

/** arrange's operations, each the menu command of the same name applied to the given layers. */
const ARRANGE = {
  group: 'Group them (siblings only)', ungroup: 'Ungroup one group',
  union: 'Combine into one shape: union', subtract: 'Combine: the bottom shape minus the others',
  intersect: 'Combine: what all shapes share', difference: 'Combine: what an odd number of shapes cover',
  'align-left': 'Align left edges', 'align-center': 'Align horizontal centers', 'align-right': 'Align right edges',
  'align-top': 'Align top edges', 'align-middle': 'Align vertical centers', 'align-bottom': 'Align bottom edges',
  'distribute-horizontal': 'Equal horizontal gaps (3 layers or more)', 'distribute-vertical': 'Equal vertical gaps (3 layers or more)',
  'bring-forward': 'One step up in paint order', 'send-backward': 'One step down', 'bring-to-front': 'On top of its siblings', 'send-to-back': 'Below its siblings',
} as const;
type ArrangeOp = keyof typeof ARRANGE;

export const TOOLS: Tool[] = [
  {
    name: 'get_document', title: 'Read the document',
    description: 'The open document as a layer tree: file name, artboards, layers bottom to top (id, name, kind, bounds, '
      + 'fill and stroke as hex, text content), palette and selection. Start here. Example layer: '
      + '{"id":"…","name":"Sun","kind":"ellipse","bounds":[1150,450,380,380],"fill":"#FF6F00"}',
    inputSchema: schema(), annotations: { readOnlyHint: true },
  },
  {
    name: 'get_selection', title: 'Read the selection',
    description: 'The layers the user has selected, summarized like get_document; empty when nothing is selected.',
    inputSchema: schema(), annotations: { readOnlyHint: true },
  },
  {
    name: 'get_svg', title: 'Read layers as SVG',
    description: 'Exact geometry and style of layers as an SVG document (an artboard: its frame is the viewBox). '
      + 'Use it to inspect paths, gradients and effects that get_document summarizes.',
    inputSchema: schema({ ids }), annotations: { readOnlyHint: true },
  },
  {
    name: 'screenshot', title: 'Capture an image',
    description: 'A PNG of an artboard, of layers, or of the whole document, as the user sees it. Use it to check a result.',
    inputSchema: schema({
      id: { type: 'string', description: 'An artboard or layer id. Default: the selection, else the whole document.' },
      scale: { type: 'number', minimum: 0.1, maximum: 2, description: 'Pixels per document pixel. Default 1; reduced so the image stays within 2048 px.' },
    }),
    annotations: { readOnlyHint: true },
  },
  {
    name: 'add_svg', title: 'Draw with SVG',
    description: 'Adds shapes written as SVG (paths, rect, circle, ellipse, polygon, line, text, g, gradients); each element '
      + 'becomes an editable layer at its SVG coordinates, which are document pixels (leave out width, height and viewBox). '
      + 'Returns the new layers, which become the selection. Example: <svg><circle cx="200" cy="150" r="40" fill="#F5B700"/></svg>',
    inputSchema: schema({
      svg: { type: 'string', description: 'An SVG document or fragment wrapped in <svg>.' },
      parent: { type: 'string', description: 'Id of the artboard or group to add into. Default: the artboard under each shape, else the top level.' },
    }, ['svg']),
    annotations: EDIT,
  },
  {
    name: 'update_layers', title: 'Change layers',
    description: 'Changes properties of one or more layers in one undo step: name, position, size, rotation, colors, '
      + 'border, opacity, visibility, text, corner radius, polygon sides. Only the properties given change.',
    inputSchema: schema({
      updates: {
        type: 'array', minItems: 1, description: 'One entry per layer.',
        items: schema({
          id: { type: 'string', description: 'The layer to change.' },
          name: { type: 'string', description: 'Its name in the layer list.' },
          x: { type: 'number', description: 'Left edge of its bounds, as in get_document.' },
          y: { type: 'number', description: 'Top edge of its bounds.' },
          width: { type: 'number', exclusiveMinimum: 0, description: 'Width of its unrotated frame; the left edge stays.' },
          height: { type: 'number', exclusiveMinimum: 0, description: 'Height of its unrotated frame; the top edge stays.' },
          rotation: { type: 'number', description: 'Angle in degrees, clockwise, around its center (not for groups and artboards).' },
          fill: color('Fill color (text: its color; artboard: its background)'),
          stroke: color('Border color'),
          strokeWidth: { type: 'number', minimum: 0, description: 'Border width in pixels; 0 for none.' },
          opacity: { type: 'number', minimum: 0, maximum: 1, description: 'Opacity of the whole layer, 0 to 1.' },
          hidden: { type: 'boolean', description: 'Hide or show it.' },
          text: { type: 'string', description: 'Text layers: the new content.' },
          fontSize: { type: 'number', exclusiveMinimum: 0, description: 'Text layers: the type size in pixels.' },
          cornerRadius: { type: 'number', minimum: 0, description: 'Rectangles and text boxes: radius of all four corners.' },
          sides: { type: 'integer', minimum: 3, maximum: 64, description: 'Polygons: number of sides (or star points).' },
          innerRadius: { type: 'number', minimum: 0, maximum: 1, description: 'Polygons: 1 for a polygon, less for a star.' },
        }, ['id']),
      },
    }, ['updates']),
    annotations: EDIT,
  },
  {
    name: 'delete_layers', title: 'Delete layers',
    description: 'Deletes layers (a group or artboard with its content), in one undo step.',
    inputSchema: schema({ ids: someIDs('delete') }, ['ids']),
    annotations: { readOnlyHint: false, destructiveHint: true },
  },
  {
    name: 'arrange', title: 'Group, combine, align, order',
    description: 'Applies a menu command to layers, in one undo step: '
      + Object.entries(ARRANGE).map(([op, what]) => `${op} (${what})`).join(', ')
      + '. Several layers align on their common bounds, a single one on its artboard. Returns the resulting layers.',
    inputSchema: schema({
      op: { type: 'string', enum: Object.keys(ARRANGE), description: 'The command.' },
      ids: someIDs('arrange'),
    }, ['op', 'ids']),
    annotations: EDIT,
  },
  {
    name: 'select', title: 'Select layers',
    description: 'Selects layers in the window, to show the user what you mean or before they act. An empty list deselects.',
    inputSchema: schema({ ids: { type: 'array', items: { type: 'string' }, description: 'Ids to select, from get_document.' } }, ['ids']),
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true },
  },
  {
    name: 'undo', title: 'Undo',
    description: 'Undoes the last change in the document, like Edit › Undo: yours or the user\'s. Use it to take back your own last edit.',
    inputSchema: schema(), annotations: EDIT,
  },
  {
    name: 'redo', title: 'Redo',
    description: 'Redoes the last undone change, like Edit › Redo.',
    inputSchema: schema(), annotations: EDIT,
  },
];

type Content = { type: 'text'; text: string } | { type: 'image'; data: string; mimeType: string };
export type ToolResult = { content: Content[]; isError?: boolean };
/** PNG bytes of a framed SVG: app/render in the window, injected so the protocol is testable in Node. */
export type Rasterize = (f: Framed, scale: number) => Promise<Uint8Array>;

const text = (s: string): ToolResult => ({ content: [{ type: 'text', text: s }] });
const fail = (s: string): ToolResult => ({ content: [{ type: 'text', text: s }], isError: true });
const round = (v: number) => Math.round(v * 10) / 10;

/** What an agent needs to find and recognize a layer, without its raw points. */
export function summary(l: Layer): object {
  const b = bounds(l);
  const s: Record<string, unknown> = { id: l.id, name: l.name, kind: l.kind, bounds: [b.x, b.y, b.width, b.height].map(round) };
  if (l.hidden) s.hidden = true;
  if (l.locked) s.locked = true;
  if (l.kind !== 'group') {
    if (l.fillGradient) s.fill = 'gradient';
    else if (l.fill.a > 0) s.fill = l.fill.a < 1 ? `${hex(l.fill)} ${Math.round(l.fill.a * 100)}%` : hex(l.fill);
    if (hasVisibleStroke(l) && l.kind !== 'text') s.stroke = `${l.strokeGradient ? 'gradient' : hex(l.stroke)} ${round(l.strokeWidth)}px`;
  }
  if (l.opacity < 1) s.opacity = round(l.opacity);
  if (l.rotation) s.rotation = round((l.rotation * 180) / Math.PI);
  if (l.kind === 'polygon') Object.assign(s, { sides: l.sides, innerRadius: l.innerRadius });
  if (l.text) s.text = l.text.content;
  if (l.children.length) s.children = l.children.map(summary);
  return s;
}

/** The layers named by `ids`, else the selection; null for the whole document. A string: an unknown id. */
function target(doc: Doc, ids: unknown): Layer[] | string | null {
  if (Array.isArray(ids) && ids.length) {
    const ls = ids.map((id) => doc.get(String(id)));
    const missing = ids.find((_, i) => !ls[i]);
    return missing === undefined ? (ls as Layer[]) : `No layer with id "${missing}". Call get_document for the ids.`;
  }
  return doc.selectedLayers.length ? doc.selectedLayers : null;
}

/** One artboard: its frame; layers: their bounds; nothing: the whole document, padded like the export. */
const frameOf = (doc: Doc, ls: Layer[] | null): Framed =>
  ls?.length === 1 && ls[0].kind === 'artboard' ? framedArtboard(ls[0]) : ls ? framedLayers(ls) : framedLayers(doc.layers, 10);

// MARK: Editing

/** Why an edit can't happen now, if it can't: the user is in the middle of something. */
function busy(doc: Doc): string | null {
  const doing = doc.editingText ? 'typing text' : doc.editing ? 'editing points' : doc.penID ? 'drawing with the pen'
    : doc.dragging ? 'dragging' : doc.eyedropper ? 'picking a color' : doc.renaming ? 'renaming a layer' : null;
  return doing && `The user is ${doing} in Plume. Ask them to finish (Esc), then try again.`;
}

/** The layers `ids` name, all editable; else why not. */
function editable(doc: Doc, ids: unknown): Layer[] | string {
  if (!Array.isArray(ids) || !ids.length) return 'Give the ids of the layers, from get_document.';
  const ls: Layer[] = [];
  for (const id of ids) {
    const l = doc.get(String(id));
    if (!l) return `No layer with id "${id}". Call get_document for the ids.`;
    if (doc.isLocked(l.id)) return `"${l.name}" is locked (or in a locked group). Ask the user to unlock it.`;
    ls.push(l);
  }
  return ls;
}

/** "#RRGGBB(AA)" or "none" → a color; undefined when not given; a string when not valid. */
function paint(v: unknown, what: string): RGBA | undefined | string {
  if (v === undefined) return undefined;
  if (v === 'none') return CLEAR;
  return (typeof v === 'string' && fromHex(v)) || `${what} must be "#RRGGBB", "#RRGGBBAA" or "none", not ${JSON.stringify(v)}.`;
}

/** One layer with `u` applied, or why it can't be. Order: style, content, size, position, rotation. */
function updated(l: Layer, u: Record<string, unknown>): Layer | string {
  const num = (k: string) => (typeof u[k] === 'number' && Number.isFinite(u[k]) ? (u[k] as number) : undefined);
  let x: Layer = { ...l }; // only top-level fields are assigned below; model functions return new objects
  const fill = paint(u.fill, 'fill'), stroke = paint(u.stroke, 'stroke');
  if (typeof fill === 'string') return fill;
  if (typeof stroke === 'string') return stroke;
  if (typeof u.name === 'string') x.name = u.name;
  if (fill) x = { ...x, fill, fillGradient: undefined };
  if (stroke) x = { ...x, stroke, strokeGradient: undefined };
  if (num('strokeWidth') !== undefined) x.strokeWidth = Math.max(0, num('strokeWidth')!);
  if (num('opacity') !== undefined) x.opacity = Math.min(Math.max(num('opacity')!, 0), 1);
  if (typeof u.hidden === 'boolean') x.hidden = u.hidden;
  if (u.text !== undefined || u.fontSize !== undefined) {
    if (!x.text) return `"${l.name}" is not a text layer: text and fontSize apply to text only.`;
    const patch = { ...(typeof u.text === 'string' && { content: u.text }), ...(num('fontSize') && { size: num('fontSize') }) };
    x = refit({ ...x, text: { ...x.text, ...patch } }, x);
  }
  if (num('cornerRadius') !== undefined) {
    if (x.kind !== 'rect' && x.kind !== 'text') return `"${l.name}" is a ${x.kind}: cornerRadius applies to rectangles and text boxes.`;
    const r = Math.max(0, num('cornerRadius')!);
    x.corners = [r, r, r, r];
  }
  if (num('sides') !== undefined || num('innerRadius') !== undefined) {
    if (x.kind !== 'polygon') return `"${l.name}" is a ${x.kind}: sides and innerRadius apply to polygons.`;
    const sides = Math.min(Math.max(Math.round(num('sides') ?? x.sides), 3), 64), inner = Math.min(Math.max(num('innerRadius') ?? x.innerRadius, 0), 1);
    x = reshaped(x, sides, inner);
  }
  const w = num('width'), h = num('height');
  if (w !== undefined || h !== undefined) {
    const b = localBounds(x);
    if ((w !== undefined && (w <= 0 || b.width <= 0)) || (h !== undefined && (h <= 0 || b.height <= 0))) return `"${l.name}": width and height must be positive.`;
    x = resized(x, w !== undefined ? w / b.width : 1, h !== undefined ? h / b.height : 1, pt(b.x, b.y));
  }
  if (num('x') !== undefined || num('y') !== undefined) {
    const b = bounds(x);
    x = moved(x, pt((num('x') ?? b.x) - b.x, (num('y') ?? b.y) - b.y));
  }
  if (num('rotation') !== undefined) {
    if (isContainer(x)) return `"${l.name}" is a ${x.kind}: groups and artboards don't rotate; rotate its layers.`;
    x = rotated(x, (num('rotation')! * Math.PI) / 180 - x.rotation, center(x));
  }
  return x;
}

/** SVG text → layers, the frame built from a lone viewBox left out (like a paste). */
function fromSVG(svg: string): Layer[] {
  const ls = importSVG(svg);
  return ls.length === 1 && ls[0].kind === 'artboard' && !svg.includes('data-artboard') ? ls[0].children : ls;
}

/** Runs a menu command on `ls`, selected first; an error when the document didn't change. */
function arrange(doc: Doc, op: ArrangeOp, ls: Layer[]): ToolResult {
  const before = doc.json();
  doc.selectedIDs = new Set(ls.map((l) => l.id));
  if (op === 'group') doc.group();
  else if (op === 'ungroup') doc.ungroup();
  else if (op === 'union' || op === 'subtract' || op === 'intersect' || op === 'difference') doc.combine(op as BooleanOp);
  else if (op.startsWith('align-')) doc.align(op.slice(6) as Align);
  else if (op.startsWith('distribute-')) doc.distribute(op === 'distribute-horizontal');
  else doc.arrange(({ 'bring-forward': 'forward', 'send-backward': 'backward', 'bring-to-front': 'front', 'send-to-back': 'back' } as const)[op as 'bring-forward']);
  if (doc.json() !== before) return text(JSON.stringify(doc.selectedLayers.map(summary)));
  const why: Partial<Record<ArrangeOp, string>> = {
    group: 'Grouping needs 2 layers or more with the same parent, none of them an artboard.',
    ungroup: 'Ungroup takes exactly one group.',
    'distribute-horizontal': 'Distributing needs 3 visible layers or more.', 'distribute-vertical': 'Distributing needs 3 visible layers or more.',
  };
  const combine = ['union', 'subtract', 'intersect', 'difference'].includes(op)
    ? 'Combining needs 2 shapes or more with the same parent, no image; or the result was empty.' : undefined;
  return fail(`Nothing changed: ${why[op] ?? combine ?? 'the layers are already in place.'}`);
}

async function edit(doc: Doc, name: string, args: Record<string, unknown>): Promise<ToolResult> {
  const why = busy(doc);
  if (why) return fail(why);
  switch (name) {
    case 'add_svg': {
      if (typeof args.svg !== 'string' || !args.svg.trim()) return fail('Give the shapes as SVG text in "svg".');
      const host = args.parent === undefined ? null : doc.get(String(args.parent));
      if (args.parent !== undefined && (!host || !isContainer(host))) return fail(`"${args.parent}" is not an artboard or group id. Call get_document.`);
      if (host && doc.isLocked(host.id)) return fail(`"${host.name}" is locked. Ask the user to unlock it, or add elsewhere.`);
      let ls: Layer[];
      try { ls = fromSVG(args.svg); } catch (e) { return fail(`Not readable SVG: ${e}`); }
      if (!ls.length) return fail('The SVG has no shapes Plume can draw.');
      if (host) ls = ls.filter((l) => l.kind !== 'artboard'); // artboards stay top-level
      if (!ls.length) return fail('Artboards can only be added at the top level: leave out "parent".');
      doc.checkpoint();
      (host ? host.children : doc.layers).push(...ls);
      if (!host) doc.rehome(ls.map((l) => l.id));
      doc.selectedIDs = new Set(ls.map((l) => l.id));
      return text(JSON.stringify(doc.selectedLayers.map(summary)));
    }
    case 'update_layers': {
      const ups = Array.isArray(args.updates) ? (args.updates as Record<string, unknown>[]) : [];
      const ls = editable(doc, ups.map((u) => u?.id));
      if (typeof ls === 'string') return fail(ls);
      const results = ls.map((l, i) => updated(l, ups[i]));
      const bad = results.find((r) => typeof r === 'string');
      if (bad) return fail(`${bad} Nothing was changed.`);
      doc.checkpoint();
      for (const r of results as Layer[]) doc.set(r.id, r);
      doc.rehome(ls.map((l) => l.id));
      doc.dropCheckpointIfUnchanged();
      return text(JSON.stringify(ls.map((l) => doc.get(l.id)).filter((l) => l).map((l) => summary(l!))));
    }
    case 'delete_layers': {
      const ls = editable(doc, args.ids);
      if (typeof ls === 'string') return fail(ls);
      doc.checkpoint();
      const gone = new Set(ls.map((l) => l.id));
      remove(doc.layers, gone);
      doc.selectedIDs = new Set([...doc.selectedIDs].filter((id) => !gone.has(id)));
      return text(`Deleted ${ls.map((l) => `"${l.name}"`).join(', ')}. The user can bring them back with Edit › Undo.`);
    }
    case 'arrange': {
      if (typeof args.op !== 'string' || !(args.op in ARRANGE)) return fail(`op must be one of: ${Object.keys(ARRANGE).join(', ')}.`);
      const ls = editable(doc, args.ids);
      return typeof ls === 'string' ? fail(ls) : arrange(doc, args.op as ArrangeOp, ls);
    }
    case 'select': {
      const ls = Array.isArray(args.ids) && args.ids.length ? target(doc, args.ids) : [];
      if (typeof ls === 'string') return fail(ls);
      doc.selectedIDs = new Set((ls ?? []).map((l) => l.id));
      return text(JSON.stringify(doc.selectedLayers.map(summary)));
    }
    case 'undo':
    case 'redo': {
      const can = name === 'undo' ? doc.canUndo : doc.canRedo;
      if (!can) return fail(`Nothing to ${name}.`);
      if (name === 'undo') doc.undo();
      else doc.redo();
      return text(`Done. ${doc.canUndo ? 'More can be undone.' : 'Nothing more to undo.'}`);
    }
  }
  return fail(`Unknown tool "${name}". Available: ${TOOLS.map((t) => t.name).join(', ')}.`);
}

export async function call(doc: Doc, name: string, args: Record<string, unknown>, rasterize: Rasterize): Promise<ToolResult> {
  switch (name) {
    case 'get_document':
      return text(JSON.stringify({
        file: doc.filePath ?? null,
        edited: doc.isDirty,
        layers: doc.layers.map(summary),
        palette: doc.palette.map(hex),
        selection: [...doc.selectedIDs],
      }));
    case 'get_selection':
      return text(JSON.stringify(doc.selectedLayers.map(summary)));
    case 'get_svg': {
      const ls = target(doc, args.ids);
      return typeof ls === 'string' ? fail(ls) : text(frameOf(doc, ls).svg);
    }
    case 'screenshot': {
      const ls = target(doc, args.id === undefined ? undefined : [args.id]);
      if (typeof ls === 'string') return fail(ls);
      const f = frameOf(doc, ls);
      const asked = typeof args.scale === 'number' ? Math.min(Math.max(args.scale, 0.1), 2) : 1;
      const scale = Math.min(asked, 2048 / Math.max(f.width, f.height, 1)); // ponytail: a fixed cap, a parameter if agents need more
      const png = await rasterize(f, scale);
      return { content: [{ type: 'image', data: base64(png), mimeType: 'image/png' }] };
    }
    default:
      return edit(doc, name, args);
  }
}

type Request = { jsonrpc: '2.0'; id: string | number; method: string; params?: Record<string, unknown> };

/** One JSON-RPC request → its response. Never throws: a failure is an error the agent can read. */
export async function handle(doc: Doc, req: Request, rasterize: Rasterize): Promise<object> {
  const ok = (result: object) => ({ jsonrpc: '2.0', id: req.id, result });
  const error = (code: number, message: string) => ({ jsonrpc: '2.0', id: req.id, error: { code, message } });
  try {
    switch (req.method) {
      case 'initialize': {
        const asked = String(req.params?.protocolVersion ?? '');
        return ok({
          protocolVersion: PROTOCOL_VERSIONS.includes(asked) ? asked : PROTOCOL_VERSIONS[0],
          capabilities: { tools: {} },
          serverInfo: { name: 'plume', title: 'Plume', version },
          instructions: INSTRUCTIONS,
        });
      }
      case 'ping': return ok({});
      case 'tools/list': return ok({ tools: TOOLS });
      case 'tools/call': {
        const p = req.params ?? {};
        return ok(await call(doc, String(p.name), (p.arguments as Record<string, unknown>) ?? {}, rasterize));
      }
      default: return error(-32601, `Method not found: ${req.method}`);
    }
  } catch (e) {
    return req.method === 'tools/call' ? ok(fail(`Plume could not do it: ${e}`)) : error(-32603, String(e));
  }
}

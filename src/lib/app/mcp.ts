import type { Doc } from '#lib/document/doc.svelte';
import { hex } from '#lib/model/color';
import { base64 } from '#lib/model/images';
import { type Layer, bounds, hasVisibleStroke } from '#lib/model/layer';
import { type Framed, framedArtboard, framedLayers } from '#lib/svg/export';
import { version } from '../../../package.json'; // serverInfo: the app's version

/** MCP (Model Context Protocol) as Plume speaks it: what an agent reads and calls. The Rust shell only carries the
 *  messages (src-tauri/src/mcp.rs); everything the protocol says lives here, testable without a window.
 *  Adding a tool: an entry in TOOLS, a case in `call`, a test in tests/mcp.test.ts, a row in docs/reference/mcp.md. */

/** Protocol versions this server can speak; the client's is echoed when known, else the first. */
export const PROTOCOL_VERSIONS = ['2025-06-18', '2025-11-25', '2025-03-26', '2024-11-05'];

export const INSTRUCTIONS = `Plume is a vector editor; these tools read the document open in its window (read-only for now).
- Coordinates are document pixels, x to the right, y down. Bounds are [x, y, width, height] of the rotated shape.
- Artboards are top-level frames (kind "artboard"); a layer lives at the top level or directly in one. Groups hold children.
- Layer ids are stable between calls: read the tree once with get_document, then address layers by id.
- To see a shape's exact geometry, use get_svg; to check what the user sees, use screenshot.
- Hidden layers are listed (hidden: true) but left out of get_svg and screenshot.`;

type Schema = { type: 'object'; properties: Record<string, object>; additionalProperties: false };
export type Tool = { name: string; title: string; description: string; inputSchema: Schema; annotations: { readOnlyHint: boolean } };

const schema = (properties: Record<string, object> = {}): Schema => ({ type: 'object', properties, additionalProperties: false });
const ids = { type: 'array', items: { type: 'string' }, description: 'Layer ids from get_document. Default: the selection, else the whole document.' };

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
      return fail(`Unknown tool "${name}". Available: ${TOOLS.map((t) => t.name).join(', ')}.`);
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

import { describe, expect, test } from 'vitest';
import { Doc } from '#lib/document/doc.svelte';
import { pt } from '#lib/model/geometry';
import { newArtboard, newLayer } from '#lib/model/layer';
import { INSTRUCTIONS, TOOLS, handle } from '#lib/app/mcp';
import type { Framed } from '#lib/svg/export';

const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47]);
let rasterized: { f: Framed; scale: number } | null = null;
const rasterize = async (f: Framed, scale: number) => ((rasterized = { f, scale }), PNG);

function sample() {
  const d = new Doc();
  const board = newArtboard('Card', [pt(0, 0), pt(400, 300)]);
  const sun = newLayer('Sun', 'ellipse', [pt(10, 20), pt(110, 120)], { fill: { r: 1, g: 0.5, b: 0, a: 1 } });
  const star = newLayer('Star', 'polygon', [pt(200, 20), pt(300, 115)], { innerRadius: 0.4, hidden: true });
  const group = { ...newLayer('Group', 'group'), children: [newLayer('Box', 'rect', [pt(0, 200), pt(50, 250)], { locked: true })] };
  board.children = [sun, star, group];
  d.layers = [board];
  return { d, board, sun, star };
}

const request = (method: string, params?: object) => ({ jsonrpc: '2.0' as const, id: 7, method, params: params as Record<string, unknown> });
const callTool = async (d: Doc, name: string, args: object = {}) =>
  ((await handle(d, request('tools/call', { name, arguments: args }), rasterize)) as { result: { content: { type: string; text?: string; data?: string; mimeType?: string }[]; isError?: boolean } }).result;

describe('mcp', () => {
  test('initialize: echoes a known protocol version, gives instructions', async () => {
    const r = (await handle(new Doc(), request('initialize', { protocolVersion: '2025-03-26' }), rasterize)) as { id: number; result: Record<string, any> };
    expect(r.id).toBe(7);
    expect(r.result.protocolVersion).toBe('2025-03-26');
    expect(r.result.capabilities).toEqual({ tools: {} });
    expect(r.result.instructions).toBe(INSTRUCTIONS);
    const unknown = (await handle(new Doc(), request('initialize', { protocolVersion: '1999-01-01' }), rasterize)) as { result: Record<string, any> };
    expect(unknown.result.protocolVersion).toBe('2025-06-18');
  });

  test('tools/list: every tool described, read-only, with a closed input schema', async () => {
    const r = (await handle(new Doc(), request('tools/list'), rasterize)) as { result: { tools: typeof TOOLS } };
    expect(r.result.tools.map((t) => t.name)).toEqual(['get_document', 'get_selection', 'get_svg', 'screenshot']);
    for (const t of r.result.tools) {
      expect(t.description.length).toBeGreaterThan(40);
      expect(t.annotations.readOnlyHint).toBe(true);
      expect(t.inputSchema.additionalProperties).toBe(false);
      for (const p of Object.values(t.inputSchema.properties)) expect((p as { description: string }).description).toBeTruthy();
    }
  });

  test('get_document: the tree, compact, with what identifies each layer', async () => {
    const { d, board, sun } = sample();
    d.selectedIDs = new Set([sun.id]);
    const doc = JSON.parse((await callTool(d, 'get_document')).content[0].text!);
    expect(doc.selection).toEqual([sun.id]);
    const [ab] = doc.layers;
    expect(ab).toMatchObject({ id: board.id, kind: 'artboard', bounds: [0, 0, 400, 300] });
    const [s, star, group] = ab.children;
    expect(s).toMatchObject({ name: 'Sun', kind: 'ellipse', bounds: [10, 20, 100, 100], fill: '#FF7F00' });
    expect(s.points).toBeUndefined(); // no raw geometry
    expect(star).toMatchObject({ kind: 'polygon', sides: 5, innerRadius: 0.4, hidden: true });
    expect(group.children[0]).toMatchObject({ name: 'Box', locked: true });
  });

  test('get_selection: empty, then the selected layers', async () => {
    const { d, sun } = sample();
    expect(JSON.parse((await callTool(d, 'get_selection')).content[0].text!)).toEqual([]);
    d.selectedIDs = new Set([sun.id]);
    expect(JSON.parse((await callTool(d, 'get_selection')).content[0].text!)[0].name).toBe('Sun');
  });

  test('get_svg: an artboard by its frame, layers by their bounds, hidden ones left out, unknown id an error', async () => {
    const { d, board, sun, star } = sample();
    expect((await callTool(d, 'get_svg', { ids: [board.id] })).content[0].text).toContain('viewBox="0 0 400 300"');
    const svg = (await callTool(d, 'get_svg', { ids: [sun.id] })).content[0].text!;
    expect(svg).toContain('<ellipse');
    expect(svg).toContain('viewBox="10 20 100 100"');
    expect((await callTool(d, 'get_svg', { ids: [star.id] })).content[0].text).not.toContain('<polygon');
    const bad = await callTool(d, 'get_svg', { ids: ['nope'] });
    expect(bad.isError).toBe(true);
    expect(bad.content[0].text).toContain('get_document');
  });

  test('screenshot: a PNG of the target, scale clamped and kept within 2048 px', async () => {
    const { d, board } = sample();
    const r = await callTool(d, 'screenshot', { id: board.id, scale: 5 });
    expect(r.content[0]).toEqual({ type: 'image', data: 'iVBORw==', mimeType: 'image/png' });
    expect(rasterized!.scale).toBe(2);
    expect(rasterized!.f.width).toBe(400);
    d.layers = [newArtboard('Huge', [pt(0, 0), pt(8192, 100)])];
    await callTool(d, 'screenshot', { id: d.layers[0].id });
    expect(rasterized!.scale).toBe(0.25);
  });

  test('errors are answers, never throws', async () => {
    const d = new Doc();
    expect((await callTool(d, 'draw_logo')).isError).toBe(true);
    const r = (await handle(d, request('resources/list'), rasterize)) as { error: { code: number } };
    expect(r.error.code).toBe(-32601);
    const broken = await handle(d, request('tools/call', { name: 'screenshot', arguments: {} }), async () => { throw new Error('no canvas'); });
    expect((broken as { result: { isError: boolean } }).result.isError).toBe(true);
  });
});

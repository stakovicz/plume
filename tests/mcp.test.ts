// @vitest-environment jsdom
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

  test('tools/list: every tool described, reads marked read-only, closed input schemas', async () => {
    const r = (await handle(new Doc(), request('tools/list'), rasterize)) as { result: { tools: typeof TOOLS } };
    expect(r.result.tools.map((t) => t.name)).toEqual(['get_document', 'get_selection', 'get_svg', 'screenshot', 'add_svg', 'update_layers', 'delete_layers', 'arrange', 'select', 'undo', 'redo']);
    for (const t of r.result.tools) {
      expect(t.description.length).toBeGreaterThan(40);
      expect(t.annotations.readOnlyHint).toBe(t.name.startsWith('get_') || t.name === 'screenshot');
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

  test('add_svg: shapes at their SVG coordinates, in the artboard under them, selected, one undo step', async () => {
    const { d, board } = sample();
    const r = await callTool(d, 'add_svg', { svg: '<svg viewBox="0 0 10 10"><circle cx="200" cy="150" r="40" fill="#F5B700"/><rect x="900" y="0" width="10" height="10"/></svg>' });
    expect(r.isError).toBeUndefined();
    const added = JSON.parse(r.content[0].text!);
    expect(added).toHaveLength(2);
    expect(added[0]).toMatchObject({ kind: 'path', bounds: [160, 110, 80, 80], fill: '#F5B700' });
    expect(d.get(board.id)!.children.map((l) => l.id)).toContain(added[0].id); // inside the artboard's frame
    expect(d.layers.map((l) => l.id)).toContain(added[1].id); // outside it: top level
    expect([...d.selectedIDs]).toEqual(added.map((l: { id: string }) => l.id));
    d.undo();
    expect(d.get(added[0].id)).toBeNull();
    expect((await callTool(d, 'add_svg', { svg: '<svg><rect width="1" height="1"/></svg>', parent: 'nope' })).isError).toBe(true);
    expect((await callTool(d, 'add_svg', { svg: '<svg></svg>' })).isError).toBe(true);
  });

  test('update_layers: style, size, position, text, polygon; all or nothing; one undo step', async () => {
    const { d, sun, star } = sample();
    const r = await callTool(d, 'update_layers', { updates: [
      { id: sun.id, name: 'Moon', fill: '#336699', stroke: 'none', x: 0, y: 0, width: 50, opacity: 0.5 },
      { id: star.id, sides: 6, hidden: false },
    ] });
    expect(r.isError).toBeUndefined();
    const [moon, hex6] = JSON.parse(r.content[0].text!);
    expect(moon).toMatchObject({ name: 'Moon', fill: '#336699', bounds: [0, 0, 50, 100], opacity: 0.5 });
    expect(moon.stroke).toBeUndefined();
    expect(hex6).toMatchObject({ sides: 6 });
    expect(hex6.hidden).toBeUndefined();
    d.undo();
    expect(d.get(sun.id)!.name).toBe('Sun');
    expect(d.get(star.id)!.sides).toBe(5);
    // one bad update: nothing changes
    const bad = await callTool(d, 'update_layers', { updates: [{ id: sun.id, name: 'X' }, { id: sun.id, fill: 'red' }] });
    expect(bad.isError).toBe(true);
    expect(bad.content[0].text).toContain('#RRGGBB');
    expect(d.get(sun.id)!.name).toBe('Sun');
    expect((await callTool(d, 'update_layers', { updates: [{ id: sun.id, sides: 4 }] })).content[0].text).toContain('polygons');
  });

  test('update_layers: rotation and text', async () => {
    const d = new Doc();
    const t = newLayer('Title', 'text', [pt(0, 0), pt(10, 10)], { text: { ...(await import('#lib/model/text')).DEFAULT_TEXT, content: 'Hi' } });
    const box = newLayer('Box', 'rect', [pt(0, 0), pt(100, 50)]);
    d.layers = [t, box];
    const r = await callTool(d, 'update_layers', { updates: [{ id: t.id, text: 'Hello', fontSize: 32 }, { id: box.id, rotation: 90, cornerRadius: 8 }] });
    expect(r.isError).toBeUndefined();
    expect(d.get(t.id)!.text).toMatchObject({ content: 'Hello', size: 32 });
    expect(d.get(box.id)!.rotation).toBeCloseTo(Math.PI / 2);
    expect(d.get(box.id)!.corners).toEqual([8, 8, 8, 8]);
    expect((await callTool(d, 'update_layers', { updates: [{ id: box.id, text: 'no' }] })).isError).toBe(true);
  });

  test('locked layers are refused, with the reason', async () => {
    const { d } = sample();
    const box = d.layers[0].children[2].children[0];
    for (const [name, args] of [['update_layers', { updates: [{ id: box.id, name: 'X' }] }], ['delete_layers', { ids: [box.id] }], ['arrange', { op: 'align-left', ids: [box.id] }]] as const) {
      const r = await callTool(d, name, args);
      expect(r.isError).toBe(true);
      expect(r.content[0].text).toContain('locked');
    }
    expect(d.get(box.id)!.name).toBe('Box');
  });

  test('delete_layers, select, undo, redo', async () => {
    const { d, sun, star } = sample();
    d.selectedIDs = new Set([sun.id]);
    expect((await callTool(d, 'delete_layers', { ids: [sun.id, star.id] })).isError).toBeUndefined();
    expect(d.get(sun.id)).toBeNull();
    expect(d.selectedIDs.size).toBe(0);
    expect((await callTool(d, 'undo')).isError).toBeUndefined();
    expect(d.get(sun.id)).not.toBeNull();
    expect((await callTool(d, 'redo')).isError).toBeUndefined();
    expect(d.get(sun.id)).toBeNull();
    expect((await callTool(d, 'redo')).isError).toBe(true);
    await callTool(d, 'undo');
    await callTool(d, 'select', { ids: [star.id] });
    expect([...d.selectedIDs]).toEqual([star.id]);
    await callTool(d, 'select', { ids: [] });
    expect(d.selectedIDs.size).toBe(0);
  });

  test('arrange: group, align, combine; nothing to do is an error', async () => {
    const d = new Doc();
    const a = newLayer('A', 'rect', [pt(0, 0), pt(10, 10)]), b = newLayer('B', 'rect', [pt(30, 20), pt(50, 40)]);
    d.layers = [a, b];
    const aligned = await callTool(d, 'arrange', { op: 'align-top', ids: [a.id, b.id] });
    expect(aligned.isError).toBeUndefined();
    expect(d.get(b.id)!.points[0].y).toBe(0);
    const grouped = JSON.parse((await callTool(d, 'arrange', { op: 'group', ids: [a.id, b.id] })).content[0].text!);
    expect(grouped[0].kind).toBe('group');
    const again = await callTool(d, 'arrange', { op: 'group', ids: [grouped[0].id] });
    expect(again.isError).toBe(true);
    expect(again.content[0].text).toContain('2 layers');
    await callTool(d, 'arrange', { op: 'ungroup', ids: [grouped[0].id] });
    const merged = JSON.parse((await callTool(d, 'arrange', { op: 'union', ids: [a.id, b.id] })).content[0].text!);
    expect(merged).toHaveLength(1);
    expect(merged[0].kind).toBe('path');
    expect((await callTool(d, 'arrange', { op: 'spin', ids: [merged[0].id] })).isError).toBe(true);
  });

  test('edits wait for the user: refused while typing, editing points or drawing', async () => {
    const { d, sun } = sample();
    d.editingText = sun.id;
    const r = await callTool(d, 'update_layers', { updates: [{ id: sun.id, name: 'X' }] });
    expect(r.isError).toBe(true);
    expect(r.content[0].text).toContain('typing text');
    expect((await callTool(d, 'get_document')).isError).toBeUndefined(); // reading still works
  });
});

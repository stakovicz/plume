// @vitest-environment jsdom
import { describe, expect, test } from 'vitest';
import { unzipSync } from 'fflate';
import { pt } from '$lib/model/geometry';
import { addImage, imageBytes, imageInfo } from '$lib/model/images';
import { atOriginalSize, bounds, flipped, hit, imageFlip, localBounds, newArtboard, newImage, resized, rotated, toWorld, withImage } from '$lib/model/layer';
import { packFile, unpackFile, encodeFile, decodeFile } from '$lib/model/codable';
import { importSVG } from '$lib/svg/import';
import { layerSVG } from '$lib/svg/export';
import { Doc } from '$lib/document/doc.svelte';
import { near, nearRect, rect } from './helpers';

const u32 = (n: number) => [n >>> 24, (n >>> 16) & 255, (n >>> 8) & 255, n & 255];
/** A PNG header (enough for imageInfo) of `w`×`h`; `seed` makes distinct files. */
const png = (w: number, h: number, seed = 0) =>
  new Uint8Array([0x89, 0x50, 0x4e, 0x47, 13, 10, 26, 10, 0, 0, 0, 13, 73, 72, 68, 82, ...u32(w), ...u32(h), 8, 6, 0, 0, 0, seed, 0, 0, 0, 0]);

/** A JPEG with an EXIF orientation and a frame of `w`×`h` as stored. */
function jpeg(w: number, h: number, orientation: number) {
  const tiff = [0x4d, 0x4d, 0, 42, ...u32(8), 0, 1, 0x01, 0x12, 0, 3, ...u32(1), 0, orientation, 0, 0, ...u32(0)];
  const app1 = [0x45, 0x78, 0x69, 0x66, 0, 0, ...tiff];
  const sof = [8, h >> 8, h & 255, w >> 8, w & 255, 3, 1, 0x22, 0, 2, 0x11, 1, 3, 0x11, 1];
  return new Uint8Array([0xff, 0xd8, 0xff, 0xe1, 0, app1.length + 2, ...app1, 0xff, 0xc0, 0, sof.length + 2, ...sof, 0xff, 0xd9]);
}

describe('image', () => {
  test('format and size from the header; a quarter-turned JPEG reports its displayed size', () => {
    expect(imageInfo(png(300, 200))).toEqual({ type: 'image/png', width: 300, height: 200 });
    expect(imageInfo(jpeg(400, 300, 1))).toEqual({ type: 'image/jpeg', width: 400, height: 300 });
    expect(imageInfo(jpeg(400, 300, 6))).toEqual({ type: 'image/jpeg', width: 300, height: 400, orientation: 6 });
    const gif = new Uint8Array(32);
    gif.set([71, 73, 70, 56, 57, 97, 64, 1, 200, 0]);
    expect(imageInfo(gif)).toEqual({ type: 'image/gif', width: 320, height: 200 });
    const webp = new Uint8Array(32);
    webp.set([82, 73, 70, 70, 0, 0, 0, 0, 87, 69, 66, 80, 86, 80, 56, 88, 10, 0, 0, 0, 0, 0, 0, 0, 0x3f, 1, 0, 0xc7, 0, 0]);
    expect(imageInfo(webp)).toEqual({ type: 'image/webp', width: 320, height: 200 });
    expect(imageInfo(new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg"></svg>'))).toBeNull();
  });

  test('the same bytes are stored once, under the same key', () => {
    const a = addImage(png(10, 10, 1))!, b = addImage(png(10, 10, 1))!, c = addImage(png(10, 10, 2))!;
    expect(a.src).toBe(b.src);
    expect(a.src).not.toBe(c.src);
    expect(a.src).toMatch(/\.png$/);
  });

  test('placed at its size, scaled down to fit an artboard; picked by its frame', () => {
    const img = addImage(png(400, 200))!;
    const l = newImage('i', img, pt(0, 0), { x: 0, y: 0, width: 100, height: 100 });
    expect(localBounds(l)).toEqual({ x: -50, y: -25, width: 100, height: 50 });
    expect(l.lockRatio).toBe(true);
    expect(hit(l, pt(40, 20), 0)).toBe(true);
    expect(hit(l, pt(60, 0), 0)).toBe(false);
  });

  test('a flip or a resize past the opposite edge mirrors it; Original Size and Replace keep the center', () => {
    const img = addImage(png(40, 20))!, l = newImage('i', img, pt(0, 0));
    expect(imageFlip(flipped(l, true, 100))).toEqual({ x: -1, y: 1 });
    expect(bounds(flipped(l, true, 100))).toEqual({ x: 180, y: -10, width: 40, height: 20 });
    expect(imageFlip(resized(l, -1, 1, pt(20, 0)))).toEqual({ x: -1, y: 1 });
    expect(imageFlip(flipped(flipped(l, false, 0), false, 0))).toEqual({ x: 1, y: 1 });

    const big = flipped(resized(l, 3, 2, pt(0, 0)), true, 0);
    const back = atOriginalSize(big);
    expect(localBounds(back)).toEqual({ x: -20, y: -10, width: 40, height: 20 });
    expect(imageFlip(back).x).toBe(-1); // still mirrored

    const tall = withImage(l, addImage(png(10, 20))!);
    expect(nearRect(localBounds(tall), { x: -20, y: -40, width: 40, height: 80 })).toBe(true);
    expect(tall.image!.width).toBe(10);
  });

  test('.plm: the images the layers use go in the archive and come back', () => {
    const used = addImage(png(8, 8, 3))!, unused = addImage(png(8, 8, 4))!;
    const layers = [newImage('i', used, pt(0, 0))];
    const bytes = packFile(encodeFile({ layers, palette: [] }), layers);
    expect(Object.keys(unzipSync(bytes)).sort()).toEqual(['document.json', `images/${used.src}`]);
    expect(unused.src).not.toBe(used.src);
    const back = decodeFile(unpackFile(bytes)).layers[0];
    expect(back.kind).toBe('image');
    expect(back.image).toEqual(used);
    expect(imageBytes(used.src)).toEqual(png(8, 8, 3));
  });

  test('SVG: exported embedded, imported back as the same image, mirrored and rotated', () => {
    const img = addImage(png(40, 20, 5))!;
    const l = rotated(flipped(newImage('i', img, pt(50, 50)), true, 50), 0.5, pt(50, 50));
    const svg = layerSVG(l);
    expect(svg).toContain('href="data:image/png;base64,');
    const [ab] = importSVG(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">${svg}</svg>`);
    const back = ab.children[0];
    expect(back.kind).toBe('image');
    expect(back.image!.src).toBe(img.src);
    expect(nearRect(bounds(back), bounds(l))).toBe(true);
    // the same drawing: the picture's corners (points are in drawing order) land on the same spots
    const corners = (x: typeof l) => [x.points[0], pt(x.points[1].x, x.points[0].y), x.points[1]].map((p) => toWorld(x, p));
    corners(back).forEach((p, i) => expect(near(p, corners(l)[i], 1e-2)).toBe(true));
  });

  test('SVG import: preserveAspectRatio meet fits the picture in its box; other hrefs are skipped', () => {
    const b64 = btoa(String.fromCharCode(...png(40, 20, 6)));
    const [ab] = importSVG(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
      <image x="0" y="0" width="100" height="100" href="data:image/png;base64,${b64}"/>
      <image x="0" y="0" width="10" height="10" href="photo.png"/></svg>`);
    expect(ab.children.length).toBe(1);
    expect(localBounds(ab.children[0])).toEqual({ x: 0, y: 25, width: 100, height: 50 });
  });

  test('placed in the selection\'s artboard, scaled to fit; never combined', () => {
    const doc = new Doc();
    doc.replace([newArtboard('A', [pt(0, 0), pt(100, 100)]), newArtboard('B', [pt(200, 0), pt(300, 50)])]);
    doc.selection = doc.layers[1].id;
    doc.placeImage(addImage(png(200, 200))!);
    const b = doc.layers[1].children[0];
    expect(b.kind).toBe('image');
    expect(localBounds(b)).toEqual({ x: 225, y: 0, width: 50, height: 50 });
    doc.layers[1].children.push(rect(210, 10, 220, 20));
    doc.selectedIDs = new Set(doc.layers[1].children.map((l) => l.id));
    expect(doc.canGroup).toBe(true);
    expect(doc.canCombine).toBe(false);
  });
});

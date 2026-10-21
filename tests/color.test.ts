import { expect, test } from 'vitest';
import { fromHex, fromHSV, hex, hsv } from '$lib/model/color';

test('hsv round trip', () => {
  for (const c of [{ r: 1, g: 0, b: 0, a: 1 }, { r: 0.2, g: 0.6, b: 0.4, a: 0.5 }, { r: 0.9, g: 0.1, b: 0.7, a: 1 }]) {
    const { h, s, v } = hsv(c);
    const back = fromHSV(h, s, v, c.a);
    expect(Math.abs(back.r - c.r) + Math.abs(back.g - c.g) + Math.abs(back.b - c.b)).toBeLessThan(1e-9);
  }
  expect(hsv({ r: 0.5, g: 0.5, b: 0.5, a: 1 }).s).toBe(0); // gray: no saturation
});

test('hex parsing', () => {
  expect(fromHex('#f00')).toEqual({ r: 1, g: 0, b: 0, a: 1 });
  expect(fromHex('00FF0080')?.a).toBe(128 / 255);
  expect(fromHex('nope')).toBeNull();
  expect(hex({ r: 1, g: 0.5, b: 0, a: 1 })).toBe('#FF7F00');
});

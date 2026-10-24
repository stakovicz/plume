/** The part of fontkit we use (the package ships no types). */
declare module 'fontkit' {
  export type PathCommand = { command: 'moveTo' | 'lineTo' | 'quadraticCurveTo' | 'bezierCurveTo' | 'closePath'; args: number[] };
  export type Glyph = { path: { commands: PathCommand[] } };
  export type Position = { xAdvance: number; xOffset: number; yOffset: number };
  export type GlyphRun = { glyphs: Glyph[]; positions: Position[]; advanceWidth: number };
  export type Font = {
    postscriptName: string;
    unitsPerEm: number;
    ascent: number;
    descent: number; // negative
    variationAxes: Record<string, { min: number; default: number; max: number }>;
    layout(text: string, features?: Record<string, boolean>): GlyphRun;
    getVariation(settings: Record<string, number>): Font;
  };
  export type FontCollection = { fonts: Font[] };
  export function create(buffer: Uint8Array): Font | FontCollection;
}

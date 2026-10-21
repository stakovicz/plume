/** The part of opentype.js we use (the package ships no types). */
declare module 'opentype.js' {
  export type PathCommand = { type: 'M' | 'L' | 'C' | 'Q' | 'Z'; x: number; y: number; x1: number; y1: number; x2: number; y2: number };
  export type Options = { letterSpacing?: number }; // in em
  export type Font = {
    unitsPerEm: number;
    ascender: number;
    descender: number; // negative
    getAdvanceWidth(text: string, size: number, options?: Options): number;
    getPath(text: string, x: number, y: number, size: number, options?: Options): { commands: PathCommand[] };
  };
  export function parse(buffer: ArrayBuffer): Font;
}

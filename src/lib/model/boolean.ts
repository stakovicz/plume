import paper from 'paper/dist/paper-core';
import { type Subpath, add, apply, pt } from './geometry';
import { type Layer, isContainer, mapped, shape, transform } from './layer';

/** Combine operations, applied bottom to top in paint order. */
export const BOOLEAN_OPS = ['union', 'subtract', 'intersect', 'difference'] as const;
export type BooleanOp = (typeof BOOLEAN_OPS)[number];

// paper.js does the Bézier booleans (curves stay curves). One headless scope; nothing is ever drawn.
const scope = new paper.PaperScope();
scope.setup(new scope.Size(1, 1));

export function toPaper(subpaths: Subpath[], evenOdd: boolean): paper.CompoundPath {
  const children = subpaths.filter((s) => s.nodes.length).map((s) => new scope.Path({
    segments: s.nodes.map((n) => new scope.Segment(
      new scope.Point(n.p.x, n.p.y),
      new scope.Point(n.cin.x - n.p.x, n.cin.y - n.p.y),
      new scope.Point(n.cout.x - n.p.x, n.cout.y - n.p.y),
    )),
    closed: true, // filled area: open subpaths are implicitly closed, as when filling
    insert: false,
  }));
  return new scope.CompoundPath({ children, fillRule: evenOdd ? 'evenodd' : 'nonzero', insert: false });
}

export function fromPaper(item: paper.PathItem): Subpath[] {
  const paths = item instanceof scope.CompoundPath ? (item.children as paper.Path[]) : [item as paper.Path];
  return paths.filter((p) => p.segments.length).map((p) => ({
    closed: p.closed,
    nodes: p.segments.map((s) => {
      const q = pt(s.point.x, s.point.y);
      return { p: q, cin: add(q, pt(s.handleIn.x, s.handleIn.y)), cout: add(q, pt(s.handleOut.x, s.handleOut.y)) };
    }),
  }));
}

const METHOD = { union: 'unite', subtract: 'subtract', intersect: 'intersect', difference: 'exclude' } as const;

/** Filled area of `layers` (paint order, bottom first) combined by `op`, in document space. */
export function combinedShape(layers: Layer[], op: BooleanOp): Subpath[] {
  const [first, ...rest] = layers.map((l) => toPaper(shape(l), !isContainer(l) && l.evenOdd));
  const result = rest.reduce<paper.PathItem>((acc, p) => acc[METHOD[op]](p, { insert: false }), first);
  return fromPaper(result);
}

/** The path layer that replaces `layers`: the combined shape, styled like the bottom one.
 *  Its rotation is baked into the geometry (and gradients, clip), so the result is unrotated. */
export function combined(layers: Layer[], op: BooleanOp): Layer | null {
  const subpaths = combinedShape(layers, op);
  if (!subpaths.length) return null;
  const leaf = (l: Layer): Layer => (isContainer(l) && l.children.length ? leaf(l.children[0]) : l); // a group's style: its bottom layer's
  const style = leaf(layers[0]), t = transform(style);
  const flat = style.rotation === 0 ? style : mapped(style, (p) => apply(t, p));
  return {
    ...flat, id: crypto.randomUUID(), name: layers[0].name, kind: 'path', points: [], children: [], subpaths,
    rotation: 0, evenOdd: false, hidden: false, locked: false, text: undefined,
  };
}

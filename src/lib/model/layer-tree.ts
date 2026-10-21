import type { Layer } from './layer';

/** Layers form a tree (groups have children). These helpers address a layer by id wherever it is. */

export function find(ls: Layer[], id: string): Layer | null {
  for (const l of ls) {
    if (l.id === id) return l;
    const f = find(l.children, id);
    if (f) return f;
  }
  return null;
}

/** The sibling list that contains `id` (the live array: mutate it to edit the tree in place). */
export function siblings(ls: Layer[], id: string): Layer[] | null {
  if (ls.some((l) => l.id === id)) return ls;
  for (const l of ls) {
    const s = siblings(l.children, id);
    if (s) return s;
  }
  return null;
}

export function parent(ls: Layer[], id: string): Layer | null {
  for (const l of ls) {
    if (l.children.some((c) => c.id === id)) return l;
    const p = parent(l.children, id);
    if (p) return p;
  }
  return null;
}

/** Enclosing groups of `id`, outermost first; empty at top level or if not found. */
export function ancestors(ls: Layer[], id: string): Layer[] {
  for (const l of ls) {
    if (l.children.some((c) => c.id === id)) return [l];
    const deeper = ancestors(l.children, id);
    if (deeper.length) return [l, ...deeper];
  }
  return [];
}

export function update(ls: Layer[], id: string, layer: Layer) {
  const s = siblings(ls, id);
  if (s) s[s.findIndex((l) => l.id === id)] = layer;
}

/** Removes layers anywhere in the tree, in place; groups left empty go too. */
export function remove(ls: Layer[], ids: Set<string>) {
  for (let i = ls.length - 1; i >= 0; i--) {
    if (ids.has(ls[i].id)) {
      ls.splice(i, 1);
      continue;
    }
    remove(ls[i].children, ids);
    if (ls[i].kind === 'group' && !ls[i].children.length) ls.splice(i, 1);
  }
}

/** Layers among `ids`, in paint order (depth-first, bottom to top), leaving out any whose ancestor is also listed. */
export function inTreeOrder(ls: Layer[], ids: Set<string>): Layer[] {
  return ls.flatMap((l) => (ids.has(l.id) ? [l] : inTreeOrder(l.children, ids)));
}

/** `Base N`, N one past the highest number a `Base N` layer already has anywhere in the tree: names stay unique. */
export function nextName(ls: Layer[], base: string): string {
  const re = new RegExp(`^${base.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')} (\\d+)$`);
  let n = 0;
  const walk = (xs: Layer[]) => xs.forEach((l) => { n = Math.max(n, Number(re.exec(l.name)?.[1] ?? 0)); walk(l.children); });
  walk(ls);
  return `${base} ${n + 1}`;
}

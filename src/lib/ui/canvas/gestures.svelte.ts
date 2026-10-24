import { L } from '$lib/i18n';
import type { Doc } from '$lib/document/doc.svelte';
import type { Tool } from '$lib/document/tool';
import { type Affine, type Pt, type Rect, add, apply, dist, mapNode, node, pt, rectContains, rotateAround, scaleAround, translate, union } from '$lib/model/geometry';
import { type Guide, pointRect, snapAlong, snapRect } from '$lib/model/snapping';
import { fitCurve } from '$lib/model/curve-fit';
import { fitted } from '$lib/model/text';
import {
  type Layer, bounds, center, hit, keepingPlace, localBounds, localDelta, moved, resizeGesture, resized, rotated, toLocal, toWorld,
} from '$lib/model/layer';
import { parent, remove } from '$lib/model/layer-tree';
import { artboards } from '$lib/document/artboards';
import { type Target, insertNode, movedHandle, segmentAt, target, toggleCurve } from '$lib/model/point-editing';
import type { IconName } from '$lib/ui/kit/Icon.svelte';

/** What a click-drag does for each tool. */

/** Selection frame handles, in unit coordinates of the layer's local bounds. */
export const HANDLES = [[0, 0], [0.5, 0], [1, 0], [1, 0.5], [1, 1], [0.5, 1], [0, 1], [0, 0.5]].map(([x, y]) => pt(x, y));
export const handlePoint = (h: Pt, b: Rect) => pt(b.x + h.x * b.width, b.y + h.y * b.height);

/** An artboard's name above its top-left corner, constant screen size: it's how an artboard is picked.
 *  ponytail: width estimated from the character count (no text measuring); fine for picking. */
export const LABEL_PX = 11;
export function labelRect(a: Layer, zoom: number): Rect {
  const b = localBounds(a), w = Math.min((a.name.length * LABEL_PX * 0.6 + 4) / zoom, Math.max(b.width, 20 / zoom));
  return { x: b.x, y: b.y - (LABEL_PX + 7) / zoom, width: w, height: (LABEL_PX + 5) / zoom };
}

/** What the current mouse drag is doing, decided on mouse-down by `begin`. Layers are snapshots. */
type Drag =
  | { kind: 'ignore' }
  | { kind: 'move'; originals: Layer[]; box: Rect | null } // box: their bounds, for snapping
  | { kind: 'resize'; o: Layer; h: Pt } // handle in unit coordinates of the local bounds
  | { kind: 'rotate'; o: Layer }
  | { kind: 'edit'; o: Layer; t: Target }
  | { kind: 'draw'; tool: Tool };

const DOUBLE_CLICK_MS = 400;
const SNAP_PX = 5; // smart guides pull within this many screen pixels

export class Gestures {
  /** Pill next to the cursor while resizing/rotating, view space. */
  hint = $state<{ at: Pt; text: string; icon: IconName } | null>(null);
  /** Smart guides of the current drag, document space. */
  guides = $state<Guide[]>([]);
  #targets: Rect[] = []; // what the drag snaps to, taken on mouse-down
  #from = pt(0, 0); // where a drawing starts, document space, snapped
  #drag: Drag = { kind: 'ignore' };
  #start: Pt | null = null; // view space
  #last: Pt | null = null; // view space
  #lastDown = { time: 0, at: pt(0, 0), count: 0 }; // count: clicks in a row at that spot
  #commit: (() => void) | null = null; // writes what `doc.preview` shows, on mouse-up

  constructor(private doc: Doc) {}

  /** Rotation handle: above the top edge, in the layer's rotated frame, 20 screen px away. */
  rotateHandle(l: Layer, b: Rect) { return toWorld(l, pt(b.x + b.width / 2, b.y - 20 / this.doc.zoom)); }

  down(at: Pt, shiftClick: boolean) {
    this.#start = this.#last = at;
    this.#drag = this.#begin(this.doc.toDoc(at), shiftClick);
    this.doc.dragging = true;
  }

  move(at: Pt) {
    if (!this.#start) return;
    this.#last = at;
    const doc = this.doc, start = doc.toDoc(this.#start), loc = doc.toDoc(at);
    let d = pt((at.x - this.#start.x) / doc.zoom, (at.y - this.#start.y) / doc.zoom);
    const g = this.#drag;
    switch (g.kind) {
      case 'move':
        if (g.box) d = add(d, this.#snap({ ...g.box, x: g.box.x + d.x, y: g.box.y + d.y }));
        doc.preview = { ids: new Set(g.originals.map((o) => o.id)), t: translate(d.x, d.y) };
        this.#commit = () => {
          for (const o of g.originals) doc.set(o.id, moved(o, d));
          doc.rehome(g.originals.map((o) => o.id)); // dropped on / dragged off an artboard
        };
        break;
      case 'resize': {
        // the dragged handle snaps; the guides are those of where it ends up (⇧ or ⌥ may move it elsewhere)
        const q = toWorld(g.o, handlePoint(g.h, localBounds(g.o))), tol = SNAP_PX / doc.zoom;
        if (g.h.x === 0.5 || g.h.y === 0.5) { // side handle: slides along one local axis
          const r = g.o.rotation, u = g.h.y === 0.5 ? pt(Math.cos(r), Math.sin(r)) : pt(-Math.sin(r), Math.cos(r));
          const along = d.x * u.x + d.y * u.y, t = snapAlong(pt(q.x + u.x * along, q.y + u.y * along), u, this.#targets, tol);
          d = pt(d.x + u.x * t, d.y + u.y * t);
        } else {
          d = add(d, snapRect(pointRect(add(q, d)), this.#targets, tol).d);
        }
        this.guides = snapRect(pointRect(this.#resize(g.o, g.h, d)), this.#targets, 0).guides;
        const proportional = doc.shift || g.o.lockRatio;
        let text = proportional ? L('Proportional') : `${L('Free')} · ${L('⇧ proportional')}`;
        if (doc.option) text += ` · ${L('from center')}`;
        this.hint = { at, text, icon: proportional ? 'lock' : 'lock-open' };
        break;
      }
      case 'rotate': {
        const o = g.o, c = center(o);
        let a = o.rotation + Math.atan2(loc.y - c.y, loc.x - c.x) - Math.atan2(start.y - c.y, start.x - c.x);
        if (doc.shift) a = Math.round(a / (Math.PI / 12)) * (Math.PI / 12); // free by default, ⇧ snaps the absolute angle to 15°
        this.#write(o, rotateAround(c, a - o.rotation), () => rotated(o, a - o.rotation, c));
        let deg = Math.round((a * 180) / Math.PI) % 360;
        if (deg > 180) deg -= 360;
        else if (deg <= -180) deg += 360;
        this.hint = { at, text: doc.shift ? `${deg}° · ${L('15° steps')}` : `${deg}° · ${L('⇧ 15° steps')}`, icon: 'rotate' };
        break;
      }
      case 'edit':
        if (g.t.handle === 'node') { // a dragged point snaps to the other layers and the layer's other points
          const q = toWorld(g.o, g.o.subpaths[g.t.ref.s].nodes[g.t.ref.n].p);
          d = add(d, this.#snap(pointRect(add(q, d))));
        }
        this.#editNode(g.o, g.t, d);
        break;
      case 'draw':
        this.#draw(g.tool, this.#from, loc);
    }
  }

  /** Re-applies the drag when ⇧/⌥ toggles without mouse movement. */
  modifiersChanged() {
    if (this.#last && ['resize', 'rotate', 'draw'].includes(this.#drag.kind)) this.move(this.#last);
  }

  up() {
    const doc = this.doc, g = this.#drag;
    if (this.#commit) {
      this.#commit();
      this.#commit = null;
      doc.preview = null;
    }
    if (g.kind === 'draw' && g.tool === 'text') {
      const l = doc.selected;
      doc.tool = 'select';
      if (l?.text) { // a click types on one line from there; a drag sets the width lines wrap at
        const b = localBounds(l), click = b.width * doc.zoom < 4;
        const o = $state.snapshot(l) as Layer, half = (o.text!.size * o.text!.lineHeight) / 2;
        doc.set(l.id, fitted({ ...o, points: click ? [pt(b.x, b.y - half), pt(b.x, b.y - half)] : o.points, text: { ...o.text!, autoWidth: click } }));
        doc.editText(l.id, true);
      }
    } else if (g.kind === 'draw' && g.tool !== 'pen') {
      const l = doc.selected;
      if (l && Math.max(bounds(l).width, bounds(l).height) * doc.zoom < 2) {
        remove(doc.layers, new Set([l.id])); // degenerate shape from a click
        doc.selection = null;
      } else if (g.tool === 'pencil' && l) { // freehand samples → a few smooth Béziers
        l.subpaths[0].nodes = fitCurve(l.subpaths[0].nodes.map((n) => n.p), 2 / doc.zoom);
      } else if (g.tool === 'artboard' && l) {
        doc.adopt(l.id);
      }
      doc.tool = 'select'; // back to select after drawing
    }
    doc.dropCheckpointIfUnchanged();
    this.#start = this.#last = null;
    this.#drag = { kind: 'ignore' };
    doc.dragging = false;
    this.hint = null;
    this.guides = [];
  }

  // MARK: Smart guides

  /** Bounds of what a drag snaps to: visible layers as the canvas picks them (top-level layers, artboards and
   *  their children, the children of the group being worked in), minus `except`. */
  #snapTargets(except: Set<string>, scope: Layer[] = []): Rect[] {
    const ok = (l: Layer) => !l.hidden && !except.has(l.id);
    const ls = [...this.doc.layers.flatMap((l) => (l.kind === 'artboard' ? [l, ...l.children] : [l])), ...scope];
    return ls.filter(ok).map(bounds);
  }

  /** Offset that snaps `r` to the targets; shows the guides. */
  #snap(r: Rect, axes?: { x: boolean; y: boolean }): Pt {
    const s = snapRect(r, this.#targets, SNAP_PX / this.doc.zoom, axes);
    this.guides = s.guides;
    return s.d;
  }

  #snapPoint(p: Pt): Pt { return add(p, this.#snap(pointRect(p))); }

  /** A point-edit drag: snaps to the other layers and to the edited layer's other points. */
  #editing(o: Layer, t: Target): Drag {
    const others = o.subpaths.flatMap((sp, s) => sp.nodes.filter((_, n) => s !== t.ref.s || n !== t.ref.n).map((n) => pointRect(toWorld(o, n.p))));
    this.#targets = [...this.#snapTargets(new Set([o.id])), ...others];
    return { kind: 'edit', o, t };
  }

  /** A move drag: snaps the dragged layers' bounds to the rest. */
  #moving(originals: Layer[]): Drag {
    const ids = new Set(originals.map((o) => o.id)), home = parent(this.doc.layers, originals[0]?.id ?? '');
    this.#targets = this.#snapTargets(ids, home?.kind === 'group' ? home.children : []);
    return { kind: 'move', originals, box: originals.map(bounds).reduce<Rect | null>(union, null) };
  }

  // MARK: Mouse-down

  #begin(p: Pt, shiftClick: boolean): Drag {
    const doc = this.doc, tol = 5 / doc.zoom, now = Date.now();
    const again = now - this.#lastDown.time < DOUBLE_CLICK_MS && dist(p, this.#lastDown.at) < tol;
    const count = again ? this.#lastDown.count + 1 : 1, double = count === 2;
    this.#lastDown = { time: now, at: p, count };
    doc.checkpoint();
    if (doc.tool !== 'select') { // drawing snaps its corners (and pen points) to the other layers
      this.#targets = this.#snapTargets(new Set(doc.penID ? [doc.penID] : []));
      if (doc.tool !== 'pencil') p = this.#snapPoint(p);
      this.#from = p;
      this.guides = [];
    }

    switch (doc.tool) {
      case 'select': return this.#beginSelect(p, tol, double, shiftClick, count);
      case 'artboard': doc.add('artboard', p); break;
      case 'rect': doc.add('rect', p); break;
      case 'ellipse': doc.add('ellipse', p); break;
      case 'text': doc.add('text', p); break;
      case 'pencil': doc.add('path', p); break;
      case 'pen': {
        const l = doc.penLayer;
        if (l) {
          const nodes = l.subpaths[0].nodes;
          if (nodes.length >= 2 && dist(nodes[0].p, p) < tol) {
            l.subpaths[0].closed = true; // clicked first node: close and finish
            doc.tool = 'select';
            return { kind: 'ignore' };
          }
          nodes.push(node(p));
        } else {
          doc.add('path', p);
          doc.penID = doc.selection;
        }
      }
    }
    return { kind: 'draw', tool: doc.tool };
  }

  #beginSelect(p: Pt, tol: number, double: boolean, shiftClick: boolean, count: number): Drag {
    const doc = this.doc, snap = (l: Layer) => $state.snapshot(l) as Layer;
    const editing = doc.editingLayer;
    if (editing) {
      let e = snap(editing);
      const lp = toLocal(e, p);
      const t = target(e, lp, tol, doc.selectedNode);
      if (t) {
        if (double && t.handle === 'node') {
          const before = snap(e);
          toggleCurve(e, t.ref);
          e = keepingPlace(e, before);
          doc.editingLayer = e;
        }
        doc.selectedNode = t.ref;
        return this.#editing(e, t);
      }
      const seg = segmentAt(e, lp, tol);
      if (seg) { // click on a segment adds a point
        const r = insertNode(e, seg.s, seg.k, seg.t);
        doc.editingLayer = e;
        doc.selectedNode = r;
        return this.#editing(snap(e), { ref: r, handle: 'node' });
      }
      if (hit(e, p, tol)) {
        doc.selectedNode = null;
        return { kind: 'ignore' };
      }
      doc.editing = null; // clicked outside: leave edit mode
    }
    const sel = doc.selected;
    if (sel && !doc.isLocked(sel.id)) {
      const b = localBounds(sel);
      if (sel.kind !== 'artboard' && dist(this.rotateHandle(sel, b), p) < tol) return { kind: 'rotate', o: snap(sel) };
      const h = HANDLES.find((h) => dist(toWorld(sel, handlePoint(h, b)), p) < tol);
      if (h) {
        this.#targets = this.#snapTargets(new Set([sel.id]));
        return { kind: 'resize', o: snap(sel), h };
      }
    }

    // Inside a group, clicks pick among the group's children; otherwise top-level layers,
    // where an artboard is transparent (its direct children are picked) and is picked by its name.
    const first = [...doc.selectedIDs][0];
    const home = first ? parent(doc.layers, first) : null;
    const scope = home?.kind === 'group' ? home.children : [];
    const label = artboards(doc.layers).findLast((a) => !a.hidden && rectContains(labelRect(a, doc.zoom), p));
    const topLevel = () => {
      for (const l of doc.layers.toReversed()) {
        if (l.kind !== 'artboard') { if (hit(l, p, tol)) return l; continue; }
        if (!hit(l, p, tol)) continue;
        return l.children.findLast((c) => hit(c, p, tol)) ?? null;
      }
      return null;
    };
    if (label && count >= 3) { // triple-click on an artboard's name renames it
      doc.selection = label.id;
      doc.startRename(label.id, 'canvas');
      return { kind: 'ignore' };
    }
    let picked = label ?? scope.findLast((l) => hit(l, p, tol)) ?? topLevel();
    // a selected artboard is dragged from anywhere in its empty area
    if (!picked && sel?.kind === 'artboard' && rectContains(localBounds(sel), p)) picked = sel;

    if (shiftClick) { // ⇧-click toggles the layer in the selection
      if (picked) {
        const ids = new Set(doc.selectedIDs);
        if (ids.has(picked.id)) ids.delete(picked.id);
        else ids.add(picked.id);
        doc.selectedIDs = ids;
      }
      return { kind: 'ignore' };
    }
    if (picked && doc.selectedIDs.has(picked.id) && doc.selectedIDs.size > 1) {
      return this.#moving(doc.selectedLayers.filter((l) => !doc.isLocked(l.id)).map(snap));
    }
    doc.selection = picked?.id ?? null;
    if (!picked) return { kind: 'ignore' };
    if (double) {
      if (picked.kind === 'group') { // entering a group only changes the selection, fine even when locked
        doc.selection = picked.children.findLast((c) => hit(c, p, tol))?.id ?? picked.id;
      } else {
        doc.enterEdit();
      }
      return { kind: 'ignore' };
    }
    return doc.isLocked(picked.id) ? { kind: 'ignore' } : this.#moving([snap(picked)]); // locked: selectable, not movable
  }

  // MARK: Drag steps

  /** Free by default; ⇧ or the layer's ratio lock keeps proportions; ⌥ scales from the center.
   *  Returns where the handle ends up, document space. */
  #resize(o: Layer, h: Pt, d: Pt): Pt {
    const b = localBounds(o);
    const r = resizeGesture(b, h, localDelta(o, d), { proportional: this.doc.shift || o.lockRatio, fromCenter: this.doc.option });
    const a = r.anchor, t = scaleAround(a, r.sx, r.sy);
    this.#write(o, t, () => resized(o, r.sx, r.sy, a));
    return toWorld(o, apply(t, handlePoint(h, b))); // the anchor stays put, so the original frame still maps it
  }

  /** A group (thousands of paths when imported) is previewed through `t` and written on mouse-up;
   *  a single layer is rewritten right away, which is fast and exact.
   *  ponytail: a non-uniform group scale with rotated children is approximated by `scaled`, so the
   *  result can differ slightly from the preview on release; groups resize proportionally by default. */
  #write(o: Layer, t: Affine, result: () => Layer) {
    if (o.kind === 'artboard') { // the frame only: leave the (possibly huge) content untouched
      const live = this.doc.get(o.id);
      if (live) live.points = result().points;
      return;
    }
    if (o.kind !== 'group') return this.doc.set(o.id, result());
    this.doc.preview = { ids: new Set([o.id]), t };
    this.#commit = () => this.doc.set(o.id, result());
  }

  #editNode(o: Layer, t: Target, delta: Pt) {
    let n = o.subpaths[t.ref.s].nodes[t.ref.n];
    const d = localDelta(o, delta);
    const off = (q: Pt) => pt(q.x + d.x, q.y + d.y);
    n = t.handle === 'node' ? mapNode(n, off) : movedHandle(n, t.handle, off(n[t.handle]), this.doc.option); // ⌥ frees the handle
    const l = structuredClone(o);
    l.subpaths[t.ref.s].nodes[t.ref.n] = n;
    this.doc.set(o.id, keepingPlace(l, o));
  }

  #draw(tool: Tool, start: Pt, loc: Pt) {
    const doc = this.doc, l = doc.selected;
    if (!l) return;
    switch (tool) {
      case 'artboard':
      case 'rect':
      case 'ellipse':
      case 'text': {
        let p = this.#snapPoint(loc);
        if (doc.shift) { // constrain to square/circle
          const s = Math.max(Math.abs(p.x - start.x), Math.abs(p.y - start.y));
          p = pt(start.x + (p.x < start.x ? -s : s), start.y + (p.y < start.y ? -s : s));
        }
        // ⌥ draws from the center: the click point stays in the middle
        l.points = doc.option ? [pt(2 * start.x - p.x, 2 * start.y - p.y), p] : [start, p];
        break;
      }
      case 'pencil':
        l.subpaths[0].nodes.push(node(loc));
        break;
      case 'pen': { // dragging after click pulls out symmetric handles
        const nodes = l.subpaths[0].nodes, last = nodes.length - 1, p = nodes[last].p;
        nodes[last] = { p, cout: loc, cin: pt(2 * p.x - loc.x, 2 * p.y - loc.y) };
      }
    }
  }
}

import { L } from '$lib/i18n';
import { type Affine, type PointType, type Pt, type Rect, intersects, midX, midY, node, pt, union } from '$lib/model/geometry';
import { type RGBA, BLACK, CLEAR, eqColor } from '$lib/model/color';
import { type Kind, type Layer, asPath, bounds, flipped, isContainer, keepingPlace, localBounds, moved, newArtboard, newLayer, refit } from '$lib/model/layer';
import { DEFAULT_TEXT } from '$lib/model/text';
import { ancestors, find, inTreeOrder, nextName, parent, remove, siblings, update } from '$lib/model/layer-tree';
import { artboardAt, homeOf, inside } from './artboards';
import { type NodeRef, setPointType } from '$lib/model/point-editing';
import { decodeFile, encodeFile } from '$lib/model/codable';
import { type BooleanOp, combined } from '$lib/model/boolean';
import { outlined } from '$lib/model/outline';
import { importSVG } from '$lib/svg/import';
import type { Tool } from './tool';

/** The open document plus its editing state. Every change to `layers` the user can undo goes
 *  through `checkpoint()` first (snapshot undo). Layers are a tree (groups); address them by id.
 *  Layers read from here are reactive proxies: copy with `$state.snapshot` before editing a copy. */
export class Doc {
  layers = $state<Layer[]>([]);
  /** Document colors, saved with the file (the color picker's palette). */
  palette = $state<RGBA[]>([]);

  #selectedIDs = $state<Set<string>>(new Set()); // always replaced, never mutated (Sets aren't deeply reactive)
  get selectedIDs() { return this.#selectedIDs; }
  set selectedIDs(v: Set<string>) {
    this.#selectedIDs = v;
    if (this.editing && !(v.size === 1 && v.has(this.editing))) this.editing = null;
  }

  #tool = $state<Tool>('select');
  get tool() { return this.#tool; }
  set tool(t: Tool) {
    this.#tool = t;
    if (t !== 'pen') this.endPen();
    this.editing = null;
  }

  penID = $state<string | null>(null); // path being drawn with the pen
  #editing = $state<string | null>(null); // path in point-edit mode
  get editing() { return this.#editing; }
  set editing(id: string | null) {
    this.#editing = id;
    this.selectedNode = null;
  }
  selectedNode = $state<NodeRef | null>(null);
  /** Text layer whose content is being typed (the canvas shows a text field over it). */
  editingText = $state<string | null>(null);
  /** Name being edited in place (triple-click), and where: the layer list or an artboard's label on the canvas. */
  renaming = $state<{ id: string; where: 'list' | 'canvas' } | null>(null);
  shift = $state(false); // ⇧ held: keep proportions, snap angles, square/circle
  option = $state(false); // ⌥ held: resize/draw from the center

  // File state
  filePath = $state<string | null>(null);
  #saved = $state(JSON.stringify({ layers: [], palette: [] }));
  isDirty = $derived(this.#current() !== this.#saved);
  markSaved() { this.#saved = this.#current(); }

  // View state: view = doc * zoom + pan
  zoom = $state(1);
  pan = $state<Pt>(pt(0, 0)); // view-space offset of the document origin
  viewSize = { width: 0, height: 0 }; // set by the canvas once laid out
  hover = $state<Pt | null>(null); // mouse position over the canvas, view space
  /** Drag preview: these layers are drawn through `t` (document space: move, or a group's resize/rotate)
   *  and the geometry is written once, on mouse-up. Rewriting the tree on every mouse move re-renders
   *  and re-serializes everything. */
  preview = $state<{ ids: Set<string>; t: Affine } | null>(null);

  // Undo: snapshots of everything the user can change, as JSON (cheap to compare and copy).
  // ponytail: whole document per step; store diffs if documents get huge
  #undo: string[] = [];
  #redo: string[] = [];
  #coalescing: { key: string; at: number } | null = null;

  // MARK: Access

  get(id: string | null | undefined): Layer | null { return id ? find(this.layers, id) : null; }
  set(id: string | null | undefined, l: Layer | null) { if (id && l) update(this.layers, id, l); }

  /** The single selected layer id; null when nothing or several are selected. */
  get selection(): string | null { return this.selectedIDs.size === 1 ? [...this.selectedIDs][0] : null; }
  set selection(id: string | null) { this.selectedIDs = new Set(id ? [id] : []); }
  get selected() { return this.get(this.selection); }
  set selected(l: Layer | null) { this.set(this.selection, l); }
  get editingLayer() { return this.get(this.editing); }
  set editingLayer(l: Layer | null) { this.set(this.editing, l); }
  get penLayer() { return this.get(this.penID); }
  set penLayer(l: Layer | null) { this.set(this.penID, l); }
  get selectedLayers() { return [...this.selectedIDs].map((id) => this.get(id)).filter((l) => l !== null); }

  // MARK: Undo

  /** Serialized once per change and shared by undo and `isDirty` (tens of ms for thousands of paths). */
  #snapshot = $derived(JSON.stringify({ layers: this.layers, palette: this.palette }));
  #current() { return this.#snapshot; }

  checkpoint() {
    this.#coalescing = null;
    this.#undo.push(this.#current());
    this.#redo = [];
  }

  /** For continuous edits (slider drag, typing, color picking): while edits with the same `key` keep
   *  coming less than a second apart, they share the checkpoint taken by the first one. */
  checkpointCoalescing(key: string) {
    const now = Date.now(), c = this.#coalescing;
    this.#coalescing = { key, at: now };
    if (c && c.key === key && now - c.at < 1000) return;
    this.#undo.push(this.#current());
    this.#redo = [];
  }

  dropCheckpointIfUnchanged() {
    if (this.#undo[this.#undo.length - 1] !== this.#current()) return;
    this.#undo.pop();
    this.#coalescing = null; // the next edit needs its own checkpoint
  }

  get canUndo() { return this.#undo.length > 0; }
  get canRedo() { return this.#redo.length > 0; }

  undo() {
    const s = this.#undo.pop();
    if (s) { this.#redo.push(this.#current()); this.#restore(s); }
  }
  redo() {
    const s = this.#redo.pop();
    if (s) { this.#undo.push(this.#current()); this.#restore(s); }
  }

  /** One undoable change to a layer from the inspector; continuous edits of one layer merge. */
  styleEdit(id: string, to: Layer) { this.styleEdits([[id, to]]); }

  /** Same, for the layers of a multiple selection, changed together. */
  styleEdits(edits: [string, Layer][]) {
    if (!edits.length) return;
    this.checkpointCoalescing(edits.map(([id]) => id).join(' '));
    for (const [id, to] of edits) this.set(id, to);
    this.dropCheckpointIfUnchanged();
  }

  /** Edit/pen state and node indices refer to the old layers: drop them, keep valid selection. */
  #restore(snapshot: string) {
    this.editing = null;
    this.editingText = null;
    this.penID = null;
    this.#coalescing = null;
    ({ layers: this.layers, palette: this.palette } = JSON.parse(snapshot));
    this.selectedIDs = new Set([...this.selectedIDs].filter((id) => this.get(id)));
  }

  // MARK: Editing

  /** New layer at `p`: inside the artboard under it (artboards themselves are always top-level). */
  add(kind: Kind, p: Pt) {
    const base = { rect: L('Rectangle'), ellipse: L('Oval'), path: L('Path'), group: L('Group'), artboard: L('Artboard'), text: L('Text') }[kind];
    const host = kind === 'artboard' ? null : artboardAt(this.layers, p);
    const list = host ? host.children : this.layers;
    const name = kind === 'text' ? base : nextName(this.layers, base); // text: named after its content
    const l = kind === 'path'
      ? newLayer(name, kind, [], { subpaths: [{ nodes: [node(p)], closed: false }], fill: CLEAR, strokeWidth: 2 })
      : kind === 'artboard' ? newArtboard(name, [p, p])
      : kind === 'text' ? newLayer(name, kind, [p, p], { fill: BLACK, strokeWidth: 0, text: { ...DEFAULT_TEXT } })
      : newLayer(name, kind, [p, p]);
    list.push(l);
    this.selection = l.id;
  }

  /** Artboard tool preset: a new artboard of that size, right of everything else. */
  addArtboard(name: string, width: number, height: number) {
    const b = this.layers.reduce<Rect | null>((r, l) => union(r, bounds(l)), null);
    const x = b ? b.x + b.width + 80 : 0, y = b ? b.y : 0;
    this.checkpoint();
    const a = newArtboard(name, [pt(x, y), pt(x + width, y + height)]);
    this.layers.push(a);
    this.selection = a.id;
    this.tool = 'select';
    this.zoomToFit();
  }

  /** A newly drawn artboard takes in the top-level layers that lie entirely within it. */
  adopt(artboardID: string) {
    const a = this.get(artboardID);
    if (!a) return;
    const frame = localBounds(a);
    const taken = this.layers.filter((l) => l.kind !== 'artboard' && inside(bounds(l), frame));
    if (!taken.length) return;
    remove(this.layers, new Set(taken.map((l) => l.id)));
    a.children.push(...taken);
  }

  /** After a move: layers dropped on an artboard go into it, layers dragged off one come out.
   *  Only top-level layers and direct artboard children move between homes (a group keeps its children). */
  rehome(ids: Iterable<string>) {
    for (const id of ids) {
      const l = this.get(id), from = parent(this.layers, id);
      if (!l || l.kind === 'artboard' || (from && from.kind !== 'artboard')) continue;
      const to = homeOf(this.layers, l);
      if (to?.id === from?.id) continue;
      const moving = $state.snapshot(l) as Layer;
      remove(this.layers, new Set([id]));
      (to ? to.children : this.layers).push(moving);
    }
  }

  endPen() {
    const l = this.penLayer;
    if (l && l.subpaths[0].nodes.length < 2) remove(this.layers, new Set([l.id]));
    this.penID = null;
  }

  enterEdit() {
    const l = this.selected;
    if (!l || isContainer(l) || this.isLocked(l.id) || this.isHidden(l.id)) return;
    if (l.kind === 'text') return this.editText(l.id);
    if (l.kind !== 'path') {
      this.checkpoint();
      this.selected = asPath(l);
    }
    this.editing = this.selection;
  }

  // MARK: Text

  /** Starts typing into a text layer. `fresh`: just drawn, so the drawing gesture's checkpoint covers the edit. */
  editText(id: string, fresh = false) {
    if (!fresh) this.checkpoint();
    this.selection = id;
    this.editingText = id;
  }

  /** Live content change while typing; the box refits. A layer still named after its content follows it. */
  setText(content: string) {
    const l = this.get(this.editingText);
    if (!l?.text) return;
    const o = $state.snapshot(l) as Layer, t = o.text!;
    const name = o.name === textName(t.content) ? textName(content) : o.name;
    this.set(o.id, refit({ ...o, name, text: { ...t, content } }, o));
  }

  /** Ends typing (Esc, click elsewhere): one undo step. Text left empty is deleted (undo brings
   *  back what it was; a fresh one leaves no step at all). */
  endTextEdit() {
    const l = this.get(this.editingText);
    this.editingText = null;
    if (l && !l.text?.content.trim()) {
      remove(this.layers, new Set([l.id]));
      this.selectedIDs = new Set([...this.selectedIDs].filter((id) => id !== l.id));
    }
    this.dropCheckpointIfUnchanged();
  }

  /** Deletes the selected node in point-edit mode, otherwise the selected layers. */
  deleteSelected() {
    const e = this.editingLayer;
    if (e) {
      const r = this.selectedNode;
      if (!r || !e.subpaths[r.s]?.nodes[r.n]) return;
      this.checkpoint();
      const before = $state.snapshot(e), l = $state.snapshot(e);
      l.subpaths[r.s].nodes.splice(r.n, 1);
      if (l.subpaths[r.s].nodes.length < 2) l.subpaths.splice(r.s, 1);
      this.selectedNode = null;
      if (l.subpaths.length) return void (this.editingLayer = keepingPlace(l, before));
    }
    const deletable = new Set([...this.selectedIDs].filter((id) => !this.isLocked(id))); // locked layers (or in a locked group) stay
    if (!deletable.size) return;
    if (!this.editing) this.checkpoint();
    remove(this.layers, deletable);
    this.selectedIDs = new Set([...this.selectedIDs].filter((id) => !deletable.has(id)));
  }

  // MARK: Visibility & locking

  /** ⇧⌘H / eye button: hides all of `ids` unless they're all hidden already (then shows them). */
  toggleHidden(ids: Iterable<string>) { this.#toggle('hidden', ids); }
  /** ⇧⌘L / padlock button. */
  toggleLocked(ids: Iterable<string>) { this.#toggle('locked', ids); }

  /** Hidden or locked through the layer itself or any enclosing group (children inherit;
   *  their own flag is kept, so showing/unlocking the group restores them as they were). */
  isHidden(id: string) { return this.#inherited('hidden', id); }
  isLocked(id: string) { return this.#inherited('locked', id); }

  #inherited(flag: 'hidden' | 'locked', id: string) {
    return (this.get(id)?.[flag] ?? false) || ancestors(this.layers, id).some((l) => l[flag]);
  }

  /** Inspector "Unlock": the layer and whichever enclosing groups lock it. */
  unlock(id: string) {
    const self = this.get(id);
    const locked = [...(self ? [self] : []), ...ancestors(this.layers, id)].filter((l) => l.locked);
    if (!locked.length) return;
    this.checkpoint();
    for (const l of locked) l.locked = false;
  }

  #toggle(flag: 'hidden' | 'locked', ids: Iterable<string>) {
    const targets = [...ids].map((id) => this.get(id)).filter((l) => l !== null);
    if (!targets.length) return;
    const value = !targets.every((l) => l[flag]);
    this.checkpoint();
    for (const l of targets) l[flag] = value;
    if (value) this.editing = null; // hidden or locked layers can't stay in point-edit mode
  }

  // MARK: Renaming

  startRename(id: string, where: 'list' | 'canvas') {
    if (!this.isLocked(id)) this.renaming = { id, where }; // locked: read-only, name included
  }

  /** One undoable rename; empty names are refused. */
  rename(id: string, name: string) {
    this.renaming = null;
    const l = this.get(id);
    if (!l || !name.trim() || this.isLocked(id)) return;
    this.checkpoint();
    l.name = name.trim();
    this.dropCheckpointIfUnchanged();
  }

  // MARK: Reordering (layer list drag and drop)

  /** The layers `ids` would move, in paint order, if they can go into `parentID` (null = top level). */
  #movable(ids: Iterable<string>, parentID: string | null): Layer[] | null {
    const dest = parentID ? this.get(parentID) : null;
    if (parentID && (!dest || !isContainer(dest) || this.isLocked(parentID))) return null;
    const moving = inTreeOrder(this.layers, new Set(ids));
    if (!moving.length || moving.some((l) => this.isLocked(l.id))) return null;
    if (dest && moving.some((l) => l.kind === 'artboard')) return null; // artboards stay top-level
    if (dest && moving.some((l) => l.id === dest.id || find(l.children, dest.id))) return null; // not into itself
    return moving;
  }

  canMoveLayers(ids: Iterable<string>, parentID: string | null) { return this.#movable(ids, parentID) !== null; }

  /** Moves layers into `parentID` (a group or artboard; null = top level) at `index` of its current
   *  children (bottom to top), keeping their paint order. Geometry stays put, except that layers landing
   *  in an artboard entirely outside its frame (so clipped away, invisible) are brought to its center,
   *  together. Groups left empty disappear, as when deleting. */
  moveLayers(ids: Iterable<string>, parentID: string | null, index: number) {
    const moving = this.#movable(ids, parentID);
    if (!moving) return;
    const movedIDs = new Set(moving.map((l) => l.id));
    const target = () => (parentID ? this.get(parentID)!.children : this.layers);
    const shift = target().slice(0, index).filter((l) => movedIDs.has(l.id)).length; // indices close up once they leave
    this.checkpoint();
    const dest = parentID ? this.get(parentID) : null;
    const copies = landing(moving.map((l) => $state.snapshot(l) as Layer), dest);
    for (const id of movedIDs) {
      const s = siblings(this.layers, id)!;
      s.splice(s.findIndex((l) => l.id === id), 1);
    }
    target().splice(index - shift, 0, ...copies);
    remove(this.layers, new Set()); // prune groups left empty (after inserting: the target may have been emptied)
    this.selectedIDs = movedIDs;
    this.dropCheckpointIfUnchanged();
  }

  // MARK: Clipboard (the app layer moves the data; see app/clipboard.ts)

  /** Copies of the selected layers, in paint order (a selected group brings its children). */
  copySelection(): Layer[] { return inTreeOrder(this.layers, this.selectedIDs).map((l) => $state.snapshot(l) as Layer); }

  /** ⌘V: into the selected group or artboard, else just above the topmost selected layer,
   *  else at the top level (then into the artboard under it). Same position as the originals; layers that
   *  would land outside their artboard's frame go to its center. Artboards are pasted right of everything.
   *  `at` (a file dropped on the canvas): centered on that document point, in the artboard under it.
   *  The pasted layers get new ids and become the selection. */
  paste(clip: Layer[], at?: Pt) {
    if (!clip.length) return;
    let copies = clip.map(withNewIDs);
    const c = copies.reduce<Rect | null>((r, l) => union(r, bounds(l)), null)!;
    if (at) copies = copies.map((l) => moved(l, pt(at.x - midX(c), at.y - midY(c))));
    this.checkpoint();
    if (copies.some((l) => l.kind === 'artboard')) { // artboards stay top-level, side by side
      const all = this.layers.reduce<Rect | null>((r, l) => union(r, bounds(l)), null);
      if (all && !at) copies = copies.map((l) => moved(l, pt(all.x + all.width + 80 - c.x, 0)));
      this.layers.push(...copies);
    } else {
      const sel = at ? null : this.selected, top = at ? undefined : inTreeOrder(this.layers, this.selectedIDs).at(-1);
      const host = top ? parent(this.layers, top.id) : null;
      let dest: Layer | null = null, list = this.layers, index = list.length;
      if (sel && isContainer(sel) && !this.isLocked(sel.id)) [dest, list, index] = [sel, sel.children, sel.children.length];
      else if (top && !(host && this.isLocked(host.id))) {
        dest = host;
        list = siblings(this.layers, top.id)!;
        index = list.findIndex((l) => l.id === top.id) + 1;
      }
      copies = landing(copies, dest);
      list.splice(index, 0, ...copies);
      if (!dest) this.rehome(copies.map((l) => l.id));
    }
    this.selectedIDs = new Set(copies.map((l) => l.id));
  }

  /** ⌘D: pastes a copy of the selection right above it, without touching the clipboard. */
  duplicate() { this.paste(this.copySelection()); }

  // MARK: Arrange (paint order among siblings)

  /** Bring Forward / Send Backward (one step past the next unselected sibling), Bring to Front / Send to Back.
   *  Each selected layer moves within its own parent; selected neighbours move together. Locked layers stay. */
  arrange(to: 'forward' | 'backward' | 'front' | 'back') {
    const ids = new Set([...this.selectedIDs].filter((id) => !this.isLocked(id)));
    const lists = new Set([...ids].map((id) => siblings(this.layers, id)).filter((s) => s !== null));
    if (!lists.size) return;
    this.checkpoint();
    for (const s of lists) {
      const order = $state.snapshot(s) as Layer[], sel = (i: number) => ids.has(order[i].id);
      const swap = (i: number, j: number) => ([order[i], order[j]] = [order[j], order[i]]);
      if (to === 'forward') for (let i = order.length - 2; i >= 0; i--) { if (sel(i) && !sel(i + 1)) swap(i, i + 1); }
      if (to === 'backward') for (let i = 1; i < order.length; i++) { if (sel(i) && !sel(i - 1)) swap(i, i - 1); }
      if (to === 'front') order.sort((a, b) => +ids.has(a.id) - +ids.has(b.id)); // stable: keeps relative order
      if (to === 'back') order.sort((a, b) => +ids.has(b.id) - +ids.has(a.id));
      s.splice(0, s.length, ...order);
    }
    this.dropCheckpointIfUnchanged();
  }

  /** Point Type of the selected node, in point-edit mode. */
  setPointType(type: PointType) {
    const l = this.editingLayer, r = this.selectedNode;
    if (!l || !r) return;
    this.checkpoint();
    const before = $state.snapshot(l) as Layer, e = structuredClone(before);
    setPointType(e, r, type);
    this.editingLayer = keepingPlace(e, before); // new handles can move the bounds, hence the pivot
    this.dropCheckpointIfUnchanged();
  }

  /** Flip Horizontal / Vertical: mirrors the selection across its center line. Locked layers and artboards stay. */
  flip(horizontal: boolean) {
    const ls = this.selectedLayers.filter((l) => !this.isLocked(l.id) && l.kind !== 'artboard');
    const b = ls.map(bounds).reduce<Rect | null>(union, null);
    if (!b) return;
    this.checkpoint();
    const axis = horizontal ? midX(b) : midY(b);
    for (const l of ls) this.set(l.id, flipped($state.snapshot(l) as Layer, horizontal, axis));
    this.editing = null;
  }

  /** Arrow keys: moves the selection by `d` (1 px, 10 with ⇧); presses in a row are one undo step. */
  nudge(d: Pt) {
    const ls = this.selectedLayers.filter((l) => !this.isLocked(l.id));
    if (!ls.length) return;
    this.checkpointCoalescing('nudge');
    for (const l of ls) this.set(l.id, moved($state.snapshot(l) as Layer, d));
    this.rehome(ls.map((l) => l.id));
  }

  // MARK: Groups

  /** Selected layers that share one parent, in paint order; null if they don't. */
  get #groupableSiblings(): Layer[] | null {
    const ids = this.selectedIDs;
    if (ids.size < 2) return null;
    const s = siblings(this.layers, [...ids][0])?.filter((l) => ids.has(l.id));
    if (!s || s.length !== ids.size || s.some((l) => this.isLocked(l.id) || l.kind === 'artboard')) return null; // artboards stay top-level
    return s;
  }
  get canGroup() { return this.#groupableSiblings !== null; }
  get canUngroup() { const g = this.selected; return !!g && g.kind === 'group' && !this.isLocked(g.id); }

  /** ⌘G: wraps the selected sibling layers in a group placed where the topmost one was. */
  group() {
    const kids = this.#groupableSiblings;
    if (!kids) return;
    this.checkpoint();
    const name = nextName(this.layers, L('Group'));
    const g = newLayer(name, 'group', [], { children: $state.snapshot(kids), lockRatio: true }); // distorting a group is almost always an accident
    const ids = this.selectedIDs, s = siblings(this.layers, kids[0].id)!;
    const top = s.findLastIndex((l) => ids.has(l.id)) - (kids.length - 1);
    remove(s, ids);
    s.splice(top, 0, g);
    this.selection = g.id;
  }

  /** Combine (⌥⌘U/S/I/X): replaces the selected sibling layers by one path, their filled areas combined
   *  bottom to top, placed where the topmost one was. Nothing happens if the result is empty. */
  combine(op: BooleanOp) {
    const kids = this.#groupableSiblings;
    if (!kids) return;
    const result = combined(kids.map((l) => $state.snapshot(l) as Layer), op);
    if (!result) return;
    this.checkpoint();
    const ids = this.selectedIDs, s = siblings(this.layers, kids[0].id)!;
    const top = s.findLastIndex((l) => ids.has(l.id)) - (kids.length - 1);
    remove(s, ids);
    s.splice(top, 0, result);
    this.selection = result.id;
  }

  /** ⌥⌘O Convert to Outlines: each selected layer's border becomes its filled shape (same layer, same place),
   *  text becomes its glyphs. Layers without a visible border, groups and locked layers are left as they are. */
  outline() {
    const done = [...this.selectedIDs].filter((id) => !this.isLocked(id))
      .map((id) => [id, this.get(id) && outlined($state.snapshot(this.get(id)!) as Layer)] as const)
      .filter(([, l]) => l);
    if (!done.length) return;
    this.checkpoint();
    for (const [id, l] of done) this.set(id, l);
    this.editing = null;
  }

  /** ⇧⌘G: replaces the selected group by its children. */
  ungroup() {
    const g = this.selected;
    if (!g || g.kind !== 'group' || this.isLocked(g.id)) return;
    this.checkpoint();
    const kids = $state.snapshot(g.children), s = siblings(this.layers, g.id)!;
    s.splice(s.findIndex((l) => l.id === g.id), 1, ...kids);
    this.selectedIDs = new Set(kids.map((l) => l.id));
  }

  // MARK: Loading

  /** Replaces the document with a saved `.json` or an imported `.svg`. Undo history starts over. */
  /** `name`: for an SVG, the artboard built from its viewBox (the file name, usually). */
  load(text: string, svg: boolean, name?: string) {
    if (svg) return this.replace(importSVG(text, name));
    const f = decodeFile(text);
    this.replace(f.layers, f.palette);
  }

  replace(layers: Layer[], palette: RGBA[] = []) {
    this.tool = 'select';
    this.layers = layers;
    this.palette = palette;
    this.selectedIDs = new Set();
    this.#undo = [];
    this.#redo = [];
    this.#coalescing = null;
    this.zoomToFit();
  }

  json() { return encodeFile({ layers: this.layers, palette: this.palette }); }

  /** Adds a color to the document palette (no duplicates). */
  addToPalette(c: RGBA) {
    if (this.palette.some((p) => eqColor(p, c))) return;
    this.checkpoint();
    this.palette.push(c);
  }

  removeFromPalette(i: number) {
    if (i < 0 || i >= this.palette.length) return;
    this.checkpoint();
    this.palette.splice(i, 1);
  }

  // MARK: Zoom

  toDoc(p: Pt): Pt { return pt((p.x - this.pan.x) / this.zoom, (p.y - this.pan.y) / this.zoom); }

  /** Zooms keeping the document point under `q` (view space, default center) fixed. */
  zoomBy(f: number, q: Pt = pt(this.viewSize.width / 2, this.viewSize.height / 2)) {
    const d = this.toDoc(q);
    this.zoom = Math.min(Math.max(this.zoom * f, 0.05), 64);
    this.pan = pt(q.x - d.x * this.zoom, q.y - d.y * this.zoom);
  }

  zoomToActualSize() { this.zoomBy(1 / this.zoom); }

  zoomToFit() {
    const { width: w, height: h } = this.viewSize;
    if (!w || !h) return; // canvas not laid out yet; it fits on first layout
    const b = this.layers.reduce<Rect | null>((r, l) => union(r, bounds(l)), null);
    if (!b || b.width + b.height <= 0) {
      this.zoom = 1;
      this.pan = pt(0, 0);
      return;
    }
    this.zoom = Math.min(Math.max(Math.min(w / (b.width + 80), h / (b.height + 80)), 0.05), 64);
    this.pan = pt(w / 2 - midX(b) * this.zoom, h / 2 - midY(b) * this.zoom);
  }
}

/** A text layer's automatic name: its first line. */
const textName = (content: string) => content.trim().split('\n')[0].slice(0, 40) || L('Text');

/** A copy with fresh ids, children included. */
const withNewIDs = (l: Layer): Layer => ({ ...l, id: crypto.randomUUID(), children: l.children.map(withNewIDs) });

/** Layers arriving in an artboard entirely outside its frame (so clipped away, invisible) are brought
 *  to its center, together. Anywhere else they stay put. */
function landing(layers: Layer[], dest: Layer | null): Layer[] {
  if (dest?.kind !== 'artboard') return layers;
  const frame = localBounds(dest), lost = new Set(layers.filter((l) => !intersects(bounds(l), frame)).map((l) => l.id));
  const u = layers.filter((l) => lost.has(l.id)).reduce<Rect | null>((r, l) => union(r, bounds(l)), null);
  if (!u) return layers;
  const d = pt(midX(frame) - midX(u), midY(frame) - midY(u));
  return layers.map((l) => (lost.has(l.id) ? moved(l, d) : l));
}

/** `path` moves to the front; at most 10 entries. */
export const pushRecent = (path: string, list: string[]) => [path, ...list.filter((p) => p !== path)].slice(0, 10);

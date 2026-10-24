# Plume

Plume: vector editor. Tauri 2 (Rust shell) + SvelteKit SPA (Svelte 5, TypeScript), rendered as SVG.
All editor logic is TypeScript so the same code runs in a browser; Rust only reads/writes files.

## Commands

- Run (desktop): `npm run tauri dev`
- Run (browser, no file panels): `npm run dev` → http://localhost:1420 (`/kit` = UI primitives gallery, dev only)
- Test: `npm test` (vitest; `// @vitest-environment jsdom` for files that need `DOMParser`; `tests/setup.ts` lets paper.js load without a canvas)
- Types: `npm run check` · Style rules: `npm run lint` (stylelint)
- Build the app: `npm run tauri build`
- Examples (File › Examples; the web version opens the first at launch): SVGs in `static/exemples/`, listed in
  `EXAMPLES` (app/files); `svg.test.ts` checks each one imports and is listed
- Presentation site: `npm run site` → `_site/` (site/ pages, docs/ and CHANGELOG.md as HTML, the web editor under app/,
  built with `BASE_PATH=/plume/app`); `.github/workflows/pages.yml` publishes it to GitHub Pages from main

## Layout

```
src-tauri/src/lib.rs   Rust commands: read_text, read_bytes, write_text / write_bytes (atomic), launch_file, system_fonts (fontdb); dialog plugin
src/lib/
  model/      Layer (+ transforms, border), geometry (Pt, Affine, Bézier bounds/hit), path-data,
              point-editing, curve-fit, layer-tree helpers, color, effects, codable (file format),
              boolean (union/subtract/… via paper.js), outline (border → filled shape),
              text (layout, measuring, glyph outlines via fontkit; fonts bundled in static/fonts or installed)
  document/   Doc (state, undo, editing ops, zoom, load/save data), Tool
  svg/        import (DOMParser → element tree → layers; gradients, masks as clips, filters), export, syntax
  app/        files (panels/read/write, recents, save prompt, export), render (PNG/JPG/PDF from SVG),
              commands (menu bar + browser shortcuts)
  ui/         Inspector, LayerList, tokens.css; kit/ primitives; canvas/ Canvas | LayerView | gestures
  i18n/       L() + fr.json
src/routes/   +page (window layout, toolbar, global keys), kit/ (primitives gallery)
site/         presentation page, doc page template, style, images (scripts/site.js assembles _site/)
tests/        one file per area (layer, doc, svg, color, curve-fit, localization)
```

Dependencies point downwards: ui/app → document → model/svg. model and svg never import UI, Svelte or Tauri.
Logic that can be tested without a window belongs in model/document, not in components.

## Conventions

- **Coordinates.** Three spaces: view (canvas pixels), document (`doc.toDoc`), layer-local.
  A layer stores unrotated geometry; `rotation` applies around the center of `localBounds`.
  Convert with `toWorld` / `toLocal` / `localDelta`.
- **Layer tree.** Groups hold `children` in document space and have no transform of their own;
  group move/rotate/resize go through `moved` / `rotated` / `resized` / `scaled`, which recurse.
  Never index `doc.layers[i]`: use `doc.get(id)` / `doc.set(id, l)`, `doc.selected`, `doc.editingLayer`,
  and the helpers in `layer-tree.ts`. `selectedIDs` is the selection (always assign a new `Set`);
  `selection` is the single one.
- **Artboards** (`kind: 'artboard'`, `document/artboards.ts`): top-level only, never grouped or rotated.
  `points` = frame, `fill` = background, children in document space drawn clipped to the frame; resizing
  changes the frame only. A layer lives at the top level or directly in an artboard: `doc.add` puts a new
  layer in the artboard under the click, a new artboard `adopt`s what lies inside it, and a move ends with
  `doc.rehome` (the artboard under the layer's center). On the canvas an artboard is transparent to clicks
  (its children are picked) and is selected by its name (`labelRect`). Opening an SVG builds an artboard
  from its viewBox (else width/height, else the content bounds); `<g data-artboard>` (our export) comes back as artboards.
- **Reactive proxies.** Layers read from `doc` are Svelte `$state` proxies. Mutating one in place is a live
  edit; to edit a copy, take `$state.snapshot(l)` (never `structuredClone` a proxy, it throws). Model
  functions (`mapped`, `moved`, …) return new objects; point-editing ops mutate the layer passed in.
- **Hidden** layers are never hit on the canvas (`hit`) but stay selectable from the list.
  **Locked** layers are selectable everywhere but inert: no handles, no move, no point edit, no
  delete/group/ungroup, read-only inspector. Only hide and unlock apply. Toggle via `toggleHidden/Locked`.
  Both are inherited from enclosing groups: check `doc.isHidden(id)` / `doc.isLocked(id)`, not the layer's own flag.
- **Edits that move the rotation pivot** (node edits, resize, delete node) must end with
  `keepingPlace(edited, original)` so untouched geometry stays put on screen.
- **New `Layer` property** → add its default in `newLayer` (the tolerant decoder in `codable.ts` fills
  missing keys from it, so old documents keep opening), and to SVG import/export when SVG has an equivalent.
  A new `[number, number]` field that is not a point must be named in `codable.ts` (points are `[x, y]` on disk).
- **Paint & effects.** `fillGradient`/`strokeGradient` (gradient space → `transform` → layer local),
  `clip` (subpaths in the geometry's space), `opacity`, `blur`, `shadow`. They must follow `mapped`
  (done there) and group-level transforms (`mappingClip`). Rendering order in `LayerView`: clip →
  opacity/filter on the whole layer `<g>` → content. Inside/outside borders: double width, clipped/masked.
- **Undo** is snapshot-based (layers + palette, as JSON): `doc.checkpoint()` before a change,
  `dropCheckpointIfUnchanged()` after a gesture that may not have changed anything. Inspector edits go
  through `doc.styleEdit(id, to)`, which coalesces continuous edits of one layer into one step.
- **Overlays** (selection, handles, nodes) are drawn in document space with sizes divided by
  `doc.zoom` so they keep a constant screen size.
- **Modifiers**: free by default, ⇧ constrains (proportions, 15° angle steps,
  square/circle), ⌥ works from the center (resize, draw). `lockRatio` makes a layer resize
  proportionally without ⇧ (on by default for groups and imported SVG). Bézier handles: mirrored,
  ⌥ = independent. Tool keys (and Return/Esc) are handled on the canvas, not as menu shortcuts, so
  they never fire while typing in a text field; tool letters also work from the rest of the window
  (`toolForKey`, +page), still never in a text field. Return commits a field, Escape cancels it.
  A click without drag on a layer of a multiple selection narrows the selection to it (gestures `narrow`).
- **UI text** goes through `L('English text')` (`$lib/i18n`), never a bare string in markup. Add the
  French translation to `src/lib/i18n/fr.json`; `localization.test.ts` fails otherwise.
- **UI consistency.** Colors and sizes live only in `ui/tokens.css` (`light-dark()` per token).
  Views (Inspector, LayerList, …) assemble `ui/kit/` primitives and use tokens, no px or color literals;
  `npm run lint` enforces it. A new control goes in `kit/` and on the `/kit` page, in all its states.
  Native HTML first (`popover`, `<input>`); add a headless library (Bits UI) only for what HTML can't do.
- **Commands.** Menu items and their shortcuts are defined once in `app/commands.ts`: native menu under
  Tauri, keydown matching in a browser.
- **Files.** `doc.filePath` is the current document; `isDirty` compares layers and palette with the
  last save. On disk: `{ layers, palette }`; a bare `[Layer]` array
  (older files) still loads. Anything that replaces the document calls `files.confirmDiscardChanges()` first.
- **Colors** in views use `ColorField` (kit): it offers the document palette; undo comes from `styleEdit`.
- Deliberate shortcuts are marked `// ponytail:` with their limit and upgrade path.

## Release

1. Note changes under `## Non publié` in CHANGELOG.md as you go.
2. `npm version patch|minor|major`: runs tests, type check and lint, bumps package.json (tauri.conf.json reads it),
   Cargo.toml and Cargo.lock, dates the changelog section, commits `Plume x.y.z`, tags `vx.y.z` and pushes.
3. The tag triggers `.github/workflows/release.yml`: macOS and Linux bundles, release notes from the changelog.

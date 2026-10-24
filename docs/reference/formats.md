# Formats de fichier

## Document Plume (`.json`)

Le seul format qui conserve tout : calques, groupes, plans de travail, styles, couleurs du document.

```json
{ "layers": [ … ], "palette": [ { "r": 1, "g": 0.72, "b": 0, "a": 1 } ] }
```

- Les points sont écrits `[x, y]`.
- Les nombres sont arrondis au millième (au millionième pour les angles et les dégradés).
- Un simple tableau de calques (anciens fichiers) s'ouvre aussi.
- Un calque enregistré par une version plus ancienne reçoit les valeurs par défaut des réglages apparus depuis.
- L'enregistrement est atomique : un échec ne laisse jamais un fichier à moitié écrit.

## Import SVG

À l'ouverture (⌘O), au collage (⌘V) et au glisser-déposer.

| Pris en charge | Détail |
|---|---|
| Formes | `path`, `rect`, `circle`, `ellipse`, `line`, `polyline`, `polygon`, converties en tracés |
| Structure | `g` → groupe ; `use` et `symbol` ; `a`, `switch` parcourus |
| Transformations | appliquées aux points |
| Peinture | couleurs, opacités, `fill-rule`, bordure (épaisseur, pointillés, extrémités, angles) |
| Dégradés | `linearGradient`, `radialGradient` |
| Découpe | `clipPath`, et `mask` traité comme une découpe |
| Filtres | flou gaussien, ombre portée (`feDropShadow`, ou `feOffset` + `feGaussianBlur`) |
| Texte | un calque par `<text>`, une ligne par `<tspan>` positionné ; un style par texte |
| Masqué | `display="none"`, `visibility="hidden"` |
| Cadre | `viewBox`, sinon `width`/`height`, sinon le contenu → plan de travail |
| Plans de travail | `<g data-artboard>` (exports de Plume) reviennent comme plans de travail |

Les coins arrondis des `rect` (`rx`, `ry`) sont conservés ; le rectangle devient un tracé.

Non pris en charge : images bitmap, motifs (`pattern`), feuilles de style CSS (`<style>`), texte sur un chemin,
styles différents dans un même texte, autres filtres, masques de luminance, drapeaux d'arc compactés (`a1 1 0 011 1`).

## Exports

| Format | Contenu | Notes |
|---|---|---|
| PDF | vectoriel, 1 px = 1 pt, texte sélectionnable | polices intégrées sauf `.otf` et polices non chargées (Times) ; ombre et flou ignorés |
| SVG | vectoriel ; plans de travail en `<g data-artboard>` ; rectangles arrondis en `<rect rx>`, ou en `<path>` si leurs coins diffèrent | polices non intégrées |
| PNG | rendu du canevas, 1×, 2×, 3× | transparence conservée ; polices intégrées |
| JPG | idem, qualité 90 % | fond blanc |

## Préréglages de plans de travail

| Groupe | Nom | Taille |
|---|---|---|
| Écran | HD | 1280 × 720 |
| Écran | Desktop | 1440 × 1024 |
| Écran | Full HD | 1920 × 1080 |
| Écran | QHD | 2560 × 1440 |
| Écran | 4K UHD | 3840 × 2160 |
| Écran | Carré | 1080 × 1080 |
| Papier | A5 | 420 × 595 |
| Papier | A4 | 595 × 842 |
| Papier | A3 | 842 × 1191 |
| Papier | Letter | 612 × 792 |
| Papier | Legal | 612 × 1008 |

Les formats papier sont en points : 1 pt = 1 px dans Plume, comme dans l'export PDF.

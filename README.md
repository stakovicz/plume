# Plume

Éditeur vectoriel : application de bureau macOS, Windows et Linux (Tauri 2) dont toute la logique est en
TypeScript (SvelteKit, Svelte 5) et le rendu en SVG. La même interface tourne aussi dans un navigateur.

## Fonctionnalités

- **Dessin** : rectangle (R, coins arrondis), ovale (O), plume (V), crayon (P, lissé en courbes de Bézier), texte (T), plan de travail (A).
  ⇧ contraint (carré, cercle, angles par 15°), ⌥ dessine depuis le centre.
- **Édition de points** : double-clic ou Retour sur un tracé ; poignées miroir, ⌥ pour les rendre indépendantes.
- **Calques** : groupes, plans de travail, masquer / verrouiller, renommer, glisser-déposer dans la liste,
  ordre d'empilement (avancer, reculer, premier plan, arrière-plan).
- **Combiner** des formes : union, soustraction, intersection, différence (courbes conservées).
- **Vectoriser le contour** : une bordure devient une forme pleine.
- **Retourner** horizontalement ou verticalement (menu Outils).
- **Repères d'alignement** : en déplaçant, redimensionnant ou dessinant, les bords et centres s'aimantent à ceux
  des autres calques, et une ligne montre l'alignement.
- **Style** : remplissage et bordure (couleur ou dégradé linéaire / radial), bordure centrée / intérieure /
  extérieure, pointillés, extrémités et angles, opacité, flou, ombre, palette de couleurs du document.
- **Presse-papier** : copier / couper / coller / dupliquer des calques, groupes et plans de travail ;
  coller un SVG copié depuis une autre application.
- **Fichiers** : document `.plm`, ouverture de SVG (avec dégradés, masques, filtres), export PDF (vectoriel),
  SVG, PNG et JPG (1×, 2×, 3×) du document, des plans de travail ou de la sélection.
- **Interface** en anglais et en français.

## Installation

- **winget** (Windows) : `winget install Stakovicz.Plume`
- **Scoop** (Windows) : `scoop bucket add stakovicz https://github.com/stakovicz/scoop-bucket`, puis `scoop install stakovicz/plume-editor`
- **Homebrew** (macOS, Linux x86_64) : `brew install --cask stakovicz/tap/plume-editor`
- **Snap** : `sudo snap install plume-editor`
- **APT** (Debian, Ubuntu) et **DNF** (Fedora) : dépôts signés, voir [Installer Plume](docs/guides/installer.md)
- Sinon : `.dmg`, `.deb`, `.rpm` ou `.AppImage` sur la [page des versions](https://github.com/stakovicz/plume/releases).

## Documentation

Site : **https://stakovicz.github.io/plume/** (présentation, téléchargements, version web à essayer).

La [documentation d'utilisation](docs/README.md) est organisée en tutoriels, guides pratiques, référence
et explications. Pour commencer : [Votre première illustration](docs/tutoriels/01-premiere-illustration.md).
Tous les raccourcis : [docs/reference/raccourcis.md](docs/reference/raccourcis.md).

## Développement

Prérequis : Node.js 22+, Rust et les [prérequis Tauri 2](https://v2.tauri.app/start/prerequisites/).

```bash
npm install
```

```bash
npm run tauri dev
```

Sans Rust, l'éditeur tourne dans un navigateur (sans panneaux de fichiers natifs : ouverture par sélecteur,
enregistrement et export par téléchargement) :

```bash
npm run dev
```

Puis http://localhost:1420 ; `/kit` montre la galerie des composants d'interface.

| Commande | Rôle |
|---|---|
| `npm test` | tests (vitest) |
| `npm run check` | vérification des types |
| `npm run lint` | règles de style (couleurs et tailles uniquement via `src/lib/ui/tokens.css`) |
| `npm run tauri build` | application empaquetée |

L'architecture et les conventions du code sont décrites dans [AGENTS.md](AGENTS.md).

## Format de fichier

Un document `.plm` est une archive zip contenant `document.json` : `{ "layers": [...], "palette": [...] }`,
les points écrits `[x, y]`.

## Licence

MIT

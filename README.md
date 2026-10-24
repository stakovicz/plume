# Plume

Éditeur vectoriel : application de bureau macOS (Tauri 2) dont toute la logique est en
TypeScript (SvelteKit, Svelte 5) et le rendu en SVG. La même interface tourne aussi dans un navigateur.

## Fonctionnalités

- **Dessin** : rectangle (R), ovale (O), plume (V), crayon (P, lissé en courbes de Bézier), texte (T), plan de travail (A).
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
- **Fichiers** : document `.json`, ouverture de SVG (avec dégradés, masques, filtres), export PDF (vectoriel),
  SVG, PNG et JPG (1×, 2×, 3×) du document, des plans de travail ou de la sélection.
- **Interface** en anglais et en français.

## Raccourcis

### Fichiers et fenêtre

| Action | Raccourci |
|---|---|
| Nouveau / Ouvrir / Enregistrer / Enregistrer sous | ⌘N / ⌘O / ⌘S / ⇧⌘S |
| Exporter | ⌘E |
| Navigateur / Inspecteur | ⌥⌘1 / ⌥⌘2 |
| Réduire / Fermer la fenêtre / Quitter | ⌘M / ⌘W / ⌘Q |

### Outils

Actifs quand le canevas a le clavier (jamais pendant la saisie dans un champ).

| Outil | Touche |
|---|---|
| Sélection | Échap, ou Retour depuis un autre outil |
| Plan de travail | A |
| Plume | V |
| Crayon | P |
| Rectangle | R |
| Ovale | O |
| Texte | T |

### Édition

| Action | Raccourci |
|---|---|
| Annuler / Rétablir | ⌘Z / ⇧⌘Z |
| Copier / Couper / Coller / Dupliquer | ⌘C / ⌘X / ⌘V / ⌘D |
| Supprimer la sélection (ou le point sélectionné en édition de points) | ⌫ / Suppr |
| Déplacer de 1 px / 10 px | ← → ↑ ↓ / ⇧ + flèche |
| Éditer les points d'un tracé (ou le texte d'un calque texte) | Retour, ou double-clic |
| Quitter l'édition de points | Échap, ou clic hors du tracé |
| Grouper / Dégrouper | ⌘G / ⇧⌘G |
| Union / Soustraire / Intersection / Différence | ⌥⌘U / ⌥⌘S / ⌥⌘I / ⌥⌘X |
| Vectoriser le contour | ⌥⌘O |
| Avancer / Reculer | ⌥⌘↑ / ⌥⌘↓ |
| Premier plan / Arrière-plan | ⌃⌥⌘↑ / ⌃⌥⌘↓ |
| Masquer / Verrouiller | ⇧⌘H / ⇧⌘L |

### Vue

| Action | Raccourci |
|---|---|
| Zoom + / − / 100 % / Tout afficher | ⌘= / ⌘- / ⌘0 / ⌘1 |
| Défiler | molette ou trackpad |
| Zoomer autour du curseur | ⌘ + molette, ou pincement |
| Zoom à 100 % | double-clic sur le pourcentage |

### Souris et modificateurs sur le canevas

| Action | Geste |
|---|---|
| Ajouter / retirer de la sélection | ⇧-clic |
| Entrer dans un groupe | double-clic |
| Renommer un plan de travail | triple-clic sur son nom |
| Ajouter un point à un tracé | clic sur un segment (édition de points) |
| Point d'angle ↔ courbe | double-clic sur un point (édition de points) |
| Fermer un tracé à la plume | clic sur le premier point ; Retour ou Échap pour le laisser ouvert |
| Courbe à la plume | glisser après le clic |
| Texte sur une ligne / dans un cadre | clic / glisser (Échap pour terminer) |
| Carré, cercle ; proportions ; angle par 15° | ⇧ en dessinant, redimensionnant, pivotant |
| Depuis le centre | ⌥ en dessinant ou redimensionnant |
| Poignée de Bézier indépendante | ⌥ en la glissant |

### Navigateur (liste des calques)

| Action | Raccourci |
|---|---|
| Calque précédent / suivant | ↑ / ↓ (⇧ étend la sélection) |
| Ouvrir un groupe ou plan de travail / y entrer | → |
| Fermer / remonter au parent | ← |
| Renommer | Retour, ou triple-clic |
| Sélection multiple / plage | ⌘-clic / ⇧-clic |
| Déplacer dans la pile ou dans un groupe | glisser-déposer |

### Champs

| Action | Raccourci |
|---|---|
| Valider / annuler | Retour / Échap |
| Champ numérique : +/− un pas, ×10 | ↑ / ↓, ⇧ + ↑ / ↓ |
| Sélecteur de couleur : déplacer le curseur de 1 % / 10 % | flèches / ⇧ + flèches |
| Dégradé : déplacer un arrêt / le supprimer | ← → (⇧ ×10) / ⌫ |
| Liste des polices : parcourir / choisir / fermer | ↑ ↓ / Retour / Échap |

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

L'architecture et les conventions du code sont décrites dans [CLAUDE.md](CLAUDE.md).

## Format de fichier

Un document est un JSON `{ "layers": [...], "palette": [...] }`, les points écrits `[x, y]` ; un simple
tableau de calques (fichiers plus anciens) s'ouvre aussi.

## Licence

MIT

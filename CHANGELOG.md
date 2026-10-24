# Changelog

## Non publié

### Ajouts

- **Polices installées** : les polices du système (macOS, Linux) sont proposées dans l'inspecteur, sous
  « Installées », et chargées quand un calque les utilise. Les collections (.ttc) et les polices variables sont prises en charge.
- **Aperçu des polices** : la liste affiche chaque police dans son propre dessin, avec un champ de recherche.
- **Export PDF et PNG** avec les polices installées : elles sont intégrées au fichier (texte sélectionnable en PDF).
  Les polices .otf (contours CFF) restent remplacées par Times dans les PDF.
- **Sélection au lasso** : glisser depuis une zone vide du canevas trace un rectangle qui sélectionne les calques
  visibles qu'il touche ; ⇧ ajoute à la sélection.
- **Tout sélectionner** (⌘A) sélectionne les calques : ceux du groupe en cours, sinon tous les calques visibles,
  ceux des plans de travail compris. Dans un champ, ⌘A sélectionne toujours son texte.

### Modifications

- Mise en page et vectorisation du texte par fontkit (au lieu d'opentype.js).
- **Gros documents plus fluides** : glisser sur le canevas (crayon, redimensionner, pivoter, éditer des points) ne
  resérialise plus tout le document à chaque mouvement ; un curseur de l'inspecteur non plus. Clic dans le vide,
  enregistrement et sélection multiple plus rapides.
- L'historique d'annulation est plafonné (~200 Mo) : les plus anciennes étapes partent sur les très gros documents.

### Corrections

- Un tracé de plusieurs centaines de milliers de points (SVG importé) faisait planter le calcul de ses limites.
- Un groupe sélectionné avec l'un de ses calques : le déplacement, le retournement et l'export ne s'appliquent
  plus deux fois à ce calque ; l'export de la sélection suit l'ordre d'empilement.

## 0.2.0 — 2026-10-21

### Ajouts

- **Repères d'alignement** : en déplaçant, redimensionnant (calques pivotés compris) ou dessinant, les bords et
  centres s'aimantent à ceux des autres calques ; une ligne magenta montre l'alignement. En édition de points,
  un point s'aimante aussi aux autres points du tracé.
- **Retourner** horizontalement ou verticalement la sélection (menu Outils).
- **Déplacer aux flèches** : 1 px, 10 px avec ⇧.
- **Type de point** dans l'inspecteur en édition de points : droit, miroir, déconnecté, asymétrique.
  Les poignées suivent le type choisi ; ⌥ en glissant rend une poignée indépendante.
- **Inspecteur en sélection multiple** : les réglages communs restent affichés (« Multiple » quand les valeurs
  diffèrent) et s'appliquent à tous les calques en une étape d'annulation. Un groupe sélectionné expose de même
  le remplissage, la bordure et le texte des calques qu'il contient.
- **Navigateur** : ⇧-clic sélectionne tous les calques entre le dernier cliqué et celui-ci.
- **Icônes** dans les menus Outils et Disposition, y compris dans le menu natif.
- **Icône de l'application** (macOS, Windows, Linux) et favicons pour le web.
- **Versions** macOS Intel et Linux (.AppImage, .deb, .rpm) en plus de macOS Apple Silicon.

### Modifications

- Les bordures et pointillés suivent le redimensionnement d'un calque ou d'un groupe.
- Combiner, Vectoriser le contour et Retourner sont dans le menu Outils.
- Les nouveaux calques et groupes prennent le numéro suivant le plus grand déjà utilisé : plus de doublons.
- Les documents enregistrés sont plus légers : 3 décimales pour les longueurs, 6 pour les angles et dégradés.
- Les éléments standard du menu natif sont traduits (Masquer Plume, Tout afficher, Réduire…).
- Le clic droit n'ouvre plus le menu de la page web (Recharger, Inspecter) dans l'application.
- L'épaisseur de bordure accepte les décimales.

## 0.1.0 — 2026-10-21

Première version : dessin (rectangle, ovale, plume, crayon, texte, plan de travail), édition de points, calques et
groupes, combinaison de formes, vectorisation du contour, dégradés, ombre et flou, presse-papier, ouverture de SVG,
export PDF, SVG, PNG et JPG. Interface en anglais et en français.

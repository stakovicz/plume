# Changelog

## Non publié

### Ajouts

- **Windows** : programme d'installation `.exe` ou `.msi`, et `winget install Stakovicz.Plume`.

## 0.4.0 — 2026-10-25

### Modifications

- **Format `.plm`** : les documents sont enregistrés compressés (archive zip), avec l'extension `.plm` et leur icône, et
  s'ouvrent d'un double-clic depuis le Finder. Les anciens documents `.json` ne s'ouvrent plus.
- **Gestionnaires de paquets** : Homebrew (macOS et Linux), Snap Store, dépôts APT (Debian, Ubuntu, Synaptic) et DNF (Fedora).
  Sous Linux, Plume est rangé dans la catégorie Graphisme des menus.
  Voir le guide [Installer Plume](docs/guides/installer.md).
- **Identifiant de l'application** : `cz.stakovi.plume`. La liste des documents récents repart à vide.

## 0.3.0 — 2026-10-24

### Ajouts

- **Coins arrondis** : un rayon pour les rectangles, commun ou un par coin, dans l'inspecteur (Géométrie › Rayon,
  bouton Coins indépendants). Étirer le rectangle garde ses coins, un redimensionnement proportionnel les met
  à l'échelle. Exportés en SVG (`rx`, ou un tracé si les coins diffèrent) ; les `rx`/`ry` des SVG importés
  sont désormais conservés.
- **Polices installées** : les polices du système (macOS, Linux) sont proposées dans l'inspecteur, sous
  « Installées », et chargées quand un calque les utilise. Les collections (.ttc) et les polices variables sont prises en charge.
- **Aperçu des polices** : la liste affiche chaque police dans son propre dessin, avec un champ de recherche.
- **Export PDF et PNG** avec les polices installées : elles sont intégrées au fichier (texte sélectionnable en PDF).
  Les polices .otf (contours CFF) restent remplacées par Times dans les PDF.
- **Sélection au lasso** : glisser depuis une zone vide du canevas trace un rectangle qui sélectionne les calques
  visibles qu'il touche ; ⇧ ajoute à la sélection.
- **Site de Plume** : https://stakovicz.github.io/plume/ — présentation, téléchargements, documentation et version web
  à essayer dans le navigateur, publiés depuis GitHub.
- **Fichier › Exemples** : six SVG d'exemple (illustration, icône d'application, affiche, tableau de bord,
  pictogrammes, motif) à ouvrir et retoucher. La version web s'ouvre sur l'illustration.
- **Menu Aide › Documentation de Plume** : ouvre la documentation d'utilisation dans le navigateur.
- **Tout sélectionner** (⌘A) sélectionne les calques : ceux du groupe en cours, sinon tous les calques visibles,
  ceux des plans de travail compris. Dans un champ, ⌘A sélectionne toujours son texte.

### Modifications

- Mise en page et vectorisation du texte par fontkit (au lieu d'opentype.js).
- Tailles de plan de travail : des formats génériques d'écran (HD, Desktop, Full HD, QHD, 4K UHD, Carré) et de papier
  (A5, A4, A3, Letter, Legal) ; les formats de téléphones, tablettes et réseaux sociaux sont retirés.
- Les champs numériques de l'inspecteur et le champ hexadécimal des couleurs utilisent Fira Sans avec un zéro
  barré : 0 et O ne se confondent plus.
- Un rectangle ou un ovale dessiné est rempli d'orange (#FF6F00) à 70 % d'opacité, au lieu de gris.
- Panneau de couleur : Retour dans un champ valide et ferme le panneau.
- **Gros documents plus fluides** : glisser sur le canevas (crayon, redimensionner, pivoter, éditer des points) ne
  resérialise plus tout le document à chaque mouvement ; un curseur de l'inspecteur non plus. Clic dans le vide,
  enregistrement et sélection multiple plus rapides.
- L'historique d'annulation est plafonné (~200 Mo) : les plus anciennes étapes partent sur les très gros documents.

### Corrections

- **Linux** : Fenêtre › Réduire et Fermer la fenêtre (Ctrl+W) fonctionnent ; le menu Plume n'affiche plus les
  éléments propres à macOS (Services, Masquer…) ; Premier plan / Arrière-plan passent à Ctrl+Maj+Alt+↑ / ↓ (ils
  avaient le même raccourci qu'Avancer / Reculer) ; Ctrl+clic sélectionne plusieurs calques dans le navigateur.
- Les touches d'outils (A, V, P, R, O, T) marchent aussi juste après un clic dans l'inspecteur ou le navigateur
  (version web) ; elles restent sans effet pendant la saisie dans un champ.
- Un clic, sans glisser, sur l'un des calques d'une sélection multiple ne sélectionne plus que lui, comme dans le
  navigateur ; glisser déplace toujours toute la sélection.
- Inspecteur, section Texte : le réglage Auto / Fixe s'appelait « Épaisseur » en français ; il s'appelle « Largeur ».
- Une forme vectorisée (Vectoriser le contour) n'a plus du tout de bordure : l'export SVG écrit `stroke="none"`
  au lieu d'une bordure d'épaisseur 0, comme l'attend une icône pleine.
- Le code hexadécimal tapé dans le panneau de couleur était perdu en quittant le champ par Tab ou un clic : il est appliqué.
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

# Écrire et mettre en forme du texte

Créer un texte sur une ligne ou dans un cadre, choisir sa police, sa taille et son alignement, et le vectoriser pour un rendu identique partout.

## Créer un texte

Appuyez sur **T**, puis :

- **cliquez** : le texte tient sur une ligne et sa zone s'élargit en tapant (largeur **Auto**) ;
- ou **glissez** : vous tracez une zone dont la largeur est fixe ; les lignes passent à la ligne au mot (largeur **Fixe**).

Tapez, puis **Échap** (ou cliquez ailleurs) pour terminer. Un texte laissé vide est supprimé.
**Retour** dans la saisie crée une nouvelle ligne.

## Modifier le contenu

Sélectionnez le texte, puis **Retour** ou double-clic. Tant que le calque porte le nom de sa première ligne,
son nom suit le contenu.

## Mettre en forme

Section **Texte** de l'inspecteur ; un style par calque texte :

| Réglage | Effet |
|---|---|
| Police | Fira Sans, PT Serif, Fira Mono (fournies), puis les polices **installées** sur l'ordinateur (application de bureau) ; tapez pour filtrer |
| Graisse | Normal ou Gras |
| Taille | en pixels |
| Ligne / Lettre | interligne (multiple de la taille) et espacement des lettres (pixels) |
| Alignement | Gauche, Centre, Droite |
| Largeur | Auto (s'adapte à la plus longue ligne) ou Fixe (retour à la ligne à la largeur de la zone) |
| Couleur | couleur unie ou dégradé |

## Redimensionner

- **Proportionnellement** (⇧, ou poignée d'angle avec le cadenas de proportions) : la taille du texte change.
- **En largeur seulement** : la zone passe en largeur Fixe et les lignes se recomposent.

## Pour un rendu identique partout

Les PDF et les autres applications n'ont pas forcément la police. **Outils › Vectoriser le contour** (⌥⌘O)
transforme le texte en tracés : il n'est plus modifiable comme texte, mais s'affiche exactement pareil.
Voir [Fidélité du rendu et des exports](../explications/rendu-et-exports.md).

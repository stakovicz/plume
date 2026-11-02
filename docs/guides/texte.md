# Écrire et mettre en forme du texte

Créer un texte sur une ligne ou dans un cadre, choisir sa police, sa taille et son alignement, en faire un bloc (bouton, étiquette, encadré)
et le vectoriser pour un rendu identique partout.

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
| Couleur | couleur unie ou dégradé des lettres |
| Police | Fira Sans, PT Serif, Fira Mono (fournies), puis les polices **installées** sur l'ordinateur (application de bureau) ; tapez pour filtrer |
| Graisse | Normal ou Gras |
| Taille | en pixels |
| Interligne | multiple de la taille |
| Approche | espacement des lettres (pixels) |
| Alignement | Gauche, Centre, Droite, Justifié (les lignes coupées remplissent la largeur ; la dernière ligne d'un paragraphe reste à gauche) |
| Vertical | Haut, Milieu, Bas : place des lignes dans une zone de hauteur Fixe |

## Faire un bloc : fond, marges, bordure

Section **Bloc** de l'inspecteur, pour un bouton, une étiquette ou un encadré :

| Réglage | Effet |
|---|---|
| Fond | couleur unie ou dégradé de la zone, sous le texte |
| Largeur | Auto (s'adapte à la plus longue ligne) ou Fixe (retour à la ligne à la largeur de la zone) |
| Hauteur | Auto (s'adapte aux lignes) ou Fixe (le texte qui dépasse reste visible) |
| Marges | espace entre le bord de la zone et le texte ; une valeur pour les quatre côtés, ou une par côté (bouton à droite) |

La section **Bordure** et le **Rayon** (section Géométrie) s'appliquent à la zone, comme pour un rectangle.
En largeur ou hauteur Auto, la zone = le texte + les marges.
Pas à pas : [Faire un bouton, une étiquette ou un encadré](bouton.md).

## Redimensionner

- **Proportionnellement** (⇧, ou poignée d'angle avec le cadenas de proportions) : la taille du texte change.
- **En largeur seulement** : la zone passe en largeur Fixe et les lignes se recomposent.
- **En hauteur** : la zone passe en hauteur Fixe, le texte en fait un bloc.
- **Un bloc** (avec un fond, une bordure ou une hauteur Fixe) : seule la zone change, jamais la taille du texte,
  même proportionnellement ou dans un groupe ; marges, rayon et bordure gardent leurs valeurs.

## Pour un rendu identique partout

Les PDF et les autres applications n'ont pas forcément la police. **Outils › Vectoriser le contour** (⌥⌘O)
transforme le texte en tracés : il n'est plus modifiable comme texte, mais s'affiche exactement pareil.
Un bloc devient un groupe : un rectangle (fond, bordure, coins) sous le tracé du texte.
Voir [Fidélité du rendu et des exports](../explications/rendu-et-exports.md).

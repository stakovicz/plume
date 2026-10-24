# Dessiner à la plume

Dans ce tutoriel, vous allez dessiner une feuille avec l'outil Plume, puis retoucher sa forme point par point.
Vous saurez ensuite créer n'importe quelle forme faite de lignes droites et de courbes.

Prérequis : avoir suivi [Votre première illustration](01-premiere-illustration.md), ou savoir sélectionner
et colorer une forme.

## 1. Préparer

Ouvrez un nouveau document (⌘N). Inutile de créer un plan de travail cette fois.

## 2. Poser les points

Un tracé est une suite de **points**. Un clic pose un point d'angle ; un clic suivi d'un glisser pose un point
de courbe et tire ses deux **poignées**.

1. Appuyez sur **V** (outil Plume).
2. Cliquez une fois à gauche du canevas : c'est la pointe de la feuille.
3. Cliquez à droite, à environ 300 pixels, **et glissez vers le haut** avant de relâcher :
   un point de courbe apparaît, le segment se bombe.
4. Revenez cliquer sur le **premier point** : le tracé se ferme et Plume revient à la Sélection.

Vous avez une demi-feuille bombée d'un côté et droite de l'autre.

## 3. Colorer

Dans l'inspecteur, **Remplissage** : ouvrez la pastille et tapez `66BB6A` dans **Hex**, puis **Retour**.
Le nouveau tracé n'avait qu'une bordure ; il est maintenant rempli de vert.

## 4. Entrer en édition de points

Avec la feuille sélectionnée, appuyez sur **Retour** (ou double-cliquez dessus). Les points apparaissent
sous forme de petits carrés : vous êtes en **édition de points**.

## 5. Courber le côté droit

1. Cliquez sur le **segment droit** (le côté plat), à mi-longueur : un point s'ajoute.
2. Double-cliquez sur ce nouveau point : il devient un point de courbe, avec deux poignées.
3. Glissez le point vers le bas pour bomber ce côté aussi.

Votre feuille a maintenant deux côtés courbes.

## 6. Affiner les poignées

1. Cliquez sur le point de courbe de droite (celui posé à l'étape 2).
2. Glissez l'une de ses poignées : l'autre bouge en miroir, la courbe reste lisse.
3. Maintenez **⌥** et glissez une poignée : elle bouge seule, et la pointe devient anguleuse.

Dans l'inspecteur, la section **Point** montre le **type** du point sélectionné :
Droit, Miroir, Déconnecté ou Asymétrique. Cliquez sur **Miroir** pour retrouver une courbe lisse.

## 7. Supprimer un point

Sélectionnez un point et appuyez sur **⌫** : il disparaît et le tracé se referme sans lui.
Annulez avec ⌘Z si la forme vous plaît moins.

## 8. Sortir de l'édition

Appuyez sur **Échap**, ou cliquez en dehors de la feuille. Les poignées de sélection habituelles reviennent :
vous pouvez déplacer, redimensionner et faire pivoter la feuille entière.

## Et le crayon ?

L'outil **Crayon** (P) dessine à main levée : glissez, et au relâchement Plume transforme le trait en quelques
courbes lisses, modifiables de la même façon en édition de points.

## Ce que vous avez appris

- **Clic** = point d'angle, **clic-glisser** = point de courbe ; cliquer le premier point ferme le tracé.
- **Retour** ou double-clic entre en édition de points ; **Échap** en sort.
- En édition : clic sur un segment ajoute un point, double-clic sur un point bascule angle/courbe,
  **⌥** libère une poignée, **⌫** supprime le point.

Pour aller plus loin : [Modifier les points d'un tracé](../guides/editer-des-points.md).

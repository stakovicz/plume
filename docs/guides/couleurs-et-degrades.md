# Appliquer des couleurs, dégradés et effets

Les couleurs se règlent dans l'inspecteur : **Remplissage** et **Bordure** pour une forme, **Texte › Couleur**
pour un texte, **Fond** pour un plan de travail. Cliquer sur une pastille ouvre le panneau de couleur.

## Choisir une couleur

Dans le panneau :

- le carré règle saturation et luminosité, la barre suivante la teinte, la dernière l'opacité ;
- **Hex** : tapez un code (`F5B700`, `#f5b700`, `FB0`) puis **Retour** ; l'opacité en cours est conservée ;
- le champ en pourcentage, à côté, règle l'opacité ;
- **Retour** dans un champ du panneau valide et ferme le panneau ;
- les flèches du clavier déplacent le curseur actif de 1 % (10 % avec ⇧).

Pour plusieurs calques sélectionnés, le changement s'applique à tous.

## Réutiliser des couleurs : couleurs du document

En bas du panneau, **Couleurs du document** : **+** ajoute la couleur en cours, un clic sur une pastille
l'applique, un clic droit la retire. Ces couleurs sont enregistrées avec le document.

## Créer un dégradé

1. En haut du panneau, choisissez **Linéaire** ou **Radial** (**Couleur** revient à une couleur unie).
   Le dégradé part de la couleur en cours vers sa version transparente.
2. La barre montre les **arrêts** :
   - clic sur la barre : ajoute un arrêt ;
   - clic sur un arrêt : le sélectionne ; les réglages de couleur modifient alors cet arrêt ;
   - glisser un arrêt, ou ← → (⇧ pour 10 %) : le déplace ;
   - ⌫ : supprime l'arrêt (il en faut au moins deux).
3. Pour un dégradé linéaire, **Angle** fixe sa direction : 0° vers le haut, 90° vers la droite, 180° vers le bas.

Un dégradé radial part du centre du calque jusqu'à ses bords. Les dégradés se règlent calque par calque :
avec plusieurs calques sélectionnés, seule la couleur unie est proposée.

## Bordure

Section **Bordure** :

- **Épaisseur** : 0 retire la bordure ;
- **Position** : Centre, Intérieur ou Extérieur (formes fermées seulement, voir [Bordures](../explications/bordures.md)) ;
- **Tiret** et **Espace** : longueurs des pointillés ; Tiret à 0 = trait plein, Espace à 0 = même longueur que le tiret ;
- **Extrémités** (Plate, Arrondi, Carré) et **Angles** (Onglet, Arrondi, Biseau).

## Opacité et effets

- **Calque › Opacité** : la transparence du calque entier (un groupe est rendu comme une seule image).
- **Ombre** : activez l'interrupteur à droite du titre, puis réglez **Couleur**, décalage **X / Y** et **Flou**.
- **Effets › Flou du calque** : floute tout le calque.

L'ombre et le flou ne passent pas dans les exports PDF ; ils sont conservés en SVG, PNG et JPG.

# Modifier les points d'un tracé

Ajouter, déplacer ou supprimer les points d'un tracé et régler leurs poignées, pour retoucher une forme point par point.

## Entrer en édition de points

Sélectionnez la forme, puis **Retour** ou double-clic. Un rectangle ou un ovale est d'abord converti en tracé
(une étape annulable). Un calque texte ouvre la saisie du texte à la place.

Les calques verrouillés ou masqués, les groupes et les plans de travail n'ont pas d'édition de points.

## Ce que l'on peut faire

| Pour… | Faites |
|---|---|
| Sélectionner un point | clic dessus ; ses poignées apparaissent |
| Le déplacer | glissez-le ; il s'aimante aux autres calques et aux autres points du tracé |
| Ajouter un point | clic sur un segment, là où le point doit aller |
| Basculer angle ↔ courbe | double-clic sur le point |
| Courber sans casser la ligne | glissez une poignée : l'autre suit en miroir |
| Casser la courbe (pointe) | ⌥ en glissant une poignée |
| Choisir le comportement des poignées | inspecteur, section **Point › Type** |
| Supprimer le point | ⌫ ; un sous-tracé de moins de deux points disparaît |
| Sortir | Échap, ou clic en dehors de la forme |

## Types de point

- **Droit** : pas de poignées, angle vif.
- **Miroir** : poignées opposées, de même longueur.
- **Asymétrique** : poignées opposées, longueurs libres.
- **Déconnecté** : poignées indépendantes.

Le type choisi reste attaché au point : les poignées le respectent quand vous les glissez ensuite.

## Continuer un tracé à la plume

Avec l'outil Plume (V), chaque clic ajoute un point au tracé en cours, chaque clic-glisser un point de courbe.
Cliquer sur le premier point ferme le tracé ; **Retour** ou **Échap** le termine ouvert.
Un tracé de moins de deux points est abandonné.

# Calques, groupes et plans de travail

Comment Plume organise un document : une pile de calques, des groupes sans forme propre, des calques pivotés qui gardent leur géométrie droite et des plans de travail qui découpent leur contenu.

## Un arbre de calques

Un document Plume est une pile de calques. Certains calques en contiennent d'autres : les **groupes** et les
**plans de travail**. La pile est donc un arbre, que le navigateur affiche avec le dessus de la pile en haut.

L'ordre compte : un calque est dessiné par-dessus ceux qui le précèdent dans son parent. C'est pourquoi les
commandes d'ordre (Avancer, Reculer…) agissent entre calques de même parent, et pourquoi Grouper et Combiner
exigent des calques de même parent : le résultat doit prendre une place unique dans la pile.

## Un groupe n'a pas de forme à lui

Un groupe n'est qu'un contenant. Ses calques gardent leurs propres coordonnées sur la page ; le groupe n'a ni
position, ni taille, ni rotation qui lui soient propres. Déplacer, faire pivoter ou redimensionner un groupe
modifie directement chacun de ses calques.

Conséquences :

- Dégrouper ne fait rien bouger : il n'y a pas de transformation à « défaire ».
- Le cadre d'un groupe est calculé à partir de son contenu ; il n'a pas de champ Rotation.
- Redimensionner un groupe de façon non proportionnelle étire ses calques un par un : un calque pivoté
  à l'intérieur est étiré selon ses propres axes, ce qui n'est qu'une approximation. C'est pourquoi les groupes
  se redimensionnent proportionnellement par défaut (cadenas actif).

Ce que le groupe possède vraiment, ce sont des réglages de **rendu** : opacité, ombre, flou. Ils s'appliquent
au groupe comme à une seule image. Deux formes qui se chevauchent dans un groupe à 50 % d'opacité ne
s'assombrissent pas là où elles se recouvrent.

## Un calque pivoté garde sa forme droite

Un rectangle pivoté reste, pour Plume, un rectangle droit accompagné d'un angle. Le cadre de sélection
suit donc la forme, et les champs Position et Taille décrivent le rectangle non pivoté. Quand vous modifiez
un point d'une forme pivotée, Plume compense pour que le reste de la forme ne bouge pas à l'écran.

## Les plans de travail

Un plan de travail est un cadre au premier niveau de la pile, jamais dans un groupe. Ses calques sont dessinés
découpés à son cadre, par-dessus son fond.

Plume décide automatiquement à quel plan de travail appartient un calque : celui qui se trouve sous **son centre**
à la fin d'un déplacement. Cette règle évite d'avoir à ranger les calques à la main, et un calque que l'on déplace
ne se retrouve pas invisible, entièrement hors du plan de travail qui le découpe.

Sur le canevas, un plan de travail est transparent aux clics : on travaille sur son contenu, et on le
sélectionne par son nom. Le redimensionner ne change que son cadre, jamais ce qu'il contient : on recadre
une page, on n'étire pas un dessin.

## Aligner : sur quoi ?

Aligner a besoin d'une référence. Avec plusieurs calques, c'est le cadre qui les englobe tous : aligner à gauche
amène chacun au bord gauche du calque le plus à gauche, qui ne bouge donc pas. Un calque seul n'a rien avec quoi
s'aligner : il prend son parent, le groupe ou le plan de travail qui le contient. Au premier niveau, hors de tout
plan de travail, il n'a pas de référence et la commande ne fait rien.

Le cadre utilisé est celui que l'on voit sur la page : pour un calque pivoté, le rectangle droit qui l'englobe une
fois tourné, pas sa forme droite d'origine. Un groupe, n'ayant pas de forme à lui, s'aligne par le cadre de son
contenu et bouge d'un bloc. Un calque verrouillé ne bouge pas, mais sa place compte : c'est un moyen simple
d'aligner les autres sur lui. Après l'alignement, chaque calque déplacé suit la règle du centre ci-dessus et peut
changer de plan de travail.

## Masqué, verrouillé

Masquer et verrouiller se transmettent du groupe à ses calques, sans effacer leur propre réglage. Masquer
un groupe puis le réafficher rend à chaque calque l'état qu'il avait. Un calque verrouillé reste sélectionnable,
pour qu'on puisse lire ses réglages, le copier ou le déverrouiller.

# Fidélité du rendu et des exports

Pourquoi un dessin s'affiche presque à l'identique dans Plume et dans un export SVG, PNG ou JPG, ce qu'un PDF perd, et comment les polices et les images voyagent ou non.

## Le canevas est du SVG

Plume dessine le canevas en SVG, par le moteur du navigateur intégré. Ce que vous voyez est donc très proche
de ce que produit un export SVG, et les exports PNG et JPG sont rendus par ce même moteur : ombres, flous,
dégradés et découpes y sont identiques au canevas.

## Le PDF est recomposé

Un PDF n'est pas une image du canevas : le dessin y est retraduit en instructions PDF, pour rester vectoriel
et garder un texte sélectionnable. Cette traduction ignore les **filtres** : l'ombre portée et le flou
n'apparaissent pas dans les PDF. Pour un PDF avec ombre, exportez en PNG à 2× ou 3×, ou dessinez l'ombre
comme une forme.

## Les polices

Le texte est mis en page par Plume à partir des fichiers de police eux-mêmes, et non par le navigateur :
mesure des lignes, retour à la ligne et vectorisation utilisent les mêmes données. C'est ce qui permet à un texte
d'avoir exactement la même largeur sur le canevas, dans un export et une fois vectorisé.

Selon le format, la police voyage ou non :

- **PNG, JPG** : intégrée au rendu.
- **PDF** : intégrée, sauf les polices `.otf` (contours CFF), que la bibliothèque PDF ne sait pas intégrer, et les
  polices non chargées d'un SVG importé ; elles sont remplacées par Times.
- **SVG** : seul le nom de la police est écrit ; l'application qui ouvre le fichier doit l'avoir.

Une police d'un SVG importé que Plume ne connaît pas est mesurée avec Fira Sans : la mise en page peut différer
légèrement de l'original.

Quand le rendu doit être exact partout, **vectorisez le texte** (⌥⌘O) : les lettres deviennent des tracés,
qui ne dépendent plus d'aucune police.

## Les images

Une image placée dans Plume est **intégrée** partout : dans le `.plm`, et dans chaque export. Un SVG exporté la
contient en `data:`, il reste donc lisible seul, au prix d'un fichier plus lourd que l'image elle-même (environ un
tiers de plus).

Les photos d'appareil et de téléphone sont souvent enregistrées couchées, avec une **orientation EXIF** qui dit
comment les tourner. Le canevas, le SVG, le PNG et le JPG en tiennent compte, mais les lecteurs PDF l'ignorent.
Plume redessine donc ces photos droites avant de les mettre dans le PDF. Elles y sont réenregistrées en JPEG
(qualité 92 %), les autres images y vont telles quelles.

Un GIF animé s'anime sur le canevas et dans un SVG ouvert par un navigateur ; PNG, JPG et PDF n'en gardent qu'une image.

## Les blocs de texte

SVG n'a pas de bloc de texte : un texte avec fond, marges ou bordure s'exporte comme un groupe `<g>` qui contient
un rectangle (fond, bordure, coins arrondis) puis le texte. Chaque ligne est écrite à la position calculée par Plume ;
une ligne justifiée, mot par mot, pour qu'elle remplisse la largeur dans n'importe quel lecteur.

Rouvert dans Plume, ce SVG donne un rectangle et un texte séparés, qui ne sont plus un bloc : changer le texte
n'agrandit plus le fond. Pour continuer à modifier un bloc, gardez le document en `.plm`.

## L'import SVG est une traduction

Un SVG peut décrire bien plus que ce que Plume sait éditer (feuilles de style, motifs, images liées, filtres variés).
Plume en traduit l'essentiel en calques modifiables : formes en tracés, groupes, dégradés, découpes, flou, ombre,
texte simple, images intégrées. Le reste est ignoré plutôt qu'approximé. Les transformations sont appliquées aux points : un SVG
importé n'a plus de matrices, seulement des formes à leur place.
Voir la liste exacte dans [Formats de fichier](../reference/formats.md#import-svg).

# Dessiner une étoile

Tracer un polygone régulier, le changer en étoile, puis l'ajuster : nombre de branches, finesse, proportions.

## Tracer un polygone

1. Choisissez l'outil **Polygone** (touche **Y**, ou l'icône pentagone de la barre d'outils).
2. Glissez sur le canevas en maintenant ⇧ : la forme reste régulière. Sans ⇧, elle s'étire pour remplir la
   boîte tracée. ⌥ trace depuis le centre.

Le polygone a 5 côtés et un sommet en haut. L'outil rend la main à la Sélection.

## En faire une étoile

Dans l'inspecteur, section **Géométrie** :

- **Côtés** : le nombre de sommets du polygone, donc de branches de l'étoile (3 à 64).
- **Rayon intérieur** : la distance des creux au centre, en pourcentage de celle des pointes. À 100 %, c'est un
  polygone ; en dessous, une étoile, d'autant plus fine que le rayon est petit.

Tapez la valeur puis Retour, ou utilisez ↑/↓ (⇧ : par 10). Chaque changement s'annule d'un ⌘Z.

| Pour obtenir | Côtés | Rayon intérieur |
|---|---|---|
| triangle, losange, hexagone, octogone | 3, 4, 6, 8 | 100 % |
| étoile classique (pentagramme, branches alignées) | 5 | 38 % |
| étoile de David (deux triangles) | 6 | 58 % |
| étoile fine | 5 à 8 | 20 à 30 % |
| macaron, sceau « Nouveau ! » | 16 à 24 | 80 à 90 % |
| astérisque (avec une bordure épaisse, sans remplissage) | 6 à 8 | 0 % |

Plusieurs polygones sélectionnés ensemble reçoivent les mêmes réglages.

## Régler les proportions

La forme remplit toujours sa boîte : changer **L** ou **H** dans l'inspecteur l'allonge ou l'aplatit.
Changer les **Côtés** ou le **Rayon intérieur** ajuste la hauteur, autour du centre : un polygone régulier le reste,
un polygone étiré garde le même étirement.

Pour rendre régulière une forme tracée sans ⇧, réglez la hauteur selon la largeur :

| Côtés | Hauteur |
|---|---|
| 3 | L × 0,866 |
| 4 | L × 1 |
| 5 | L × 0,951 |
| 6 | L × 1,155 |
| 8 | L × 1,082 |

Pour une étoile, la règle est la même tant que les creux restent à l'intérieur des pointes, ce qui est le cas des
réglages ci-dessus.

Pour la pencher, réglez la **Rotation** (une étoile à 5 branches pointe vers le bas à 36°).

## Aller plus loin

- **Retouche des points** : Retour ou double-clic convertit le polygone en tracé, pour déplacer une branche ou
  arrondir un creux (voir [Modifier les points d'un tracé](editer-des-points.md)). Côtés et Rayon intérieur ne sont
  alors plus réglables.
- **Combiner** : une étoile soustraite d'un cercle, ou réunie à un autre polygone
  (voir [Combiner des formes](combiner-des-formes.md)).
- **Export** : en SVG, la forme sort en `<polygon>` ; réimportée, elle devient un tracé. Le document `.plm` garde
  les côtés et le rayon (voir [Formats de fichier](../reference/formats.md)).

Les coins arrondis ne sont pas encore proposés sur les polygones : passez par la retouche des points.

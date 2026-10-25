# Importer un SVG

Ouvrir un fichier SVG comme document, coller un SVG copié ailleurs ou glisser des fichiers SVG sur le canevas.

## Ouvrir un SVG comme document

**Fichier › Ouvrir…** (⌘O) et choisissez un `.svg`. Plume crée un nouveau document :

- un plan de travail aux dimensions du SVG (son `viewBox`, sinon sa largeur et hauteur, sinon son contenu),
  nommé d'après le fichier, contient tout le dessin ;
- les éléments `<g>` deviennent des groupes, les formes des tracés.

Le document est **sans titre** : ⌘S enregistre un nouveau document `.plm`, le fichier SVG d'origine n'est jamais modifié.

Pour essayer sans fichier : **Fichier › Exemples** ouvre l'un des SVG d'exemple fournis avec Plume.

## Coller un SVG

Copiez un SVG depuis une autre application (en tant que code, fichier ou image dans une page web), puis
**Édition › Coller** (⌘V) dans Plume. Le dessin arrive comme calques ; plusieurs éléments sont réunis en un groupe.

Le collage va dans le groupe ou plan de travail sélectionné, sinon juste au-dessus du calque sélectionné,
sinon au premier niveau.

## Glisser-déposer des fichiers

Glissez un ou plusieurs fichiers `.svg` sur le canevas : chacun arrive centré là où vous le déposez,
dans le plan de travail qui se trouve dessous.

## Ce qui est pris en charge

Formes, tracés, groupes, transformations, couleurs et opacités, dégradés linéaires et radiaux, masques et
`clipPath` (comme découpe), flou gaussien, ombres portées, texte simple.
La liste complète et les limites : [Formats de fichier](../reference/formats.md#import-svg).

# Importer une image

Placer une photo, une capture d'écran ou un logo (PNG, JPG, WebP, GIF) dans un document, pour l'annoter,
la détourer avec un masque ou composer autour.

## Trois façons de l'ajouter

- **Fichier › Importer une image…** (⇧⌘I) : choisissez un fichier. L'image arrive au centre du plan de travail
  de la sélection, sinon au centre de la vue.
- **Glisser-déposer** un ou plusieurs fichiers image sur le canevas : chacun arrive centré là où vous le déposez,
  dans le plan de travail qui se trouve dessous.
- **Coller** (⌘V) une image copiée : une capture d'écran, une image copiée depuis un navigateur. Elle se place
  comme avec Importer une image.

L'image garde sa taille en pixels, réduite si elle dépasse le plan de travail. Le calque porte le nom du fichier.
Une photo de téléphone s'affiche dans le bon sens, comme dans votre visionneuse, y compris dans les exports.
Un GIF animé s'anime sur le canevas ; les exports PNG, JPG et PDF n'en gardent qu'une image
(voir [Fidélité du rendu et des exports](../explications/rendu-et-exports.md#les-images)).

## La modifier

Une image se déplace, se redimensionne (proportions gardées par défaut, cadenas pour les libérer), tourne et
se retourne (Outils › Retourner horizontalement / verticalement) comme les autres calques. Opacité, ombre et flou
s'y appliquent aussi.

Dans l'inspecteur, la section **Image** affiche sa taille d'origine et propose :

- **Taille d'origine** : revient à la taille en pixels, au même endroit ;
- **Remplacer…** : met une autre image à la place, même largeur, la hauteur suit ses proportions.

Une image n'a ni remplissage, ni bordure, ni points à modifier ; elle ne se combine pas avec des formes.

## Où elle est enregistrée

L'image est **intégrée** au document `.plm`, une seule fois même si elle sert plusieurs fois : le document reste
complet si le fichier d'origine bouge ou disparaît. Les exports SVG l'intègrent aussi (en `data:`), et un SVG
qui contient des images intégrées les rend à l'ouverture. Voir [Formats de fichier](../reference/formats.md).

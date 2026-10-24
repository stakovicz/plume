# Bordures : centre, intérieur, extérieur

## Où passe le trait

En SVG, comme dans la plupart des formats vectoriels, un trait est toujours **centré** sur le contour : une
bordure de 10 px déborde de 5 px à l'extérieur et mord de 5 px à l'intérieur. Plume propose aussi
**Intérieur** et **Extérieur**, pratiques pour qu'une forme garde sa taille visible ou pour encadrer une image.

Pour les obtenir, Plume dessine un trait deux fois plus épais, puis n'en garde que la moitié voulue :
découpée à l'intérieur de la forme, ou masquée à l'intérieur pour ne garder que l'extérieur. Le résultat est
exact et s'exporte en SVG et PDF de la même façon.

Ces positions n'ont de sens que pour une forme **fermée** : un tracé ouvert n'a ni intérieur ni extérieur,
sa bordure reste centrée et le réglage Position est désactivé.

## La bordure suit le redimensionnement

Agrandir une forme agrandit aussi son épaisseur de bordure et ses pointillés, du même facteur (la moyenne des
facteurs horizontal et vertical). Une icône agrandie au double garde donc ses proportions de trait.
C'est aussi pourquoi l'épaisseur peut devenir un nombre à virgule.

## Vectoriser le contour

**Vectoriser le contour** remplace la bordure par la forme pleine qu'elle dessine. On ne peut plus changer son
épaisseur, mais on peut la combiner avec d'autres formes, la remplir d'un dégradé, ou être sûr que tous les
logiciels l'afficheront à l'identique.

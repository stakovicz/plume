# Travailler avec des plans de travail

Un plan de travail est un cadre (écran, page, visuel) : son contenu est découpé à ses bords et il s'exporte
comme un fichier à part.

## Créer un plan de travail

- **À une taille prédéfinie** : appuyez sur **A** ; l'inspecteur liste des formats d'écran
  (HD à 4K, carré) et de papier (A5 à A3, Letter, Legal). Un clic ajoute le plan de travail à droite des autres.
- **À la main** : avec **A**, glissez sur le canevas.

Un plan de travail dessiné par-dessus des calques existants les prend s'ils tiennent entièrement dedans.

## Sélectionner un plan de travail

Cliquez sur **son nom**, au-dessus de son coin supérieur gauche. Cliquer à l'intérieur sélectionne les calques
qu'il contient, pas le plan de travail. Une fois sélectionné, il se déplace en glissant n'importe où dans sa zone vide.

## Changer sa taille

- Glissez ses poignées : seul le cadre change, le contenu ne bouge pas.
- Ou, dans l'inspecteur, **Géométrie › Préréglage**, ou les champs **L** et **H**.

Un plan de travail ne pivote pas et ne se retourne pas.

## Changer son fond

Section **Fond** de l'inspecteur. Un fond transparent (opacité 0) donne un PNG transparent à l'export.

## Grille

Dans l'inspecteur, l'interrupteur à droite du titre de chaque section :

- **Grille** ajoute une grille carrée depuis le coin supérieur gauche du plan de travail :
  **taille** des cases (8 px par défaut) et une ligne **majeure** toutes les N cases (8 par défaut ; 0 = aucune) ;
- **Colonnes** ajoute des colonnes de mise en page : **nombre** (6 par défaut), **gouttière** et **marge**.

Les deux s'utilisent seules ou ensemble, toujours de la même couleur.

- Les lignes gardent la même épaisseur à l'écran ; trop serrées quand on dézoome, elles disparaissent.
- Grille et colonnes ne sont ni sélectionnables ni exportées. Leurs réglages sont enregistrés avec le document, et dans le SVG exporté.
- **Magnétisme** : en déplaçant, redimensionnant, dessinant ou éditant un point dans le plan de travail, les bords
  s'aimantent aux lignes et aux bords des colonnes (les repères d'alignement passent avant).
  Maintenez **⌘** (Ctrl) pour l'ignorer le temps d'un glissement.
- Menu **Présentation** : **Afficher/Masquer les grilles** (⌘') et **Activer/Désactiver le magnétisme de la grille**,
  pour tous les plans de travail. Grilles masquées, pas de magnétisme.

## Mettre des calques dedans ou les en sortir

Déplacez simplement le calque : à la fin du déplacement, il appartient au plan de travail sous **son centre**,
ou au premier niveau s'il n'y en a pas. Vous pouvez aussi le glisser dans le navigateur.
Un calque déposé dans un plan de travail entièrement en dehors de son cadre y est ramené au centre,
pour ne pas devenir invisible.

## Renommer

Triple-clic sur son nom sur le canevas, ou dans le navigateur. Le nom sert de nom de fichier à l'export.

## Exporter

**Fichier › Exporter…**, **Contenu : Plans de travail** : un fichier par plan de travail visible.
Voir [Exporter](exporter.md).

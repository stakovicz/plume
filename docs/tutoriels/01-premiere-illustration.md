# Votre première illustration

Dans ce tutoriel, vous allez créer une bannière : un soleil, un sol en dégradé et un titre,
puis l'exporter en image PNG. Comptez un quart d'heure. Aucune connaissance préalable n'est nécessaire.

À la fin, vous saurez dessiner des formes, les colorer, écrire du texte, grouper des calques,
enregistrer un document et l'exporter.

## 1. Ouvrir un document vide

Lancez Plume. Si un document s'ouvre (Plume rouvre le dernier), choisissez **Fichier › Nouveau** (⌘N).

La fenêtre a trois zones :

- à gauche, le **navigateur** : la liste des calques ;
- au centre, le **canevas**, où l'on dessine ;
- à droite, l'**inspecteur** : en haut la barre d'outils, en dessous les réglages de la sélection.

Les touches des outils (A, O, R, T…) n'agissent pas pendant la saisie dans un champ : après avoir tapé une valeur,
cliquez l'outil dans la barre d'outils, ou d'abord dans le canevas.

## 2. Créer un plan de travail

Un plan de travail est la « page » que vous exporterez.

1. Appuyez sur **A** (outil Plan de travail). L'inspecteur affiche des tailles prêtes à l'emploi.
2. Dans la section **Écran**, cliquez sur **1920 × 1080** (Full HD).

![L'inspecteur avec l'outil Plan de travail : les formats Écran et Papier](../img/tuto1-formats.webp)

Un plan de travail blanc apparaît, cadré dans la fenêtre. Son nom, « Full HD », s'affiche au-dessus.
Plume est revenu à l'outil Sélection.

![Le plan de travail Full HD, blanc, au centre de la fenêtre ; le navigateur à gauche, l'inspecteur à droite](../img/tuto1-plan-de-travail.webp)

## 3. Dessiner le soleil

1. Dans la barre d'outils, cliquez l'outil **Ovale** (touche O).
2. Dans le haut du plan de travail, glissez en maintenant **⇧** : vous obtenez un cercle.
   Relâchez la souris avant ⇧.

Le cercle est sélectionné : huit poignées l'entourent et l'inspecteur montre ses réglages.

3. Dans l'inspecteur, section **Remplissage**, cliquez sur la pastille de couleur.
4. Une nouvelle forme est orange et un peu transparente (70 %). Dans le champ à droite de **Hex**, mettez
   l'opacité à `100` puis **Retour** : le panneau se ferme.
5. Rouvrez la pastille, tapez `F5B700` dans **Hex** puis **Retour** : le cercle devient jaune.

   ![Le panneau de couleur ouvert sur le cercle : F5B700 tapé dans Hex, opacité 100 %](../img/tuto1-couleur.webp)

6. Section **Bordure**, mettez **Épaisseur** à `0` puis **Retour** :
   le contour noir disparaît.

## 4. Dessiner le sol en dégradé

1. Cliquez l'outil **Rectangle** (R) et glissez sur toute la largeur du bas du plan de travail.
2. Section **Remplissage**, ouvrez la pastille de couleur et choisissez **Linéaire** en haut du panneau.

Le rectangle se remplit d'un dégradé qui va de haut en bas (**Angle** 180°), de l'orange vers le transparent.
Sous le sélecteur de type, la barre montre ses **arrêts** : à gauche la couleur du haut, à droite celle du bas.

3. Cliquez sur l'arrêt de gauche, mettez son opacité à `100` (champ à droite de **Hex**) et **Retour** :
   le panneau se ferme. Rouvrez-le, cliquez sur l'arrêt de gauche, tapez `2E7D32` dans **Hex** et **Retour**.
4. Rouvrez le panneau, cliquez sur l'arrêt de droite, mettez son opacité à `100` et **Retour** ;
   rouvrez-le, cliquez sur l'arrêt de droite, tapez `A5D6A7` dans **Hex** et **Retour**.

![Le dégradé linéaire du sol : arrêt vert foncé à gauche, vert clair à droite, angle 180°](../img/tuto1-degrade.webp)

Retirez aussi la bordure : **Épaisseur** à `0`.

## 5. Écrire un titre

1. Cliquez l'outil **Texte** (T), puis au milieu du plan de travail.
2. Tapez `Bonjour`, puis **Échap** pour terminer la saisie.

Le texte reste sélectionné. Dans la section **Texte** de l'inspecteur :

3. **Police** : choisissez **PT Serif**.
4. **Graisse** : **Gras**.
5. **Taille** : `120` puis **Retour**.

Avec l'outil Sélection, glissez le texte pour le placer sous le soleil. Des lignes magenta apparaissent quand
il s'aligne sur le centre du plan de travail ou du soleil : relâchez à ce moment-là pour le centrer.

![Le titre Bonjour sous le soleil ; la section Texte de l'inspecteur : PT Serif, Gras, taille 120](../img/tuto1-texte.webp)

## 6. Grouper le soleil et le titre

1. Cliquez sur le soleil, puis **⇧-clic** sur le titre : les deux sont sélectionnés.
2. **Disposition › Grouper** (⌘G).

Dans le navigateur, un calque « Groupe 1 » contient maintenant le soleil et le texte.

3. Triple-cliquez sur « Groupe 1 » dans le navigateur, tapez `Motif` et **Retour**.
4. Dans l'inspecteur, section **Effets**, activez **Ombre** : le soleil et le titre reçoivent une ombre portée.

![Le groupe Motif, déplié dans le navigateur ; dans l'inspecteur, l'ombre activée](../img/tuto1-groupe.webp)

Glissez le groupe sur le canevas : le soleil et le texte bougent ensemble.

## 7. Enregistrer

**Fichier › Enregistrer** (⌘S), nommez le fichier `banniere` et validez. Plume enregistre un document `banniere.plm`
que vous pourrez rouvrir et modifier.

## 8. Exporter en PNG

1. **Fichier › Exporter…** (⌘E).
2. **Contenu** : **Plans de travail**. **Format** : **PNG**. **Échelle** : **2×**.
3. Cliquez sur **Exporter** et choisissez où enregistrer `Full HD@2x.png`.

![Le dialogue Exporter : Plans de travail, PNG, 2×](../img/tuto1-export.webp)

Ouvrez l'image : 3840 × 2160 pixels, avec le soleil, le titre, l'ombre et le dégradé.

![La bannière terminée : un soleil jaune, le titre Bonjour, un sol en dégradé vert](../img/tuto1-resultat.webp)

## Ce que vous avez appris

- Un **plan de travail** cadre ce que vous exportez.
- Chaque outil a sa touche (O, R, T, A), hors de la saisie dans un champ, et rend la main à la Sélection après le dessin ;
  **⇧** contraint (cercle, carré).
- L'**inspecteur** règle la sélection : couleur, dégradé, bordure, texte, effets.
- **Grouper** fait bouger et styler plusieurs calques ensemble.

Ensuite : [Dessiner à la plume](02-dessiner-a-la-plume.md).

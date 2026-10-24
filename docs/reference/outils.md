# Outils

La barre d'outils est en haut de l'inspecteur. Les touches agissent quand le canevas a le clavier.
Après un dessin, Plume revient à l'outil Sélection, sauf pour la Plume (qui continue le tracé).

| Outil | Touche | Utilisation | Modificateurs |
|---|---|---|---|
| Sélection | Échap | clic : sélectionner ; glisser : déplacer ; glisser depuis le vide : sélection au lasso ; poignées : redimensionner, pivoter ; double-clic ou Retour : éditer les points ou le texte | ⇧-clic : ajouter/retirer ; ⇧ : proportions, angle par 15° ; ⌥ : depuis le centre |
| Plan de travail | A | glisser : dessiner un plan de travail ; l'inspecteur propose des tailles prédéfinies | ⇧ : carré ; ⌥ : depuis le centre |
| Plume | V | clic : point d'angle ; clic-glisser : point de courbe ; clic sur le premier point : fermer ; Retour ou Échap : terminer ouvert | — |
| Crayon | P | glisser : trait à main levée, lissé en courbes au relâchement | — |
| Rectangle | R | glisser | ⇧ : carré ; ⌥ : depuis le centre |
| Ovale | O | glisser | ⇧ : cercle ; ⌥ : depuis le centre |
| Texte | T | clic : texte sur une ligne (largeur Auto) ; glisser : zone à largeur Fixe ; Échap : terminer | — |

L'outil Plan de travail n'est pas dans la barre d'outils : il s'obtient avec **A** ou le menu **Outils**.

## Valeurs par défaut des nouveaux calques

| Calque | Remplissage | Bordure |
|---|---|---|
| Rectangle, ovale | gris | noire, 1 px |
| Tracé (plume, crayon) | aucun | noire, 2 px |
| Texte | noir (Fira Sans, 16 px) | aucune |
| Plan de travail | fond blanc | aucune |

Une forme tracée d'un simple clic (moins de 2 pixels à l'écran) est abandonnée.

## Aides au dessin

- **Repères d'alignement** : en déplaçant, redimensionnant ou dessinant, bords et centres s'aimantent à moins
  de 5 pixels écran de ceux des autres calques visibles ; une ligne de repère s'affiche.
- **Bulle d'information** près du curseur en redimensionnant ou pivotant : mode (libre, proportionnel,
  depuis le centre) ou angle.
- **Zoom** : de 5 % à 6400 %.

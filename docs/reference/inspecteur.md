# Inspecteur

Colonne de droite : barre d'outils, pourcentage de zoom (double-clic : 100 %), puis les sections ci-dessous.
Les sections affichées dépendent de la sélection. Masquer / afficher : ⌥⌘2.

Avec plusieurs calques sélectionnés, une valeur commune est affichée ; sinon le champ indique **Multiple**.
Une modification s'applique à tous les calques non verrouillés, en une seule étape d'annulation.

## Sans sélection

« Aucune sélection ». Avec l'outil Plan de travail : la liste des tailles prédéfinies (voir ci-dessous).

## N calques sélectionnés

Plusieurs calques uniquement.

| Contrôle | Effet |
|---|---|
| Grouper | regroupe les calques (même parent requis) |
| Union, Soustraire, Intersection, Différence | combine les calques en un tracé |

## Verrouillé

Si la sélection est verrouillée : **Déverrouiller** (le calque et les groupes qui le verrouillent).
Les autres sections passent en lecture seule.

## Calque

Absente pour les plans de travail.

| Contrôle | Effet |
|---|---|
| Nom | renomme (un seul calque) |
| Opacité | curseur et champ en %, transparence du calque entier |
| Dégrouper | groupe seul |

## Géométrie

| Contrôle | Effet |
|---|---|
| Position X, Y | coin supérieur gauche du cadre (non pivoté) ; plusieurs calques : de leur ensemble |
| Taille L, H | dimensions ; plusieurs calques : mis à l'échelle depuis le coin supérieur gauche |
| Cadenas (Verrouiller les proportions) | redimensionner garde les proportions sans ⇧ |
| Rayon | rectangles : rayon des quatre coins ; 0 = coins droits ; « Multiple » quand ils diffèrent |
| Coins indépendants (bouton à droite du Rayon) | affiche **Haut** (gauche, droit) et **Bas** (gauche, droit) pour régler chaque coin ; si les coins diffèrent, un clic leur redonne à tous le rayon du coin haut gauche |
| Préréglage | plans de travail : taille prédéfinie, ou Personnalisé |
| Rotation | en degrés ; ni groupes, ni plans de travail |

Des rayons trop grands pour le rectangle sont tous réduits du même facteur, jusqu'à ce que chaque côté
contienne ses deux coins (comme en CSS) : un rayon de 50 sur un rectangle de 100 × 40 donne une pilule.

## Point

En édition de points, quand un point est sélectionné. **Type** : Droit, Miroir, Déconnecté, Asymétrique.

## Fond

Plans de travail : **Couleur** de fond.

## Texte

Calques texte. Police, Graisse (Normal, Gras), Taille, Ligne / Lettre (interligne ×, espacement en px),
Alignement (Gauche, Centre, Droite), Largeur (Auto, Fixe), Couleur ou dégradé.

## Remplissage

Formes et tracés. **Couleur** ou **Dégradé** (linéaire, radial) via le panneau de couleur.

## Bordure

| Contrôle | Valeurs |
|---|---|
| Couleur / Dégradé | panneau de couleur |
| Épaisseur | ≥ 0 ; 0 = pas de bordure |
| Position | Centre, Intérieur, Extérieur (formes fermées) |
| Tiret / Espace | pointillés ; Tiret 0 = plein ; Espace 0 = égal au tiret |
| Extrémités | Plate, Arrondi, Carré |
| Angles | Onglet, Arrondi, Biseau |

Un **groupe** sélectionné affiche Texte, Remplissage et Bordure de ses calques : les réglages s'appliquent à eux.

## Effets

Absente pour les plans de travail.

| Contrôle | Effet |
|---|---|
| Ombre | active l'ombre portée (par défaut : noir 50 %, X 0, Y 2, flou 4) |
| Couleur, X / Y, Flou | réglages de l'ombre (flou 0 à 100) |
| Flou du calque | 0 à 100 |

## Panneau de couleur

S'ouvre au clic sur une pastille.

| Élément | Effet |
|---|---|
| Couleur / Linéaire / Radial | type de remplissage (un calque à la fois pour les dégradés) |
| Barre d'arrêts | clic : ajouter ; glisser ou ← → : déplacer ; ⌫ : supprimer (deux minimum) |
| Angle | dégradé linéaire : 0° haut, 90° droite, 180° bas |
| Carré, Teinte, Opacité | couleur en cours ou de l'arrêt sélectionné ; flèches : 1 %, ⇧ : 10 % |
| Hex | code hexadécimal, Retour pour appliquer ; garde l'opacité |
| % | opacité |
| Couleurs du document | clic : appliquer ; + : ajouter ; clic droit : retirer |

# Organiser les calques

## Sélectionner

- **Un calque** : clic sur le canevas, ou dans le navigateur.
- **Plusieurs calques** : ⇧-clic sur le canevas ; ⌘-clic dans le navigateur.
- **Une plage** dans le navigateur : cliquez le premier calque, puis ⇧-clic sur le dernier.
- **Tout** : ⌘A. Sélectionne les calques visibles du niveau en cours : ceux du groupe où vous travaillez,
  sinon tous les calques du document, plans de travail traversés.
- **Un calque dans un groupe** : double-clic sur le groupe ; les clics suivants choisissent parmi ses calques.
  Ou dépliez le groupe dans le navigateur.

Il n'y a pas de sélection au lasso : utilisez ⇧-clic, ⌘A ou le navigateur.

## Déplacer, redimensionner, faire pivoter

- **Déplacer** : glissez le calque, ou utilisez les flèches (1 px, 10 px avec ⇧).
  Les bords et centres s'aimantent aux autres calques (lignes de repère).
- **Redimensionner** : glissez l'une des huit poignées. ⇧ garde les proportions, ⌥ redimensionne depuis le centre.
  Le cadenas **Verrouiller les proportions** de l'inspecteur (section Géométrie) rend le redimensionnement
  proportionnel sans ⇧ ; il est actif par défaut pour les groupes et les SVG importés.
- **Faire pivoter** : glissez la poignée ronde au-dessus du cadre. ⇧ arrondit l'angle par pas de 15°.
- **Valeurs exactes** : section **Géométrie** de l'inspecteur (Position, Taille, Rotation).
- **Retourner** : **Outils › Retourner horizontalement / verticalement**.

## Grouper et dégrouper

- **Grouper** (⌘G) : les calques sélectionnés doivent avoir le même parent (tous au premier niveau,
  ou tous dans le même groupe ou plan de travail). Le groupe prend la place du calque le plus haut.
- **Dégrouper** (⇧⌘G) : le groupe est remplacé par ses calques.

Sélectionner un groupe permet de régler d'un coup le remplissage, la bordure ou le texte de tous ses calques.
Son opacité et ses effets restent ceux du groupe, appliqués à l'ensemble.

## Changer l'ordre d'empilement

- **Menu Disposition** : Avancer (⌥⌘↑), Reculer (⌥⌘↓), Mettre au premier plan (⌃⌥⌘↑),
  Mettre à l'arrière-plan (⌃⌥⌘↓). Chaque calque bouge parmi ses voisins de même parent.
- **Navigateur** : glissez une ligne au-dessus ou au-dessous d'une autre. Déposée au milieu d'un groupe
  ou d'un plan de travail, elle y entre. Le haut de la liste est le dessus de la pile.

## Renommer

Triple-clic sur le nom dans le navigateur (ou **Retour** sur la ligne sélectionnée), tapez, **Retour**.
Échap annule. Un plan de travail se renomme aussi par triple-clic sur son nom, sur le canevas.

## Masquer et verrouiller

Survolez une ligne du navigateur : l'œil masque, le cadenas verrouille. Raccourcis : ⇧⌘H, ⇧⌘L.

- Un calque **masqué** n'est plus dessiné ni cliquable sur le canevas, mais reste sélectionnable dans le navigateur.
- Un calque **verrouillé** reste sélectionnable mais ne peut être ni déplacé, ni modifié, ni supprimé.
  L'inspecteur passe en lecture seule et propose **Déverrouiller**.
- Les calques d'un groupe masqué ou verrouillé le sont aussi ; le navigateur l'indique par une icône pâle.

## Supprimer

⌫ ou Suppr. Les calques verrouillés restent. Un groupe vidé disparaît avec ses calques.

Voir aussi : [Calques, groupes et plans de travail](../explications/calques-groupes-plans.md).

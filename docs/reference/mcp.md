# Serveur MCP

Les outils que Plume expose à un agent IA par le protocole MCP. Mise en route : [Piloter Plume depuis un agent
IA](../guides/mcp.md).

| Élément | Valeur |
|---|---|
| Transport | stdio : l'agent lance `plume --mcp`, qui relaie vers la fenêtre ouverte |
| Versions du protocole | 2025-06-18 (par défaut), 2025-11-25, 2025-03-26, 2024-11-05 |
| Capacités | outils (`tools`) ; pas de ressources ni de prompts |
| Accès | lecture et modification du document ouvert ; les outils de lecture portent l'annotation `readOnlyHint`, `delete_layers` l'annotation `destructiveHint` |
| Délai | 30 s par demande |

## Conventions

- Coordonnées en pixels du document, x vers la droite, y vers le bas.
- `bounds` : `[x, y, largeur, hauteur]` de la forme telle qu'affichée (rotation comprise), arrondis au dixième.
- Les identifiants de calques sont stables d'un appel à l'autre (et dans le fichier `.plm`).
- Les calques masqués sont listés (`hidden: true`) mais absents de `get_svg` et de `screenshot`.
- Une erreur est une réponse lisible (`isError: true`), par exemple un identifiant inconnu.
- Chaque appel qui modifie le document est **une** étape d'annulation (Édition › Annuler), et rien n'est modifié
  si une partie de la demande est invalide.
- Les calques verrouillés (ou dans un groupe verrouillé) sont refusés, avec leur nom.
- Les modifications sont refusées tant que l'utilisateur tape un texte, modifie des points, dessine à la plume,
  fait glisser ou renomme un calque ; la lecture reste possible.

## Outils

### get_document

Le document ouvert. Aucun paramètre.

| Champ | Contenu |
|---|---|
| `file` | chemin du fichier, ou `null` pour un document jamais enregistré |
| `edited` | modifications non enregistrées |
| `layers` | les calques de premier niveau, du dessous au dessus (voir Résumé d'un calque) |
| `palette` | couleurs du document, en hex |
| `selection` | identifiants des calques sélectionnés |

**Résumé d'un calque** : `id`, `name`, `kind` (`artboard`, `group`, `rect`, `ellipse`, `polygon`, `path`, `text`,
`image`), `bounds`, et selon le cas : `fill` (`#RRGGBB`, suivi de l'opacité si < 100 %, ou `gradient`), `stroke`
(couleur et épaisseur), `opacity`, `rotation` (degrés), `sides` et `innerRadius` (polygone), `text` (contenu),
`hidden`, `locked`, `children` (plans de travail et groupes). Pas de points : voir `get_svg`.

```json
{"id":"…","name":"Soleil","kind":"ellipse","bounds":[1150,450,380,380],"fill":"#FF6F00"}
```

### get_selection

Les calques sélectionnés, résumés comme dans `get_document` ; liste vide sans sélection. Aucun paramètre.

### get_svg

Un document SVG des calques, avec leur géométrie et leur style exacts.

| Paramètre | Type | Défaut |
|---|---|---|
| `ids` | liste d'identifiants | la sélection, sinon tout le document |

Un seul plan de travail : son cadre devient le `viewBox`. Sinon, le `viewBox` entoure les calques.

### screenshot

Une image PNG, telle qu'affichée.

| Paramètre | Type | Défaut |
|---|---|---|
| `id` | identifiant d'un plan de travail ou d'un calque | la sélection, sinon tout le document |
| `scale` | nombre de 0,1 à 2 (pixels d'image par pixel du document) | 1 |

L'échelle est réduite si besoin pour que l'image ne dépasse pas 2048 pixels de côté.

## Outils de modification

### add_svg

Ajoute des formes écrites en SVG : chaque élément (`path`, `rect`, `circle`, `ellipse`, `polygon`, `line`, `text`,
`g`, dégradés) devient un calque modifiable, aux coordonnées du SVG, qui sont celles du document. Les formes
deviennent des tracés, comme à l'import d'un fichier SVG. Les nouveaux calques sont sélectionnés et renvoyés.

| Paramètre | Type | Défaut |
|---|---|---|
| `svg` | texte SVG, enveloppé dans `<svg>` (sans `width`, `height` ni `viewBox`) | obligatoire |
| `parent` | identifiant d'un plan de travail ou d'un groupe | le plan de travail sous chaque forme, sinon le premier niveau |

```xml
<svg><circle cx="200" cy="150" r="40" fill="#F5B700"/></svg>
```

### update_layers

Change des calques en une seule étape d'annulation ; seules les propriétés données changent.

| Paramètre | Type |
|---|---|
| `updates` | liste d'objets, un par calque, avec `id` et les propriétés ci-dessous |

| Propriété | Effet |
|---|---|
| `name` | nom dans la liste des calques |
| `x`, `y` | bord gauche, bord haut des `bounds` |
| `width`, `height` | taille du cadre non pivoté ; le bord gauche ou haut reste en place |
| `rotation` | angle en degrés, autour du centre (ni groupe, ni plan de travail) |
| `fill`, `stroke` | `#RRGGBB`, `#RRGGBBAA` ou `none` ; remplacent un dégradé |
| `strokeWidth` | épaisseur de la bordure ; 0 : aucune |
| `opacity` | de 0 à 1 |
| `hidden` | masquer ou afficher |
| `text`, `fontSize` | textes : contenu, taille en pixels |
| `cornerRadius` | rectangles et zones de texte : rayon des quatre coins |
| `sides`, `innerRadius` | polygones : nombre de côtés (3 à 64), rayon intérieur (0 à 1 ; moins de 1 : étoile) |

### delete_layers

Supprime des calques (un groupe ou un plan de travail avec son contenu). Paramètre : `ids`.

### arrange

Applique une commande de menu aux calques donnés, en une étape d'annulation, et renvoie les calques qui en résultent.

| Paramètre | Valeurs |
|---|---|
| `op` | `group`, `ungroup`, `union`, `subtract`, `intersect`, `difference`, `align-left`, `align-center`, `align-right`, `align-top`, `align-middle`, `align-bottom`, `distribute-horizontal`, `distribute-vertical`, `bring-forward`, `send-backward`, `bring-to-front`, `send-to-back` |
| `ids` | les calques concernés |

Plusieurs calques s'alignent sur leurs bounds communs, un seul sur son plan de travail. Si la commande ne change rien
(grouper un seul calque, répartir moins de trois calques…), la réponse est une erreur qui dit pourquoi.

### select

Sélectionne des calques dans la fenêtre, pour montrer à l'utilisateur de quoi il s'agit. Paramètre : `ids` ; une
liste vide désélectionne.

### undo, redo

Annule ou rétablit la dernière modification du document, comme Édition › Annuler et Rétablir, qu'elle vienne de
l'agent ou de l'utilisateur. Aucun paramètre.

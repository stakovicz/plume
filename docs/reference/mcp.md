# Serveur MCP

Les outils que Plume expose à un agent IA par le protocole MCP. Mise en route : [Piloter Plume depuis un agent
IA](../guides/mcp.md).

| Élément | Valeur |
|---|---|
| Transport | stdio : l'agent lance `plume --mcp`, qui relaie vers la fenêtre ouverte |
| Versions du protocole | 2025-06-18 (par défaut), 2025-11-25, 2025-03-26, 2024-11-05 |
| Capacités | outils (`tools`) ; pas de ressources ni de prompts |
| Accès | lecture seule : chaque outil porte l'annotation `readOnlyHint` |
| Délai | 30 s par demande |

## Conventions

- Coordonnées en pixels du document, x vers la droite, y vers le bas.
- `bounds` : `[x, y, largeur, hauteur]` de la forme telle qu'affichée (rotation comprise), arrondis au dixième.
- Les identifiants de calques sont stables d'un appel à l'autre (et dans le fichier `.plm`).
- Les calques masqués sont listés (`hidden: true`) mais absents de `get_svg` et de `screenshot`.
- Une erreur est une réponse lisible (`isError: true`), par exemple un identifiant inconnu.

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

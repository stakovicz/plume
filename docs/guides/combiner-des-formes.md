# Combiner des formes

## Combiner

1. Sélectionnez au moins deux calques **de même parent** (⇧-clic). Ni verrouillés, ni plans de travail.
2. **Outils › Combiner** ou les icônes de l'inspecteur (section « N calques sélectionnés ») :

| Opération | Raccourci | Résultat |
|---|---|---|
| Union | ⌥⌘U | la surface couverte par l'une ou l'autre forme |
| Soustraire | ⌥⌘S | la forme du dessous, moins celles du dessus |
| Intersection | ⌥⌘I | ce qui est commun à toutes les formes |
| Différence | ⌥⌘X | ce qui est couvert par un nombre impair de formes |

Les calques sont remplacés par **un seul tracé**, placé là où était le plus haut, avec le nom et le style
du calque du dessous. Les courbes restent des courbes. Si le résultat est vide (Intersection de formes disjointes),
rien ne change.

C'est la surface **remplie** qui compte : les bordures sont ignorées, un tracé ouvert est fermé.
Un groupe compte comme l'ensemble de ses formes ; un texte, comme ses lettres.

## Vectoriser le contour

**Outils › Vectoriser le contour** (⌥⌘O) : la bordure de chaque calque sélectionné devient une forme pleine,
à la même place. Utile pour combiner un trait, ou pour qu'un export garde exactement l'épaisseur voulue.

Un **texte** devient ses lettres en tracés : il n'est plus modifiable comme texte, mais s'exporte à l'identique
partout (voir [Fidélité du rendu et des exports](../explications/rendu-et-exports.md)).

Les calques sans bordure visible, les groupes et les calques verrouillés ne changent pas.

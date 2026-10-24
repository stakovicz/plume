# Exporter en PDF, SVG, PNG ou JPG

Exporter le document, chaque plan de travail ou la sélection en PDF, SVG, PNG ou JPG, en 1×, 2× ou 3×.

1. **Fichier › Exporter…** (⌘E).
2. **Contenu** (seuls les choix possibles sont proposés) :
   - **Sélection** : les calques sélectionnés, recadrés au plus juste ;
   - **Plans de travail** : un fichier par plan de travail visible ;
   - **Document** : tout le dessin, avec une marge de 10 px.
3. **Format** : PDF, SVG, PNG ou JPG.
4. **Échelle** (PNG et JPG) : 1×, 2× ou 3×.
5. **Exporter**. Pour un seul fichier, choisissez son nom et son emplacement ; pour plusieurs plans de travail,
   choisissez un dossier.

Dans un navigateur, les fichiers sont téléchargés.

## Noms des fichiers

- Plans de travail : le nom de chaque plan de travail (`Accueil.png`). Deux noms identiques deviennent
  `Accueil.png` et `Accueil 2.png`.
- Sélection d'un seul calque : son nom ; sinon le nom du document.
- Échelle différente de 1 : suffixe `@2x`, `@3x` (`Accueil@2x.png`).

## Choisir le format

| Format | Pour | À savoir |
|---|---|---|
| PDF | impression, documents | vectoriel, texte sélectionnable ; **ombre et flou ignorés** |
| SVG | web, autres éditeurs | vectoriel ; les polices ne sont pas incluses |
| PNG | écrans, transparence | fond transparent hors des plans de travail ou si leur fond l'est |
| JPG | photos, poids réduit | pas de transparence : fond blanc |

Les polices utilisées sont intégrées aux PDF, PNG et JPG. Exception en PDF : les polices `.otf`
et celles d'un SVG importé non chargées sont remplacées par Times. Pour un texte exact, vectorisez-le d'abord
(⌥⌘O). Détails : [Fidélité du rendu et des exports](../explications/rendu-et-exports.md).

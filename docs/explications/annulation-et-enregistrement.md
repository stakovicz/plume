# Annulation et enregistrement

Ce que ⌘Z annule, jusqu'où remonte l'historique, et comment Plume sait qu'un document a des modifications à enregistrer.

## Une étape par geste

Chaque geste complet est **une** étape d'annulation : un déplacement du clic au relâchement, une forme dessinée,
une commande de menu. Les réglages continus (glisser un curseur, choisir une couleur dans le panneau, taper un
nom) sont regroupés : tant que les modifications d'un même calque se suivent à moins d'une seconde, elles
forment une seule étape. Un clic qui ne change rien ne crée pas d'étape.

## Ce qui s'annule

Tout ce qui est enregistré dans le document : calques, styles, structure, couleurs du document.
Pas la vue (zoom, défilement), ni la sélection, ni l'état des panneaux.

## Un historique borné

Plume garde l'état complet du document à chaque étape : c'est simple et fiable, mais un gros document importé
pèse plusieurs mégaoctets par étape. L'historique est donc limité à environ 200 Mo : sur un très gros document,
les étapes les plus anciennes disparaissent. Ouvrir ou créer un document repart d'un historique vide.

## Savoir s'il faut enregistrer

Le titre de la fenêtre indique **— Modifié** quand le document diffère de sa dernière version enregistrée.
La comparaison porte sur le contenu, pas sur le nombre d'étapes : annuler jusqu'à l'état enregistré fait
disparaître la mention.

Fermer la fenêtre, quitter, ouvrir un autre document ou en créer un nouveau propose **Enregistrer**,
**Ne pas enregistrer** ou **Annuler** s'il y a des modifications.

## Fichiers ouverts et SVG

Un document `.json` ouvert est enregistré à sa place par ⌘S. Un SVG ouvert devient un document sans titre :
Plume ne réécrit jamais un SVG, car le format `.json` garde des informations que le SVG ne sait pas porter
(plans de travail, verrouillage, couleurs du document…). Au lancement, l'application de bureau rouvre le
dernier document.

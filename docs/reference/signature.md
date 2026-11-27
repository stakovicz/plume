# Code signing policy

Politique de signature du code des programmes d'installation Windows de Plume.

Free code signing provided by [SignPath.io](https://about.signpath.io), certificate by [SignPath Foundation](https://signpath.org).

## Ce qui est signé

Les programmes d'installation Windows (`.exe` et `.msi`) de chaque [version publiée](https://github.com/stakovicz/plume/releases).
Ils sont construits à partir des sources de ce dépôt par GitHub Actions, sur des machines hébergées par GitHub
(`.github/workflows/release.yml`), puis envoyés à SignPath pour signature. Les applications macOS sont signées
séparément avec un certificat Developer ID et notarisées.

## Équipe

- Auteurs (committers) et relecteurs (reviewers) : les [membres du dépôt](https://github.com/stakovicz/plume/graphs/contributors)
  ayant les droits d'écriture ; toute contribution extérieure passe par une pull request relue.
- Approbateurs (approvers) : [stakovicz](https://github.com/stakovicz), propriétaire du dépôt. Chaque demande de
  signature est approuvée à la main.

L'authentification à deux facteurs est obligatoire pour l'accès au dépôt et à SignPath.

## Confidentialité

This program will not transfer any information to other networked systems unless specifically requested by the user
or the person installing or operating it.

Plume ne transmet aucune donnée : pas de compte, pas de statistiques d'usage. Le serveur MCP, désactivé par défaut,
n'écoute que sur la machine locale (127.0.0.1).

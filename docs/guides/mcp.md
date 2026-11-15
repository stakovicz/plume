# Piloter Plume depuis un agent IA

Brancher un agent (Claude Code, Claude Desktop, Cursor…) sur la fenêtre Plume ouverte, par le protocole MCP
(Model Context Protocol). Dans cette première version, l'agent **lit** le document : il le décrit, lit des calques en
SVG et en fait des captures. Il ne le modifie pas encore.

Application de bureau uniquement : la version web n'a pas de serveur MCP.

## 1. Activer le serveur dans Plume

Menu **Plume › Activer le serveur MCP**. Une pastille **MCP** apparaît alors à côté du titre du Navigateur : tant
qu'elle est là, un agent peut lire le document ouvert. **Plume › Désactiver le serveur MCP** l'arrête.

Le serveur est désactivé par défaut. Plume se souvient du réglage d'un lancement à l'autre.

## 2. Déclarer Plume dans l'agent

L'agent lance lui-même Plume avec l'option `--mcp` : ce processus sans fenêtre relaie ses demandes vers la fenêtre
ouverte. Le chemin de l'exécutable dépend du système :

| Système | Exécutable |
|---|---|
| macOS | `/Applications/Plume.app/Contents/MacOS/plume` |
| Windows | `%LOCALAPPDATA%\Plume\plume.exe` (installeur `.exe`) ou `C:\Program Files\Plume\plume.exe` (`.msi`) ; Scoop : `%USERPROFILE%\scoop\apps\plume-editor\current\plume.exe` |
| Linux (APT, DNF, AUR) | `plume` |
| Linux (Snap) | `plume-editor.plume` |
| Linux (Flatpak) | `flatpak` avec les arguments `run cz.stakovi.plume --mcp` |

**Claude Code**, dans un terminal :

```sh
claude mcp add plume -- /Applications/Plume.app/Contents/MacOS/plume --mcp
```

**Claude Desktop** : Réglages › Développeur › Modifier la configuration, puis dans `claude_desktop_config.json` :

```json
{
  "mcpServers": {
    "plume": { "command": "/Applications/Plume.app/Contents/MacOS/plume", "args": ["--mcp"] }
  }
}
```

**Cursor** : la même entrée dans `~/.cursor/mcp.json`.

Redémarrez l'agent (ou reconnectez le serveur : `/mcp` dans Claude Code) pour qu'il voie les outils de Plume.

## 3. Demander

Quelques exemples :

- « Décris le document ouvert dans Plume. »
- « Quelles couleurs utilise le plan de travail Carte ? Propose une palette plus contrastée. »
- « Fais une capture de la sélection et dis-moi si le texte est bien centré. »
- « Donne-moi le SVG du logo pour l'intégrer à ma page. »

L'agent commence par lire l'arbre des calques, puis demande le SVG ou une capture de ce qui l'intéresse. Le détail
des outils est dans la [référence MCP](../reference/mcp.md).

## Sécurité

- Rien n'écoute tant que vous n'activez pas le serveur.
- La connexion reste sur votre machine (`127.0.0.1`), sur un port choisi au démarrage du serveur.
- Un jeton aléatoire, écrit dans un fichier que vous seul pouvez lire, est exigé à chaque connexion : un autre
  utilisateur de la machine ou une page web ne peut pas se connecter. Vous n'avez rien à copier.
- L'agent ne lit que le document ouvert ; il n'accède pas à vos fichiers par Plume.

## Dépannage

| Message de l'agent | Que faire |
|---|---|
| « Plume is not open, or its MCP server is off » | ouvrez Plume, activez le serveur (Plume › Activer le serveur MCP), puis reconnectez le serveur dans l'agent |
| aucun outil Plume dans l'agent | l'agent s'est connecté avant l'activation : reconnectez-le (`/mcp` dans Claude Code, redémarrage pour Claude Desktop) |
| « Plume did not answer within 30 s » | une boîte de dialogue attend une réponse dans Plume (enregistrement, export) : fermez-la et redemandez |
| « Impossible de démarrer le serveur MCP » dans Plume | le message indique la cause (dossier de données non accessible, par exemple) |

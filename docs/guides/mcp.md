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
ouverte. Il faut donc lui donner le chemin de l'exécutable et l'argument `--mcp`.

### Chemin de l'exécutable

| Installation | Commande | Arguments |
|---|---|---|
| macOS | `/Applications/Plume.app/Contents/MacOS/plume` | `--mcp` |
| Windows, installeur `.exe` | `%LOCALAPPDATA%\Plume\plume.exe` | `--mcp` |
| Windows, installeur `.msi` | `C:\Program Files\Plume\plume.exe` | `--mcp` |
| Windows, Scoop | `%USERPROFILE%\scoop\apps\plume-editor\current\plume.exe` | `--mcp` |
| Linux : APT, DNF, AUR | `plume` | `--mcp` |
| Linux : Snap | `plume-editor.plume` | `--mcp` |
| Linux : Flatpak | `flatpak` | `run`, `cz.stakovi.plume`, `--mcp` |

Dans un fichier JSON, un chemin Windows s'écrit avec des antislashs doublés (`C:\\Program Files\\Plume\\plume.exe`) ou
des barres obliques (`C:/Program Files/Plume/plume.exe`). Remplacez `%LOCALAPPDATA%` ou `%USERPROFILE%` par le chemin
complet : les fichiers de configuration ne développent pas ces variables.

La plupart des agents attendent la même entrée, sous la clé `mcpServers` :

```json
{
  "mcpServers": {
    "plume": { "command": "/Applications/Plume.app/Contents/MacOS/plume", "args": ["--mcp"] }
  }
}
```

Variantes de l'entrée `plume` :

```json
"plume": { "command": "C:/Program Files/Plume/plume.exe", "args": ["--mcp"] }
"plume": { "command": "plume", "args": ["--mcp"] }
"plume": { "command": "flatpak", "args": ["run", "cz.stakovi.plume", "--mcp"] }
```

### Claude Code

Dans un terminal :

```sh
claude mcp add plume -- /Applications/Plume.app/Contents/MacOS/plume --mcp
```

Par défaut, Plume n'est disponible que dans le dossier où la commande a été lancée. Ajoutez `--scope user` (avant `--`)
pour l'avoir dans tous vos projets, ou `--scope project` pour l'écrire dans le fichier `.mcp.json` du projet, à
partager avec l'équipe (même format `mcpServers` que ci-dessus ; Claude Code demande de l'approuver la première fois).
Pour changer de portée : `claude mcp remove plume`, puis l'ajouter à nouveau.

### Claude Desktop

Menu **Claude › Réglages… › Développeur › Modifier la configuration**, qui ouvre (ou crée)
`claude_desktop_config.json` :

| Système | Fichier |
|---|---|
| macOS | `~/Library/Application Support/Claude/claude_desktop_config.json` |
| Windows | `%APPDATA%\Claude\claude_desktop_config.json` |

Ajoutez l'entrée `mcpServers` ci-dessus, puis **quittez complètement** Claude Desktop (pas seulement sa fenêtre) et
rouvrez-le. En cas d'échec, les journaux sont dans `~/Library/Logs/Claude` (macOS) ou `%APPDATA%\Claude\logs` (Windows).

### Cursor

La même entrée `mcpServers`, dans `~/.cursor/mcp.json` pour tous les projets, ou dans `.cursor/mcp.json` à la racine
d'un projet.

### VS Code (GitHub Copilot)

Dans `.vscode/mcp.json` (ou par la commande **MCP: Open User Configuration** pour tous les projets). Attention, la
clé est `servers`, et chaque serveur précise son type :

```json
{
  "servers": {
    "plume": { "type": "stdio", "command": "/Applications/Plume.app/Contents/MacOS/plume", "args": ["--mcp"] }
  }
}
```

### Windsurf

Dans le panneau Cascade, menu MCP › **Open MCP config file**, qui ouvre le bon fichier `mcp_config.json` pour votre
installation, puis ajoutez l'entrée `mcpServers` ci-dessus.

### Zed

Dans `settings.json`, sous la clé `context_servers` (ou par Réglages › AI › MCP Servers) :

```json
{
  "context_servers": {
    "plume": { "command": "/Applications/Plume.app/Contents/MacOS/plume", "args": ["--mcp"], "env": {} }
  }
}
```

### Codex CLI

```sh
codex mcp add plume -- /Applications/Plume.app/Contents/MacOS/plume --mcp
```

ou, dans `~/.codex/config.toml` (la table s'appelle bien `mcp_servers`) :

```toml
[mcp_servers.plume]
command = "/Applications/Plume.app/Contents/MacOS/plume"
args = ["--mcp"]
```

### Vérifier la connexion

- **Claude Code** : `claude mcp list` affiche `plume: … - ✔ Connected` ; dans une session, `/mcp` liste les outils
  `get_document`, `get_selection`, `get_svg` et `screenshot`.
- **Autres agents** : les outils de Plume apparaissent dans la liste des outils ou des serveurs MCP.
- Si l'agent répond que Plume n'est pas ouvert, voir le Dépannage plus bas.

Après avoir activé le serveur dans Plume, reconnectez l'agent s'il était déjà lancé (`/mcp` dans Claude Code,
redémarrage pour les autres) : il ne lit la liste des outils qu'à la connexion.

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

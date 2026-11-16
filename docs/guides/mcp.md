# Piloter Plume depuis un agent IA

Demander à un assistant IA (Claude, Cursor, Copilot…) de regarder votre dessin dans Plume : le décrire, vérifier un
alignement, proposer des couleurs, récupérer le SVG d'un logo. L'assistant voit le document ouvert dans la fenêtre,
tel que vous le voyez.

Pour l'instant, l'assistant **lit** le document : il ne le modifie pas. Cette fonction n'existe que dans l'application
de bureau (macOS, Windows, Linux), pas dans la version web.

Elle repose sur MCP (Model Context Protocol), le standard qui permet de brancher des outils sur un assistant IA.

## En bref

1. Dans Plume, menu **Plume › Activer le serveur MCP**.
2. Dans votre assistant, ajoutez Plume comme serveur MCP (voir plus bas pour le vôtre).
3. Demandez-lui, par exemple : « Décris le document ouvert dans Plume. »

## 1. Activer le serveur dans Plume

Pour démarrer : menu **Plume › Activer le serveur MCP**. Une étiquette **MCP** s'affiche à côté du titre du « Navigateur » : tant
qu'elle est là, un assistant peut lire le document ouvert.

Pour arrêter : menu **Plume › Désactiver le serveur MCP**.
Plume se souvient de votre choix au lancement suivant.

## 2. Ajouter Plume à votre assistant IA

Votre assistant a besoin de savoir où se trouve Plume sur votre ordinateur. Il le lancera lui-même, sans fenêtre,
avec l'option `--mcp`.

### Où se trouve Plume

| Vous avez installé Plume… | Chemin à indiquer |
|---|---|
| sur macOS | `/Applications/Plume.app/Contents/MacOS/plume` |
| sur Windows, avec l'installeur `.exe` | `C:\Users\VOUS\AppData\Local\Plume\plume.exe` |
| sur Windows, avec l'installeur `.msi` | `C:\Program Files\Plume\plume.exe` |
| sur Windows, avec Scoop | `C:\Users\VOUS\scoop\apps\plume-editor\current\plume.exe` |
| sur Linux, avec APT, DNF ou AUR | `plume` |
| sur Linux, avec Snap | `plume-editor.plume` |

Remplacez `VOUS` par votre nom d'utilisateur Windows. Avec Flatpak, le cas est un peu différent : voir
[Linux avec Flatpak](#linux-avec-flatpak).

Les exemples ci-dessous utilisent le chemin macOS : remplacez-le par le vôtre.

### Claude Code

Dans un terminal :

```sh
claude mcp add --scope user plume -- /Applications/Plume.app/Contents/MacOS/plume --mcp
```

`--scope user` rend Plume disponible dans tous vos projets. Sans cette option, il ne l'est que dans le dossier où
vous avez tapé la commande.

### Claude Desktop

1. Ouvrez **Claude › Réglages… › Développeur**, puis cliquez sur **Modifier la configuration**.
2. Dans le fichier `claude_desktop_config.json` qui s'ouvre, collez :

   ```json
   {
     "mcpServers": {
       "plume": {
         "command": "/Applications/Plume.app/Contents/MacOS/plume",
         "args": ["--mcp"]
       }
     }
   }
   ```

3. Enregistrez, puis **quittez complètement** Claude Desktop (menu Claude › Quitter, pas seulement la fenêtre) et
   rouvrez-le.

Si le fichier contient déjà d'autres serveurs, ajoutez seulement le bloc `"plume": { … }` à côté d'eux, dans
`mcpServers`, séparé par une virgule.

### Cursor

Ouvrez `~/.cursor/mcp.json` (créez-le s'il n'existe pas) et collez le même bloc que pour Claude Desktop.

### VS Code (GitHub Copilot)

Ouvrez la palette de commandes, choisissez **MCP: Open User Configuration**, et collez :

```json
{
  "servers": {
    "plume": {
      "type": "stdio",
      "command": "/Applications/Plume.app/Contents/MacOS/plume",
      "args": ["--mcp"]
    }
  }
}
```

Attention : VS Code utilise `servers` là où les autres écrivent `mcpServers`, et demande la ligne `"type": "stdio"`.

### Autres assistants

- **Windsurf** : dans le panneau Cascade, menu MCP › **Open MCP config file**, puis collez le même bloc que pour
  Claude Desktop.
- **Zed** : dans `settings.json`, le même bloc mais sous le nom `context_servers` au lieu de `mcpServers`.
- **Codex CLI** : dans un terminal,
  `codex mcp add plume -- /Applications/Plume.app/Contents/MacOS/plume --mcp`.

### Vérifier que ça marche

Redémarrez votre assistant, puis demandez-lui : « Quels outils Plume as-tu ? ». Il doit citer `get_document`,
`get_selection`, `get_svg` et `screenshot`. Dans Claude Code, la commande `claude mcp list` affiche
`plume … ✔ Connected`.

Si l'assistant a été lancé **avant** que vous activiez le serveur dans Plume, il ne voit pas encore ses outils :
redémarrez-le (dans Claude Code, tapez `/mcp` et reconnectez Plume).

## 3. Demander

Plume doit être ouvert, avec le serveur activé. Quelques idées :

- « Décris le document ouvert dans Plume. »
- « Quelles couleurs utilise le plan de travail Carte ? Propose une palette plus contrastée. »
- « Fais une capture de la sélection et dis-moi si le texte est bien centré. »
- « Donne-moi le SVG du logo pour l'intégrer à ma page web. »

L'assistant lit d'abord la liste des calques, puis demande le SVG ou une capture de ce qui l'intéresse.

## Est-ce sûr ?

- **Rien n'est ouvert sans vous** : le serveur ne tourne que si vous l'activez, et l'étiquette MCP le signale.
- **Tout reste sur votre ordinateur** : la connexion entre l'assistant et Plume ne sort pas de votre machine.
- **Personne d'autre ne peut s'y brancher** : chaque connexion doit fournir un code secret, tiré au hasard et
  enregistré dans un fichier que vous seul pouvez lire. Vous n'avez rien à recopier.
- **L'assistant ne voit que le document ouvert** : il ne peut pas parcourir vos fichiers par Plume.

Le document est en revanche envoyé à l'assistant, comme tout ce que vous lui montrez : n'activez pas le serveur sur un
document confidentiel si votre assistant fonctionne en ligne.

## En cas de problème

**L'assistant dit que Plume n'est pas ouvert** (« Plume is not open, or its MCP server is off ») : ouvrez Plume, activez le serveur, puis redémarrez ou reconnectez l'assistant.

**L'assistant ne connaît aucun outil Plume** : il s'est connecté avant l'activation du serveur. Redémarrez-le, ou tapez `/mcp` dans Claude Code.

**L'assistant dit que Plume n'a pas répondu** (« did not answer within 30 s ») : une fenêtre attend sans doute votre réponse dans Plume (enregistrement, export). Fermez-la et redemandez.

**Plume affiche « Impossible de démarrer le serveur MCP »** : le message donne la cause, par exemple un dossier de réglages inaccessible.

**Claude Desktop n'affiche pas Plume** : vérifiez que le fichier de configuration est du JSON valide (une virgule en trop suffit à tout bloquer) et que
Claude Desktop a bien été quitté puis rouvert. Ses journaux sont dans `~/Library/Logs/Claude` (macOS) ou
`%APPDATA%\Claude\logs` (Windows).

## Pour aller plus loin

### Chemins Windows dans un fichier JSON

Dans un fichier de configuration JSON, doublez les barres obliques inverses, ou remplacez-les par des barres
obliques :

```json
"command": "C:\\Program Files\\Plume\\plume.exe"
"command": "C:/Program Files/Plume/plume.exe"
```

Les variables comme `%LOCALAPPDATA%` ne fonctionnent pas dans ces fichiers : écrivez le chemin complet.

### Linux avec Flatpak

La commande est `flatpak`, et Plume se lance avec trois arguments :

```json
"plume": { "command": "flatpak", "args": ["run", "cz.stakovi.plume", "--mcp"] }
```

Avec Claude Code : `claude mcp add --scope user plume -- flatpak run cz.stakovi.plume --mcp`.

### Partager la configuration avec une équipe (Claude Code, Cursor)

- Claude Code : `claude mcp add --scope project …` écrit la configuration dans un fichier `.mcp.json` à la racine du
  projet, à ajouter au dépôt. Chacun doit l'approuver la première fois.
- Cursor : placez le bloc dans `.cursor/mcp.json` à la racine du projet.

Le chemin de Plume doit alors être le même pour tous, ce qui est le cas sur macOS et Linux.

### Emplacements des fichiers de configuration

| Assistant | Fichier |
|---|---|
| Claude Desktop, macOS | `~/Library/Application Support/Claude/claude_desktop_config.json` |
| Claude Desktop, Windows | `%APPDATA%\Claude\claude_desktop_config.json` |
| Cursor | `~/.cursor/mcp.json`, ou `.cursor/mcp.json` dans un projet |
| VS Code | `.vscode/mcp.json` dans un projet, ou la configuration utilisateur |
| Zed | `settings.json`, clé `context_servers` |
| Codex CLI | `~/.codex/config.toml`, table `[mcp_servers.plume]` avec `command` et `args = ["--mcp"]` |

Le détail de ce que l'assistant peut lire est dans la [référence MCP](../reference/mcp.md).

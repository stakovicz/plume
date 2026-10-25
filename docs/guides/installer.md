# Installer Plume

Installer Plume avec le gestionnaire de paquets de votre système, pour recevoir les mises à jour avec les autres
applications. Sinon, téléchargez le fichier de la dernière version sur la [page des versions](https://github.com/stakovicz/plume/releases).

## Windows : winget

```powershell
winget install Stakovicz.Plume
```

Mise à jour : `winget upgrade Stakovicz.Plume`. L'application n'est pas encore signée : si SmartScreen bloque
l'installation, cliquez sur **Informations complémentaires**, puis **Exécuter quand même**.

## Windows : Scoop

```powershell
scoop bucket add stakovicz https://github.com/stakovicz/scoop-bucket
scoop install stakovicz/plume-editor
```

Version portable, sans installateur. Mise à jour : `scoop update plume-editor`.

## macOS et Linux : Homebrew

```sh
brew install --cask stakovicz/tap/plume-editor
```

Mise à jour : `brew upgrade`. Sur Linux (x86_64), Homebrew installe l'AppImage dans `~/Applications`, sans entrée
dans le menu des applications : préférez le paquet de votre distribution ci-dessous.

L'application n'est pas encore signée : au premier lancement sur macOS, clic droit sur Plume.app, puis **Ouvrir**
(ou `xattr -dr com.apple.quarantine /Applications/Plume.app`).

## Debian, Ubuntu, Linux Mint : APT

```sh
sudo install -d /etc/apt/keyrings
curl -fsSL https://stakovicz.github.io/plume/plume.asc | sudo tee /etc/apt/keyrings/plume.asc > /dev/null
echo 'deb [signed-by=/etc/apt/keyrings/plume.asc] https://stakovicz.github.io/plume/apt ./' | sudo tee /etc/apt/sources.list.d/plume.list
sudo apt update && sudo apt install plume
```

Plume apparaît ensuite dans Synaptic et dans les mises à jour du système.

## Ubuntu et autres distributions : Snap

```sh
sudo snap install plume-editor
```

Ou cherchez « Plume » dans Ubuntu Logiciels. Pour ouvrir des fichiers sur une clé USB ou un disque externe :
`sudo snap connect plume-editor:removable-media`.

## Fedora, RHEL : DNF

```sh
sudo curl -fsSL -o /etc/yum.repos.d/plume.repo https://stakovicz.github.io/plume/rpm/plume.repo
sudo dnf install plume
```

DNF demande d'accepter la clé de signature (empreinte `364C A341 6ACD 0C95 A6AB 102C 84EF 6BB2 27A5 7E83`) au
premier téléchargement.

Les dépôts APT et RPM et le snap contiennent la dernière version, en x86_64.

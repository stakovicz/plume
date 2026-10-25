#!/usr/bin/env bash
# APT and RPM repositories holding the latest release, in _site/apt and _site/rpm (GitHub Pages), run by
# pages.yml after `npm run site`. Signed with REPO_GPG_KEY (armored private key); the public key is
# _site/plume.asc. Needs gh (GH_TOKEN), apt-ftparchive (apt-utils) and createrepo_c.
set -euo pipefail

SITE=https://stakovicz.github.io/plume
OUT=$(realpath "${1:-_site}")
export GNUPGHOME=$(mktemp -d)
gpg --batch --import <<<"$REPO_GPG_KEY"
gpg --armor --export > "$OUT/plume.asc"

mkdir -p "$OUT/apt" "$OUT/rpm"
gh release download --repo stakovicz/plume --pattern '*.deb' --dir "$OUT/apt"
gh release download --repo stakovicz/plume --pattern '*.rpm' --dir "$OUT/rpm"

# Flat APT repository: `deb [signed-by=…] $SITE/apt ./`
cd "$OUT/apt"
apt-ftparchive packages . > Packages
gzip -k9 Packages
apt-ftparchive -o APT::FTPArchive::Release::Origin=Plume -o APT::FTPArchive::Release::Label=Plume release . > "$GNUPGHOME/Release"
mv "$GNUPGHOME/Release" Release # written outside: the release file would list itself
gpg --batch --clearsign -o InRelease Release
gpg --batch --armor --detach-sign -o Release.gpg Release

# RPM repository: the metadata is signed (repo_gpgcheck), the packages are not
cd "$OUT/rpm"
createrepo_c --quiet .
gpg --batch --armor --detach-sign repodata/repomd.xml
cat > plume.repo <<EOF
[plume]
name=Plume
baseurl=$SITE/rpm
enabled=1
gpgcheck=0
repo_gpgcheck=1
gpgkey=$SITE/plume.asc
EOF

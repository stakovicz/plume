// `npm version` hook: package.json already holds the new version. Copies it to the Rust crate
// (Cargo.toml, Cargo.lock), the AUR PKGBUILD, the snap and the Flatpak metadata, and dates the changelog's "Non publié" section, then stages them for the
// release commit. tauri.conf.json reads the version from package.json.
import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';

const { version } = JSON.parse(readFileSync('package.json', 'utf8'));
const edit = (file, from, to) => {
  const s = readFileSync(file, 'utf8');
  if (!from.test(s)) throw new Error(`${file}: ${from} not found`);
  writeFileSync(file, s.replace(from, to));
};

edit('src-tauri/Cargo.toml', /^version = ".*"$/m, `version = "${version}"`);
edit('src-tauri/Cargo.lock', /(name = "plume"\nversion = )".*"/, `$1"${version}"`);
edit('packaging/aur/PKGBUILD', /^pkgver=.*$/m, `pkgver=${version}`);
const snap = 'snap/snapcraft.yaml', old = readFileSync(snap, 'utf8').match(/^version: '(.*)'$/m)[1];
writeFileSync(snap, readFileSync(snap, 'utf8').replaceAll(old, version)); // version and .deb URL
const today = new Date().toISOString().slice(0, 10);
edit('flatpak/cz.stakovi.plume.metainfo.xml', /<releases>\n/, `<releases>\n    <release version="${version}" date="${today}"/>\n`);
edit('CHANGELOG.md', /^## Non publié$/m, `## ${version} — ${today}`);
execSync('git add src-tauri/Cargo.toml src-tauri/Cargo.lock packaging/aur/PKGBUILD snap/snapcraft.yaml flatpak/cz.stakovi.plume.metainfo.xml CHANGELOG.md');

#!/usr/bin/env bash
# flatpak/node-sources.json and flatpak/cargo-sources.json: every npm package and crate of package-lock.json and
# src-tauri/Cargo.lock, for the offline Flatpak build. Rerun after a dependency change (Flathub needs them current).
set -euo pipefail

TOOLS=${FLATPAK_BUILDER_TOOLS:-${TMPDIR:-/tmp}/flatpak-builder-tools}
[ -d "$TOOLS" ] || git clone --quiet --depth 1 https://github.com/flatpak/flatpak-builder-tools "$TOOLS"
[ -d "$TOOLS/venv" ] || "${PYTHON:-python3}" -m venv "$TOOLS/venv" # Python ≥ 3.10
"$TOOLS/venv/bin/pip" install --quiet "$TOOLS/node" aiohttp PyYAML tomlkit

"$TOOLS/venv/bin/flatpak-node-generator" npm package-lock.json -o flatpak/node-sources.json
"$TOOLS/venv/bin/python" "$TOOLS/cargo/flatpak-cargo-generator.py" src-tauri/Cargo.lock -o flatpak/cargo-sources.json

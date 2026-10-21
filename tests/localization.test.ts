import { expect, test } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import fr from '$lib/i18n/fr.json';

/** Every `L("…")` / `L('…')` key in the sources must exist in the French table. */
test('every UI string has a French translation', () => {
  const files = readdirSync('src', { recursive: true, encoding: 'utf8' }).filter((f) => /\.(ts|svelte)$/.test(f));
  const missing: string[] = [];
  for (const f of files) {
    for (const m of readFileSync(join('src', f), 'utf8').matchAll(/\bL\((['"])((?:(?!\1)[^\\]|\\.)*)\1/g)) {
      if (!(m[2] in fr)) missing.push(m[2]);
    }
  }
  expect(files.length).toBeGreaterThan(0);
  expect(missing).toEqual([]);
});

import fr from './fr.json';

/** Localized UI string. Keys are the English text; translations live in `<lang>.json`.
 *  Every user-facing string goes through `L` (a test checks each key has a French translation). */
const table: Record<string, string> = (globalThis.navigator?.language ?? 'en').startsWith('fr') ? fr : {};

export const L = (key: string, ...args: (string | number)[]) => {
  let i = 0;
  return (table[key] ?? key).replace(/%d|%@/g, () => String(args[i++]));
};

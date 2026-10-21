/** UI consistency: colors and sizes come from src/lib/ui/tokens.css (see CLAUDE.md). */
export default {
  overrides: [
    { files: ['**/*.svelte'], customSyntax: 'postcss-html' },
    // primitives own their exact sizes; views assemble them with tokens only
    { files: ['src/lib/ui/kit/**'], rules: { 'unit-disallowed-list': null } },
  ],
  rules: {
    'color-no-hex': true,
    'color-named': 'never',
    'function-disallowed-list': ['rgb', 'rgba', 'hsl', 'hsla'],
    'unit-disallowed-list': ['px'],
  },
  ignoreFiles: ['src/lib/ui/tokens.css', 'build/**', '.svelte-kit/**'],
};

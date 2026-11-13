// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ['dist/*', 'scripts/*'],
  },
  {
    // These rules are for code compiled by the React Compiler, which this app doesn't use
    // (no experiments.reactCompiler in app.json). They flag patterns the app relies on on
    // purpose: Animated values held in refs, the latest-callback ref in useRefreshOn, and state
    // reset when a screen's input changes.
    rules: {
      'react-hooks/refs': 'off',
      'react-hooks/set-state-in-effect': 'off',
      'react-hooks/purity': 'off',
    },
  },
]);

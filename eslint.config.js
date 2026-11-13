import js from '@eslint/js';
import prettier from 'eslint-config-prettier';
import tseslint from 'typescript-eslint';

// Dependency rule from docs/08-architecture.md, section 3:
//   data <- core <- state <- game, services never import game.
const ENGINE_PACKAGES = ['phaser', 'phaser/*', '@capacitor/*'];

const layerPatterns = (...layers) => layers.flatMap((layer) => [`**/${layer}`, `**/${layer}/**`]);

const restrictImports = (files, group, message) => ({
  files,
  rules: {
    'no-restricted-imports': ['error', { patterns: [{ group, message }] }],
  },
});

export default tseslint.config(
  { ignores: ['dist', 'coverage', 'node_modules', 'ios', 'android'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
    },
  },
  restrictImports(
    ['src/core/**'],
    [...ENGINE_PACKAGES, ...layerPatterns('game', 'services', 'state', 'i18n')],
    'src/core is pure logic: it may import only src/data and src/util.',
  ),
  restrictImports(
    ['src/data/**'],
    [...ENGINE_PACKAGES, ...layerPatterns('core', 'game', 'services', 'state', 'i18n')],
    'src/data holds plain numbers and content: no engine, no other layers.',
  ),
  restrictImports(
    ['src/services/**', 'src/state/**'],
    layerPatterns('game'),
    'services and state must not depend on the rendering layer.',
  ),
  {
    files: ['src/core/**'],
    rules: {
      'no-restricted-globals': [
        'error',
        ...['window', 'document', 'navigator', 'localStorage'].map((name) => ({
          name,
          message: 'src/core must not touch the DOM.',
        })),
      ],
      'no-restricted-properties': [
        'error',
        {
          object: 'Math',
          property: 'random',
          message: 'Use the seeded generator from core/rng.ts.',
        },
      ],
    },
  },
  prettier,
);

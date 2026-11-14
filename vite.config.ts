import type { Plugin } from 'vite';
import { defineConfig } from 'vitest/config';

/** Node global; the project does not pull in the Node type definitions. */
declare const process: {
  getBuiltinModule(id: 'node:fs'): { readFileSync(path: string, encoding: 'utf-8'): string };
};

/** Phaser's own minified ES module build: one file, no imports, no source map. */
const PHASER_MIN = '/node_modules/phaser/dist/phaser.esm.min.js';

/**
 * Dev only: the dev server sends Phaser as its minified build without any source map. By
 * default Vite pre-bundles Phaser and inlines its source map as base64, about 21 MB for one
 * module, which iPhone Safari over Wi-Fi does not load at all (a blank page). Production
 * builds and tests are not affected; the game's own files keep their maps.
 */
function leanDevPhaser(): Plugin {
  return {
    name: 'lean-dev-phaser',
    apply: 'serve',
    enforce: 'pre',
    load(id) {
      if (!id.split('?')[0]?.endsWith('phaser/dist/phaser.esm.min.js')) return null;
      const code = process
        .getBuiltinModule('node:fs')
        .readFileSync(id.split('?')[0] ?? id, 'utf-8');
      // An empty map tells Vite there is no map, so it does not generate and inline one.
      return { code, map: { mappings: '' } };
    },
  };
}

export default defineConfig(({ command, mode }) => {
  const devServer = command === 'serve' && mode !== 'test';
  return {
    // Relative base so the build also works from the Capacitor webview.
    base: './',
    plugins: devServer ? [leanDevPhaser()] : [],
    resolve: devServer ? { alias: [{ find: /^phaser$/, replacement: PHASER_MIN }] } : {},
    optimizeDeps: devServer ? { exclude: ['phaser'] } : {},
    build: {
      target: 'es2022',
      chunkSizeWarningLimit: 2000,
    },
    test: {
      environment: 'node',
      include: ['src/**/*.test.ts'],
      coverage: {
        provider: 'v8',
        include: ['src/core/**/*.ts'],
        reporter: ['text'],
        thresholds: { lines: 85 },
      },
    },
  };
});

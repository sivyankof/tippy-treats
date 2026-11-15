import { normalizePath, type Plugin } from 'vite';
import { defineConfig } from 'vitest/config';

/** Node global; the project does not pull in the Node type definitions. */
declare const process: {
  getBuiltinModule(id: 'node:fs'): { readFileSync(path: string, encoding: 'utf-8'): string };
};

/** The `version` of package.json: the one source of the version the game shows. */
function packageVersion(): string {
  const text = process.getBuiltinModule('node:fs').readFileSync('./package.json', 'utf-8');
  return (JSON.parse(text) as { version: string }).version;
}

/** Wait this long after the last package.json change before restarting the dev server. */
const RESTART_DEBOUNCE_MS = 300;

/** Phaser's own minified ES module build: one file, no imports, no source map. */
const PHASER_MIN = '/node_modules/phaser/dist/phaser.esm.min.js';

/**
 * Dev only: the dev server sends Phaser as its minified build without any source map. By
 * default Vite pre-bundles Phaser and inlines its source map as base64, about 21 MB for one
 * module, which makes the first load on a phone over Wi-Fi slow. Production builds and tests
 * are not affected; the game's own files keep their maps.
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

/**
 * Dev only: the version is baked in through `define` when the config loads, and Vite reloads the
 * config for its own file but not for package.json. A long-running dev server would keep showing
 * the old version after a bump, so a change of package.json restarts the server.
 */
function restartOnPackageJson(): Plugin {
  return {
    name: 'restart-on-package-json',
    apply: 'serve',
    configureServer(server) {
      const file = normalizePath(`${server.config.root}/package.json`);
      server.watcher.add(file);
      let timer: ReturnType<typeof setTimeout> | undefined;
      server.watcher.on('change', (changed) => {
        if (normalizePath(changed) !== file) return;
        // Editors and npm write the file in several events: restart once.
        clearTimeout(timer);
        timer = setTimeout(() => {
          server.restart().catch((error: unknown) => {
            server.config.logger.error(
              `restart after package.json change failed: ${String(error)}`,
            );
          });
        }, RESTART_DEBOUNCE_MS);
      });
    },
  };
}

export default defineConfig(({ command, mode }) => {
  const devServer = command === 'serve' && mode !== 'test';
  return {
    // Relative base so the build also works from the Capacitor webview.
    base: './',
    define: { __APP_VERSION__: JSON.stringify(packageVersion()) },
    plugins: devServer ? [leanDevPhaser(), restartOnPackageJson()] : [],
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

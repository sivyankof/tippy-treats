import { normalizePath, type Plugin } from 'vite';
import { defineConfig } from 'vitest/config';
import { cleanBuildHash, formatBuildStamp, formatBuildTime } from './src/util/build-stamp.ts';

/** Node global; the project does not pull in the Node type definitions. */
declare const process: {
  env: Record<string, string | undefined>;
  getBuiltinModule(id: 'node:fs'): {
    readFileSync(path: string, encoding: 'utf-8'): string;
    existsSync(path: string): boolean;
  };
  getBuiltinModule(id: 'node:child_process'): {
    execSync(
      command: string,
      options: { stdio: ['ignore', 'pipe', 'ignore'] },
    ): { toString(): string };
  };
};

/** The `version` of package.json: the one source of the version the game shows. */
function packageVersion(): string {
  const text = process.getBuiltinModule('node:fs').readFileSync('./package.json', 'utf-8');
  return (JSON.parse(text) as { version: string }).version;
}

/** The short hash of HEAD; 'unknown' when git or the repository is not there (a source archive). */
function gitHash(): string {
  try {
    const out = process
      .getBuiltinModule('node:child_process')
      .execSync('git rev-parse --short HEAD', { stdio: ['ignore', 'pipe', 'ignore'] });
    return cleanBuildHash(out.toString());
  } catch {
    return cleanBuildHash(null);
  }
}

/**
 * The Firebase settings files of the native projects. They are git-ignored (the owner puts them
 * in, docs/11a-device-build.md); without one the app of that platform keeps the analytics and the
 * crash reports silent instead of touching an unconfigured Firebase.
 */
const FIREBASE_FILES = {
  ios: 'ios/App/App/GoogleService-Info.plist',
  android: 'android/app/google-services.json',
} as const;

function hasFile(path: string): boolean {
  return process.getBuiltinModule('node:fs').existsSync(path);
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

/** The game's own files on the dev server: the page itself and every module under /src/. */
const GAME_FILES = /^\/(?:index\.html)?$|^\/src\//;

/**
 * Dev only: the game's own files go out with `Cache-Control: no-store`. Safari on the iPhone kept
 * old modules in memory after a change of the imports and the game stopped with "Importing binding
 * name … is not found". Phaser and the rest of node_modules keep Vite's usual caching. Vite sets
 * its own Cache-Control just before the response is written, so the header is put in last, right
 * before the head goes out.
 */
function noStoreGameFiles(): Plugin {
  return {
    name: 'no-store-game-files',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (GAME_FILES.test((req as { url?: string }).url?.split('?')[0] ?? '')) {
          const writeHead = res.writeHead as (...args: unknown[]) => typeof res;
          res.writeHead = function (this: typeof res, ...args: unknown[]) {
            this.setHeader('Cache-Control', 'no-store');
            return writeHead.apply(this, args);
          } as typeof res.writeHead;
        }
        next();
      });
    },
  };
}

/** Puts the build stamp into index.html (`%BUILD_STAMP%`), where the dev error box prints it. */
/**
 * The build stamp of the page: a production build bakes the one of its build, the dev server
 * works it out again on every load of the page (the commit now, the time of the load), so a stamp
 * on a phone's error box is never the server's start.
 */
function buildStampInHtml(stamp: () => string): Plugin {
  return {
    name: 'build-stamp-in-html',
    transformIndexHtml: (html) => html.replaceAll('%BUILD_STAMP%', stamp()),
  };
}

export default defineConfig(({ command, mode }) => {
  const devServer = command === 'serve' && mode !== 'test';
  // `vite build --mode internal`: the internal build of the apps (debug menu, URL debug parameters,
  // `src/util/build-kind.ts`). Vite reads VITE_ variables of the environment after this function.
  if (mode === 'internal') process.env.VITE_INTERNAL_BUILD = '1';
  const buildHash = gitHash();
  const buildTime = formatBuildTime(new Date());
  return {
    // Relative base so the build also works from the Capacitor webview.
    base: './',
    define: {
      __APP_VERSION__: JSON.stringify(packageVersion()),
      __BUILD_HASH__: JSON.stringify(buildHash),
      __BUILD_TIME__: JSON.stringify(buildTime),
      __FIREBASE_IOS__: JSON.stringify(hasFile(FIREBASE_FILES.ios)),
      __FIREBASE_ANDROID__: JSON.stringify(hasFile(FIREBASE_FILES.android)),
    },
    plugins: [
      buildStampInHtml(
        devServer
          ? () => `${formatBuildStamp(gitHash(), formatBuildTime(new Date()))} (page load)`
          : () => formatBuildStamp(buildHash, buildTime),
      ),
      ...(devServer ? [leanDevPhaser(), restartOnPackageJson(), noStoreGameFiles()] : []),
    ],
    resolve: devServer ? { alias: [{ find: /^phaser$/, replacement: PHASER_MIN }] } : {},
    optimizeDeps: devServer ? { exclude: ['phaser'] } : {},
    build: {
      target: 'es2022',
      chunkSizeWarningLimit: 2000,
    },
    test: {
      environment: 'node',
      include: ['src/**/*.test.ts', 'scripts/**/*.test.ts'],
      coverage: {
        provider: 'v8',
        include: ['src/core/**/*.ts'],
        reporter: ['text'],
        thresholds: { lines: 85 },
      },
    },
  };
});

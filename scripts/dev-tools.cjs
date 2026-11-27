/* global process, fetch, setTimeout, require, __dirname, module */
/*
 * Shared plumbing of the browser scripts (soak:auto, store:shots): command line options, a vite
 * dev server of its own on a free port, and where Playwright is.
 */
/* eslint-disable @typescript-eslint/no-require-imports */
const { spawn, spawnSync } = require('node:child_process');
const { existsSync, readdirSync, readFileSync } = require('node:fs');
const { createServer } = require('node:net');
const { join } = require('node:path');

const SERVER_WAIT_MS = 60_000;

/** `--name value` and `--name=value` options (only names in `withValue` take a value), plus the plain arguments that are not an option's value; a flag without a value is `true`. */
function parseArgs(argv, withValue) {
  const options = {};
  const positional = [];
  for (let i = 0; i < argv.length; i++) {
    const item = argv[i];
    const match = /^--([^=]+)(?:=(.*))?$/.exec(item);
    if (!match) {
      positional.push(item);
    } else if (withValue.includes(match[1])) {
      const next = argv[i + 1];
      if (match[2] !== undefined) options[match[1]] = match[2];
      else if (next !== undefined && !next.startsWith('--')) {
        options[match[1]] = next;
        i++;
      }
    } else {
      options[match[1]] = match[2] ?? true;
    }
  }
  return { options, positional };
}

function freePort() {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.once('error', reject);
    server.listen(0, () => {
      const address = server.address();
      const port = typeof address === 'object' && address ? address.port : 0;
      server.close(() => resolve(port));
    });
  });
}

/** Starts vite of this repository on a free port; resolves to its address and a `stop()` that kills it. */
async function startVite() {
  const port = await freePort();
  // No shell: `child.pid` is vite itself. On Windows the tree is killed by taskkill, elsewhere
  // vite leads its own process group (detached) and the whole group gets the signal.
  const vite = join(__dirname, '..', 'node_modules', 'vite', 'bin', 'vite.js');
  const child = spawn(process.execPath, [vite, '--port', String(port), '--strictPort'], {
    stdio: 'ignore',
    detached: process.platform !== 'win32',
  });
  let exited = false;
  child.once('exit', () => {
    exited = true;
  });
  const stop = () => {
    if (child.pid === undefined || exited) return;
    if (process.platform === 'win32')
      spawnSync('taskkill', ['/PID', String(child.pid), '/T', '/F']);
    else {
      try {
        process.kill(-child.pid);
      } catch {
        /* already gone */
      }
    }
  };
  const url = `http://localhost:${port}/`;
  const until = Date.now() + SERVER_WAIT_MS;
  while (Date.now() < until && !exited) {
    try {
      if ((await fetch(url)).ok) return { url, stop };
    } catch {
      /* not up yet */
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  stop();
  throw new Error('vite did not start');
}

/**
 * The Playwright package directory: `given` (an option), else PLAYWRIGHT_PATH, else the newest copy
 * npx keeps in its cache (`npx playwright ...` puts it there) whose Chromium is installed, else null.
 */
function findPlaywright(given) {
  if (given) return given;
  if (process.env.PLAYWRIGHT_PATH) return process.env.PLAYWRIGHT_PATH;
  const cache = process.env.LOCALAPPDATA
    ? join(process.env.LOCALAPPDATA, 'npm-cache', '_npx')
    : join(process.env.HOME || '', '.npm', '_npx');
  if (!existsSync(cache)) return null;
  // Several cached copies: the newest one that can start a browser.
  const found = [];
  for (const entry of readdirSync(cache)) {
    const dir = join(cache, entry, 'node_modules', 'playwright');
    const manifest = join(dir, 'package.json');
    if (!existsSync(manifest)) continue;
    const { version } = JSON.parse(readFileSync(manifest, 'utf8'));
    found.push({
      dir,
      version: String(version)
        .split('.')
        .map((part) => parseInt(part, 10) || 0),
    });
  }
  const newer = (a, b) => {
    for (let i = 0; i < 3; i++) if ((a[i] ?? 0) !== (b[i] ?? 0)) return (b[i] ?? 0) - (a[i] ?? 0);
    return 0;
  };
  found.sort((a, b) => newer(a.version, b.version));
  return found.find((copy) => hasChromium(copy.dir))?.dir ?? null;
}

/** The Playwright copy has its Chromium downloaded (`npx playwright install` puts it per version). */
function hasChromium(dir) {
  try {
    return existsSync(require(dir).chromium.executablePath());
  } catch {
    return false;
  }
}

/**
 * Chromium flags that put the game on the real GPU of this computer: the software GL drops
 * triangles of rotated pictures. The ANGLE backend is named per system (Direct3D on Windows,
 * Metal on macOS); elsewhere Chromium picks its own.
 */
function gpuArgs() {
  const backend = { win32: 'd3d11', darwin: 'metal' }[process.platform];
  return [...(backend ? [`--use-angle=${backend}`] : []), '--ignore-gpu-blocklist'];
}

module.exports = { parseArgs, freePort, startVite, findPlaywright, gpuArgs };

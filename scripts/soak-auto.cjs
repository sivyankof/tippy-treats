/* global process, console, fetch, setTimeout, require, __dirname */
/*
 * End-of-session soak: picks the level from the files changed since --base (default origin/master)
 * plus uncommitted files, runs scripts/soak-check.cjs accordingly and prints ONE final line.
 *
 *   PLAYWRIGHT_PATH=<playwright package dir> npm run soak:auto -- [--base <ref>] [--url <dev>]
 *     [--playwright <dir>] [--minutes 5]
 *
 * Without --url it starts its own vite on a free port. See docs/08-architecture.md, section 9.
 */
/* eslint-disable @typescript-eslint/no-require-imports */
const { spawn, spawnSync } = require('node:child_process');
const { createServer } = require('node:net');
const { join } = require('node:path');
const { pickSoakLevel } = require('./soak-level.cjs');

const DEFAULT_MINUTES = 5;
const SERVER_WAIT_MS = 60_000;

const OPTIONS_WITH_VALUE = ['base', 'url', 'playwright', 'minutes'];

/** `--name value` and `--name=value` options, plus the plain arguments that are not an option's value. */
function parseArgs(argv) {
  const options = {};
  const positional = [];
  for (let i = 0; i < argv.length; i++) {
    const item = argv[i];
    const match = /^--([^=]+)(?:=(.*))?$/.exec(item);
    if (!match) {
      positional.push(item);
    } else if (OPTIONS_WITH_VALUE.includes(match[1])) {
      const next = argv[i + 1];
      if (match[2] !== undefined) options[match[1]] = match[2];
      else if (next !== undefined && !next.startsWith('--')) {
        options[match[1]] = next;
        i++;
      }
    }
  }
  return { options, positional };
}

const { options: opts, positional: positionals } = parseArgs(process.argv.slice(2));
const arg = (name) => opts[name];

/** A failed run: reported as the final line and the exit code, after the cleanup has run. */
class Failure extends Error {}

function fail(message) {
  throw new Failure(message);
}

function git(args) {
  const out = spawnSync('git', args, { encoding: 'utf8' });
  if (out.status !== 0) throw new Error(`git ${args.join(' ')} failed: ${out.stderr}`);
  return out.stdout;
}

function changedFiles(base) {
  const committed = git(['diff', '--name-only', `${base}...HEAD`]).split('\n');
  // `-z` entries are "XY path" separated by NUL, unquoted; a rename or copy is followed by an
  // extra entry holding the old path. `-uall` lists the files of untracked directories.
  const entries = git(['status', '--porcelain', '-uall', '-z']).split('\0');
  const dirty = [];
  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];
    if (entry.length < 4) continue;
    dirty.push(entry.slice(3));
    if (/[RC]/.test(entry.slice(0, 2)) && entries[i + 1]) dirty.push(entries[++i]);
  }
  return [...new Set([...committed, ...dirty].filter((f) => f !== ''))];
}

/** The ref as a commit, or a clear failure. */
function checkedBase(ref) {
  const out = spawnSync('git', ['rev-parse', '--verify', '--quiet', `${ref}^{commit}`], {
    encoding: 'utf8',
  });
  if (out.status !== 0) fail(`--base ${ref} is not a commit of this repository`);
  return ref;
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

function runCheck(url, extra, env) {
  const out = spawnSync('node', ['scripts/soak-check.cjs', '--url', url, ...extra], {
    encoding: 'utf8',
    env,
  });
  const text = `${out.stdout}${out.stderr}`;
  process.stdout.write(text);
  return { code: out.status ?? 1, out: text };
}

async function main() {
  // npm swallows a flag given without the `--` separator and exposes it as npm_config_base.
  // Without the separator it arrives as npm_config_base=true plus the ref as a plain argument.
  // Preferred form: `npm run soak:auto -- --base <ref>` (npm then prints no "Unknown cli config").
  const fromNpm = process.env.npm_config_base;
  const positional = positionals[0];
  const base = checkedBase(
    arg('base') ?? (fromNpm === 'true' ? positional : fromNpm) ?? positional ?? 'origin/master',
  );
  const minutes = Number(arg('minutes') ?? DEFAULT_MINUTES);
  const choice = pickSoakLevel(changedFiles(base));
  const shown =
    choice.triggers.slice(0, 5).join(', ') + (choice.triggers.length > 5 ? ', ...' : '');
  console.log(`soak:auto: base ${base}, level ${choice.level}`);
  if (choice.level === 'none') {
    console.log('soak:auto: none (only docs, texts, data, scripts or tests changed) — nothing run');
    return;
  }
  console.log(`soak:auto: triggered by ${choice.triggers.join(', ')}`);

  const env = { ...process.env };
  const playwright = arg('playwright');
  if (playwright) env.PLAYWRIGHT_PATH = playwright;
  if (!env.PLAYWRIGHT_PATH) fail('needs PLAYWRIGHT_PATH or --playwright <playwright package dir>');

  const given = arg('url');
  const server = given ? { url: given, stop: () => {} } : await startVite();
  try {
    const smoke = runCheck(server.url, ['--smoke'], env);
    const line = smoke.out.split('\n').find((l) => l.startsWith('smoke:')) ?? 'smoke: no result';
    // soak-check exits non-zero on any message, unfinished step or unequal count.
    if (smoke.code !== 0) fail(line);
    const messages = /(\d+) messages/.exec(line)?.[1] ?? '?';
    const number = (name) => new RegExp(name + ' ([0-9]+)=[0-9]+').exec(line)?.[1] ?? '?';
    const counts = `objects ${number('objects')}, listeners ${number('listeners')}, tweens ${number('tweens')} unchanged`;
    let tail = '';
    if (choice.level === 'smoke+5min') {
      const soak = runCheck(server.url, ['--minutes', String(minutes), '--rich'], env);
      const runs = /runs (\d+)/.exec(soak.out)?.[1] ?? '?';
      const problems = /console errors and warnings: (\d+)/.exec(soak.out)?.[1] ?? '?';
      if (soak.code !== 0) fail(`soak ${minutes} min, runs ${runs}, ${problems} messages`);
      tail = `, soak ${minutes} min ${runs} runs ${problems} messages`;
    }
    console.log(
      `soak:auto: ${choice.level} ok (${shown}) — smoke ${messages} messages, ${counts}${tail}`,
    );
  } finally {
    server.stop();
  }
}

main().catch((error) => {
  console.log(`soak:auto: FAIL ${error instanceof Failure ? error.message : String(error)}`);
  process.exitCode = 1;
});

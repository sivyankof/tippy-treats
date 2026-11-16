/* global process, console, fetch, setTimeout, require */
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
const { pickSoakLevel } = require('./soak-level.cjs');

const DEFAULT_MINUTES = 5;
const SERVER_WAIT_MS = 60_000;

function arg(name) {
  const i = process.argv.indexOf(`--${name}`);
  const next = i < 0 ? undefined : process.argv[i + 1];
  return next === undefined || next.startsWith('--') ? undefined : next;
}

function git(args) {
  const out = spawnSync('git', args, { encoding: 'utf8' });
  if (out.status !== 0) throw new Error(`git ${args.join(' ')} failed: ${out.stderr}`);
  return out.stdout;
}

function changedFiles(base) {
  const committed = git(['diff', '--name-only', `${base}...HEAD`]).split('\n');
  // `--porcelain` lines are "XY path" (or "XY old -> new").
  const dirty = git(['status', '--porcelain'])
    .split('\n')
    .filter((line) => line !== '')
    .map((line) => line.slice(3).split(' -> ').pop() ?? '');
  return [...new Set([...committed, ...dirty].filter((f) => f !== ''))];
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
  const child = spawn('npx', ['vite', '--port', String(port), '--strictPort'], {
    stdio: 'ignore',
    shell: true,
  });
  const stop = () => {
    if (child.pid === undefined) return;
    if (process.platform === 'win32')
      spawnSync('taskkill', ['/PID', String(child.pid), '/T', '/F']);
    else child.kill();
  };
  const url = `http://localhost:${port}/`;
  const until = Date.now() + SERVER_WAIT_MS;
  while (Date.now() < until) {
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

function fail(message) {
  console.log(`soak:auto: FAIL ${message}`);
  process.exit(1);
}

async function main() {
  // npm swallows a flag given without the `--` separator and exposes it as npm_config_base.
  // Without the separator it arrives as npm_config_base=true plus the ref as a plain argument.
  const fromNpm = process.env.npm_config_base;
  const positional = process.argv.slice(2).find((a) => !a.startsWith('--'));
  const base =
    arg('base') ?? (fromNpm === 'true' ? positional : fromNpm) ?? positional ?? 'origin/master';
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
    if (smoke.code !== 0) fail(`${line}`);
    const counts = /objects (\d+)=\1/.test(line)
      ? 'object counts unchanged'
      : 'object counts CHANGED';
    const messages = /(\d+) messages/.exec(line)?.[1] ?? '?';
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

main().catch((error) => fail(String(error)));

// Publishes the game's site: copies site/ of this repository into site/ of the public repository
// whose GitHub Pages serve SITE.base (sivyankof/tippy-treats-site) and pushes; its Pages workflow
// then serves the pages (docs/11-release-store.md, section 9).
//
//   node scripts/site/publish-site.cjs [--dry-run] [--effective-date 2026-11-20 | --keep-date]
//
// Everything comes from the HEAD commit, never from uncommitted edits: the files of site/ (the git
// blobs; images byte for byte) and src/data/app/site.ts (the support address and the address of the
// site, which names the public repository). Uncommitted edits of either stop the script.
// site/README.md (internal notes) stays here. [SUPPORT_EMAIL] gets SITE.supportEmail, the empty
// <time data-effective> the effective date: the first publication takes today's local date, later
// ones the published date; a changed text of the policy or the terms needs --effective-date (or
// --keep-date for a correction that keeps the date). The guard (site-guard.cjs) stops the
// publication before the commit on any placeholder left, any e-mail address but the support one, or
// anything like a phone number. The public commit is signed with the GitHub noreply address: its
// author is public, a personal address has no place there. After the push the script waits for the
// Pages deploy of that commit (with the GitHub CLI `gh`), runs a failed deploy again (up to
// DEPLOY_TRIES in all: GitHub's artifact list may lag behind the upload), then checks the live
// privacy page for the effective date and the support address.
'use strict';
/* global process, console, require, __dirname, fetch, setTimeout */
/* eslint-disable @typescript-eslint/no-require-imports */
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const guard = require('./site-guard.cjs');

const AUTHOR_NAME = 'sivyankof';
const AUTHOR_EMAIL = '49230480+sivyankof@users.noreply.github.com';
const ROOT = path.resolve(__dirname, '..', '..');
const SITE_SOURCE = 'src/data/app/site.ts';
const MAX_OUTPUT_BYTES = 64 * 1024 * 1024;
/** Deploy attempts in all (the first one and the reruns of a failed one). */
const DEPLOY_TRIES = 3;
/** How long the deploy run may take to show up after the push, and the live page to update, ms. */
const RUN_APPEAR_MS = 90_000;
const LIVE_WAIT_MS = 180_000;
const POLL_MS = 5_000;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** Runs the GitHub CLI; null when it is missing or fails (the caller then says what to do by hand). */
function gh(args) {
  const done = spawnSync('gh', args, { encoding: 'utf8' });
  return done.status === 0 ? done.stdout : null;
}

/** The id of the Pages deploy run of `sha`, once it shows up; null when it never does. */
async function deployRun(slug, sha) {
  const until = Date.now() + RUN_APPEAR_MS;
  while (Date.now() < until) {
    const out = gh([
      'run',
      'list',
      '-R',
      slug,
      '--workflow',
      'pages.yml',
      '--commit',
      sha,
      '--json',
      'databaseId',
      '--jq',
      '.[0].databaseId',
    ]);
    if (out && out.trim()) return out.trim();
    await sleep(POLL_MS);
  }
  return null;
}

/** Status, conclusion and attempt of a run; null when gh cannot tell. */
function runState(slug, id) {
  const out = gh(['run', 'view', id, '-R', slug, '--json', 'status,conclusion,attempt']);
  try {
    return out ? JSON.parse(out) : null;
  } catch {
    return null;
  }
}

/** After a rerun: waits until GitHub shows the new attempt (or the run is no longer completed). */
async function newAttempt(slug, id, before) {
  const until = Date.now() + RUN_APPEAR_MS;
  while (Date.now() < until) {
    const state = runState(slug, id);
    if (state && (state.attempt > before || state.status !== 'completed')) return true;
    await sleep(POLL_MS);
  }
  return false;
}

/**
 * Waits for the deploy of `sha` and runs it again while it fails; true once it succeeded. A watch
 * that ends without the run being over (the network dropped) is only watched again: a rerun is
 * sent only for a run that completed with a failure.
 */
async function waitForDeploy(slug, sha) {
  const id = await deployRun(slug, sha);
  if (!id) return false;
  let reruns = 0;
  for (;;) {
    spawnSync('gh', ['run', 'watch', id, '-R', slug, '-i', '5'], { stdio: 'inherit' });
    const state = runState(slug, id);
    if (!state) return false;
    if (state.status !== 'completed') continue;
    if (state.conclusion === 'success') {
      console.log(`Pages deploy ${id} succeeded (attempt ${state.attempt}).`);
      return true;
    }
    if (reruns + 1 >= DEPLOY_TRIES) return false;
    reruns += 1;
    console.log(
      `Pages deploy ${id} ended ${state.conclusion} (attempt ${state.attempt}), running it again.`,
    );
    if (gh(['run', 'rerun', id, '-R', slug, '--failed']) === null) return false;
    if (!(await newAttempt(slug, id, state.attempt))) return false;
  }
}

/**
 * Every published text file is served as it was pushed. A query unique to this publication keeps
 * the Pages CDN from answering with a copy it cached before.
 */
async function liveCheck(base, files, pushed) {
  const until = Date.now() + LIVE_WAIT_MS;
  let waiting = Object.keys(files);
  while (Date.now() < until && waiting.length > 0) {
    const still = [];
    for (const name of waiting) {
      const url = `${base}${name.slice('site/'.length)}?publish=${pushed}`;
      try {
        const response = await fetch(url, { cache: 'no-store' });
        if (!response.ok || (await response.text()) !== files[name]) still.push(name);
      } catch {
        still.push(name);
      }
    }
    waiting = still;
    if (waiting.length > 0) await sleep(POLL_MS);
  }
  return waiting;
}

/** Runs git; its output as bytes. A non-zero exit throws with git's message. */
function gitBytes(args, cwd = ROOT) {
  const done = spawnSync('git', args, { cwd, maxBuffer: MAX_OUTPUT_BYTES });
  if (done.status !== 0) {
    throw new Error(`git ${args.join(' ')}: ${(done.stderr || '').toString().trim()}`);
  }
  return done.stdout;
}

const git = (args, cwd) => gitBytes(args, cwd).toString('utf8');

function parseArgs(argv) {
  const args = { dryRun: false, date: null, keepDate: false };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--dry-run') args.dryRun = true;
    else if (argv[i] === '--effective-date') args.date = argv[++i] ?? '';
    else if (argv[i] === '--keep-date') args.keepDate = true;
    else throw new Error(`unknown argument: ${argv[i]}`);
  }
  return args;
}

/** The files of site/ in HEAD that are published: text files as strings, others as bytes. */
function siteFiles() {
  const names = guard.publishable(
    git(['ls-tree', '-r', '-z', '--name-only', 'HEAD', 'site']).split('\0').filter(Boolean),
  );
  if (names.length === 0) throw new Error('no files of site/ in HEAD');
  const text = {};
  const binary = {};
  for (const name of names) {
    const bytes = gitBytes(['show', `HEAD:${name}`]);
    if (guard.isText(name)) text[name] = bytes.toString('utf8');
    else binary[name] = bytes;
  }
  return { text, binary };
}

/** Today's date where the owner is (not UTC). */
function localToday() {
  const now = new Date();
  const two = (n) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${two(now.getMonth() + 1)}-${two(now.getDate())}`;
}

/** The published text files of the legal pages, path -> text (missing ones left out). */
function publishedLegal(work) {
  const out = {};
  for (const name of guard.LEGAL_PAGES) {
    const file = path.join(work, name);
    if (fs.existsSync(file)) out[name] = fs.readFileSync(file, 'utf8');
  }
  return out;
}

/** The effective date to publish with (see the header); throws when it cannot be decided safely. */
function effectiveDate(args, files, email, published) {
  if (args.date !== null) return { date: args.date, note: 'given' };
  const policy = published['site/privacy.html'];
  if (policy === undefined) return { date: localToday(), note: 'first publication' };
  const date = guard.publishedDate(policy);
  if (!date)
    throw new Error('the published privacy.html has no effective date: give --effective-date');
  const changed = guard.changedLegal(guard.fillSite(files, { email, date }), published);
  if (changed.length > 0 && !args.keepDate) {
    throw new Error(
      `the text of ${changed.join(', ')} changed: give --effective-date YYYY-MM-DD ` +
        '(or --keep-date for a correction that keeps the date)',
    );
  }
  return { date, note: changed.length > 0 ? 'kept for a correction' : 'published' };
}

function removeQuietly(dir) {
  try {
    fs.rmSync(dir, { recursive: true, force: true });
  } catch (error) {
    console.warn(`Could not remove ${dir}: ${error instanceof Error ? error.message : error}`);
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const dirty = git(['status', '--porcelain', '--', 'site', SITE_SOURCE]).trim();
  if (dirty) throw new Error(`uncommitted edits, commit them first:\n${dirty}`);
  const siteSource = git(['show', `HEAD:${SITE_SOURCE}`]);
  const email = guard.readSupportEmail(siteSource);
  const repo = guard.repoOfBase(guard.readField(siteSource, 'base'));
  const sourceSha = git(['rev-parse', '--short', 'HEAD']).trim();
  const { text, binary } = siteFiles();
  const work = fs.mkdtempSync(path.join(os.tmpdir(), 'tippy-site-'));
  try {
    git(['clone', '--quiet', '--depth', '1', repo, work]);
    const { date, note } = effectiveDate(args, text, email, publishedLegal(work));
    const files = guard.fillSite(text, { email, date });

    fs.rmSync(path.join(work, 'site'), { recursive: true, force: true });
    for (const [name, content] of [...Object.entries(files), ...Object.entries(binary)]) {
      const target = path.join(work, name);
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.writeFileSync(target, content);
    }
    git(['add', '--all', 'site'], work);
    const changed = git(['status', '--porcelain', '--', 'site'], work).trim();
    console.log(`Source ${sourceSha}, ${repo}, effective date ${date} (${note}).`);
    console.log(
      changed
        ? `Changes against the published site:\n${changed}`
        : 'The published site is the same.',
    );

    const problems = guard.findProblems(files, email);
    if (problems.length > 0) {
      throw new Error(`Publication stopped by the guard:\n${problems.join('\n')}`);
    }
    if (!changed) return;
    if (args.dryRun) {
      console.log('Dry run: nothing pushed.');
      return;
    }
    // The deploy is waited for with the GitHub CLI: without it, stop before anything is pushed.
    if (gh(['auth', 'status']) === null) {
      throw new Error(
        'The GitHub CLI (gh) is missing or not logged in: gh auth login, then run again.',
      );
    }
    git(
      [
        '-c',
        `user.name=${AUTHOR_NAME}`,
        '-c',
        `user.email=${AUTHOR_EMAIL}`,
        'commit',
        '--quiet',
        '-m',
        `site: sync with the source (${sourceSha})`,
      ],
      work,
    );
    git(['push', '--quiet', 'origin', 'HEAD:main'], work);
    const pushed = git(['rev-parse', 'HEAD'], work).trim();
    const slug = guard.slugOfRepo(repo);
    console.log(`Pushed ${pushed.slice(0, 7)} to ${slug}; waiting for the Pages deploy.`);
    if (!(await waitForDeploy(slug, pushed))) {
      throw new Error(
        `The Pages deploy did not succeed (or gh is missing): gh run list -R ${slug} -L 1, then gh run rerun <id> -R ${slug} --failed`,
      );
    }
    const base = guard.readField(siteSource, 'base');
    const stale = await liveCheck(base, files, pushed);
    if (stale.length > 0) {
      throw new Error(
        `Deployed, but these pages are not served as pushed yet: ${stale.join(', ')}. Check them by hand.`,
      );
    }
    console.log(`Live: ${base} (effective date ${date}).`);
  } finally {
    removeQuietly(work);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});

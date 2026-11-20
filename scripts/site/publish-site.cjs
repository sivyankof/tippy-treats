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
// author is public, a personal address has no place there.
'use strict';
/* global process, console, require, __dirname */
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

function main() {
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
    console.log(
      'Pushed. Pages deploy in 1-2 minutes: gh run list -R sivyankof/tippy-treats-site -L 1',
    );
  } finally {
    removeQuietly(work);
  }
}

try {
  main();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}

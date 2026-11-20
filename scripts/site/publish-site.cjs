// Publishes the game's site: copies site/ of this repository into site/ of the public repository
// sivyankof/tippy-treats-site and pushes; its GitHub Pages workflow then serves the pages
// (docs/11-release-store.md, section 9).
//
//   node scripts/site/publish-site.cjs [--dry-run] [--effective-date 2026-11-20]
//
// Only the files of site/ in the HEAD commit go out (the git blobs), never uncommitted edits: they
// stop the script. site/README.md (internal notes) stays here. [SUPPORT_EMAIL] gets
// SITE.supportEmail of src/data/app/site.ts, the empty <time data-effective> the effective date
// (the first publication: today; later the published one, unless --effective-date is given). The
// guard (site-guard.cjs) stops the publication before the commit on any placeholder left, any
// e-mail address but the support one, or anything like a phone number. The public commit is signed
// with the GitHub noreply address: its author is public, a personal address has no place there.
'use strict';
/* global process, console, require, __dirname */
/* eslint-disable @typescript-eslint/no-require-imports */
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const guard = require('./site-guard.cjs');

const PUBLIC_REPO = 'https://github.com/sivyankof/tippy-treats-site.git';
const AUTHOR_NAME = 'sivyankof';
const AUTHOR_EMAIL = '49230480+sivyankof@users.noreply.github.com';
const ROOT = path.resolve(__dirname, '..', '..');

function git(args, cwd = ROOT) {
  const done = spawnSync('git', args, { cwd, encoding: 'utf8' });
  if (done.status !== 0) {
    throw new Error(`git ${args.join(' ')}: ${(done.stderr || '').trim()}`);
  }
  return done.stdout;
}

function parseArgs(argv) {
  const args = { dryRun: false, date: null };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--dry-run') args.dryRun = true;
    else if (argv[i] === '--effective-date') args.date = argv[++i] ?? '';
    else throw new Error(`unknown argument: ${argv[i]}`);
  }
  return args;
}

/** The files of site/ in HEAD that are published: path -> text. */
function siteFiles() {
  const names = guard.publishable(
    git(['ls-tree', '-r', '--name-only', 'HEAD', 'site']).split('\n').filter(Boolean),
  );
  if (names.length === 0) throw new Error('no files of site/ in HEAD');
  return Object.fromEntries(names.map((name) => [name, git(['show', `HEAD:${name}`])]));
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const dirty = git(['status', '--porcelain', '--', 'site']).trim();
  if (dirty) throw new Error(`site/ has uncommitted edits, commit them first:\n${dirty}`);
  const email = guard.readSupportEmail(
    fs.readFileSync(path.join(ROOT, 'src', 'data', 'app', 'site.ts'), 'utf8'),
  );
  const sourceSha = git(['rev-parse', '--short', 'HEAD']).trim();
  const work = fs.mkdtempSync(path.join(os.tmpdir(), 'tippy-site-'));
  try {
    git(['clone', '--quiet', '--depth', '1', PUBLIC_REPO, work]);
    const publishedPolicy = path.join(work, 'site', 'privacy.html');
    const published = fs.existsSync(publishedPolicy)
      ? guard.publishedDate(fs.readFileSync(publishedPolicy, 'utf8'))
      : null;
    const date = args.date ?? published ?? today();
    const files = guard.fillSite(siteFiles(), { email, date });

    fs.rmSync(path.join(work, 'site'), { recursive: true, force: true });
    for (const [name, text] of Object.entries(files)) {
      const target = path.join(work, name);
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.writeFileSync(target, text);
    }
    git(['add', '--all', 'site'], work);
    const changed = git(['status', '--porcelain', '--', 'site'], work).trim();
    console.log(
      `Source ${sourceSha}, effective date ${date}${published ? '' : ' (first publication)'}.`,
    );
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
    fs.rmSync(work, { recursive: true, force: true });
  }
}

try {
  main();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}

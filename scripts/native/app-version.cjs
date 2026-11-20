/* global require, module, __dirname, console */
// The version the player sees, in the game and in both stores (docs/11a-device-build.md, section 0).
// `package.json` keeps a semver `version` (1.0.0); the stores get it without a zero patch (1.0),
// because the build attaches to the App Store Connect version whose number it carries exactly.
//   node scripts/native/app-version.cjs   → prints the version of this repository
'use strict';
/* eslint-disable @typescript-eslint/no-require-imports */

const fs = require('node:fs');
const path = require('node:path');

/** `1.0.0` → `1.0`, `1.2.0` → `1.2`, `1.0.3` → `1.0.3`; throws on anything but three numbers. */
function storeVersion(semver) {
  const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(String(semver).trim());
  if (match === null) throw new Error(`package.json version is not major.minor.patch: ${semver}`);
  const [, major, minor, patch] = match;
  return patch === '0' ? `${major}.${minor}` : `${major}.${minor}.${patch}`;
}

/** The store version of the repository at `repo` (its package.json). */
function appVersion(repo = path.resolve(__dirname, '..', '..')) {
  const pkg = JSON.parse(fs.readFileSync(path.join(repo, 'package.json'), 'utf8'));
  return storeVersion(pkg.version);
}

if (require.main === module) console.log(appVersion());

module.exports = { storeVersion, appVersion };

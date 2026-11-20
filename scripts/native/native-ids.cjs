/* global require, module, __dirname, process, console */
// Writes the AdMob app ids of the native projects from `.env` (docs/11a-device-build.md, "Ключи").
// The ids are never committed: Info.plist reads `$(ADMOB_APP_ID)` from ios/App/ids.xcconfig, which
// includes the git-ignored ios/App/ids.local.xcconfig written here; android/app/build.gradle reads
// the git-ignored android/ids.local.properties. The internal build always gets Google's sample app
// ids (only Google's sample ad units run in it); the store build gets the ids of `.env`, or the
// sample ones when `.env` has none (the store build then shows no ads at all: it has no ad units).
//   node scripts/native/native-ids.cjs [--internal]
// Prints which kind of id each platform got, never the id.
'use strict';
/* eslint-disable @typescript-eslint/no-require-imports */

const fs = require('node:fs');
const path = require('node:path');

/** Google's sample AdMob app ids (developers.google.com/admob, "Enable test ads"). */
const SAMPLE_APP_IDS = {
  ios: 'ca-app-pub-3940256099942544~1458002511',
  android: 'ca-app-pub-3940256099942544~3347511713',
};

const APP_ID = /^ca-app-pub-\d{16}~\d{10}$/;

/** `KEY=value` lines of a `.env` text; quotes around a value are dropped. */
function parseEnv(text) {
  const out = {};
  for (const line of text.split(/\r?\n/)) {
    const match = /^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/.exec(line);
    if (match === null) continue;
    out[match[1]] = match[2].replace(/^(['"])(.*)\1$/, '$2');
  }
  return out;
}

/** The app id of each platform and where it came from. */
function pickAppIds(env, internal) {
  const pick = (value, sample) => {
    const id = typeof value === 'string' ? value.trim() : '';
    if (internal || id === '') return { id: sample, source: 'google sample' };
    if (!APP_ID.test(id))
      throw new Error(
        'an AdMob app id in .env does not look like ca-app-pub-<16 digits>~<10 digits>',
      );
    return { id, source: '.env' };
  };
  return {
    ios: pick(env.VITE_ADMOB_APP_ID_IOS, SAMPLE_APP_IDS.ios),
    android: pick(env.VITE_ADMOB_APP_ID_ANDROID, SAMPLE_APP_IDS.android),
  };
}

function main() {
  const repo = path.resolve(__dirname, '..', '..');
  const internal = process.argv.includes('--internal');
  const envFile = path.join(repo, '.env');
  const env = fs.existsSync(envFile) ? parseEnv(fs.readFileSync(envFile, 'utf8')) : {};
  const ids = pickAppIds(env, internal);
  const note = 'Written by scripts/native/native-ids.cjs from .env. Never commit this file.';
  fs.writeFileSync(
    path.join(repo, 'ios', 'App', 'ids.local.xcconfig'),
    `// ${note}\nADMOB_APP_ID = ${ids.ios.id}\n`,
  );
  fs.writeFileSync(
    path.join(repo, 'android', 'ids.local.properties'),
    `# ${note}\nadmobAppId=${ids.android.id}\n`,
  );
  console.log(
    `native ids (${internal ? 'internal' : 'store'} build): AdMob app id ios ${ids.ios.source}, android ${ids.android.source}`,
  );
}

if (require.main === module) main();

module.exports = { parseEnv, pickAppIds, SAMPLE_APP_IDS };

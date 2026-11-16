/* global module */
/**
 * Picks the level of the end-of-session soak from the files changed over the session
 * (`npm run soak:auto`, docs/08-architecture.md, section 9). Pure: no git, no browser.
 */
/** Changes that need no run: documents, texts, balance data, scripts and tests. */
const NO_RUN_PATTERNS = [
  /^docs\//,
  /\.md$/,
  /^src\/i18n\//,
  /^src\/data\//,
  /^scripts\//,
  /\.test\.ts$/,
];

/** Changes that also need five minutes of random play. */
const DEEP_PATTERNS = [
  /^src\/game\/scenes\//,
  /(^|\/)per-scene[^/]*\.ts$/,
  /(^|\/)run-restart[^/]*\.ts$/,
  /(^|\/)run-exit[^/]*\.ts$/,
  /(^|\/)results-launch[^/]*\.ts$/,
  /(^|\/)scene-keys[^/]*\.ts$/,
  /(^|\/)landing-prep[^/]*\.ts$/,
  /(^|\/)collapse-prep[^/]*\.ts$/,
  /(^|\/)timed-pool[^/]*\.ts$/,
  /(^|\/)tongue[^/]*\.ts$/,
  /(^|\/)lick[^/]*\.ts$/,
  /(^|\/)shared-atlas[^/]*\.ts$/,
  /(^|\/)bake-texture[^/]*\.ts$/,
  /-textures\.ts$/,
  /^src\/core\//,
  /^src\/state\//,
  /^src\/services\/storage\//,
  /(^|\/)fx-guard[^/]*\.ts$/,
];

/**
 * @param {readonly string[]} files
 * @returns {{ level: 'none' | 'smoke' | 'smoke+5min', triggers: string[] }}
 */
function pickSoakLevel(files) {
  const changed = files
    .map((f) => f.split(String.fromCharCode(92)).join('/'))
    .filter((f) => f !== '');
  const code = changed.filter((f) => !NO_RUN_PATTERNS.some((re) => re.test(f)));
  const deep = code.filter((f) => DEEP_PATTERNS.some((re) => re.test(f)));
  if (deep.length > 0) return { level: 'smoke+5min', triggers: deep };
  if (code.length > 0) return { level: 'smoke', triggers: code };
  return { level: 'none', triggers: [] };
}

module.exports = { pickSoakLevel };

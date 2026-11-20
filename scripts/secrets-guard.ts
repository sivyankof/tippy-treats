import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

/**
 * The guard against ad, purchase and analytics keys in the repository (docs/08-architecture.md,
 * section 9). The repository is public: AdMob ids, RevenueCat keys and the Firebase files live only
 * in `.env` and the git-ignored files of the native projects. Google's own sample ad ids are
 * public and allowed: the internal build runs on them.
 */

/** Google's public publisher id of the sample ad units (developers.google.com/admob, "test ads"). */
export const GOOGLE_TEST_PUBLISHER = '3940256099942544';

interface KeyRule {
  name: string;
  pattern: RegExp;
  /** True when a match is fine (a public sample id). */
  allowed?: (match: string) => boolean;
}

const KEY_RULES: readonly KeyRule[] = [
  {
    name: 'AdMob id',
    pattern: /ca-app-pub-\d{16}[~/]\d{10}/g,
    allowed: (match) => match.startsWith(`ca-app-pub-${GOOGLE_TEST_PUBLISHER}`),
  },
  {
    name: 'RevenueCat key',
    pattern: /\b(?:appl|goog|amzn|stripe|rcb|sk|strp)_[A-Za-z0-9]{20,}\b/g,
  },
  { name: 'Google API key', pattern: /\bAIza[0-9A-Za-z_-]{35}\b/g },
  { name: 'Firebase app id', pattern: /\b1:\d{6,}:(?:ios|android|web):[0-9a-f]{8,}\b/g },
];

/** Files that must never be tracked, whatever they hold. */
const FORBIDDEN_NAMES: readonly RegExp[] = [
  /(^|\/)\.env$/,
  /(^|\/)\.env\.(?!example$)[^/]+$/,
  /(^|\/)GoogleService-Info\.plist$/,
  /(^|\/)google-services\.json$/,
  /(^|\/)ids\.local\.(?:xcconfig|properties)$/,
];

/** Binary files are not read: no key is written in a picture or a sound. */
const BINARY =
  /\.(?:png|jpe?g|webp|gif|ico|mp3|ogg|m4a|wav|woff2?|ttf|otf|jar|keystore|zip|aab|apk)$/i;

export interface KeyFinding {
  file: string;
  what: string;
}

/** What one file breaks: its name, or a key in its text. The key itself is never reported. */
export function findKeys(file: string, text: string): KeyFinding[] {
  const found: KeyFinding[] = [];
  if (FORBIDDEN_NAMES.some((rule) => rule.test(file))) found.push({ file, what: 'secret file' });
  for (const rule of KEY_RULES) {
    for (const match of text.matchAll(rule.pattern)) {
      if (rule.allowed?.(match[0]) === true) continue;
      found.push({ file, what: rule.name });
      break;
    }
  }
  return found;
}

/** Every tracked file, as git sees it (staged additions included). */
export function trackedFiles(): string[] {
  return execFileSync('git', ['ls-files', '-z', '--cached'], { encoding: 'utf8' })
    .split('\0')
    .filter((file) => file !== '');
}

/** All findings over the tracked files of the repository. */
export function scanRepository(): KeyFinding[] {
  return trackedFiles().flatMap((file) => {
    if (BINARY.test(file)) return findKeys(file, '');
    let text: string;
    try {
      text = readFileSync(file, 'utf8');
    } catch {
      // Deleted in the working tree but still in the index: nothing to read.
      return findKeys(file, '');
    }
    return findKeys(file, text);
  });
}

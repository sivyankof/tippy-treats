import { describe, expect, it } from 'vitest';
import { findKeys, GOOGLE_TEST_PUBLISHER, scanRepository } from './secrets-guard';

// Sample values are glued from pieces, so this file itself holds no key the guard would see.
const pub = (publisher: string, sep: string): string => `ca-app-pub-${publisher}${sep}1234567890`;
const fakeRevenueCat = ['appl', 'AbCdEfGhIjKlMnOpQrStUv'].join('_');
const fakeGoogleKey = ['AI', 'za', 'Sy0123456789abcdefghijklmnopqrstuvw'].join('');
const fakeFirebaseApp = ['1', '123456789012', 'ios', 'abcdef0123456789'].join(':');

describe('secrets guard', () => {
  it('finds a real AdMob id and lets Google sample ids pass', () => {
    expect(findKeys('a.ts', `id = '${pub('1234567890123456', '~')}'`)).toEqual([
      { file: 'a.ts', what: 'AdMob id' },
    ]);
    expect(findKeys('a.ts', `id = '${pub(GOOGLE_TEST_PUBLISHER, '/')}'`)).toEqual([]);
  });

  it('finds RevenueCat, Google API keys and Firebase app ids', () => {
    expect(findKeys('b.ts', fakeRevenueCat).map((f) => f.what)).toEqual(['RevenueCat key']);
    expect(findKeys('b.ts', fakeGoogleKey).map((f) => f.what)).toEqual(['Google API key']);
    expect(findKeys('b.ts', fakeFirebaseApp).map((f) => f.what)).toEqual(['Firebase app id']);
  });

  it('does not take ordinary words for keys', () => {
    expect(findKeys('c.ts', 'sk_short goog_ appl_store ca-app-pub-123')).toEqual([]);
  });

  it('refuses secret files by their name', () => {
    for (const file of [
      '.env',
      '.env.production',
      'ios/App/App/GoogleService-Info.plist',
      'android/app/google-services.json',
      'ios/App/ids.local.xcconfig',
      'android/ids.local.properties',
    ]) {
      expect(findKeys(file, '')).toEqual([{ file, what: 'secret file' }]);
    }
    expect(findKeys('.env.example', '')).toEqual([]);
  });

  it('the tracked files hold no ad, purchase or analytics key', () => {
    // Names only: the value of a key is never printed.
    expect(scanRepository()).toEqual([]);
  }, 30_000);
});

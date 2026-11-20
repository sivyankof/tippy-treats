import { describe, expect, it } from 'vitest';
import { parseEnv, pickAppIds, SAMPLE_APP_IDS } from './native-ids.cjs';

// A made-up id glued from pieces, so this file holds nothing the secrets guard would see.
const ownId = ['ca-app-pub-', '1'.repeat(16), '~', '2'.repeat(10)].join('');

describe('native ids', () => {
  it('reads KEY=value lines and drops quotes', () => {
    expect(parseEnv('# note\nA=1\r\nB = "two"\nC=\nbad line')).toEqual({ A: '1', B: 'two', C: '' });
  });

  it('gives the internal build Google sample app ids whatever .env says', () => {
    const ids = pickAppIds(
      { VITE_ADMOB_APP_ID_IOS: ownId, VITE_ADMOB_APP_ID_ANDROID: ownId },
      true,
    );
    expect(ids.ios).toEqual({ id: SAMPLE_APP_IDS.ios, source: 'google sample' });
    expect(ids.android).toEqual({ id: SAMPLE_APP_IDS.android, source: 'google sample' });
  });

  it('gives the store build the ids of .env, or the sample ones when there are none', () => {
    const ids = pickAppIds({ VITE_ADMOB_APP_ID_IOS: ownId, VITE_ADMOB_APP_ID_ANDROID: ' ' }, false);
    expect(ids.ios).toEqual({ id: ownId, source: '.env' });
    expect(ids.android).toEqual({ id: SAMPLE_APP_IDS.android, source: 'google sample' });
  });

  it('refuses an id that is not an AdMob app id (an ad unit id, a typo)', () => {
    expect(() => pickAppIds({ VITE_ADMOB_APP_ID_IOS: ownId.replace('~', '/') }, false)).toThrow();
  });
});

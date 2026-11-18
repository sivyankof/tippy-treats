import { describe, expect, it } from 'vitest';
import { MUSIC_PLAYLIST } from '../../../data/music';
import { isAppleTouch, playableTracks, setupAudioSession } from './audio-session';

const IPHONE =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.7 Mobile/15E148 Safari/604.1';
const ANDROID =
  'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Mobile Safari/537.36';
const MAC =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko)';

describe('setupAudioSession', () => {
  it('sets the page session to ambient where the API exists, and keeps the streams', () => {
    const session = { type: 'auto' };
    const info = setupAudioSession({ audioSession: session, userAgent: IPHONE });
    expect(session.type).toBe('ambient');
    expect(info).toEqual({ streams: true, ambient: true });
  });

  it('an iPhone or iPad without the API plays no media elements', () => {
    expect(setupAudioSession({ userAgent: IPHONE })).toEqual({ streams: false, ambient: false });
    const ipad = { userAgent: MAC, platform: 'MacIntel', maxTouchPoints: 5 };
    expect(setupAudioSession(ipad).streams).toBe(false);
  });

  it('Android and desktops are unchanged', () => {
    expect(setupAudioSession({ userAgent: ANDROID })).toEqual({ streams: true, ambient: false });
    const mac = { userAgent: MAC, platform: 'MacIntel', maxTouchPoints: 0 };
    expect(setupAudioSession(mac)).toEqual({ streams: true, ambient: false });
    expect(setupAudioSession(undefined).streams).toBe(true);
  });

  it('an engine that refuses the type counts as one without the API', () => {
    const session = {
      get type(): string {
        return 'auto';
      },
      set type(_value: string) {
        throw new Error('not supported');
      },
    };
    expect(setupAudioSession({ audioSession: session, userAgent: IPHONE }).streams).toBe(false);
  });
});

describe('isAppleTouch', () => {
  it('knows iPhones and touch iPads, not Macs or Android', () => {
    expect(isAppleTouch({ userAgent: IPHONE })).toBe(true);
    expect(isAppleTouch({ userAgent: MAC, platform: 'MacIntel', maxTouchPoints: 5 })).toBe(true);
    expect(isAppleTouch({ userAgent: MAC, platform: 'MacIntel', maxTouchPoints: 0 })).toBe(false);
    expect(isAppleTouch({ userAgent: ANDROID })).toBe(false);
  });
});

describe('playableTracks', () => {
  it('without streams the playlist keeps only the seamless tracks', () => {
    expect(playableTracks(MUSIC_PLAYLIST, true)).toEqual(MUSIC_PLAYLIST);
    expect(playableTracks(MUSIC_PLAYLIST, false)).toEqual(['kitchen', 'roof', 'stars', 'space']);
  });
});

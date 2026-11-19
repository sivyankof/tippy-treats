import { describe, expect, it } from 'vitest';
import { MUSIC_PLAYLIST } from '../../../data/audio/music';
import { playableTracks, setupAudioSession } from './audio-session';

const IPHONE =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.7 Mobile/15E148 Safari/604.1';
const ANDROID =
  'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Mobile Safari/537.36';
const MAC =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko)';

describe('setupAudioSession', () => {
  it('on an iPhone with the API the page session becomes ambient and the streams stay', () => {
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

  it('Android and desktops are left as they are, even with the API', () => {
    const session = { type: 'auto' };
    expect(setupAudioSession({ audioSession: session, userAgent: ANDROID })).toEqual({
      streams: true,
      ambient: false,
    });
    const mac = { audioSession: session, userAgent: MAC, platform: 'MacIntel', maxTouchPoints: 0 };
    expect(setupAudioSession(mac)).toEqual({ streams: true, ambient: false });
    expect(session.type).toBe('auto');
    expect(setupAudioSession(undefined).streams).toBe(true);
  });

  it('an engine that refuses or ignores the type counts as one without the API', () => {
    const refusing = {
      get type(): string {
        return 'auto';
      },
      set type(_value: string) {
        throw new Error('not supported');
      },
    };
    expect(setupAudioSession({ audioSession: refusing, userAgent: IPHONE }).streams).toBe(false);
    const ignoring = {
      get type(): string {
        return 'auto';
      },
      set type(_value: string) {
        // An invalid enum value is dropped without a word.
      },
    };
    expect(setupAudioSession({ audioSession: ignoring, userAgent: IPHONE }).streams).toBe(false);
  });
});

describe('playableTracks', () => {
  it('without streams the playlist keeps only the seamless tracks', () => {
    expect(playableTracks(MUSIC_PLAYLIST, true)).toEqual(MUSIC_PLAYLIST);
    expect(playableTracks(MUSIC_PLAYLIST, false)).toEqual(['kitchen', 'roof', 'stars', 'space']);
  });
});

import { describe, expect, it } from 'vitest';
import { MUSIC_PLAYLIST, MUSIC_TRACKS, type MusicTrackId } from '../../../data/audio/music';
import { MusicPreload, type PreloadDeps } from './music-preload';

function fakeBuffer(track: MusicTrackId): AudioBuffer {
  const spec = MUSIC_TRACKS[track];
  const data = new Float32Array(64);
  return {
    length: spec.frames,
    sampleRate: spec.sampleRate,
    numberOfChannels: 2,
    getChannelData: () => data,
  } as unknown as AudioBuffer;
}

function deps(first: MusicTrackId, extra: Partial<PreloadDeps> = {}) {
  const calls: string[] = [];
  const index = MUSIC_PLAYLIST.indexOf(first);
  const fake: { preload: string; src: string; removeAttribute(): void; load(): void } = {
    preload: '',
    src: '',
    removeAttribute(): void {
      fake.src = '';
    },
    load(): void {},
  };
  const element = fake as unknown as HTMLMediaElement;
  const d: PreloadDeps = {
    random: () => (index + 0.5) / MUSIC_PLAYLIST.length,
    playlist: MUSIC_PLAYLIST,
    url: (track) => `/music/${track}.m4a`,
    decodeOffline: (url, rate) => {
      calls.push(`decode ${url} ${rate}`);
      return Promise.resolve(fakeBuffer(first));
    },
    makeElement: () => {
      calls.push('element');
      return element;
    },
    ...extra,
  };
  return { d, calls, element };
}

describe('MusicPreload', () => {
  it('a seamless first track is fetched and decoded at its own rate, before any tap', async () => {
    const { d, calls } = deps('roof');
    const preload = new MusicPreload(d);
    expect(preload.track).toBe('roof');
    preload.start();
    const taken = preload.takeDecoded();
    expect(taken?.track).toBe('roof');
    const decoded = await taken?.decoded;
    expect(calls).toEqual([`decode /music/roof.m4a ${MUSIC_TRACKS.roof.sampleRate}`]);
    expect(decoded?.bounds).toEqual({ start: 0, end: MUSIC_TRACKS.roof.frames });
    // Taken once.
    expect(preload.takeDecoded()).toBeNull();
  });

  it('a streamed first track gets its element with the file already loading', () => {
    const { d, calls, element } = deps('menu');
    const preload = new MusicPreload(d);
    preload.start();
    expect(calls).toEqual(['element']);
    expect(element.src).toBe('/music/menu.m4a');
    expect(element.preload).toBe('auto');
    expect(preload.takeDecoded()).toBeNull();
    expect(preload.takeElement()).toBe(element);
    expect(preload.takeElement()).toBeNull();
  });

  it('the player gets the same first pick the preload made', () => {
    for (const track of MUSIC_PLAYLIST) {
      const preload = new MusicPreload(deps(track).d);
      expect(MUSIC_PLAYLIST[preload.index]).toBe(track);
    }
  });

  it('a failed load is quiet: the player loads the track itself', async () => {
    const { d } = deps('stars', { decodeOffline: () => Promise.reject(new Error('offline')) });
    const preload = new MusicPreload(d);
    preload.start();
    const taken = preload.takeDecoded();
    await expect(taken?.decoded).rejects.toThrow('offline');
  });

  it('starts once, and lets go of what it readied when the music is switched off', () => {
    const { d, calls } = deps('roof');
    const preload = new MusicPreload(d);
    preload.start();
    preload.start();
    expect(calls).toHaveLength(1);
    preload.release();
    expect(preload.takeDecoded()).toBeNull();
    const stream = deps('menu');
    const streamed = new MusicPreload(stream.d);
    streamed.start();
    streamed.release();
    expect(streamed.takeElement()).toBeNull();
  });

  it('a page with no streams has no element for a streamed track', () => {
    const { d } = deps('menu', { makeElement: () => null });
    const preload = new MusicPreload(d);
    preload.start();
    expect(preload.takeElement()).toBeNull();
  });
});

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MUSIC_PLAYLIST, MUSIC_TRACKS, type MusicTrackId } from '../../../data/audio/music';
import type { MusicHost } from '../music-control';
import { NodeTally } from '../node-tally';
import { MusicPreload } from './music-preload';
import { playlistPlayerFactory } from './playlist-player';

class FakeParam {
  value = 0;
  cancelScheduledValues(): void {}
  setValueAtTime(v: number): void {
    this.value = v;
  }
  linearRampToValueAtTime(v: number): void {
    this.value = v;
  }
}

class FakeNode {
  gain = new FakeParam();
  buffer: AudioBuffer | null = null;
  loop = false;
  loopStart = 0;
  loopEnd = 0;
  onended: (() => void) | null = null;
  connect(): void {}
  disconnect(): void {}
  start(): void {}
  stop(): void {}
}

/** A context with what the player and a buffer deck touch, and a decoder that makes a fake buffer. */
function fakeContext() {
  const rate = 48_000;
  return {
    currentTime: 0,
    sampleRate: rate,
    state: 'running',
    sources: 0,
    createGain: () => new FakeNode(),
    createBufferSource() {
      this.sources += 1;
      return new FakeNode();
    },
    decodeAudioData: () => {
      const spec = MUSIC_TRACKS[firstSeamless];
      const data = new Float32Array(64);
      return Promise.resolve({
        length: Math.round((spec.frames * rate) / spec.sampleRate),
        sampleRate: rate,
        numberOfChannels: 2,
        getChannelData: () => data,
      } as unknown as AudioBuffer);
    },
  };
}

const firstSeamless: MusicTrackId =
  MUSIC_PLAYLIST.find((t) => MUSIC_TRACKS[t].loop === 'seamless') ?? 'kitchen';

describe('the playlist in the iOS app, where track files come with status 0', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('a seamless first track is decoded and plays', async () => {
    // Capacitor's file scheme answers a whole .m4a with a plain URL response: no HTTP status.
    const fetched: string[] = [];
    vi.stubGlobal('fetch', (url: string) => {
      fetched.push(url);
      return Promise.resolve({
        ok: false,
        status: 0,
        type: 'basic',
        arrayBuffer: () => Promise.resolve(new ArrayBuffer(8)),
      });
    });
    const index = MUSIC_PLAYLIST.indexOf(firstSeamless);
    const preload = new MusicPreload({
      random: () => (index + 0.5) / MUSIC_PLAYLIST.length,
      playlist: MUSIC_PLAYLIST,
      url: () => null,
      decodeOffline: () => Promise.reject(new Error('unused')),
      makeElement: () => null,
    });
    const ctx = fakeContext();
    const host: MusicHost = {
      ctx: ctx as unknown as BaseAudioContext,
      bus: new FakeNode() as unknown as GainNode,
      tally: new NodeTally(),
    };
    const player = playlistPlayerFactory({
      playlist: MUSIC_PLAYLIST,
      streams: false,
      preload,
      bless: false,
    })(host);
    player.playlist();
    await vi.advanceTimersByTimeAsync(50);
    expect(fetched).toHaveLength(1);
    expect(player.state()).toMatchObject({ track: firstSeamless, decks: 1, loading: false });
    expect(ctx.sources).toBeGreaterThan(0);
  });
});

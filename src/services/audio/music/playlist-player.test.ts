import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MUSIC, MUSIC_TRACKS, type MusicTrackId } from '../../../data/music';
import type { MusicHost } from '../music-control';
import { NodeTally } from '../node-tally';
import {
  PlaylistPlayer,
  trackLevel,
  type OpeningDeck,
  type PlayerSources,
} from './playlist-player';
import type { DeckClock } from './tune-deck';
import { decodedBytes } from './tune-loop';

const RATE = 48_000;

/** An `AudioParam` that follows its last scheduled value (enough for the levels the player sets). */
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
  connected = 0;
  connect(): void {
    this.connected++;
  }
  disconnect(): void {
    this.connected = 0;
  }
}

class FakeGain extends FakeNode {
  gain = new FakeParam();
}

class FakeSource extends FakeNode {
  buffer: unknown = null;
  loop = false;
  loopStart = 0;
  loopEnd = 0;
  onended: ((event: Event) => void) | null = null;
  stoppedAt: number | null = null;
  start(): void {}
  stop(when = 0): void {
    this.stoppedAt = when;
  }
}

class FakeContext {
  currentTime = 0;
  sampleRate = RATE;
  sources: FakeSource[] = [];
  createGain(): FakeGain {
    return new FakeGain();
  }
  createBufferSource(): FakeSource {
    const s = new FakeSource();
    this.sources.push(s);
    return s;
  }
}

function fakeBuffer(track: MusicTrackId) {
  const spec = MUSIC_TRACKS[track];
  const length = Math.round((spec.frames * RATE) / spec.sampleRate);
  const data = new Float32Array(64);
  return {
    length,
    sampleRate: RATE,
    numberOfChannels: 2,
    getChannelData: () => data,
  } as unknown as AudioBuffer;
}

/** A stream deck that plays as soon as it is started. */
class FakeStream implements OpeningDeck {
  readonly gain = new FakeGain() as unknown as GainNode;
  readonly bytes = 0;
  held = false;
  disposed = false;
  constructor(readonly track: MusicTrackId) {}
  start(): Promise<void> {
    return Promise.resolve();
  }
  hold(on: boolean): void {
    this.held = on;
  }
  dispose(): void {
    this.disposed = true;
  }
}

function setup() {
  const ctx = new FakeContext();
  const bus = new FakeGain();
  const playing: boolean[] = [];
  const host: MusicHost = {
    ctx: ctx as unknown as BaseAudioContext,
    bus: bus as unknown as GainNode,
    tally: new NodeTally(),
    onPlaying: (on) => playing.push(on),
  };
  const clock: DeckClock = {
    get currentTime() {
      return ctx.currentTime;
    },
    setTimeout: (call, ms) => setTimeout(call, ms),
    clearTimeout: (id) => clearTimeout(id as ReturnType<typeof setTimeout>),
  };
  const decodes: MusicTrackId[] = [];
  const streams: FakeStream[] = [];
  const sources: PlayerSources = {
    clock,
    decode: (track) => {
      decodes.push(track);
      return Promise.resolve(fakeBuffer(track));
    },
    openStream: (track) => {
      const deck = new FakeStream(track);
      streams.push(deck);
      return deck;
    },
  };
  const player = new PlaylistPlayer(host, sources);
  /** Moves the context and the timers on together, and lets promises settle. */
  const advance = async (sec: number): Promise<void> => {
    const step = 0.05;
    for (let t = 0; t < sec - 1e-9; t += step) {
      ctx.currentTime += step;
      await vi.advanceTimersByTimeAsync(step * 1000);
    }
  };
  return { ctx, player, decodes, streams, playing, advance };
}

describe('PlaylistPlayer', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('streams the long tracks and decodes the seamless ones', async () => {
    const { player, decodes, streams, advance, playing } = setup();
    player.play('menu');
    await advance(0.1);
    expect(streams.map((s) => s.track)).toEqual(['menu']);
    expect(decodes).toEqual([]);
    player.play('kitchen');
    await advance(0.1);
    expect(decodes).toEqual(['kitchen']);
    expect(player.state().track).toBe('kitchen');
    expect(playing).toEqual([true, true]);
  });

  it('fades the new track to its level and lets the old one go after the change', async () => {
    const { player, streams, advance } = setup();
    player.play('menu');
    await advance(0.1);
    const menu = streams[0];
    expect((menu?.gain.gain as unknown as FakeParam).value).toBeCloseTo(trackLevel('menu'));
    player.play('kitchen');
    await advance(0.1);
    expect(player.state().decks).toBe(2);
    expect((menu?.gain.gain as unknown as FakeParam).value).toBe(0);
    await advance(MUSIC.crossfadeSec + 0.2);
    expect(player.state().decks).toBe(1);
    expect(menu?.disposed).toBe(true);
  });

  it('never has a third track sounding, however fast the changes come', async () => {
    const { player, advance } = setup();
    const order: MusicTrackId[] = [
      'menu',
      'kitchen',
      'showcase',
      'roof',
      'stars',
      'space',
      'menu',
      'daily',
      'record',
      'menu',
    ];
    for (const gap of [0, 0.05, 0.3, 1, 2]) {
      for (const track of order) {
        player.play(track);
        expect(player.state().decks).toBeLessThanOrEqual(2);
        await advance(gap);
        expect(player.state().decks).toBeLessThanOrEqual(2);
      }
      await advance(MUSIC.crossfadeSec + 1);
      expect(player.state().decks).toBe(1);
      expect(player.state().track).toBe('menu');
    }
  });

  it('a track asked again while it leaves comes back without a new load', async () => {
    const { player, decodes, advance } = setup();
    player.play('kitchen');
    await advance(0.1);
    player.play('roof');
    await advance(0.5);
    player.play('kitchen');
    await advance(0.1);
    expect(decodes).toEqual(['kitchen', 'roof']);
    expect(player.state().track).toBe('kitchen');
    await advance(MUSIC.crossfadeSec + 0.5);
    expect(player.state().decks).toBe(1);
  });

  it('the same track asked again goes on untouched', async () => {
    const { player, decodes, advance } = setup();
    player.play('stars');
    await advance(0.1);
    player.play('stars');
    player.play('stars');
    await advance(0.1);
    expect(decodes).toEqual(['stars']);
    expect(player.state().decks).toBe(1);
  });

  it('a newer ask cancels a track still loading', async () => {
    const { player, decodes, advance } = setup();
    player.play('kitchen');
    player.play('roof');
    await advance(0.6);
    expect(decodes).toEqual(['kitchen', 'roof']);
    expect(player.state().track).toBe('roof');
    expect(player.state().decks).toBe(1);
  });

  it('keeps the decoded music under the cap on every change of zone', async () => {
    const { player, advance } = setup();
    const walk: MusicTrackId[] = ['menu', 'kitchen', 'showcase', 'roof', 'stars', 'space', 'menu'];
    for (const track of walk) {
      player.play(track);
      await advance(0.05);
      player.play(track === 'menu' ? 'daily' : 'menu');
      await advance(0.05);
      player.play(track);
      await advance(MUSIC.crossfadeSec + 0.5);
    }
    const state = player.state();
    expect(state.peakBytes).toBeLessThanOrEqual(MUSIC.memoryCapBytes);
    expect(state.peakBytes).toBeGreaterThanOrEqual(decodedBytes(MUSIC_TRACKS.roof, RATE));
  });

  it('stop fades everything out and reports it', async () => {
    const { player, advance, playing } = setup();
    player.play('kitchen');
    await advance(0.1);
    player.stop();
    expect(playing.at(-1)).toBe(false);
    await advance(MUSIC.stopSec + 0.2);
    expect(player.state()).toMatchObject({ track: null, decks: 0, decodedBytes: 0 });
  });

  it('holds the streamed decks with the context', async () => {
    const { player, streams, advance } = setup();
    player.play('showcase');
    await advance(0.1);
    player.hold(true);
    expect(streams[0]?.held).toBe(true);
    player.hold(false);
    expect(streams[0]?.held).toBe(false);
  });

  it('a file that does not load leaves the music silent and the player working', async () => {
    const { ctx, player, advance } = setup();
    const broken = new PlaylistPlayer(
      {
        ctx: ctx as unknown as BaseAudioContext,
        bus: new FakeGain() as unknown as GainNode,
        tally: new NodeTally(),
      },
      {
        clock: { currentTime: 0, setTimeout: () => null, clearTimeout: () => undefined },
        decode: () => Promise.reject(new Error('404')),
        openStream: () => null,
      },
    );
    broken.play('kitchen');
    broken.play('menu');
    await advance(0.1);
    expect(broken.state().decks).toBe(0);
    player.play('kitchen');
    await advance(0.1);
    expect(player.state().decks).toBe(1);
  });

  it('the level puts the bus output at the target loudness', () => {
    expect(20 * Math.log10(trackLevel('kitchen'))).toBeCloseTo(-4 + 6.02, 1);
    expect(20 * Math.log10(trackLevel('showcase'))).toBeCloseTo(-5 + 6.02, 1);
  });
});

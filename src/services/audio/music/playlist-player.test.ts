import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  MUSIC,
  MUSIC_PLAYLIST,
  MUSIC_TRACKS,
  musicAskFor,
  type MusicCue,
  type MusicTrackId,
} from '../../../data/music';
import type { MusicHost } from '../music-control';
import { NodeTally } from '../node-tally';
import {
  PlaylistPlayer,
  trackLevel,
  type OpeningDeck,
  type PlayerSources,
} from './playlist-player';
import type { DeckClock } from './tune-deck';

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
  connect(): void {}
  disconnect(): void {}
}

class FakeGain extends FakeNode {
  gain = new FakeParam();
}

class FakeSource extends FakeNode {
  buffer: AudioBuffer | null = null;
  loop = false;
  loopStart = 0;
  loopEnd = 0;
  onended: ((event: Event) => void) | null = null;
  when = 0;
  offset = 0;
  start(when = 0, offset = 0): void {
    this.when = when;
    this.offset = offset;
  }
  stop(): void {}
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

/** A decoded buffer of `track` (its source length at the context rate). */
function fakeBuffer(track: MusicTrackId): AudioBuffer {
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

/** A stream deck whose element plays with the context's clock (held: it stops). */
class FakeStream implements OpeningDeck {
  readonly gain = new FakeGain() as unknown as GainNode;
  readonly bytes = 0;
  readonly seamless = false;
  readonly loopSec: number;
  from = 0;
  disposed = false;
  private startedAt: number | null = null;
  private before = 0;
  constructor(
    readonly track: MusicTrackId,
    private readonly ctx: FakeContext,
  ) {
    this.loopSec = MUSIC_TRACKS[track].frames / MUSIC_TRACKS[track].sampleRate;
  }
  start(offsetSec: number): Promise<void> {
    this.from = offsetSec;
    this.startedAt = this.ctx.currentTime;
    return Promise.resolve();
  }
  played(): number {
    return this.before + (this.startedAt === null ? 0 : this.ctx.currentTime - this.startedAt);
  }
  hold(on: boolean): void {
    if (on) {
      this.before = this.played();
      this.startedAt = null;
    } else {
      this.startedAt = this.ctx.currentTime;
    }
  }
  dispose(): void {
    this.disposed = true;
  }
}

/** `random` that picks playlist track `index` first. */
function pick(index: number): () => number {
  return () => (index + 0.5) / MUSIC_PLAYLIST.length;
}

function setup(first: MusicTrackId = 'kitchen') {
  const ctx = new FakeContext();
  const playing: boolean[] = [];
  const host: MusicHost = {
    ctx: ctx as unknown as BaseAudioContext,
    bus: new FakeGain() as unknown as GainNode,
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
    random: pick(MUSIC_PLAYLIST.indexOf(first)),
    decode: (track) => {
      decodes.push(track);
      return Promise.resolve(fakeBuffer(track));
    },
    openStream: (track) => {
      const deck = new FakeStream(track, ctx);
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
  /** The buffer sources of `track`, in the order they were made. */
  const sourcesOf = (track: MusicTrackId): FakeSource[] => {
    const length = fakeBuffer(track).length;
    return ctx.sources.filter((s) => s.buffer?.length === length);
  };
  return { ctx, player, decodes, streams, playing, advance, sourcesOf };
}

const loopOf = (track: MusicTrackId): number =>
  MUSIC_TRACKS[track].frames / MUSIC_TRACKS[track].sampleRate;

const bytesOf = (track: MusicTrackId): number => fakeBuffer(track).length * 2 * 4;

describe('PlaylistPlayer', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('the first track is not always the same', () => {
    const firsts = new Set<MusicTrackId | null>();
    for (const track of MUSIC_PLAYLIST) {
      const { player } = setup(track);
      player.playlist();
      firsts.add(player.state().track);
    }
    expect(firsts.size).toBe(MUSIC_PLAYLIST.length);
  });

  it('a zone change, a miss, "one more run" and the screens in between do not change the track', async () => {
    const { player, decodes, advance } = setup('kitchen');
    const cues: MusicCue[] = [
      { kind: 'menu' },
      { kind: 'run', daily: false },
      { kind: 'results', record: false },
      { kind: 'run', daily: false },
      { kind: 'menu' },
      { kind: 'menu' },
      { kind: 'run', daily: false },
    ];
    for (const cue of cues) {
      const ask = musicAskFor(cue);
      if (ask?.kind === 'playlist') player.playlist();
      await advance(5);
      expect(player.state()).toMatchObject({ track: 'kitchen', decks: 1, playlist: true });
    }
    expect(decodes).toEqual(['kitchen']);
    expect(player.state().turnSec).toBeCloseTo(35, 0);
  });

  it('a seamless track plays whole loops up to the minimum and changes exactly on a loop boundary', async () => {
    const { player, advance, sourcesOf } = setup('kitchen');
    player.playlist();
    await advance(0.1);
    const start = sourcesOf('kitchen')[0]?.when ?? 0;
    const loops = Math.ceil(MUSIC.minPlaySec / loopOf('kitchen'));
    expect(loops).toBe(3);
    const boundary = start + loops * loopOf('kitchen');
    await advance(boundary - 1);
    expect(player.state().track).toBe('kitchen');
    expect(sourcesOf('roof')).toHaveLength(0);
    await advance(2);
    expect(player.state().track).toBe('roof');
    const roof = sourcesOf('roof')[0];
    expect(roof?.when).toBeCloseTo(boundary, 2);
    expect(roof?.offset).toBe(0);
    await advance(MUSIC.crossfadeSec + 1);
    expect(player.state().decks).toBe(1);
  });

  it('decodes the next track ahead and keeps at most two decoded', async () => {
    const { player, decodes, advance } = setup('kitchen');
    player.playlist();
    await advance(0.1);
    const turn = 3 * loopOf('kitchen');
    await advance(turn - MUSIC.prefetchSec - 2);
    expect(decodes).toEqual(['kitchen']);
    await advance(3);
    expect(decodes).toEqual(['kitchen', 'roof']);
    let peak = 0;
    for (let t = 0; t < 10; t += 0.5) {
      await advance(0.5);
      peak = Math.max(peak, player.state().decodedBytes);
    }
    expect(peak).toBe(bytesOf('kitchen') + bytesOf('roof'));
    expect(player.state().peakBytes).toBeLessThanOrEqual(MUSIC.memoryCapBytes);
  });

  it('a non-seamless track plays once and ends with the change', async () => {
    const { player, streams, advance } = setup('menu');
    player.playlist();
    await advance(0.1);
    expect(streams[0]?.track).toBe('menu');
    await advance(loopOf('menu') - MUSIC.crossfadeSec - 1);
    expect(player.state().track).toBe('menu');
    await advance(1.6);
    expect(player.state().track).toBe('kitchen');
    await advance(MUSIC.crossfadeSec + 1);
    expect(streams[0]?.disposed).toBe(true);
  });

  it('goes round the playlist in order', async () => {
    const { player, advance } = setup('bartender');
    player.playlist();
    await advance(0.1);
    const seen: (MusicTrackId | null)[] = [player.state().track];
    for (let i = 0; i < MUSIC_PLAYLIST.length; i++) {
      player.next();
      await advance(MUSIC.crossfadeSec + 0.5);
      seen.push(player.state().track);
    }
    expect(seen).toEqual(['bartender', ...MUSIC_PLAYLIST]);
  });

  it('after the daily tower the playlist goes on from its place, its turn intact', async () => {
    const { player, advance, sourcesOf } = setup('kitchen');
    player.playlist();
    await advance(50);
    player.play('daily');
    await advance(40);
    expect(player.state()).toMatchObject({ track: 'daily', playlist: false });
    player.playlist();
    await advance(0.2);
    const back = sourcesOf('kitchen').at(-1);
    expect(back?.offset).toBeGreaterThan(49);
    expect(back?.offset).toBeLessThan(51);
    expect(player.state().turnSec).toBeGreaterThan(49);
    expect(player.state().turnSec).toBeLessThan(52);
  });

  it('after the record window the playlist goes on from its place', async () => {
    const { player, advance, streams } = setup('menu');
    player.playlist();
    await advance(30);
    player.play('record');
    await advance(10);
    player.playlist();
    await advance(0.2);
    const back = streams.at(-1);
    expect(back?.track).toBe('menu');
    expect(back?.from).toBeGreaterThan(29);
    expect(back?.from).toBeLessThan(31.5);
  });

  it('a hold stops the music where it is and the turn does not run meanwhile', async () => {
    const { player, advance, sourcesOf } = setup('kitchen');
    player.playlist();
    await advance(20);
    player.hold('pause', true);
    const turn = player.state().turnSec;
    await advance(300);
    expect(player.state().turnSec).toBeCloseTo(turn, 5);
    expect(player.state().track).toBe('kitchen');
    player.hold('pause', false);
    await advance(0.1);
    const resumed = sourcesOf('kitchen').at(-1);
    expect(resumed?.offset).toBeCloseTo(turn % loopOf('kitchen'), 1);
    player.hold('app', true);
    player.hold('pause', true);
    player.hold('app', false);
    const held = player.state().turnSec;
    await advance(5);
    expect(player.state().turnSec).toBeCloseTo(held, 5);
  });

  it('never has a third track sounding or over the memory cap, however fast the asks come', async () => {
    const { player, advance } = setup('roof');
    const asks: Array<MusicTrackId | 'playlist' | 'next'> = [
      'playlist',
      'daily',
      'playlist',
      'record',
      'next',
      'daily',
      'next',
      'playlist',
    ];
    for (const gap of [0, 0.05, 0.3, 1, 2]) {
      for (const ask of asks) {
        if (ask === 'playlist') player.playlist();
        else if (ask === 'next') player.next();
        else player.play(ask);
        expect(player.state().decks).toBeLessThanOrEqual(2);
        await advance(gap);
        expect(player.state().decks).toBeLessThanOrEqual(2);
        expect(player.state().peakBytes).toBeLessThanOrEqual(MUSIC.memoryCapBytes);
      }
      await advance(MUSIC.crossfadeSec + 1);
      expect(player.state().decks).toBe(1);
    }
  });

  it('stop fades everything out, and the playlist comes back from its place', async () => {
    const { player, advance, playing, sourcesOf } = setup('kitchen');
    player.playlist();
    await advance(12);
    player.stop();
    expect(playing.at(-1)).toBe(false);
    await advance(MUSIC.stopSec + 0.3);
    expect(player.state()).toMatchObject({ track: null, decks: 0, decodedBytes: 0 });
    player.playlist();
    await advance(0.2);
    expect(sourcesOf('kitchen').at(-1)?.offset).toBeGreaterThan(11.5);
  });

  it('a file that does not load leaves the music silent and the player working', async () => {
    const { ctx, advance } = setup();
    const broken = new PlaylistPlayer(
      {
        ctx: ctx as unknown as BaseAudioContext,
        bus: new FakeGain() as unknown as GainNode,
        tally: new NodeTally(),
      },
      {
        clock: { currentTime: 0, setTimeout: () => null, clearTimeout: () => undefined },
        random: () => 0.3,
        decode: () => Promise.reject(new Error('404')),
        openStream: () => null,
      },
    );
    broken.playlist();
    broken.play('daily');
    await advance(0.1);
    expect(broken.state().decks).toBe(0);
  });

  it('the level puts the bus output at the target loudness', () => {
    expect(20 * Math.log10(trackLevel('kitchen'))).toBeCloseTo(-4 + 6.02, 1);
  });
});

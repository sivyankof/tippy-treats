import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MUSIC_PLAYLIST, MUSIC_TRACKS, type MusicTrackId } from '../../../data/audio/music';
import type { MusicHost } from '../music-control';
import { NodeTally } from '../node-tally';
import { FakeGain } from './fake-nodes';
import { PlaylistPlayer, type OpeningDeck, type PlayerSources } from './playlist-player';
import type { DeckClock } from './tune-deck';

/** A stream deck whose `play()` is refused while `refuse` says so. */
class RefusingStream implements OpeningDeck {
  readonly gain = new FakeGain() as unknown as GainNode;
  readonly bytes = 0;
  readonly seamless = false;
  readonly loopSec: number;
  disposed = false;
  constructor(
    readonly track: MusicTrackId,
    private readonly refuse: () => boolean,
  ) {
    this.loopSec = MUSIC_TRACKS[track].frames / MUSIC_TRACKS[track].sampleRate;
  }
  start(): Promise<void> {
    return this.refuse()
      ? Promise.reject(new DOMException('not allowed', 'NotAllowedError'))
      : Promise.resolve();
  }
  played(): number {
    return 0;
  }
  hold(): void {}
  dispose(): void {
    this.disposed = true;
  }
  setLooping(): void {}
  extend(): boolean {
    return true;
  }
}

/** The first streamed track of the playlist (a refused `play()` stops only those). */
const STREAMED: MusicTrackId =
  MUSIC_PLAYLIST.find((t) => MUSIC_TRACKS[t].loop !== 'seamless') ?? 'menu';

function setup(first: MusicTrackId, refuse: (track: MusicTrackId) => boolean) {
  const ctx = { currentTime: 0, sampleRate: 48_000, state: 'running' };
  const host: MusicHost = {
    ctx: ctx as unknown as BaseAudioContext,
    bus: new FakeGain() as unknown as GainNode,
    tally: new NodeTally(),
  };
  const clock: DeckClock = {
    get currentTime() {
      return ctx.currentTime;
    },
    setTimeout: (call, ms) => setTimeout(call, ms),
    clearTimeout: (id) => clearTimeout(id as ReturnType<typeof setTimeout>),
  };
  const opened: RefusingStream[] = [];
  let released = 0;
  const sources: PlayerSources = {
    clock,
    playlist: MUSIC_PLAYLIST,
    random: () => (MUSIC_PLAYLIST.indexOf(first) + 0.5) / MUSIC_PLAYLIST.length,
    // A seamless track stays loading (the next track is then the one asked for).
    decode: () => new Promise<AudioBuffer>(() => undefined),
    openStream: (track) => {
      const deck = new RefusingStream(track, () => refuse(track));
      opened.push(deck);
      return deck;
    },
    release: () => {
      released += 1;
    },
  };
  const player = new PlaylistPlayer(host, sources);
  const settle = async (): Promise<void> => {
    await vi.advanceTimersByTimeAsync(10);
  };
  return { player, opened, settle, released: () => released };
}

describe('PlaylistPlayer, a track that does not start', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('a refused play is asked again on the next tap and then plays', async () => {
    let refusing = true;
    const t = setup(STREAMED, () => refusing);
    t.player.playlist();
    await t.settle();
    expect(t.player.state()).toMatchObject({ track: null, decks: 0, loading: false });
    refusing = false;
    t.player.gesture();
    await t.settle();
    expect(t.player.state()).toMatchObject({ track: STREAMED, decks: 1, playlist: true });
  });

  it('a second refusal in a row moves the playlist on to its next track', async () => {
    const t = setup(STREAMED, (track) => track === STREAMED);
    t.player.playlist();
    await t.settle();
    t.player.gesture();
    await t.settle();
    expect(t.player.state().decks).toBe(0);
    t.player.gesture();
    await t.settle();
    const index = MUSIC_PLAYLIST.indexOf(STREAMED);
    const next = MUSIC_PLAYLIST[(index + 1) % MUSIC_PLAYLIST.length];
    expect(t.player.state()).toMatchObject({ track: next, playlist: true });
    expect(t.opened.slice(0, 2).map((d) => d.track)).toEqual([STREAMED, STREAMED]);
  });

  it('asking for the playlist again restarts one whose start failed', async () => {
    let refusing = true;
    const t = setup(STREAMED, () => refusing);
    t.player.playlist();
    await t.settle();
    refusing = false;
    t.player.playlist();
    await t.settle();
    expect(t.player.state()).toMatchObject({ track: STREAMED, decks: 1 });
  });

  it('a tap with nothing failed changes nothing', async () => {
    const t = setup(STREAMED, () => false);
    t.player.playlist();
    await t.settle();
    t.player.gesture();
    await t.settle();
    expect(t.opened).toHaveLength(1);
  });

  it('dispose stops the decks, lets the elements go and ignores later asks', async () => {
    const t = setup(STREAMED, () => false);
    t.player.playlist();
    await t.settle();
    t.player.dispose();
    expect(t.released()).toBe(1);
    t.player.playlist();
    await t.settle();
    expect(t.opened).toHaveLength(1);
  });

  it('the several events of one tap retry once and do not skip the track under way', async () => {
    let refusing = true;
    const t = setup(STREAMED, () => refusing);
    t.player.playlist();
    await t.settle();
    refusing = false;
    // pointerdown, pointerup and touchend of one tap, before the retry has started.
    t.player.gesture();
    t.player.gesture();
    t.player.gesture();
    await t.settle();
    expect(t.opened.map((d) => d.track)).toEqual([STREAMED, STREAMED]);
    expect(t.player.state()).toMatchObject({ track: STREAMED, decks: 1 });
  });

  it('asking for the failed playlist again between taps keeps its count, so the next tap moves on', async () => {
    const t = setup(STREAMED, (track) => track === STREAMED);
    t.player.playlist();
    await t.settle();
    t.player.gesture();
    await t.settle();
    // A menu screen opens and asks for the playlist again (no tap).
    t.player.playlist();
    await t.settle();
    t.player.gesture();
    await t.settle();
    const index = MUSIC_PLAYLIST.indexOf(STREAMED);
    expect(t.player.state().track).toBe(MUSIC_PLAYLIST[(index + 1) % MUSIC_PLAYLIST.length]);
  });

  it('a new player goes on from the turn of the old one', async () => {
    const t = setup(STREAMED, () => false);
    const index = (MUSIC_PLAYLIST.indexOf(STREAMED) + 2) % MUSIC_PLAYLIST.length;
    t.player.resumeAt({ index, turnSec: 12 });
    t.player.playlist();
    await t.settle();
    expect(t.player.position()).toMatchObject({ index });
  });
});

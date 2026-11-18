import { MUSIC, type MusicTrack, type MusicTrackId } from '../../../data/music';
import { MS_PER_SECOND } from '../../../util/math';
import { releaseOnce, SOURCE_FOREVER_SEC, stopQuietly, type NodeTally } from '../node-tally';
import type { MediaPool, PooledMedia } from './media-pool';
import { fadeParam, type LoopBounds } from './tune-loop';

/** One track on its own level (the player fades decks in and out; a deck only plays). */
export interface Deck {
  readonly track: MusicTrackId;
  /** The deck's level; the player connects it to the music bus. */
  readonly gain: GainNode;
  /** Memory of the decoded audio the deck holds, bytes (0 for a streamed track). */
  readonly bytes: number;
  /** The context is held (the app is in the background): a streamed track pauses its elements. */
  hold(on: boolean): void;
  /** Stops at context time `at` and lets everything go. */
  dispose(at: number): void;
}

/** A seamless track: one looping buffer source between the loop bounds. */
export class BufferDeck implements Deck {
  readonly gain: GainNode;
  readonly bytes: number;
  private source: AudioBufferSourceNode | null;

  constructor(
    ctx: BaseAudioContext,
    tally: NodeTally,
    readonly track: MusicTrackId,
    buffer: AudioBuffer,
    bounds: LoopBounds,
    at: number,
  ) {
    this.bytes = buffer.length * buffer.numberOfChannels * Float32Array.BYTES_PER_ELEMENT;
    const rate = buffer.sampleRate;
    const gain = ctx.createGain();
    gain.gain.value = 0;
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.loop = true;
    source.loopStart = bounds.start / rate;
    source.loopEnd = bounds.end / rate;
    source.connect(gain);
    const nodes = [source, gain];
    tally.add(nodes);
    source.onended = releaseOnce(tally, nodes);
    // The first pass begins at the loop start (after an encoder delay the decoder kept).
    source.start(at, bounds.start / rate);
    source.stop(at + SOURCE_FOREVER_SEC);
    this.gain = gain;
    this.source = source;
  }

  hold(): void {
    // The context itself stops; nothing to do.
  }

  dispose(at: number): void {
    const source = this.source;
    this.source = null;
    if (source) stopQuietly(source, at);
  }
}

/** The clock the stream deck reads: the context's time, and timers (injected in tests). */
export interface DeckClock {
  readonly currentTime: number;
  setTimeout(call: () => void, ms: number): unknown;
  clearTimeout(id: unknown): void;
}

/**
 * A long, non-seamless track streamed by two media elements (never decoded whole). It loops by
 * starting the other element from the beginning `loopOverlapSec` before the end and fading the
 * two over that time; then the first one pauses. A timer looks at the element's own position, so
 * a held context or a lagging stream never piles passes up.
 */
export class StreamDeck implements Deck {
  readonly gain: GainNode;
  readonly bytes = 0;
  private active = 0;
  private timer: unknown = null;
  private disposed = false;
  private held = false;
  /** Elements that were sounding when the deck was held. */
  private paused: PooledMedia[] = [];
  private readonly loopAt: number;

  constructor(
    private readonly ctx: BaseAudioContext,
    private readonly clock: DeckClock,
    private readonly pool: MediaPool,
    readonly track: MusicTrackId,
    spec: MusicTrack,
    private readonly url: string,
    private readonly players: readonly [PooledMedia, PooledMedia],
  ) {
    this.loopAt = spec.frames / spec.sampleRate - MUSIC.loopOverlapSec;
    this.gain = ctx.createGain();
    this.gain.gain.value = 0;
    for (const player of players) {
      player.gain.connect(this.gain);
      player.el.onended = () => {
        if (player === this.players[this.active]) this.turn();
      };
    }
  }

  /** Lends two elements from `pool`, or returns null when it has none left. */
  static open(
    ctx: BaseAudioContext,
    clock: DeckClock,
    pool: MediaPool,
    track: MusicTrackId,
    spec: MusicTrack,
    url: string,
  ): StreamDeck | null {
    const a = pool.acquire();
    const b = a ? pool.acquire() : null;
    if (!a || !b) {
      if (a) pool.release(a);
      return null;
    }
    return new StreamDeck(ctx, clock, pool, track, spec, url, [a, b]);
  }

  /** Starts the first pass; resolves once the element plays (rejects when it cannot). */
  async start(): Promise<void> {
    const first = this.players[0];
    first.el.src = this.url;
    first.gain.gain.cancelScheduledValues(0);
    first.gain.gain.value = 1;
    await first.el.play();
    this.arm();
  }

  hold(on: boolean): void {
    if (this.disposed || on === this.held) return;
    this.held = on;
    if (on) {
      this.clearTimer();
      this.paused = this.players.filter((p) => !p.el.paused);
      for (const p of this.paused) p.el.pause();
      return;
    }
    for (const p of this.paused) p.el.play().catch(() => undefined);
    this.paused = [];
    this.arm();
  }

  dispose(at: number): void {
    if (this.disposed) return;
    this.disposed = true;
    this.clearTimer();
    const wait = Math.max(0, at - this.clock.currentTime) * MS_PER_SECOND;
    this.clock.setTimeout(() => {
      for (const p of this.players) {
        p.el.onended = null;
        this.pool.release(p);
      }
      this.gain.disconnect();
    }, wait);
  }

  /** Waits until the active element nears its end, then turns to the other one. */
  private arm(): void {
    this.clearTimer();
    if (this.disposed || this.held) return;
    const left = this.loopAt - (this.players[this.active]?.el.currentTime ?? 0);
    if (left <= 0) {
      this.turn();
      return;
    }
    // Wakes when the end is due by the element's own clock (a stalled stream is looked at again then).
    this.timer = this.clock.setTimeout(
      () => this.arm(),
      Math.max(left, MUSIC.minWaitSec) * MS_PER_SECOND,
    );
  }

  /** The next pass starts from the beginning and the two fade over the overlap. */
  private turn(): void {
    if (this.disposed) return;
    this.clearTimer();
    const from = this.players[this.active];
    const to = this.players[1 - this.active];
    if (!from || !to) return;
    this.active = 1 - this.active;
    const now = this.ctx.currentTime;
    const overlap = MUSIC.loopOverlapSec;
    to.el.src = this.url;
    to.el.currentTime = 0;
    fadeParam(to.gain.gain, now, 1, overlap, MUSIC.fadeSteps);
    fadeParam(from.gain.gain, now, 0, overlap, MUSIC.fadeSteps);
    to.el.play().catch(() => undefined);
    this.clock.setTimeout(() => {
      if (this.disposed || this.players[this.active] === from) return;
      from.el.pause();
    }, overlap * MS_PER_SECOND);
    this.arm();
  }

  private clearTimer(): void {
    if (this.timer !== null) this.clock.clearTimeout(this.timer);
    this.timer = null;
  }
}

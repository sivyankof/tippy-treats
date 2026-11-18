import { MUSIC, type MusicTrack, type MusicTrackId } from '../../../data/music';
import { MS_PER_SECOND } from '../../../util/math';
import { releaseOnce, SOURCE_FOREVER_SEC, stopQuietly, type NodeTally } from '../node-tally';
import type { MediaPool, PooledMedia } from './media-pool';
import { fadeParam, type LoopBounds } from './tune-loop';

/** The clock a deck reads: the context's time, and timers (injected in tests). */
export interface DeckClock {
  readonly currentTime: number;
  setTimeout(call: () => void, ms: number): unknown;
  clearTimeout(id: unknown): void;
}

/** One track on its own level (the player fades decks in and out; a deck only plays). */
export interface Deck {
  readonly track: MusicTrackId;
  /** The deck's level; the player connects it to the music bus. */
  readonly gain: GainNode;
  /** Memory of the decoded audio the deck holds, bytes (0 for a streamed track). */
  readonly bytes: number;
  /** Length of one loop of a seamless track, or of the whole file of a streamed one, seconds. */
  readonly loopSec: number;
  readonly seamless: boolean;
  /** Seconds the deck has played since it started, its holds left out. */
  played(): number;
  /** Stops where it is (the game is paused, the app is in the background) and goes on from there. */
  hold(on: boolean): void;
  /** Stops at context time `at` and lets everything go. */
  dispose(at: number): void;
  /**
   * One more pass of a track that plays once (a stream): it loops into its start again. False when
   * it cannot. A seamless deck loops anyway and has none.
   */
  extend?(): boolean;
}

/**
 * A seamless track: a looping buffer source between the loop bounds. A hold stops the source and
 * a release starts a new one where it stopped (a source node plays once; the buffer stays).
 */
export class BufferDeck implements Deck {
  readonly gain: GainNode;
  readonly bytes: number;
  readonly loopSec: number;
  readonly seamless = true;
  private source: AudioBufferSourceNode | null = null;
  /** Seconds played by the sources before the current one. */
  private before = 0;
  /** Context time the current source starts (null while held). */
  private segmentAt: number | null = null;
  private readonly offsetSec: number;
  private held = false;
  private disposed = false;

  /** Starts at context time `at`, `offsetSec` into the loop. */
  constructor(
    private readonly ctx: BaseAudioContext,
    private readonly clock: DeckClock,
    private readonly tally: NodeTally,
    readonly track: MusicTrackId,
    private readonly buffer: AudioBuffer,
    private readonly bounds: LoopBounds,
    at: number,
    offsetSec = 0,
  ) {
    this.bytes = buffer.length * buffer.numberOfChannels * Float32Array.BYTES_PER_ELEMENT;
    this.loopSec = (bounds.end - bounds.start) / buffer.sampleRate;
    this.offsetSec = this.loopSec > 0 ? offsetSec % this.loopSec : 0;
    this.gain = ctx.createGain();
    this.gain.gain.value = 0;
    tally.add([this.gain]);
    this.startSource(at, this.offsetSec);
  }

  played(): number {
    if (this.segmentAt === null) return this.before;
    return this.before + Math.max(0, this.clock.currentTime - this.segmentAt);
  }

  hold(on: boolean): void {
    if (this.disposed || on === this.held) return;
    this.held = on;
    const now = this.clock.currentTime;
    if (on) {
      this.before = this.played();
      this.segmentAt = null;
      if (this.source) stopQuietly(this.source, now);
      this.source = null;
      return;
    }
    this.startSource(now, this.position());
  }

  dispose(at: number): void {
    if (this.disposed) return;
    this.disposed = true;
    if (this.source) stopQuietly(this.source, at);
    this.source = null;
    const wait = Math.max(0, at - this.clock.currentTime) * MS_PER_SECOND;
    this.clock.setTimeout(() => {
      this.gain.disconnect();
      this.tally.release([this.gain]);
    }, wait);
  }

  /** Where in the loop the deck is now. */
  private position(): number {
    return this.loopSec > 0 ? (this.offsetSec + this.played()) % this.loopSec : 0;
  }

  private startSource(at: number, offset: number): void {
    const { buffer, bounds } = this;
    const rate = buffer.sampleRate;
    const source = this.ctx.createBufferSource();
    source.buffer = buffer;
    source.loop = true;
    source.loopStart = bounds.start / rate;
    source.loopEnd = bounds.end / rate;
    source.connect(this.gain);
    this.tally.add([source]);
    source.onended = releaseOnce(this.tally, [source]);
    // The loop starts after an encoder delay the decoder kept.
    source.start(at, bounds.start / rate + offset);
    source.stop(at + SOURCE_FOREVER_SEC);
    this.source = source;
    this.segmentAt = at;
  }
}

/**
 * A long, non-seamless track streamed by media elements (never decoded whole). In the playlist it
 * plays once (`looping` false); on its own it loops by starting the other element from the
 * beginning `loopOverlapSec` before the end and fading the two over that time. A timer looks at
 * the element's own position, so a hold or a lagging stream never piles passes up.
 */
export class StreamDeck implements Deck {
  readonly gain: GainNode;
  readonly bytes = 0;
  readonly seamless = false;
  readonly loopSec: number;
  private active = 0;
  private timer: unknown = null;
  private disposed = false;
  private held = false;
  private startOffset = 0;
  /** Seconds played by the passes before the current one. */
  private before = 0;
  /** Passes still to loop into when the deck is not looping for ever (`extend`). */
  private passesLeft = 0;
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
    private readonly players: PooledMedia[],
    private readonly looping: boolean,
  ) {
    this.loopSec = spec.frames / spec.sampleRate;
    this.loopAt = this.loopSec - MUSIC.loopOverlapSec;
    this.gain = ctx.createGain();
    this.gain.gain.value = 0;
    for (const player of players) this.wire(player);
  }

  extend(): boolean {
    if (this.disposed) return false;
    if (this.players.length < 2) {
      const media = this.pool.acquire();
      if (!media) return false;
      this.players.push(media);
      this.wire(media);
    }
    this.passesLeft += 1;
    this.arm();
    return true;
  }

  /** Lends elements from `pool` (two to loop, one to play once), or returns null when it has too few. */
  static open(
    ctx: BaseAudioContext,
    clock: DeckClock,
    pool: MediaPool,
    track: MusicTrackId,
    spec: MusicTrack,
    url: string,
    looping: boolean,
  ): StreamDeck | null {
    const players: PooledMedia[] = [];
    for (let i = 0; i < (looping ? 2 : 1); i++) {
      const media = pool.acquire();
      if (!media) {
        for (const p of players) pool.release(p);
        return null;
      }
      players.push(media);
    }
    return new StreamDeck(ctx, clock, pool, track, spec, url, players, looping);
  }

  /**
   * Starts `offsetSec` into the file (a media fragment, so the element seeks before it plays);
   * resolves once the element plays (rejects when it cannot).
   */
  async start(offsetSec = 0): Promise<void> {
    const first = this.players[0];
    if (!first) throw new Error('no element');
    const from = offsetSec > 0 && offsetSec < this.loopSec ? offsetSec : 0;
    this.startOffset = from;
    first.el.src = from > 0 ? `${this.url}#t=${from.toFixed(3)}` : this.url;
    first.gain.gain.cancelScheduledValues(0);
    first.gain.gain.value = 1;
    await first.el.play();
    if (this.held) {
      first.el.pause();
      this.paused = [first];
    }
    this.arm();
  }

  played(): number {
    const el = this.players[this.active]?.el;
    return this.before + (el ? Math.max(0, el.currentTime - this.startOffset) : 0);
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

  private wire(player: PooledMedia): void {
    player.gain.connect(this.gain);
    player.el.onended = () => {
      if (this.loops() && player === this.players[this.active]) this.turn();
    };
  }

  /** Loops at the end of this pass: for ever, or for the passes `extend` asked for. */
  private loops(): boolean {
    return this.looping || this.passesLeft > 0;
  }

  /** Waits until the active element nears its end, then turns to the other one (looping only). */
  private arm(): void {
    this.clearTimer();
    if (this.disposed || this.held || !this.loops()) return;
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
    this.before += Math.max(0, from.el.currentTime - this.startOffset);
    this.active = 1 - this.active;
    this.startOffset = 0;
    if (!this.looping) this.passesLeft = Math.max(0, this.passesLeft - 1);
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

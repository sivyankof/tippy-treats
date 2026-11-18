import { AUDIO_MIX } from '../../../data/audio-mix';
import { MUSIC, MUSIC_PLAYLIST, MUSIC_TRACKS, type MusicTrackId } from '../../../data/music';
import { MS_PER_SECOND } from '../../../util/math';
import { fromDb } from '../levels';
import type {
  MusicControl,
  MusicFactory,
  MusicHoldReason,
  MusicHost,
  MusicPlayerState,
} from '../music-control';
import { MediaPool, type MediaContext } from './media-pool';
import { firstIndex, nextIndex, turnLength, turnOffset } from './playlist-turn';
import { BufferDeck, StreamDeck, type Deck, type DeckClock } from './tune-deck';
import { fetchAndDecode, trackUrl } from './tune-loader';
import { decodedBytes, fadeParam, loopBounds, smoothSeam, type LoopBounds } from './tune-loop';

/**
 * The level of `track` in the player: the files are `fileLufs`, the music bus scales by its own
 * level, and the music should reach `busLufs` at the bus output (plus the track's own `gainDb`).
 */
export function trackLevel(track: MusicTrackId): number {
  const db = MUSIC.busLufs - MUSIC.fileLufs + MUSIC_TRACKS[track].gainDb;
  return fromDb(db) / AUDIO_MIX.musicLevel;
}

/** A stream deck before it plays. */
export interface OpeningDeck extends Deck {
  /** Starts `offsetSec` into the file. */
  start(offsetSec: number): Promise<void>;
}

/** How the player gets its tracks (the browser's in the game, fakes in tests). */
export interface PlayerSources {
  clock: DeckClock;
  /** Random numbers in [0, 1): the first track of the playlist. */
  random: () => number;
  /** The decoded file of a seamless track, or null when it has no file. */
  decode(track: MusicTrackId): Promise<AudioBuffer> | null;
  /** A stream deck of a non-seamless track (`looping` when it plays on its own), or null when it cannot be streamed. */
  openStream(track: MusicTrackId, looping: boolean): OpeningDeck | null;
}

/** The seam of a decoded seamless track is smoothed once, as it comes out of the decoder. */
function prepare(buffer: AudioBuffer, track: MusicTrackId): LoopBounds {
  const rate = buffer.sampleRate;
  const bounds = loopBounds(buffer.length, MUSIC_TRACKS[track], rate, MUSIC.aacPrimingFrames);
  const frames = Math.round(MUSIC.seamSmoothSec * rate);
  for (let c = 0; c < buffer.numberOfChannels; c++) {
    smoothSeam(buffer.getChannelData(c), bounds.start, bounds.end, frames, MUSIC.seam);
  }
  return bounds;
}

interface Decoded {
  buffer: AudioBuffer;
  bounds: LoopBounds;
}

interface Pending {
  track: MusicTrackId;
  ticket: number;
}

interface Prefetch {
  track: MusicTrackId;
  decoded: Promise<Decoded>;
  /** Set once decoded (it counts in memory from then on, until used or dropped). */
  ready: Decoded | null;
}

/** What plays: the playlist, one track on its own (an exception), or nothing. */
type Mode = { kind: 'playlist' } | { kind: 'track'; track: MusicTrackId } | null;

/**
 * The music player (docs/06, section 7, "Музыка"). The playlist goes round `MUSIC_PLAYLIST` from
 * a random first track, each track for at least `minPlaySec` (whole loops of a seamless one, a
 * non-seamless one once), and changes over `crossfadeSec` exactly on the loop boundary (put on the
 * context's clock `switchLeadSec` ahead; the next seamless track is decoded `prefetchSec` ahead).
 * An exception (`play`) plays one track round and round; the playlist keeps its turn (track and
 * seconds played) and goes on from there. A hold stops the decks where they are.
 *
 * At most two decks sound at once (the track playing and the one leaving): a new track asked for
 * during a change cuts the leaving one at once, and a track that is leaving comes back from its
 * current level when it is asked for again. Decoded audio lives only in the decks and the
 * prefetched track, and a decode waits until the cut decks are gone and no other decode runs: at
 * most two decoded tracks at a time (the memory cap, docs/08 journal).
 */
export class PlaylistPlayer implements MusicControl {
  private current: Deck | null = null;
  private leaving: Deck | null = null;
  /** Decks stopping, with the context time they are gone at. */
  private readonly retiring = new Map<Deck, number>();
  /** Decodes running now (a cancelled one too: its memory is taken until it ends), bytes each. */
  private readonly decoding = new Set<{ bytes: number }>();
  private pending: Pending | null = null;
  private ticket = 0;
  private leaveTimer: unknown = null;
  private watchTimer: unknown = null;
  private mode: Mode = null;
  /** The playlist's turn: its track, the seconds played by decks of it that are gone, the deck playing it. */
  private index: number;
  private turnBefore = 0;
  private turnDeck: Deck | null = null;
  private prefetch: Prefetch | null = null;
  private readonly holds = new Set<MusicHoldReason>();
  private peak = 0;

  constructor(
    private readonly host: MusicHost,
    private readonly sources: PlayerSources,
  ) {
    this.index = firstIndex(sources.random, MUSIC_PLAYLIST.length);
  }

  playlist(): void {
    if (this.mode?.kind === 'playlist') return;
    this.mode = { kind: 'playlist' };
    const track = this.turnTrack();
    this.show(track, turnOffset(this.turnShape(track), this.turnBefore), true);
  }

  play(track: MusicTrackId): void {
    if (this.mode?.kind === 'track' && this.mode.track === track) return;
    this.mode = { kind: 'track', track };
    this.clearWatch();
    this.prefetch = null;
    this.show(track, 0, false);
  }

  next(): void {
    this.mode = { kind: 'playlist' };
    this.clearWatch();
    this.prefetch = null;
    this.turnDeck = null;
    this.turnBefore = 0;
    this.index = nextIndex(this.index, MUSIC_PLAYLIST.length);
    this.show(this.turnTrack(), 0, true);
  }

  stop(): void {
    this.mode = null;
    this.cancelPending();
    this.clearWatch();
    this.clearLeaveTimer();
    this.prefetch = null;
    this.leaveTurn();
    const decks = [this.current, this.leaving];
    this.current = null;
    this.leaving = null;
    for (const deck of decks) if (deck) this.fadeAndRetire(deck, MUSIC.stopSec);
    this.host.onPlaying?.(false);
  }

  hold(reason: MusicHoldReason, on: boolean): void {
    const was = this.holds.size > 0;
    if (on) this.holds.add(reason);
    else this.holds.delete(reason);
    const held = this.holds.size > 0;
    if (held === was) return;
    for (const deck of this.decks()) deck.hold(held);
    if (held) this.clearWatch();
    else this.watch();
  }

  state(): MusicPlayerState {
    return {
      track: this.pending?.track ?? this.current?.track ?? null,
      playlist: this.mode?.kind === 'playlist',
      turnSec: this.turnPlayed(),
      decks: this.decks().length,
      decodedBytes: this.bytesNow(),
      peakBytes: this.peak,
    };
  }

  resetPeak(): void {
    this.peak = this.bytesNow();
  }

  /** The playlist's track now. */
  private turnTrack(): MusicTrackId {
    return MUSIC_PLAYLIST[this.index] ?? MUSIC_PLAYLIST[0] ?? 'menu';
  }

  /** The loop and kind of `track` from its data (before a deck of it exists). */
  private turnShape(track: MusicTrackId): { loopSec: number; seamless: boolean } {
    const spec = MUSIC_TRACKS[track];
    return { loopSec: spec.frames / spec.sampleRate, seamless: spec.loop === 'seamless' };
  }

  private turnPlayed(): number {
    return this.turnBefore + (this.turnDeck ? this.turnDeck.played() : 0);
  }

  /** The turn's deck stops counting (it leaves for an exception or stops); the turn keeps its seconds. */
  private leaveTurn(): void {
    if (!this.turnDeck) return;
    this.turnBefore += this.turnDeck.played();
    this.turnDeck = null;
  }

  /** Brings `track` in (`turn`: as the playlist's turn), `offsetSec` into it. */
  private show(track: MusicTrackId, offsetSec: number, turn: boolean): void {
    const { current } = this;
    if (current?.track === track) {
      this.cancelPending();
      this.adopt(current, turn);
      this.watch();
      return;
    }
    if (this.leaving?.track === track) {
      this.cancelPending();
      this.swapBack(turn);
      this.watch();
      return;
    }
    if (this.pending?.track === track) return;
    this.cancelPending();
    if (this.turnDeck === current) this.leaveTurn();
    const leaving = this.leaving;
    if (leaving) {
      this.leaving = null;
      this.clearLeaveTimer();
      this.cut(leaving);
    }
    const ticket = ++this.ticket;
    this.pending = { track, ticket };
    this.whenFree(ticket, () => this.open(track, ticket, offsetSec, turn));
  }

  /** A deck already playing becomes the turn's deck (its seconds count from now on). */
  private adopt(deck: Deck, turn: boolean): void {
    if (!turn || this.turnDeck === deck) return;
    this.turnBefore = Math.max(0, this.turnBefore - deck.played());
    this.turnDeck = deck;
  }

  private open(track: MusicTrackId, ticket: number, offsetSec: number, turn: boolean): void {
    if (ticket !== this.ticket) return;
    if (MUSIC_TRACKS[track].loop === 'seamless') {
      const decoded = this.decoded(track);
      if (!decoded) {
        this.dropPending(ticket);
        return;
      }
      decoded.then(
        ({ buffer, bounds }) => {
          if (ticket !== this.ticket) return;
          const { ctx, tally } = this.host;
          const now = ctx.currentTime;
          const { clock } = this.sources;
          this.enter(new BufferDeck(ctx, clock, tally, track, buffer, bounds, now, offsetSec), {
            at: now,
            turn,
          });
        },
        // A missing or broken file leaves the music silent, never the game broken.
        () => this.dropPending(ticket),
      );
      return;
    }
    const deck = this.sources.openStream(track, !turn);
    if (!deck) {
      this.dropPending(ticket);
      return;
    }
    deck.start(offsetSec).then(
      () => {
        if (ticket === this.ticket) this.enter(deck, { at: this.host.ctx.currentTime, turn });
        else deck.dispose(this.host.ctx.currentTime);
      },
      () => {
        deck.dispose(this.host.ctx.currentTime);
        this.dropPending(ticket);
      },
    );
  }

  /** The decoded `track`: the prefetched one when it is that track, otherwise a new decode. */
  private decoded(track: MusicTrackId): Promise<Decoded> | null {
    const prefetch = this.prefetch;
    if (prefetch?.track === track) {
      this.prefetch = null;
      return prefetch.decoded;
    }
    return this.decode(track);
  }

  /** Decodes `track` and smooths its seam; the decode counts in memory while it runs. */
  private decode(track: MusicTrackId): Promise<Decoded> | null {
    const decoding = this.sources.decode(track);
    if (!decoding) return null;
    const job = { bytes: decodedBytes(MUSIC_TRACKS[track], this.host.ctx.sampleRate) };
    this.decoding.add(job);
    this.note();
    const done = (): void => {
      this.decoding.delete(job);
    };
    decoding.then(done, done);
    return decoding.then((buffer) => ({ buffer, bounds: prepare(buffer, track) }));
  }

  /** The new deck fades in from context time `at` over the one playing, which leaves from then. */
  private enter(deck: Deck, { at, turn }: { at: number; turn: boolean }): void {
    this.pending = null;
    const leaving = this.leaving;
    if (leaving) {
      this.leaving = null;
      this.cut(leaving);
    }
    this.clearLeaveTimer();
    deck.gain.connect(this.host.bus);
    if (this.holds.size > 0) deck.hold(true);
    const now = this.host.ctx.currentTime;
    const level = trackLevel(deck.track);
    fadeParam(deck.gain.gain, now, level, MUSIC.crossfadeSec, MUSIC.fadeSteps, at);
    if (this.current) this.leave(this.current, at);
    this.current = deck;
    if (turn) this.turnDeck = deck;
    this.host.onPlaying?.(true);
    this.note();
    this.watch();
  }

  /** The leaving track comes back; the one playing leaves in its place. */
  private swapBack(turn: boolean): void {
    const back = this.leaving;
    const gone = this.current;
    if (!back || !gone) return;
    this.clearLeaveTimer();
    if (this.turnDeck === gone) this.leaveTurn();
    this.current = back;
    this.adopt(back, turn);
    const now = this.host.ctx.currentTime;
    fadeParam(back.gain.gain, now, trackLevel(back.track), MUSIC.crossfadeSec, MUSIC.fadeSteps);
    this.leave(gone, now);
  }

  /** `deck` fades out from `at` over the change and is let go at its end, unless it comes back first. */
  private leave(deck: Deck, at: number): void {
    this.leaving = deck;
    const now = this.host.ctx.currentTime;
    fadeParam(deck.gain.gain, now, 0, MUSIC.crossfadeSec, MUSIC.fadeSteps, at);
    const end = Math.max(now, at) + MUSIC.crossfadeSec;
    this.leaveTimer = this.after(end, () => {
      this.leaveTimer = null;
      if (this.leaving !== deck) return;
      this.leaving = null;
      this.retire(deck, this.host.ctx.currentTime);
    });
  }

  /** Looks at the playlist's turn: decodes the next track ahead, and puts the change on the clock when it is due. */
  private watch(): void {
    this.clearWatch();
    const deck = this.turnDeck;
    if (this.mode?.kind !== 'playlist' || this.holds.size > 0 || !deck || deck !== this.current) {
      return;
    }
    const remaining = turnLength(deck, MUSIC.minPlaySec, MUSIC.crossfadeSec) - this.turnPlayed();
    if (remaining <= MUSIC.prefetchSec) this.prefetchNext();
    if (remaining <= MUSIC.switchLeadSec) {
      this.switchAt(this.sources.clock.currentTime + Math.max(0, remaining));
      return;
    }
    const wait = Math.min(MUSIC.watchSec, remaining - MUSIC.switchLeadSec);
    this.watchTimer = this.sources.clock.setTimeout(() => this.watch(), wait * MS_PER_SECOND);
  }

  /** Decodes the next seamless track of the playlist, when nothing else is in memory but the track playing. */
  private prefetchNext(): void {
    if (this.prefetch || this.pending || this.leaving) return;
    if (this.decoding.size > 0 || this.retiring.size > 0) return;
    const track = MUSIC_PLAYLIST[nextIndex(this.index, MUSIC_PLAYLIST.length)];
    if (!track || MUSIC_TRACKS[track].loop !== 'seamless') return;
    const decoded = this.decode(track);
    if (!decoded) return;
    const prefetch: Prefetch = { track, decoded, ready: null };
    this.prefetch = prefetch;
    decoded.then(
      (ready) => {
        prefetch.ready = ready;
        this.note();
      },
      () => {
        if (this.prefetch === prefetch) this.prefetch = null;
      },
    );
  }

  /** The playlist moves on to its next track, the change starting at context time `at`. */
  private switchAt(at: number): void {
    this.turnDeck = null;
    this.turnBefore = 0;
    this.index = nextIndex(this.index, MUSIC_PLAYLIST.length);
    const track = this.turnTrack();
    const ready = this.prefetch?.track === track ? this.prefetch.ready : null;
    if (ready) {
      // Exactly on the boundary: the new deck and both fades are put on the context's clock.
      this.prefetch = null;
      this.cancelPending();
      const { ctx, tally } = this.host;
      const { clock } = this.sources;
      const deck = new BufferDeck(ctx, clock, tally, track, ready.buffer, ready.bounds, at, 0);
      this.enter(deck, { at, turn: true });
      return;
    }
    // A stream (or a decode not ready in time) starts when the boundary comes.
    const index = this.index;
    this.after(at, () => {
      if (this.mode?.kind === 'playlist' && this.index === index && !this.turnDeck) {
        this.show(track, 0, true);
      }
    });
  }

  /** A third track is coming: the leaving one goes at once (a short fade, no click). */
  private cut(deck: Deck): void {
    this.fadeAndRetire(deck, MUSIC.cutSec);
  }

  private fadeAndRetire(deck: Deck, sec: number): void {
    const now = this.host.ctx.currentTime;
    fadeParam(deck.gain.gain, now, 0, sec, MUSIC.fadeSteps);
    this.retire(deck, now + sec);
  }

  /** Stops `deck` at `at`; it counts in memory until then. */
  private retire(deck: Deck, at: number): void {
    if (this.turnDeck === deck) this.leaveTurn();
    deck.dispose(at);
    this.retiring.set(deck, at);
    this.note();
    this.after(at, () => {
      this.retiring.delete(deck);
    });
  }

  /**
   * Runs `call` once no deck is stopping and no decode runs (at once when so): a new decode never
   * adds to memory that is still being let go. Waiting for the prefetched track's own decode is
   * fine (it is the one wanted). A newer ask cancels it.
   */
  private whenFree(ticket: number, call: () => void): void {
    if (ticket !== this.ticket) return;
    const wanted = this.prefetch !== null && this.pending?.track === this.prefetch.track;
    const busy = this.decoding.size > 0 && !wanted;
    if (this.retiring.size === 0 && !busy) {
      call();
      return;
    }
    const until =
      this.retiring.size > 0
        ? Math.max(...this.retiring.values())
        : this.sources.clock.currentTime + MUSIC.pollSec;
    this.after(until, () => this.whenFree(ticket, call));
  }

  /** Runs `call` once the context's time reaches `at` (a held context simply makes it wait). */
  private after(at: number, call: () => void): unknown {
    const { clock } = this.sources;
    const left = at - clock.currentTime;
    if (left <= 0) {
      call();
      return null;
    }
    const wait = Math.min(Math.max(left, MUSIC.minWaitSec), MUSIC.pollSec * 4);
    return clock.setTimeout(() => {
      if (clock.currentTime >= at) call();
      else this.after(at, call);
    }, wait * MS_PER_SECOND);
  }

  private cancelPending(): void {
    if (!this.pending) return;
    this.pending = null;
    this.ticket += 1;
  }

  private dropPending(ticket: number): void {
    if (ticket === this.ticket) this.pending = null;
  }

  private clearLeaveTimer(): void {
    if (this.leaveTimer !== null) this.sources.clock.clearTimeout(this.leaveTimer);
    this.leaveTimer = null;
  }

  private clearWatch(): void {
    if (this.watchTimer !== null) this.sources.clock.clearTimeout(this.watchTimer);
    this.watchTimer = null;
  }

  private decks(): Deck[] {
    const list: Deck[] = [...this.retiring.keys()];
    if (this.leaving) list.push(this.leaving);
    if (this.current) list.push(this.current);
    return list;
  }

  private bytesNow(): number {
    let bytes = 0;
    for (const job of this.decoding) bytes += job.bytes;
    for (const deck of this.decks()) bytes += deck.bytes;
    const ready = this.prefetch?.ready;
    if (ready) {
      bytes += ready.buffer.length * ready.buffer.numberOfChannels * Float32Array.BYTES_PER_ELEMENT;
    }
    return bytes;
  }

  private note(): void {
    this.peak = Math.max(this.peak, this.bytesNow());
  }
}

/** Media element sources exist only on a live `AudioContext` with `Audio` around. */
function streamContext(ctx: BaseAudioContext): MediaContext | null {
  if (!('createMediaElementSource' in ctx) || typeof Audio !== 'function') return null;
  return ctx as unknown as MediaContext;
}

/** The live player of the game (`WebAudioService`'s music factory; runs inside the unlocking gesture). */
export const createPlaylistPlayer: MusicFactory = (host) => {
  const { ctx } = host;
  const clock: DeckClock = {
    get currentTime() {
      return ctx.currentTime;
    },
    setTimeout: (call, ms) => globalThis.setTimeout(call, ms),
    clearTimeout: (id) => globalThis.clearTimeout(id as ReturnType<typeof setTimeout>),
  };
  const media = streamContext(ctx);
  const pool = media ? new MediaPool(media, () => new Audio(), MUSIC.streamElements) : null;
  const blessUrl = trackUrl('menu');
  if (pool && blessUrl) pool.bless(blessUrl);
  return new PlaylistPlayer(host, {
    clock,
    // The player is a service, not the core: plain randomness is fine for the first track.
    random: Math.random,
    decode: (track) => {
      const url = trackUrl(track);
      return url ? fetchAndDecode(ctx, url) : null;
    },
    openStream: (track, looping) => {
      const url = trackUrl(track);
      if (!pool || !url) return null;
      return StreamDeck.open(ctx, clock, pool, track, MUSIC_TRACKS[track], url, looping);
    },
  });
};

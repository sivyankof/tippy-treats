import { AUDIO_MIX } from '../../../data/audio/audio-mix';
import { MUSIC, MUSIC_TRACKS, type MusicTrackId } from '../../../data/audio/music';
import { MS_PER_SECOND } from '../../../util/math';
import { fromDb } from '../levels';
import type {
  MusicControl,
  MusicFactory,
  MusicHoldReason,
  MusicHost,
  MusicPlayerState,
} from '../music-control';
import { audioLog, errorText } from '../audio-log';
import { MediaPool, type MediaContext } from './media-pool';
import type { MusicPreload } from './music-preload';
import { firstIndex, nextIndex, turnLength, turnOffset } from './playlist-turn';
import { BufferDeck, StreamDeck, type Deck, type DeckClock } from './tune-deck';
import { fetchAndDecode, trackUrl } from './tune-loader';
import {
  bufferBytes,
  decodedBytes,
  fadeParam,
  prepareLoop,
  trackLoopSec,
  type Decoded,
} from './tune-loop';

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
  /** The playlist this page plays, in order. */
  playlist: readonly MusicTrackId[];
  /** Random numbers in [0, 1): the first track of the playlist (unless `first` picked it). */
  random: () => number;
  /** The first track readied while the game loaded: its index, and the decoded file of a seamless one. */
  first?: { index: number; decoded: { track: MusicTrackId; decoded: Promise<Decoded> } | null };
  /** The decoded file of a seamless track, or null when it has no file. */
  decode(track: MusicTrackId): Promise<AudioBuffer> | null;
  /** A stream deck of a non-seamless track (`looping` when it plays on its own), or null when it cannot be streamed. */
  openStream(track: MusicTrackId, looping: boolean): OpeningDeck | null;
  /** Lets go of everything the sources hold (the media elements); the player is done. */
  release?(): void;
}

/** A track that did not start: what to ask again on the next tap. */
interface Failed {
  track: MusicTrackId;
  offsetSec: number;
  turn: boolean;
  park: boolean;
  /** It was asked again once already (the next failure moves the playlist on). */
  retried: boolean;
}

/** A track asked for and not playing yet; `turn`: as the playlist's turn. */
interface Pending {
  track: MusicTrackId;
  ticket: number;
  turn: boolean;
}

interface Prefetch {
  track: MusicTrackId;
  decoded: Promise<Decoded>;
  /** Set once decoded (it counts in memory from then on, until used or dropped). */
  ready: Decoded | null;
}

/** A wait on the context's clock that can be called off. */
interface Wait {
  cancel(): void;
}

/** What plays: the playlist, one track on its own (an exception), or nothing. */
type Mode = { kind: 'playlist' } | { kind: 'track'; track: MusicTrackId } | null;

/**
 * The music player (docs/06, section 7, "Музыка"). The playlist goes round the page's playlist
 * (`MUSIC_PLAYLIST`, its seamless tracks only where streams cannot play) from a random first track
 * (the preload's pick), each track for at least `minPlaySec` (whole loops of a seamless one, a
 * non-seamless one once), and changes over `crossfadeSec` exactly on the loop boundary (put on the
 * context's clock `switchLeadSec` ahead; the next seamless track is decoded `prefetchSec` ahead,
 * never while a run is played: the turn grows by whole loops instead). An exception (`play`) plays
 * one track round and round; the playlist keeps its turn (track and seconds played) and goes on
 * from there. A hold stops the decks where they are.
 *
 * At most two decks sound at once (the track playing and the one leaving): a new track asked for
 * during a change cuts the leaving one at once, and a track that is leaving comes back from its
 * current level when it is asked for again. A deck left for an exception (or an exception left for
 * another) is parked: held silent and decoded, so coming back needs no decode in the middle of a
 * run. Decoded audio lives only in the decks, the parked one and the prefetched track: at most
 * `maxDecoded` tracks and `memoryCapBytes` at a time, a parked or prefetched track making room for
 * a decode (docs/08 journal).
 */
export class PlaylistPlayer implements MusicControl {
  private current: Deck | null = null;
  private leaving: Deck | null = null;
  private parked: Deck | null = null;
  /** Decks stopping, with the context time they are gone at. */
  private readonly retiring = new Map<Deck, number>();
  /** Decodes running now (a cancelled one too: its memory is taken until it ends), bytes each. */
  private readonly decoding = new Set<{ bytes: number }>();
  private pending: Pending | null = null;
  private failed: Failed | null = null;
  private disposed = false;
  private ticket = 0;
  private leaveWait: Wait | null = null;
  private watchTimer: unknown = null;
  private mode: Mode = null;
  /** The playlist's turn: its track, the seconds played by decks of it that are gone, the deck playing it. */
  private index: number;
  private turnBefore = 0;
  private turnDeck: Deck | null = null;
  /** The turn's deck that left last and the seconds it had played then (taken back if it returns). */
  private lastLeft: { deck: Deck; played: number } | null = null;
  private prefetch: Prefetch | null = null;
  private readonly holds = new Set<MusicHoldReason>();
  /** A run is being played: nothing is decoded, the turn grows by whole loops instead. */
  private isBusy = false;
  /** Seconds the turn grew by while the run was busy at its end. */
  private extraSec = 0;
  private peak = 0;

  constructor(
    private readonly host: MusicHost,
    private readonly sources: PlayerSources,
  ) {
    const { first } = sources;
    this.index = first?.index ?? firstIndex(sources.random, sources.playlist.length);
    const ready = first?.decoded;
    if (ready) {
      const prefetch: Prefetch = { track: ready.track, decoded: ready.decoded, ready: null };
      this.prefetch = prefetch;
      // Still decoding at the tap: its memory counts like any decode until it ends.
      const job = {
        bytes: decodedBytes(MUSIC_TRACKS[ready.track], MUSIC_TRACKS[ready.track].sampleRate),
      };
      this.decoding.add(job);
      const done = (): void => {
        this.decoding.delete(job);
      };
      ready.decoded.then(done, done);
      ready.decoded.then(
        (decoded) => {
          prefetch.ready = decoded;
          this.note();
        },
        () => {
          if (this.prefetch === prefetch) this.prefetch = null;
        },
      );
    }
  }

  playlist(): void {
    // A playlist that plays (or is starting) goes on; one whose start failed starts again.
    if (this.mode?.kind === 'playlist' && (this.current || this.pending)) return;
    this.mode = { kind: 'playlist' };
    this.failed = null;
    const track = this.turnTrack();
    const shape = { loopSec: trackLoopSec(MUSIC_TRACKS[track]), seamless: this.seamless(track) };
    this.show(track, turnOffset(shape, this.turnBefore), true, true);
  }

  play(track: MusicTrackId): void {
    if (this.mode?.kind === 'track' && this.mode.track === track) return;
    this.mode = { kind: 'track', track };
    this.failed = null;
    this.clearWatch();
    if (this.prefetch && this.prefetch.track !== track) this.prefetch = null;
    this.show(track, 0, false, true);
  }

  next(): void {
    this.mode = { kind: 'playlist' };
    this.failed = null;
    this.clearWatch();
    this.prefetch = null;
    this.newTurn(nextIndex(this.index, this.sources.playlist.length));
    this.show(this.turnTrack(), 0, true, false);
  }

  prepare(track: MusicTrackId | null): void {
    if (track === null) {
      if (this.prefetch && this.prefetch.track !== this.nextTrack()) this.prefetch = null;
      return;
    }
    if (this.isBusy || !this.seamless(track)) return;
    if ([this.current, this.leaving, this.parked].some((deck) => deck?.track === track)) return;
    if (this.prefetch?.track === track) return;
    if (this.pending || this.leaving || this.decoding.size > 0 || this.retiring.size > 0) return;
    this.prefetch = null;
    this.startPrefetch(track);
  }

  stop(): void {
    audioLog.add('player: stop');
    this.mode = null;
    this.failed = null;
    this.cancelPending();
    this.clearWatch();
    this.clearLeaveWait();
    this.prefetch = null;
    this.leaveTurn();
    const decks = [this.current, this.leaving];
    this.current = null;
    this.leaving = null;
    for (const deck of decks) if (deck) this.fadeAndRetire(deck, MUSIC.stopSec);
    this.unpark();
    this.host.onPlaying?.(false);
  }

  hold(reason: MusicHoldReason, on: boolean): void {
    const was = this.holds.size > 0;
    if (on) this.holds.add(reason);
    else this.holds.delete(reason);
    const held = this.holds.size > 0;
    if (held === was) return;
    audioLog.add(`player: ${held ? 'held' : 'let go'} [${[...this.holds].join(',')}]`);
    for (const deck of this.liveDecks()) deck.hold(held);
    if (held) this.clearWatch();
    else this.watch();
  }

  busy(on: boolean): void {
    if (on === this.isBusy) return;
    this.isBusy = on;
    if (!on) this.watch();
  }

  state(): MusicPlayerState {
    return {
      track: this.pending?.track ?? this.current?.track ?? null,
      playlist: this.mode?.kind === 'playlist',
      turnSec: this.turnPlayed(),
      decks: this.liveDecks().length,
      decodedBytes: this.bytesNow(),
      buffers: this.decodedTracks(),
      peakBytes: this.peak,
      loading: this.pending !== null,
    };
  }

  resetPeak(): void {
    this.peak = this.bytesNow();
  }

  /**
   * A tap: a track that did not start (a refused `play()`, a failed decode) is asked once more; if it
   * had been asked again already, the playlist moves on to its next track instead.
   */
  gesture(): void {
    const failed = this.failed;
    if (!failed || this.disposed || !this.stillWanted(failed)) return;
    if (!failed.retried) {
      audioLog.add(`player: ${failed.track} asked again after a tap`);
      this.failed = { ...failed, retried: true };
      this.show(failed.track, failed.offsetSec, failed.turn, failed.park);
      return;
    }
    this.failed = null;
    if (failed.turn) {
      audioLog.add(`player: ${failed.track} failed twice, next track`);
      this.next();
    }
  }

  /** Stops at once and lets the media elements go; the player is not used after this. */
  dispose(): void {
    if (this.disposed) return;
    this.stop();
    this.disposed = true;
    this.clearLeaveWait();
    for (const deck of [...this.retiring.keys()]) deck.dispose(this.host.ctx.currentTime);
    this.retiring.clear();
    this.sources.release?.();
  }

  /** The failed track is still what the game wants. */
  private stillWanted(failed: Failed): boolean {
    const { mode } = this;
    if (failed.turn) return mode?.kind === 'playlist' && this.turnTrack() === failed.track;
    return mode?.kind === 'track' && mode.track === failed.track;
  }

  /** `track` did not start: it waits for the next tap (`gesture`); a second failure in a row is kept as such. */
  private startFailed(ticket: number, failed: Omit<Failed, 'retried'>): void {
    if (ticket !== this.ticket) return;
    this.pending = null;
    const again = this.failed?.track === failed.track && this.failed.retried;
    this.failed = { ...failed, retried: again };
  }

  /** The playlist's track now, and the one after it. */
  private turnTrack(): MusicTrackId {
    const list = this.sources.playlist;
    return list[this.index] ?? list[0] ?? 'kitchen';
  }

  private nextTrack(): MusicTrackId | null {
    const list = this.sources.playlist;
    return list[nextIndex(this.index, list.length)] ?? null;
  }

  private seamless(track: MusicTrackId): boolean {
    return MUSIC_TRACKS[track].loop === 'seamless';
  }

  private turnPlayed(): number {
    return this.turnBefore + (this.turnDeck ? this.turnDeck.played() : 0);
  }

  /** The playlist moves to track `index`, from its start. */
  private newTurn(index: number): void {
    this.index = index;
    this.turnDeck = null;
    this.turnBefore = 0;
    this.extraSec = 0;
    this.lastLeft = null;
  }

  /** The turn's deck stops counting (it leaves for an exception or stops); the turn keeps its seconds. */
  private leaveTurn(): void {
    const deck = this.turnDeck;
    if (!deck) return;
    const played = deck.played();
    this.turnBefore += played;
    this.lastLeft = { deck, played };
    this.turnDeck = null;
  }

  /**
   * A deck already alive becomes the turn's deck. If it is the one that left the turn, the seconds
   * it was counted for then are taken back (it has played on since, and goes on counting); any
   * other deck of the track started from its beginning, so the turn starts again with it.
   */
  private adopt(deck: Deck): void {
    if (this.turnDeck === deck) return;
    const left = this.lastLeft;
    this.turnBefore = left?.deck === deck ? Math.max(0, this.turnBefore - left.played) : 0;
    this.lastLeft = null;
    this.turnDeck = deck;
  }

  /** Brings `track` in (`turn`: as the playlist's turn; `park`: the deck it replaces is parked), `offsetSec` into it. */
  private show(track: MusicTrackId, offsetSec: number, turn: boolean, park: boolean): void {
    const { current } = this;
    if (current?.track === track) {
      this.cancelPending();
      current.setLooping?.(!turn);
      if (turn) this.adopt(current);
      this.watch();
      return;
    }
    if (this.leaving?.track === track) {
      this.cancelPending();
      this.swapBack(turn);
      this.watch();
      return;
    }
    if (this.parked?.track === track) {
      this.cancelPending();
      const deck = this.parked;
      this.parked = null;
      if (this.holds.size === 0) deck.hold(false);
      deck.setLooping?.(!turn);
      this.enter(deck, { at: this.host.ctx.currentTime, turn, park, adopted: true });
      return;
    }
    if (this.pending?.track === track && this.pending.turn === turn) return;
    this.cancelPending();
    if (this.turnDeck === current) this.leaveTurn();
    const leaving = this.leaving;
    if (leaving) {
      this.leaving = null;
      this.clearLeaveWait();
      this.cut(leaving);
    }
    if (this.disposed) return;
    const ticket = ++this.ticket;
    audioLog.add(`player: ask ${track}${turn ? ' (playlist)' : ''} at ${offsetSec.toFixed(1)} s`);
    this.pending = { track, ticket, turn };
    this.whenFree(ticket, () => this.open(track, ticket, offsetSec, turn, park));
  }

  private open(
    track: MusicTrackId,
    ticket: number,
    offsetSec: number,
    turn: boolean,
    park: boolean,
  ): void {
    if (ticket !== this.ticket) return;
    if (this.seamless(track)) {
      const decoded = this.decoded(track);
      if (!decoded) {
        audioLog.add(`player: no file for ${track}`);
        this.startFailed(ticket, { track, offsetSec, turn, park });
        return;
      }
      decoded.then(
        ({ buffer, bounds }) => {
          if (ticket !== this.ticket) return;
          const { ctx, tally } = this.host;
          const now = ctx.currentTime;
          const { clock } = this.sources;
          const deck = new BufferDeck(ctx, clock, tally, track, buffer, bounds, now, offsetSec);
          this.enter(deck, { at: now, turn, park, adopted: false });
        },
        // A missing or broken file leaves the music silent, never the game broken.
        (error: unknown) => {
          audioLog.add(`player: decode of ${track} failed, ${errorText(error)}`);
          this.startFailed(ticket, { track, offsetSec, turn, park });
        },
      );
      return;
    }
    const deck = this.sources.openStream(track, !turn);
    if (!deck) {
      audioLog.add(`player: no stream for ${track}`);
      this.startFailed(ticket, { track, offsetSec, turn, park });
      return;
    }
    deck.start(offsetSec).then(
      () => {
        if (ticket !== this.ticket) {
          deck.dispose(this.host.ctx.currentTime);
          return;
        }
        this.enter(deck, { at: this.host.ctx.currentTime, turn, park, adopted: false });
      },
      (error: unknown) => {
        audioLog.add(`player: stream ${track} did not start, ${errorText(error)}`);
        deck.dispose(this.host.ctx.currentTime);
        this.startFailed(ticket, { track, offsetSec, turn, park });
      },
    );
  }

  /**
   * The decoded `track`: the prefetched one when it is that track (a failed prefetch falls back to
   * a decode now), otherwise a new decode.
   */
  private decoded(track: MusicTrackId): Promise<Decoded> | null {
    const prefetch = this.prefetch;
    if (prefetch?.track === track) {
      this.prefetch = null;
      return prefetch.decoded.catch(() => {
        const again = this.decode(track);
        if (!again) throw new Error(`no file for ${track}`);
        return again;
      });
    }
    return this.decode(track);
  }

  /**
   * Decodes `track` and smooths its seam; the decode counts in memory while it runs. A parked or
   * prefetched track goes first when the decode would make one track too many or pass the cap.
   */
  private decode(track: MusicTrackId): Promise<Decoded> | null {
    const bytes = decodedBytes(MUSIC_TRACKS[track], this.host.ctx.sampleRate);
    this.makeRoom(bytes);
    const decoding = this.sources.decode(track);
    if (!decoding) return null;
    const job = { bytes };
    this.decoding.add(job);
    this.note();
    const done = (): void => {
      this.decoding.delete(job);
    };
    decoding.then(done, done);
    return decoding.then((buffer) => ({ buffer, bounds: prepareLoop(buffer, track) }));
  }

  private makeRoom(bytes: number): void {
    const over = (): boolean =>
      this.decodedTracks() + 1 > MUSIC.maxDecoded || this.bytesNow() + bytes > MUSIC.memoryCapBytes;
    if (over()) this.unpark();
    if (over() && this.prefetch?.ready) this.prefetch = null;
  }

  /** The new deck fades in from context time `at` over the one playing, which leaves from then. */
  private enter(
    deck: Deck,
    { at, turn, park, adopted }: { at: number; turn: boolean; park: boolean; adopted: boolean },
  ): void {
    audioLog.add(
      `player: ${deck.track} in at ${at.toFixed(2)} (now ${this.host.ctx.currentTime.toFixed(2)}, ${this.host.ctx.state})`,
    );
    this.pending = null;
    this.failed = null;
    const leaving = this.leaving;
    if (leaving) {
      this.leaving = null;
      this.cut(leaving);
    }
    this.clearLeaveWait();
    deck.gain.connect(this.host.bus);
    if (this.holds.size > 0) deck.hold(true);
    const now = this.host.ctx.currentTime;
    const level = trackLevel(deck.track);
    // From silence the music comes in quickly; over another track it crosses fully.
    const fade = this.current ? MUSIC.crossfadeSec : MUSIC.entrySec;
    fadeParam(deck.gain.gain, now, level, fade, MUSIC.fadeSteps, at);
    const before = this.current;
    if (before) {
      if (this.turnDeck === before) this.leaveTurn();
      this.leave(before, at, park);
    }
    this.current = deck;
    if (turn) {
      if (adopted) this.adopt(deck);
      else this.turnDeck = deck;
    }
    this.host.onPlaying?.(true);
    this.note();
    this.watch();
  }

  /** The leaving track comes back; the one playing leaves in its place. */
  private swapBack(turn: boolean): void {
    const back = this.leaving;
    const gone = this.current;
    if (!back || !gone) return;
    this.clearLeaveWait();
    if (this.turnDeck === gone) this.leaveTurn();
    this.current = back;
    back.setLooping?.(!turn);
    if (turn) this.adopt(back);
    const now = this.host.ctx.currentTime;
    fadeParam(back.gain.gain, now, trackLevel(back.track), MUSIC.crossfadeSec, MUSIC.fadeSteps);
    this.leave(gone, now, false);
  }

  /**
   * `deck` fades out from `at` over the change; at its end it is let go, or parked (`park`), unless
   * it comes back first.
   */
  private leave(deck: Deck, at: number, park: boolean): void {
    this.leaving = deck;
    const now = this.host.ctx.currentTime;
    fadeParam(deck.gain.gain, now, 0, MUSIC.crossfadeSec, MUSIC.fadeSteps, at);
    const end = Math.max(now, at) + MUSIC.crossfadeSec;
    this.leaveWait = this.after(end, () => {
      this.leaveWait = null;
      if (this.leaving !== deck) return;
      this.leaving = null;
      if (park) this.park(deck);
      else this.retire(deck, this.host.ctx.currentTime);
    });
  }

  /** Keeps `deck` held and silent for coming back (the one parked before is let go). */
  private park(deck: Deck): void {
    this.unpark();
    deck.hold(true);
    this.parked = deck;
    this.note();
  }

  /** Lets the parked deck go. */
  private unpark(): void {
    const deck = this.parked;
    if (!deck) return;
    this.parked = null;
    if (this.lastLeft?.deck === deck) this.lastLeft = null;
    this.retire(deck, this.host.ctx.currentTime);
  }

  /** Looks at the playlist's turn: decodes the next track ahead, and puts the change on the clock when it is due. */
  private watch(): void {
    this.clearWatch();
    const deck = this.turnDeck;
    if (this.mode?.kind !== 'playlist' || this.holds.size > 0 || !deck || deck !== this.current) {
      return;
    }
    const length = turnLength(deck, MUSIC.minPlaySec, MUSIC.crossfadeSec) + this.extraSec;
    const remaining = length - this.turnPlayed();
    const decodeNext = this.nextNeedsDecode();
    // A decode's end stalls the main thread: never while a run is played. A turn that grew while
    // the run was busy decodes its next track as soon as the run lets go.
    if (decodeNext && !this.isBusy && (remaining <= MUSIC.prefetchSec || this.extraSec > 0)) {
      this.prefetchNext();
    }
    if (remaining <= MUSIC.switchLeadSec) {
      const ready = !decodeNext || this.prefetch?.ready;
      if (!ready && this.isBusy && this.extend(deck)) {
        this.watchTimer = this.sources.clock.setTimeout(
          () => this.watch(),
          MUSIC.watchSec * MS_PER_SECOND,
        );
        return;
      }
      this.switchAt(this.sources.clock.currentTime + Math.max(0, remaining));
      return;
    }
    const wait = Math.min(MUSIC.watchSec, remaining - MUSIC.switchLeadSec);
    this.watchTimer = this.sources.clock.setTimeout(() => this.watch(), wait * MS_PER_SECOND);
  }

  /** The playlist's next track has to be decoded (a seamless one) and is not decoded yet. */
  private nextNeedsDecode(): boolean {
    const track = this.nextTrack();
    if (!track || !this.seamless(track)) return false;
    return !(this.prefetch?.track === track && this.prefetch.ready);
  }

  /** The turn grows by one more loop (or pass) of `deck`; false when it cannot. */
  private extend(deck: Deck): boolean {
    if (deck.seamless) {
      this.extraSec += deck.loopSec;
      return true;
    }
    if (!deck.extend?.()) return false;
    this.extraSec += deck.loopSec - MUSIC.loopOverlapSec;
    return true;
  }

  /** Decodes the next seamless track of the playlist, when nothing else is changing. */
  private prefetchNext(): void {
    const track = this.nextTrack();
    if (!track || !this.seamless(track) || this.prefetch?.track === track) return;
    if (this.pending || this.leaving) return;
    if (this.decoding.size > 0 || this.retiring.size > 0) return;
    this.prefetch = null;
    this.startPrefetch(track);
  }

  private startPrefetch(track: MusicTrackId): void {
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
    this.newTurn(nextIndex(this.index, this.sources.playlist.length));
    const track = this.turnTrack();
    audioLog.add(`player: turn to ${track} at ${at.toFixed(2)}`);
    const ready = this.prefetch?.track === track ? this.prefetch.ready : null;
    if (ready) {
      // Exactly on the boundary: the new deck and both fades are put on the context's clock.
      this.prefetch = null;
      this.cancelPending();
      const { ctx, tally } = this.host;
      const { clock } = this.sources;
      const deck = new BufferDeck(ctx, clock, tally, track, ready.buffer, ready.bounds, at, 0);
      this.enter(deck, { at, turn: true, park: false, adopted: false });
      return;
    }
    // A stream (or a decode not ready in time) starts when the boundary comes.
    const index = this.index;
    this.after(at, () => {
      if (this.mode?.kind === 'playlist' && this.index === index && !this.turnDeck) {
        this.show(track, 0, true, false);
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
  private after(at: number, call: () => void): Wait {
    const { clock } = this.sources;
    let timer: unknown = null;
    let cancelled = false;
    const check = (): void => {
      timer = null;
      if (cancelled) return;
      const left = at - clock.currentTime;
      if (left <= 0) {
        call();
        return;
      }
      const wait = Math.min(Math.max(left, MUSIC.minWaitSec), MUSIC.pollSec * 4);
      timer = clock.setTimeout(check, wait * MS_PER_SECOND);
    };
    check();
    return {
      cancel: () => {
        cancelled = true;
        if (timer !== null) clock.clearTimeout(timer);
      },
    };
  }

  private cancelPending(): void {
    if (!this.pending) return;
    this.pending = null;
    this.ticket += 1;
  }

  private clearLeaveWait(): void {
    this.leaveWait?.cancel();
    this.leaveWait = null;
  }

  private clearWatch(): void {
    if (this.watchTimer !== null) this.sources.clock.clearTimeout(this.watchTimer);
    this.watchTimer = null;
  }

  /** Decks that sound or are stopping (the parked one is held apart). */
  private liveDecks(): Deck[] {
    const list: Deck[] = [...this.retiring.keys()];
    if (this.leaving) list.push(this.leaving);
    if (this.current) list.push(this.current);
    return list;
  }

  /** Decoded tracks in memory now (streams hold none). */
  private decodedTracks(): number {
    const decks = [...this.liveDecks(), this.parked].filter((deck) => deck && deck.bytes > 0);
    return decks.length + this.decoding.size + (this.prefetch?.ready ? 1 : 0);
  }

  private bytesNow(): number {
    let bytes = 0;
    for (const job of this.decoding) bytes += job.bytes;
    for (const deck of this.liveDecks()) bytes += deck.bytes;
    if (this.parked) bytes += this.parked.bytes;
    const ready = this.prefetch?.ready;
    if (ready) bytes += bufferBytes(ready.buffer);
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

/** What the live player is built with (`services/index.ts`). */
export interface LivePlayerOptions {
  playlist: readonly MusicTrackId[];
  /** Media elements may play (false on iOS before 16.4: no streams, no element pool). */
  streams: boolean;
  preload: MusicPreload;
  /**
   * Bless the elements at the unlock (a browser on iOS: an element may play later without a gesture
   * once it played in one). The app plays media without a gesture and skips it: eight elements
   * loading one file at once through the app's file scheme stall for seconds.
   */
  bless: boolean;
}

/** The live player of the game (`WebAudioService`'s music factory; runs inside the unlocking gesture). */
export function playlistPlayerFactory({
  playlist,
  streams,
  preload,
  bless,
}: LivePlayerOptions): MusicFactory {
  return (host) => {
    const { ctx } = host;
    const clock: DeckClock = {
      get currentTime() {
        return ctx.currentTime;
      },
      setTimeout: (call, ms) => globalThis.setTimeout(call, ms),
      clearTimeout: (id) => globalThis.clearTimeout(id as ReturnType<typeof setTimeout>),
    };
    const media = streams ? streamContext(ctx) : null;
    // The element already loading the first track (if it is a stream) is the first of the pool.
    const make = (): HTMLMediaElement => preload.takeElement() ?? new Audio();
    const pool = media ? new MediaPool(media, make, MUSIC.streamElements) : null;
    const blessUrl = trackUrl('menu');
    if (bless && pool && blessUrl) pool.bless(blessUrl);
    return new PlaylistPlayer(host, {
      clock,
      playlist,
      // The player is a service, not the core: plain randomness is fine for the first track.
      random: Math.random,
      first: { index: preload.index, decoded: preload.takeDecoded() },
      decode: (track) => {
        const url = trackUrl(track);
        return url ? fetchAndDecode(ctx, url) : null;
      },
      release: () => pool?.dispose(),
      openStream: (track, looping) => {
        const url = trackUrl(track);
        if (!pool || !url) return null;
        return StreamDeck.open(ctx, clock, pool, track, MUSIC_TRACKS[track], url, looping);
      },
    });
  };
}

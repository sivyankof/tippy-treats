import { AUDIO_MIX } from '../../../data/audio-mix';
import { MUSIC, MUSIC_TRACKS, type MusicTrackId } from '../../../data/music';
import { MS_PER_SECOND } from '../../../util/math';
import { fromDb } from '../levels';
import type { MusicControl, MusicFactory, MusicHost, MusicPlayerState } from '../music-control';
import { MediaPool, type MediaContext } from './media-pool';
import { BufferDeck, StreamDeck, type Deck, type DeckClock } from './tune-deck';
import { fetchAndDecode, trackUrl } from './tune-loader';
import { decodedBytes, fadeParam, loopBounds, smoothSeam } from './tune-loop';

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
  start(): Promise<void>;
}

/** How the player gets its tracks (the browser's in the game, fakes in tests). */
export interface PlayerSources {
  clock: DeckClock;
  /** The decoded file of a seamless track, or null when it has no file. */
  decode(track: MusicTrackId): Promise<AudioBuffer> | null;
  /** A stream deck of a long track, or null when it cannot be streamed (no file, no free element). */
  openStream(track: MusicTrackId): OpeningDeck | null;
}

interface Pending {
  track: MusicTrackId;
  ticket: number;
}

/**
 * The music player (docs/06, section 7, "Музыка"): one track at a time, changes faded over
 * `crossfadeSec`. At most two decks sound at once (the track playing and the one leaving): a
 * new track asked for during a change cuts the leaving one at once, and a track that is leaving
 * comes back from its current level when it is asked for again. Decoded audio lives only in the
 * decks, so memory holds the track playing and the one coming in; the decode of a new track waits
 * until the cut decks are gone (the memory cap, docs/08 journal).
 */
export class PlaylistPlayer implements MusicControl {
  private current: Deck | null = null;
  private leaving: Deck | null = null;
  /** Decks stopping, with the context time they are gone at. */
  private readonly retiring = new Map<Deck, number>();
  private pending: Pending | null = null;
  /** Decodes running now (a cancelled one too: its memory is taken until it ends), bytes each. */
  private readonly decoding = new Set<{ bytes: number }>();
  private ticket = 0;
  private leaveTimer: unknown = null;
  private held = false;
  private peak = 0;

  constructor(
    private readonly host: MusicHost,
    private readonly sources: PlayerSources,
  ) {}

  play(track: MusicTrackId): void {
    if (this.pending?.track === track) return;
    if (this.current?.track === track) {
      this.cancelPending();
      return;
    }
    if (this.leaving?.track === track) {
      this.cancelPending();
      this.swapBack();
      return;
    }
    this.cancelPending();
    const leaving = this.leaving;
    if (leaving) {
      this.leaving = null;
      this.clearLeaveTimer();
      this.cut(leaving);
    }
    const ticket = ++this.ticket;
    this.pending = { track, ticket };
    this.whenFree(ticket, () => this.open(track, ticket));
  }

  stop(): void {
    this.cancelPending();
    this.clearLeaveTimer();
    const decks = [this.current, this.leaving];
    this.current = null;
    this.leaving = null;
    for (const deck of decks) if (deck) this.fadeAndRetire(deck, MUSIC.stopSec);
    this.host.onPlaying?.(false);
  }

  hold(on: boolean): void {
    this.held = on;
    for (const deck of this.decks()) deck.hold(on);
  }

  state(): MusicPlayerState {
    return {
      track: this.pending?.track ?? this.current?.track ?? null,
      decks: this.decks().length,
      decodedBytes: this.bytesNow(),
      peakBytes: this.peak,
    };
  }

  resetPeak(): void {
    this.peak = this.bytesNow();
  }

  private open(track: MusicTrackId, ticket: number): void {
    if (ticket !== this.ticket) return;
    const spec = MUSIC_TRACKS[track];
    if (spec.loop === 'seamless') {
      const decoding = this.sources.decode(track);
      if (!decoding) {
        this.dropPending(ticket);
        return;
      }
      const job = { bytes: decodedBytes(spec, this.host.ctx.sampleRate) };
      this.decoding.add(job);
      this.note();
      const done = (): void => {
        this.decoding.delete(job);
      };
      decoding.then(done, done);
      decoding.then(
        (buffer) => {
          if (ticket !== this.ticket) return;
          const rate = buffer.sampleRate;
          const bounds = loopBounds(buffer.length, spec, rate, MUSIC.aacPrimingFrames);
          const smooth = Math.round(MUSIC.seamSmoothSec * rate);
          for (let c = 0; c < buffer.numberOfChannels; c++) {
            smoothSeam(buffer.getChannelData(c), bounds.start, bounds.end, smooth, MUSIC.seam);
          }
          const { ctx, tally } = this.host;
          this.enter(new BufferDeck(ctx, tally, track, buffer, bounds, ctx.currentTime));
        },
        // A missing or broken file leaves the music silent, never the game broken.
        () => this.dropPending(ticket),
      );
      return;
    }
    const deck = this.sources.openStream(track);
    if (!deck) {
      this.dropPending(ticket);
      return;
    }
    deck.start().then(
      () => {
        if (ticket === this.ticket) this.enter(deck);
        else deck.dispose(this.host.ctx.currentTime);
      },
      () => {
        deck.dispose(this.host.ctx.currentTime);
        this.dropPending(ticket);
      },
    );
  }

  /** The new deck fades in over the one playing, which becomes the leaving one. */
  private enter(deck: Deck): void {
    this.pending = null;
    const leaving = this.leaving;
    if (leaving) {
      this.leaving = null;
      this.cut(leaving);
    }
    this.clearLeaveTimer();
    deck.gain.connect(this.host.bus);
    if (this.held) deck.hold(true);
    const now = this.host.ctx.currentTime;
    fadeParam(deck.gain.gain, now, trackLevel(deck.track), MUSIC.crossfadeSec, MUSIC.fadeSteps);
    if (this.current) this.leave(this.current);
    this.current = deck;
    this.host.onPlaying?.(true);
    this.note();
  }

  /** The leaving track comes back; the one playing leaves in its place. */
  private swapBack(): void {
    const back = this.leaving;
    const gone = this.current;
    if (!back || !gone) return;
    this.clearLeaveTimer();
    this.current = back;
    const now = this.host.ctx.currentTime;
    fadeParam(back.gain.gain, now, trackLevel(back.track), MUSIC.crossfadeSec, MUSIC.fadeSteps);
    this.leave(gone);
  }

  /** `deck` fades out over the change and is let go at its end, unless it comes back first. */
  private leave(deck: Deck): void {
    this.leaving = deck;
    const now = this.host.ctx.currentTime;
    fadeParam(deck.gain.gain, now, 0, MUSIC.crossfadeSec, MUSIC.fadeSteps);
    const end = now + MUSIC.crossfadeSec;
    this.leaveTimer = this.after(end, () => {
      this.leaveTimer = null;
      if (this.leaving !== deck) return;
      this.leaving = null;
      this.retire(deck, this.host.ctx.currentTime);
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
    deck.dispose(at);
    this.retiring.set(deck, at);
    this.note();
    this.after(at, () => {
      this.retiring.delete(deck);
    });
  }

  /**
   * Runs `call` once no deck is stopping and no decode runs (at once when so): a new decode never
   * adds to memory that is still being let go. A newer play cancels it.
   */
  private whenFree(ticket: number, call: () => void): void {
    if (ticket !== this.ticket) return;
    if (this.retiring.size === 0 && this.decoding.size === 0) {
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
    const wait = Math.max(left, MUSIC.minWaitSec);
    return clock.setTimeout(
      () => {
        if (clock.currentTime >= at) call();
        else this.after(at, call);
      },
      Math.min(wait, MUSIC.pollSec * 4) * MS_PER_SECOND,
    );
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
    decode: (track) => {
      const url = trackUrl(track);
      return url ? fetchAndDecode(ctx, url) : null;
    },
    openStream: (track) => {
      const url = trackUrl(track);
      if (!pool || !url) return null;
      return StreamDeck.open(ctx, clock, pool, track, MUSIC_TRACKS[track], url);
    },
  });
};

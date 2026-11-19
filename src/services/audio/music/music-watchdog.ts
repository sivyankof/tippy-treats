import { MUSIC_WATCHDOG } from '../../../data/audio/music-watchdog';

/** What the watchdog looks at, once per check. */
export interface WatchInput {
  /** The playlist is asked, the music is on and nothing holds the sound or the music. */
  wanted: boolean;
  /** The music bus carries sound now. */
  audible: boolean;
  /** A track was asked for and is still loading or starting. */
  loading: boolean;
  nowMs: number;
}

/** The watchdog's numbers (`MUSIC_WATCHDOG` in the game). */
export type WatchdogConfig = Record<'silentMs' | 'loadingMaxMs' | 'minGapMs' | 'maxGapMs', number>;

/**
 * Decides when a playlist that should be heard and is not gets started again: silent for
 * `silentMs` while nothing loads, or loading for longer than `loadingMaxMs`. Restarts keep
 * `minGapMs` apart, the gap doubling with each restart in a row (up to `maxGapMs`) until the
 * music is heard again.
 */
export class MusicWatchdog {
  private silentSince: number | null = null;
  private loadingSince: number | null = null;
  private lastRestart: number | null = null;
  private gapMs: number;
  /** Restarts so far. */
  restarts = 0;

  constructor(private readonly cfg: WatchdogConfig = MUSIC_WATCHDOG) {
    this.gapMs = cfg.minGapMs;
  }

  /** True when the playlist should be started again now. */
  check({ wanted, audible, loading, nowMs }: WatchInput): boolean {
    if (!wanted || audible) {
      this.silentSince = null;
      this.loadingSince = null;
      if (audible) this.gapMs = this.cfg.minGapMs;
      return false;
    }
    if (loading) {
      this.silentSince = null;
      this.loadingSince ??= nowMs;
      if (nowMs - this.loadingSince < this.cfg.loadingMaxMs) return false;
    } else {
      this.loadingSince = null;
      this.silentSince ??= nowMs;
      if (nowMs - this.silentSince < this.cfg.silentMs) return false;
    }
    if (this.lastRestart !== null && nowMs - this.lastRestart < this.gapMs) return false;
    if (this.lastRestart !== null) this.gapMs = Math.min(this.gapMs * 2, this.cfg.maxGapMs);
    this.lastRestart = nowMs;
    this.silentSince = null;
    this.loadingSince = null;
    this.restarts += 1;
    return true;
  }

  /** Starts over (a new player): nothing counted, the shortest gap. */
  reset(): void {
    this.silentSince = null;
    this.loadingSince = null;
    this.lastRestart = null;
    this.gapMs = this.cfg.minGapMs;
  }
}

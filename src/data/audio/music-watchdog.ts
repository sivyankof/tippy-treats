/** The music watchdog (services/audio/music/music-watchdog.ts, docs/06, section 7, "Сторож музыки"). */
export const MUSIC_WATCHDOG = {
  /** The music bus is looked at this often, ms. */
  checkMs: 500,
  /** The playlist is asked, nothing holds it, and the bus stays silent this long: it starts again, ms. */
  silentMs: 3000,
  /** A track still loading or starting after this long counts as stuck too, ms (a decode under way is kept). */
  loadingMaxMs: 30000,
  /** A context that does not run while the playlist should be heard is asked to run this often, ms. */
  resumeEveryMs: 3000,
  /** No two restarts closer than this, ms; each restart in a row doubles it up to `maxGapMs`. */
  minGapMs: 8000,
  maxGapMs: 60000,
  /** Peak of the music bus (0..1) above which the music counts as heard (-60 dBFS). */
  audibleLevel: 0.001,
  /** Samples the meter reads per look. */
  meterSize: 512,
} as const;

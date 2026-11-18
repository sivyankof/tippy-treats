/**
 * Numbers of the music player (docs/06-art-animation-audio.md, section 7, "Музыка"; section 9 for
 * weak phones). Times are seconds unless named `Ms`, levels linear.
 */
export const MUSIC_PLAY = {
  /** The look-ahead clock: wakes this often and schedules the notes that start within `aheadSec`. */
  tickMs: 25,
  aheadSec: 0.15,
  /** The first note of a tune starts this long after `start`. */
  startLeadSec: 0.06,
  /** Time constant of the tune's own level when it starts (a soft entry, no click). */
  entryRampSec: 0.25,
  /** Time constant of the fade when the tune stops; its voices are cut after `stopCutSec`. */
  stopRampSec: 0.04,
  stopCutSec: 0.25,
  /**
   * Level of every tune into the music bus. The bed sits well under the effects: with all six
   * layers a tune reads about -31 dBFS RMS at the output, the drop about -30 and the perfect bell
   * -25 (their sounding parts), so a drop or a bell always comes through.
   */
  tuneLevel: 0.33,
  /** The menu plays layer 1 at this share of the run level. */
  menuLevel: 0.55,
  /** Time constant of the change between the menu and the run level. */
  menuRampSec: 0.4,
  /** A part that joins fades in over this many bars from the next bar line; one that leaves fades out over `fadeOutBars`. */
  fadeInBars: 2,
  fadeOutBars: 1,
  /** Layers of a tune: one per zone. */
  layers: 6,
  /** On the minimal effects level the music plays at most this many layers (no pad, fewer voices). */
  minimalLayerCap: 3,
  /** A safety cap: notes beyond this many live voices are skipped. */
  maxVoices: 40,
  /** A part quieter than this share is not played at all. */
  silentLevel: 0.001,
} as const;

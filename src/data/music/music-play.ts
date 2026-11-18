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
   * -26..-29 (their sounding parts), so a drop or a bell always comes through.
   */
  tuneLevel: 0.65,
  /** The menu plays the layers up to this one (electric piano, tape and bass) ... */
  menuLayer: 2,
  /** ... at this share of the run level. */
  menuLevel: 0.6,
  /** Time constant of the change between the menu and the run level. */
  menuRampSec: 0.4,
  /** A part that joins fades in over this many bars from the next bar line; one that leaves fades out over `fadeOutBars`. */
  fadeInBars: 2,
  fadeOutBars: 1,
  /** Layers of a tune: one per zone. */
  layers: 6,
  /** On the minimal effects level the music leaves out layer 6 (the reverb is already off from `lite`). */
  minimalLayerCap: 5,
  /** A safety cap: notes beyond this many live voices are skipped (the piano notes ring for 3 s). */
  maxVoices: 48,
  /** A part quieter than this share is not played at all. */
  silentLevel: 0.001,
} as const;

/**
 * The music chain (built once per player, `services/audio/music/music-chain.ts`): the keys
 * filter, the bus "air" lowpass, soft saturation, the kick pump, a short delay-line reverb, tape
 * hiss and crackle, the slow tape wobble of the electric piano. Frequencies Hz, times s.
 */
export const MUSIC_BUS = {
  /** Lowpass of the electric piano and the melody (the soft, dark top of a worn electric piano). */
  keysCutoff: 2000,
  keysQ: 0.5,
  /** Lowpass of the whole music bus. */
  airCutoff: 6500,
  airQ: 0.5,
  /** Soft saturation: `tanh(drive * x) / drive` (unity at low level, rounds the peaks). */
  drive: 1.6,
  curveSize: 2049,
  /** Kick pump: the rest of the music dips this much on each kick and comes back. */
  pump: { depthDb: 1.5, attackSec: 0.012, releaseSec: 0.09 },
  /** Tape wobble of the electric piano: one slow LFO on every note's pitch. */
  wobble: { rateHz: 0.4, depthCents: 6 },
  /**
   * Short reverb: four feedback delay lines (damped by a lowpass in the loop), two to the left
   * and two to the right, mixed back at `wet`. `tailSec` is how long it rings after it is
   * switched off before its nodes are let go.
   */
  reverb: {
    delays: [0.0297, 0.0371, 0.0411, 0.0437],
    feedback: 0.74,
    damping: 2600,
    wet: 0.2,
    switchSec: 0.05,
    tailSec: 1.5,
  },
  /**
   * Tape and vinyl: a looped hiss (pinkish, its top rolled off) and rare crackles, each with its
   * own level. `crackleChance` is per beat.
   */
  tape: {
    hissLevel: 0.018,
    hissSeconds: 4.3,
    hissCutoff: 3200,
    hissLoopFadeSec: 0.05,
    crackleLevel: 0.08,
    crackleChance: 0.09,
    crackleSec: 0.004,
    crackleRate: { min: 0.6, max: 1.4 },
    crackleGain: { min: 0.35, max: 1 },
  },
} as const;

/** The soundboard knobs of the music (multipliers, 1 in the game) and the reverb switch. */
export interface MusicMix {
  tape: number;
  drums: number;
  melody: number;
  reverb: boolean;
}

export const DEFAULT_MUSIC_MIX: MusicMix = { tape: 1, drums: 1, melody: 1, reverb: true };

import { SOUND_BOOK, type SoundEntry } from './sound-book';
import type { SoundArgs, SoundId } from './sound-args';
import type { Synth } from './synth';
import { VoiceGate } from './voice-gate';

/** What `SoundPlayer.play` reports: the sound was refused by the gate, or it plays for `length` seconds. */
export type PlayResult = { played: false } | { played: true; length: number; ducksMusic: boolean };

const REFUSED: PlayResult = { played: false };

/**
 * Plays registry sounds through a synth, behind the voice gate (dedupe, cap, priorities).
 * The one place where a sound is admitted and measured, so the live service and the offline
 * render treat a crowd of sounds the same way.
 */
export class SoundPlayer {
  constructor(
    private readonly synth: Synth,
    private readonly gate: VoiceGate = new VoiceGate(),
  ) {}

  /**
   * Starts sound `id` now, or `delay` seconds from now (the gate looks at that moment).
   * A sound the gate refuses, or one that schedules no notes, reports `played: false`.
   */
  play<K extends SoundId>(id: K, args: SoundArgs[K], delay = 0): PlayResult {
    const entry = SOUND_BOOK[id] as unknown as SoundEntry<unknown[]>;
    const at = this.synth.now + delay;
    if (!this.gate.admit(id, entry.priority, at)) return REFUSED;
    const length = this.synth.measure(() => {
      this.synth.at(delay, () => entry.play(this.synth, ...args));
    });
    if (length <= 0) return REFUSED;
    this.gate.hold(at, length - delay);
    return { played: true, length, ducksMusic: entry.ducksMusic === true };
  }
}

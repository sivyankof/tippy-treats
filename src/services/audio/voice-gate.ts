import { AUDIO_MIX } from '../../data/audio/audio-mix';

/** How much a sound matters when the output is crowded (docs/06, section 7). */
export type SoundPriority = 'critical' | 'normal' | 'ambient';

export interface VoiceGateConfig {
  dedupeSec: number;
  dedupeById: Readonly<Record<string, number>>;
  voiceCap: { normal: number; ambient: number };
}

/**
 * Decides which sounds may start. Two rules: the same sound id does not start again within the
 * dedupe time; and a cap on the sounds in flight (sounds, not nodes) that refuses `ambient` first,
 * then `normal`, and never `critical`. Pure: the caller passes the time in seconds.
 */
export class VoiceGate {
  private readonly lastStart = new Map<string, number>();
  private ends: number[] = [];

  constructor(private readonly config: VoiceGateConfig = AUDIO_MIX) {}

  /** Sounds still sounding at `now`. */
  active(now: number): number {
    this.ends = this.ends.filter((end) => end > now);
    return this.ends.length;
  }

  /** True when the sound may start at `now`; a started sound must then be reported with `hold`. */
  admit(id: string, priority: SoundPriority, now: number): boolean {
    const gap = this.config.dedupeById[id] ?? this.config.dedupeSec;
    const last = this.lastStart.get(id);
    if (last !== undefined && now >= last && now - last < gap) return false;
    if (priority !== 'critical') {
      const cap =
        priority === 'ambient' ? this.config.voiceCap.ambient : this.config.voiceCap.normal;
      if (this.active(now) >= cap) return false;
    }
    this.lastStart.set(id, now);
    return true;
  }

  /** Reports that an admitted sound runs from `now` for `length` seconds. */
  hold(now: number, length: number): void {
    if (length > 0) this.ends.push(now + length);
  }
}

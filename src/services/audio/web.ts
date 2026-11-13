import type { Rarity } from '../../data/rarity';
import { SFX } from '../../data/sfx';
import { collapseThudGain, comboGainScale, comboNoteFreq, jitterRatio, noteFreq } from './notes';
import { Synth } from './synth';
import type { AudioService } from './types';

/** Creates an audio context, or returns null when Web Audio is not available. */
export type AudioContextFactory = () => AudioContext | null;

interface WebAudioGlobals {
  AudioContext?: typeof AudioContext;
  webkitAudioContext?: typeof AudioContext;
}

/** Default factory: the standard or the prefixed constructor, null when neither exists. */
export function createBrowserAudioContext(): AudioContext | null {
  const g = globalThis as WebAudioGlobals;
  const Ctor = g.AudioContext ?? g.webkitAudioContext;
  return Ctor ? new Ctor() : null;
}

/**
 * Web Audio implementation of the sound effects. The context is created on `unlock()` (a user
 * gesture); sounds requested before that, while disabled, hidden or without Web Audio are dropped.
 */
export class WebAudioService implements AudioService {
  private on = true;
  private hidden = false;
  private ctx: AudioContext | null = null;
  private synth: Synth | null = null;
  private lastThudAt = -Infinity;

  constructor(
    private readonly createContext: AudioContextFactory = createBrowserAudioContext,
    private readonly random: () => number = Math.random,
  ) {}

  get enabled(): boolean {
    return this.on;
  }

  setEnabled(on: boolean): void {
    this.on = on;
  }

  unlock(): void {
    if (!this.ctx) {
      try {
        const ctx = this.createContext();
        if (!ctx) return;
        this.ctx = ctx;
        this.synth = new Synth(ctx);
      } catch {
        this.ctx = null;
        this.synth = null;
        return;
      }
    }
    if (!this.hidden) this.run((ctx) => ctx.resume());
  }

  suspend(): void {
    this.hidden = true;
    this.run((ctx) => ctx.suspend());
  }

  resume(): void {
    this.hidden = false;
    this.run((ctx) => ctx.resume());
  }

  drop(): void {
    this.play((s) => {
      const pitch = jitterRatio(SFX.drop.pitchJitter, this.random);
      s.tone(SFX.drop.thump, { pitch });
      s.noise(SFX.drop.slap, { pitch });
    });
  }

  perfect(comboStep: number): void {
    this.play((s) => {
      const bell = SFX.perfect;
      const freq = comboNoteFreq(comboStep);
      const scale = comboGainScale(comboStep);
      for (const p of bell.partials) {
        s.tone(
          {
            wave: 'sine',
            freq: freq * p.ratio,
            attack: bell.attack,
            duration: bell.duration * p.decay,
            gain: p.gain,
          },
          { gain: scale },
        );
      }
    });
  }

  bite(): void {
    this.play((s) => s.noiseSequence(SFX.bite.bursts));
  }

  coin(): void {
    this.play((s) => s.sequence(SFX.coin.notes));
  }

  berry(): void {
    this.play((s) => s.chord(SFX.berry, SFX.berry.freqs, SFX.berry.stagger));
  }

  ability(rarity: Rarity): void {
    this.play((s) => {
      s.noise(SFX.ability.puff);
      s.sequence(SFX.ability.byRarity[rarity].notes);
    });
  }

  shieldPop(): void {
    this.play((s) => {
      s.tone(SFX.shieldPop.blip);
      s.noise(SFX.shieldPop.pop);
    });
  }

  sneeze(): void {
    this.play((s) => {
      s.tone(SFX.sneeze.squeak);
      s.noise(SFX.sneeze.puff, { delay: SFX.sneeze.puff.delay });
    });
  }

  miss(): void {
    this.play((s) => {
      s.tone(SFX.miss.whistle);
      s.tone(SFX.miss.boom, { delay: SFX.miss.boomDelay });
      s.noise(SFX.miss.boomNoise, { delay: SFX.miss.boomDelay });
    });
  }

  collapseThud(index: number): void {
    this.play((s) => {
      if (s.now - this.lastThudAt < SFX.collapse.minIntervalSec) return;
      this.lastThudAt = s.now;
      s.tone(SFX.collapse.thud, {
        gain: collapseThudGain(index),
        pitch: jitterRatio(SFX.collapse.pitchJitter, this.random),
      });
    });
  }

  record(): void {
    this.play((s) => {
      const fan = SFX.record;
      const last = fan.semitones.length - 1;
      fan.semitones.forEach((semitones, i) => {
        s.tone(
          {
            wave: fan.wave,
            freq: noteFreq(fan.rootFreq, semitones),
            attack: fan.attack,
            duration: i === last ? fan.finalDuration : fan.duration,
            gain: fan.gain,
          },
          { delay: i * fan.spacing },
        );
      });
    });
  }

  click(): void {
    this.play((s) => s.tone(SFX.click));
  }

  squeak(pitch: number): void {
    this.play((s) =>
      s.tone(SFX.squeak, { pitch: Number.isFinite(pitch) && pitch > 0 ? pitch : 1 }),
    );
  }

  /** Plays through the synth if sound is on, unlocked and visible; never throws. */
  private play(sound: (synth: Synth) => void): void {
    if (!this.on || this.hidden || !this.synth) return;
    try {
      sound(this.synth);
    } catch {
      // A failing sound must never break the game.
    }
  }

  /** Runs a context call, ignoring both sync errors and rejected promises. */
  private run(call: (ctx: AudioContext) => Promise<void>): void {
    if (!this.ctx) return;
    try {
      call(this.ctx).catch(() => undefined);
    } catch {
      // Ignore: the context may be closed.
    }
  }
}

import { RARITIES } from '../../data/rarity';
import { SFX } from '../../data/sfx';
import { collapseThudGain, comboGainScale, comboNoteFreq, jitterRatio, noteFreq } from './notes';
import type { SoundArgs, SoundId } from './sound-args';
import type { Synth } from './synth';
import type { SoundPriority } from './voice-gate';

/** Sections of the soundboard; also the way the sounds are grouped in the docs. */
export const SOUND_GROUPS = [
  'drop', // throw and combo
  'cut', // cuts
  'topper', // toppers
  'weather',
  'creature',
  'ui',
  'reward',
] as const;

export type SoundGroup = (typeof SOUND_GROUPS)[number];

/** One argument set the soundboard offers for a sound, with its short label. */
export interface SoundVariant<A extends unknown[]> {
  label: string;
  args: A;
}

/**
 * One sound of the game. `play` schedules the notes on the synth and nothing else: gating,
 * the bus and the context are the caller's (`SoundPlayer`, live or offline), so a sound renders
 * the same everywhere. Recipes are data (`data/sfx.ts`); this only interprets them.
 */
export interface SoundEntry<A extends unknown[]> {
  group: SoundGroup;
  priority: SoundPriority;
  play(synth: Synth, ...args: A): void;
  /** Argument sets for the soundboard and the offline render; none for a sound without arguments. */
  variants?: readonly SoundVariant<A>[];
  /** The music is turned down for the length of this sound (the record fanfare). */
  ducksMusic?: true;
  /** Marked "for the owner to decide" on the soundboard. */
  ownerChoice?: true;
}

export type SoundBook = { [K in SoundId]: SoundEntry<SoundArgs[K]> };

export const SOUND_BOOK: SoundBook = {
  drop: {
    group: 'drop',
    priority: 'critical',
    play(s) {
      const pitch = jitterRatio(SFX.drop.pitchJitter, s.random);
      s.tone(SFX.drop.thump, { pitch });
      s.noise(SFX.drop.slap, { pitch });
    },
  },
  perfect: {
    group: 'drop',
    priority: 'critical',
    variants: [1, 6, 12].map((step) => ({ label: `×${step}`, args: [step] as [number] })),
    play(s, comboStep) {
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
    },
  },
  bite: {
    group: 'drop',
    priority: 'normal',
    play: (s) => s.noiseSequence(SFX.bite.bursts),
  },
  miss: {
    group: 'drop',
    priority: 'critical',
    play(s) {
      s.tone(SFX.miss.whistle);
      s.tone(SFX.miss.boom, { delay: SFX.miss.boomDelay });
      s.noise(SFX.miss.boomNoise, { delay: SFX.miss.boomDelay });
    },
  },
  collapseThud: {
    group: 'drop',
    priority: 'normal',
    variants: [0, 5, 20].map((index) => ({ label: `#${index + 1}`, args: [index] as [number] })),
    play: (s, index) =>
      s.tone(SFX.collapse.thud, {
        gain: collapseThudGain(index),
        pitch: jitterRatio(SFX.collapse.pitchJitter, s.random),
      }),
  },
  topperHop: {
    group: 'topper',
    priority: 'normal',
    play(s) {
      const { notes, click } = SFX.topperHop;
      s.sequence(notes);
      s.noise(click);
    },
  },
  squeak: {
    group: 'creature',
    priority: 'normal',
    variants: [0.8, 1, 1.3].map((pitch) => ({ label: `×${pitch}`, args: [pitch] as [number] })),
    play: (s, pitch) =>
      s.tone(SFX.squeak, { pitch: Number.isFinite(pitch) && pitch > 0 ? pitch : 1 }),
  },
  sneeze: {
    group: 'creature',
    priority: 'normal',
    play(s) {
      s.tone(SFX.sneeze.squeak);
      s.noise(SFX.sneeze.puff, { delay: SFX.sneeze.puff.delay });
    },
  },
  ability: {
    group: 'creature',
    priority: 'normal',
    variants: RARITIES.map((rarity) => ({ label: rarity, args: [rarity] as [typeof rarity] })),
    play(s, rarity) {
      s.noise(SFX.ability.puff);
      s.sequence(SFX.ability.byRarity[rarity].notes);
    },
  },
  rainbowChime: {
    group: 'creature',
    priority: 'normal',
    play: (s) => s.sequence(SFX.rainbowChime.notes),
  },
  rainbowJoke: {
    group: 'creature',
    priority: 'normal',
    play: (s) => s.sequence(SFX.rainbowJoke.notes),
  },
  cloudPuff: {
    group: 'creature',
    priority: 'normal',
    play: (s) =>
      s.noise({ ...SFX.ability.puff, gain: SFX.ability.puff.gain * SFX.cloudPuff.puffGainShare }),
  },
  shieldPop: {
    group: 'creature',
    priority: 'normal',
    play(s) {
      s.tone(SFX.shieldPop.blip);
      s.noise(SFX.shieldPop.pop);
    },
  },
  lickSlurp: {
    group: 'creature',
    priority: 'normal',
    play(s) {
      const { tone, wet, pop } = SFX.lick.slurp;
      s.tone(tone);
      s.noise(wet);
      s.tone(pop, { delay: pop.delay });
    },
  },
  lickSlurpLong: {
    group: 'creature',
    priority: 'normal',
    play(s) {
      const { wet, notes } = SFX.lick.long;
      s.noise(wet);
      s.sequence(notes);
    },
  },
  lickSmack: {
    group: 'creature',
    priority: 'normal',
    play(s) {
      const { click, pop } = SFX.lick.smack;
      s.noise(click);
      s.tone(pop);
    },
  },
  lickHum: {
    group: 'creature',
    priority: 'normal',
    play: (s) => s.sequence(SFX.lick.mmm),
  },
  guestSplat: {
    group: 'creature',
    priority: 'normal',
    play(s) {
      const { thump, sub, wet } = SFX.guest.splat;
      s.tone(thump);
      s.tone(sub);
      s.noise(wet);
    },
  },
  guestPeel: {
    group: 'creature',
    priority: 'normal',
    play(s) {
      const { notes, click } = SFX.guest.peel;
      s.sequence(notes);
      s.noiseSequence([click]);
    },
  },
  guestBuzz: {
    group: 'creature',
    priority: 'normal',
    play: (s) => s.sequence(SFX.guest.buzz),
  },
  guestGiggle: {
    group: 'creature',
    priority: 'normal',
    play: (s) => s.sequence(SFX.guest.giggle),
  },
  click: {
    group: 'ui',
    priority: 'normal',
    play: (s) => s.tone(SFX.click),
  },
  coin: {
    group: 'reward',
    priority: 'normal',
    play: (s) => s.sequence(SFX.coin.notes),
  },
  berry: {
    group: 'reward',
    priority: 'normal',
    play: (s) => s.chord(SFX.berry, SFX.berry.freqs, SFX.berry.stagger),
  },
  record: {
    group: 'reward',
    priority: 'critical',
    ducksMusic: true,
    play(s) {
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
    },
  },
  recordBlip: {
    group: 'reward',
    priority: 'critical',
    play: (s) => s.sequence(SFX.recordBlip.notes),
  },
};

/** Every sound id, grouped sections first (the order of the soundboard). */
export const SOUND_IDS: readonly SoundId[] = SOUND_GROUPS.flatMap((group) =>
  (Object.keys(SOUND_BOOK) as SoundId[]).filter((id) => SOUND_BOOK[id].group === group),
);

/** The argument sets of a sound: its variants, or a single empty one. */
export function soundVariants(id: SoundId): readonly SoundVariant<unknown[]>[] {
  const entry: SoundEntry<unknown[]> = SOUND_BOOK[id] as unknown as SoundEntry<unknown[]>;
  return entry.variants ?? [{ label: '', args: [] }];
}

import { describe, expect, it } from 'vitest';
import { DICTIONARIES, keysOf } from '../../i18n';
import type { SoundId } from './sound-args';
import { SOUND_BOOK, SOUND_GROUPS, SOUND_IDS, soundVariants } from './sound-book';
import { Mixer } from './mixer';
import { SoundPlayer } from './sound-player';
import { Synth } from './synth';

/** Just enough of an audio context for the synth and the mixer; counts what it is asked to start. */
function fakeContext(): { ctx: BaseAudioContext; starts: () => number } {
  let started = 0;
  const param = (): unknown => ({
    value: 0,
    setValueAtTime() {},
    linearRampToValueAtTime() {},
    exponentialRampToValueAtTime() {},
    setTargetAtTime() {},
  });
  const node = (): Record<string, unknown> => ({
    gain: param(),
    frequency: param(),
    Q: param(),
    threshold: param(),
    knee: param(),
    ratio: param(),
    attack: param(),
    release: param(),
    connect() {},
    disconnect() {},
    start() {
      started += 1;
    },
    stop() {},
  });
  const ctx = {
    currentTime: 0,
    sampleRate: 8000,
    destination: node(),
    createGain: node,
    createDynamicsCompressor: node,
    createWaveShaper: node,
    createBiquadFilter: node,
    createBufferSource: node,
    createOscillator: node,
    createBuffer: (_c: number, length: number) => ({
      getChannelData: () => new Float32Array(length),
    }),
  };
  return { ctx: ctx as unknown as BaseAudioContext, starts: () => started };
}

describe('SOUND_BOOK', () => {
  const ids = Object.keys(SOUND_BOOK) as SoundId[];

  it('lists every sound once, in the order of the groups', () => {
    expect([...SOUND_IDS].sort()).toEqual([...ids].sort());
    const groupOrder = SOUND_IDS.map((id) => SOUND_GROUPS.indexOf(SOUND_BOOK[id].group));
    expect(groupOrder).toEqual([...groupOrder].sort((a, b) => a - b));
  });

  it('keeps the priorities of the brief: the drop, perfect, miss and record sounds are critical', () => {
    for (const id of ['drop', 'perfect', 'miss', 'record', 'recordBlip'] as const) {
      expect(SOUND_BOOK[id].priority).toBe('critical');
    }
    expect(SOUND_BOOK.coin.priority).toBe('normal');
  });

  it('has the soundboard texts of every sound and group in both languages', () => {
    for (const lang of ['en', 'ru'] as const) {
      const keys = new Set(keysOf(DICTIONARIES[lang]));
      for (const id of ids) expect(keys.has(`soundboard.sound.${id}`), `${lang} ${id}`).toBe(true);
      for (const group of SOUND_GROUPS) {
        expect(keys.has(`soundboard.group.${group}`), `${lang} ${group}`).toBe(true);
      }
    }
  });

  it('plays every sound and variant, scheduling notes and reporting a length', () => {
    for (const id of ids) {
      for (const variant of soundVariants(id)) {
        const { ctx, starts } = fakeContext();
        const synth = new Synth(ctx, new Mixer(ctx));
        const result = new SoundPlayer(synth).play(id, variant.args as never);
        expect(result.played, `${id} ${variant.label}`).toBe(true);
        expect(starts(), `${id} ${variant.label}`).toBeGreaterThan(0);
        if (result.played) expect(result.length).toBeGreaterThan(0);
      }
    }
  });

  it('has a variant for every squashed kind, thunder in the sky and behind glass, and a bed marked for the owner', () => {
    expect(
      soundVariants('topperSquash')
        .map((v) => v.label)
        .sort(),
    ).toEqual(['cherry', 'cream', 'lemon', 'mint', 'strawberry', 'wafer'].sort());
    expect(soundVariants('thunder').map((v) => v.args[0])).toEqual([false, true]);
    expect(SOUND_BOOK.weatherBed.ownerChoice).toBe(true);
    expect(SOUND_BOOK.weatherBed.priority).toBe('ambient');
    expect(SOUND_BOOK.yawn.priority).toBe('ambient');
  });

  it('draws the thunder delay and roll inside the brief (150-400 ms, 0.8-1.2 s)', () => {
    for (const value of [0, 0.5, 0.999]) {
      const { ctx } = fakeContext();
      const synth = new Synth(ctx, new Mixer(ctx), () => value);
      const result = new SoundPlayer(synth).play('thunder', [false]);
      expect(result.played).toBe(true);
      if (!result.played) continue;
      // Delay up to 0.4 s, then the roll (the low note) up to 1.2 s, plus the tail.
      expect(result.length).toBeGreaterThan(0.15 + 0.8);
      expect(result.length).toBeLessThan(0.4 + 1.2 + 0.46 + 0.2);
    }
  });

  it('marks only the record fanfare as ducking the music', () => {
    const ducking = (Object.keys(SOUND_BOOK) as SoundId[]).filter(
      (id) => SOUND_BOOK[id].ducksMusic,
    );
    expect(ducking).toEqual(['record']);
  });
});

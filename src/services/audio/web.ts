import type { Rarity } from '../../data/rarity';
import type { DuckReason } from './mixer-math';
import { Mixer } from './mixer';
import {
  musicHostOf,
  NO_MUSIC_FACTORY,
  type MusicControl,
  type MusicFactory,
} from './music-control';
import { MusicProxy } from './music-proxy';
import type { SoundArgs, SoundId } from './sound-args';
import { SoundPlayer } from './sound-player';
import { Synth } from './synth';
import type {
  AudioDebugStats,
  AudioDevControl,
  AudioService,
  AudioSuspendReason,
  MusicDebugState,
} from './types';

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
 * Web Audio implementation of the sound and the music. The context is created on `unlock()` (a user
 * gesture); sounds requested before that, while disabled, hidden or without Web Audio are dropped.
 * Sounds come from the registry (`sound-book.ts`) through the voice gate; the named methods are
 * thin wrappers over `play`.
 */
export class WebAudioService implements AudioService, AudioDevControl {
  private on = true;
  private musicOn = true;
  private readonly holds = new Set<AudioSuspendReason>();
  private ctx: AudioContext | null = null;
  private mixer: Mixer | null = null;
  private player: SoundPlayer | null = null;
  private recordDuckTimer: ReturnType<typeof setTimeout> | null = null;
  private readonly musicProxy = new MusicProxy();
  /** Duck reasons held now; kept before the mixer exists so a window open at the first tap still ducks. */
  private readonly ducks = new Set<DuckReason>();
  private devLevels: Partial<{ master: number; sfx: number; music: number }> = {};

  constructor(
    private readonly createContext: AudioContextFactory = createBrowserAudioContext,
    private readonly random: () => number = Math.random,
    private readonly musicFactory: MusicFactory = NO_MUSIC_FACTORY,
  ) {}

  get enabled(): boolean {
    return this.on;
  }

  setEnabled(on: boolean): void {
    this.on = on;
    this.mixer?.setSfxOn(on);
  }

  get musicEnabled(): boolean {
    return this.musicOn;
  }

  setMusicEnabled(on: boolean): void {
    this.musicOn = on;
    this.mixer?.setMusicOn(on);
    this.musicProxy.setEnabled(on);
  }

  setLevels(levels: Partial<{ master: number; sfx: number; music: number }>): void {
    this.devLevels = { ...this.devLevels, ...levels };
    this.mixer?.setDevScales(levels);
  }

  musicState(): MusicDebugState {
    const { options, layer, menu } = this.musicProxy.asked;
    return { variant: options?.variant ?? null, layer, menu, ducks: [...this.ducks] };
  }

  get music(): MusicControl {
    return this.musicProxy;
  }

  duckMusic(reason: DuckReason, on: boolean): void {
    if (on) this.ducks.add(reason);
    else this.ducks.delete(reason);
    this.mixer?.duckMusic(reason, on);
  }

  unlock(): void {
    if (!this.ctx) {
      try {
        const ctx = this.createContext();
        if (!ctx) return;
        const mixer = new Mixer(ctx);
        const synth = new Synth(ctx, mixer, this.random);
        this.ctx = ctx;
        this.mixer = mixer;
        this.player = new SoundPlayer(synth);
        if (!this.on) mixer.setSfxOn(false);
        if (!this.musicOn) mixer.setMusicOn(false);
        mixer.setDevScales(this.devLevels);
        for (const reason of this.ducks) mixer.duckMusic(reason, true);
        this.musicProxy.attach(this.musicFactory(musicHostOf(mixer, this.random)));
      } catch {
        this.ctx = null;
        this.mixer = null;
        this.player = null;
        return;
      }
    }
    if (this.holds.size === 0) {
      this.run((ctx) => ctx.resume());
      this.kick();
    }
  }

  suspend(reason: AudioSuspendReason): void {
    this.holds.add(reason);
    this.run((ctx) => ctx.suspend());
  }

  resume(reason: AudioSuspendReason): void {
    this.holds.delete(reason);
    if (this.holds.size === 0) this.run((ctx) => ctx.resume());
  }

  debugStats(): AudioDebugStats {
    return { liveNodes: this.mixer?.tally.live ?? 0, contextState: this.ctx?.state ?? 'none' };
  }

  play<K extends SoundId>(id: K, ...args: SoundArgs[K]): void {
    if (!this.on || this.holds.size > 0 || !this.player) return;
    try {
      const result = this.player.play(id, args);
      if (result.played && result.ducksMusic) this.duckForLength(result.length);
    } catch {
      // A failing sound must never break the game.
    }
  }

  drop = (): void => this.play('drop');
  perfect = (comboStep: number): void => this.play('perfect', comboStep);
  bite = (): void => this.play('bite');
  coin = (): void => this.play('coin');
  berry = (): void => this.play('berry');
  ability = (rarity: Rarity): void => this.play('ability', rarity);
  rainbowChime = (): void => this.play('rainbowChime');
  rainbowJoke = (): void => this.play('rainbowJoke');
  cloudPuff = (): void => this.play('cloudPuff');
  shieldPop = (): void => this.play('shieldPop');
  sneeze = (): void => this.play('sneeze');
  miss = (): void => this.play('miss');
  collapseThud = (index: number): void => this.play('collapseThud', index);
  record = (): void => this.play('record');
  recordBlip = (): void => this.play('recordBlip');
  click = (): void => this.play('click');
  lickSlurp = (): void => this.play('lickSlurp');
  lickSlurpLong = (): void => this.play('lickSlurpLong');
  lickSmack = (): void => this.play('lickSmack');
  lickHum = (): void => this.play('lickHum');
  guestSplat = (): void => this.play('guestSplat');
  guestPeel = (): void => this.play('guestPeel');
  guestBuzz = (): void => this.play('guestBuzz');
  guestGiggle = (): void => this.play('guestGiggle');
  topperHop = (): void => this.play('topperHop');
  squeak = (pitch: number): void => this.play('squeak', pitch);

  /** The music stays turned down for `length` seconds (the record fanfare). */
  private duckForLength(length: number): void {
    if (this.recordDuckTimer !== null) clearTimeout(this.recordDuckTimer);
    this.duckMusic('record', true);
    this.recordDuckTimer = setTimeout(() => {
      this.recordDuckTimer = null;
      this.duckMusic('record', false);
    }, length * 1000);
  }

  /** The silent unlock source, until the context runs; never throws. */
  private kick(): void {
    if (this.ctx?.state === 'running') return;
    try {
      this.mixer?.kick();
    } catch {
      // Not needed on a modern browser.
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

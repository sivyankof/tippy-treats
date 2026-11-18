import { AUDIO_MIX } from '../../data/audio-mix';
import { musicTarget, type DuckReason } from './mixer-math';
import { NodeTally } from './node-tally';

/**
 * The output chain over any audio context (live or offline, so renders hear what the player hears):
 *
 *   sfx bus -> sfx compressor -> master
 *   music bus ---------------->  master -> limiter -> trim -> destination
 *
 * Sounds connect to `sfxBus`, the music to `musicBus`. The bus switches and the music duck ramp
 * the bus gain, so nothing clicks. Numbers: `data/audio-mix.ts`.
 */
export class Mixer {
  readonly sfxBus: GainNode;
  readonly musicBus: GainNode;
  readonly master: GainNode;
  /** Live-node bookkeeping shared by everything that plays through this mixer. */
  readonly tally = new NodeTally();
  private sfxOn = true;
  private musicOn = true;
  /** Dev-only multipliers of the bus levels (the soundboard sliders); 1 in the game. */
  private scales = { master: 1, sfx: 1, music: 1 };
  private readonly ducks = new Set<DuckReason>();

  constructor(readonly ctx: BaseAudioContext) {
    const mix = AUDIO_MIX;
    this.sfxBus = ctx.createGain();
    this.sfxBus.gain.value = mix.sfxLevel;
    this.musicBus = ctx.createGain();
    this.musicBus.gain.value = mix.musicLevel;
    this.master = ctx.createGain();
    this.master.gain.value = mix.masterLevel;

    const sfxComp = ctx.createDynamicsCompressor();
    const sc = mix.sfxCompressor;
    sfxComp.threshold.value = sc.threshold;
    sfxComp.knee.value = sc.knee;
    sfxComp.ratio.value = sc.ratio;
    sfxComp.attack.value = sc.attack;
    sfxComp.release.value = sc.release;

    const limiter = ctx.createDynamicsCompressor();
    const lim = mix.limiter;
    limiter.threshold.value = lim.threshold;
    limiter.knee.value = lim.knee;
    limiter.ratio.value = lim.ratio;
    limiter.attack.value = lim.attack;
    limiter.release.value = lim.release;
    const trim = ctx.createGain();
    trim.gain.value = mix.trimLevel;

    this.sfxBus.connect(sfxComp);
    sfxComp.connect(this.master);
    this.musicBus.connect(this.master);
    this.master.connect(limiter);
    limiter.connect(trim);
    trim.connect(ctx.destination);
  }

  get sfxIsOn(): boolean {
    return this.sfxOn;
  }

  get musicIsOn(): boolean {
    return this.musicOn;
  }

  /** Ramps the sfx bus to its level or to silence. */
  setSfxOn(on: boolean): void {
    this.sfxOn = on;
    this.rampSfx(AUDIO_MIX.switchRampSec);
  }

  /** Ramps the music bus to its (ducked) level or to silence. */
  setMusicOn(on: boolean): void {
    this.musicOn = on;
    this.rampMusic(AUDIO_MIX.switchRampSec);
  }

  /** Turns the music down by the duck share while any reason holds. */
  duckMusic(reason: DuckReason, on: boolean): void {
    if (on) this.ducks.add(reason);
    else this.ducks.delete(reason);
    this.rampMusic(AUDIO_MIX.duckRampSec);
  }

  /** Dev only: scales the master, sfx and music levels (the soundboard sliders, not saved). */
  setDevScales(scales: Partial<{ master: number; sfx: number; music: number }>): void {
    this.scales = { ...this.scales, ...scales };
    this.master.gain.setTargetAtTime(
      AUDIO_MIX.masterLevel * this.scales.master,
      this.ctx.currentTime,
      AUDIO_MIX.switchRampSec,
    );
    this.rampSfx(AUDIO_MIX.switchRampSec);
    this.rampMusic(AUDIO_MIX.switchRampSec);
  }

  /** Reasons that hold the duck now (diagnostics). */
  get duckReasons(): readonly DuckReason[] {
    return [...this.ducks];
  }

  /** Plays a silent one-sample source: old iOS only starts the context for a source played inside the gesture. */
  kick(): void {
    const { ctx } = this;
    const src = ctx.createBufferSource();
    src.buffer = ctx.createBuffer(1, AUDIO_MIX.unlockBufferSamples, ctx.sampleRate);
    src.connect(ctx.destination);
    src.onended = () => src.disconnect();
    src.start(0);
  }

  private rampSfx(timeConstant: number): void {
    this.ramp(
      this.sfxBus.gain,
      this.sfxOn ? AUDIO_MIX.sfxLevel * this.scales.sfx : 0,
      timeConstant,
    );
  }

  private rampMusic(timeConstant: number): void {
    const target = musicTarget(
      this.musicOn,
      AUDIO_MIX.musicLevel * this.scales.music,
      this.ducks,
      AUDIO_MIX.duckShare,
    );
    this.ramp(this.musicBus.gain, target, timeConstant);
  }

  /** Exponential approach to `target` from the current value (no cancel: a new ramp continues smoothly). */
  private ramp(param: AudioParam, target: number, timeConstant: number): void {
    param.setTargetAtTime(target, this.ctx.currentTime, timeConstant);
  }
}

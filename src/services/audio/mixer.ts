import { AUDIO_MIX } from '../../data/audio/audio-mix';
import { limiterCurve, musicAudible, musicTarget, type DuckReason } from './mixer-math';
import { NodeTally } from './node-tally';

/**
 * The output chain over any audio context (live or offline, so renders hear what the player hears):
 *
 *   sfx bus -> sfx compressor -> master
 *   music bus ---------------->  master -> limiter -> destination
 *
 * Sounds connect to `sfxBus`, the music to `musicBus`. The bus switches and the music duck ramp
 * the bus gain, so nothing clicks. Numbers: `data/audio/audio-mix.ts`.
 */
export class Mixer {
  readonly sfxBus: GainNode;
  readonly musicBus: GainNode;
  readonly master: GainNode;
  /** Live-node bookkeeping shared by everything that plays through this mixer. */
  readonly tally = new NodeTally();
  /** The music's share of `tally` (its chain and voices): the leak check reads the rest. */
  readonly musicTally = this.tally.child();
  private sfxOn = true;
  private musicOn = true;
  private tunePlaying = false;
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

    const limiter = ctx.createWaveShaper();
    const lim = mix.limiter;
    limiter.curve = limiterCurve(lim.curveSize, lim.threshold, lim.ceiling);
    limiter.oversample = '2x';

    this.sfxBus.connect(sfxComp);
    sfxComp.connect(this.master);
    this.musicBus.connect(this.master);
    this.master.connect(limiter);
    limiter.connect(ctx.destination);
  }

  get sfxIsOn(): boolean {
    return this.sfxOn;
  }

  get musicIsOn(): boolean {
    return this.musicOn;
  }

  /** The music player says whether a tune is playing (it stops while the switch is off). */
  setTunePlaying(on: boolean): void {
    this.tunePlaying = on;
  }

  /** The music is really heard now (a tune plays, the switch is on, the level is not zero): the bell softens then. */
  get musicAudible(): boolean {
    return musicAudible(this.tunePlaying, this.musicOn, this.scales.music);
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

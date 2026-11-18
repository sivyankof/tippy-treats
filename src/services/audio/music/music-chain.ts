import { MUSIC_BUS, DEFAULT_MUSIC_MIX, type MusicMix } from '../../../data/music/music-play';
import type { PartRole } from '../../../data/music/song';
import { MS_PER_SECOND } from '../../../util/math';
import { fromDb } from '../levels';
import { saturationCurve } from '../mixer-math';
import type { NodeTally } from '../node-tally';

/**
 * The music chain of a player, built once (docs/06, section 7, "Музыка"; numbers `MUSIC_BUS`):
 *
 *   keys, melody -> keys filter (lowpass ~2 kHz) --+
 *   bass ------------------------------------------+-> pump -> saturation -> air (lowpass 6.5 kHz) -> fader
 *   drums --------------------------------------------------> saturation        |
 *                                                     air -> reverb send -> reverb -> fader
 *   tape (hiss loop, crackles) -----------------------------------------------------> fader
 *   fader -> music bus
 *
 * Voices connect to `roles[role]`; the soundboard knobs scale the drums, the melody and the
 * tape. The kick dips `pump` (AudioParam automation only). One slow LFO (`wobble`) drives the
 * detune of every electric-piano oscillator. The reverb is four damped feedback delay lines; it
 * is torn down when switched off (weak phones) and built again when switched on; a device that
 * starts with it off never builds it. While no tune plays the chain is `idle`: the reverb is gone
 * and the output is disconnected from the bus, so none of it is computed; `wake` brings it back.
 */
export class MusicChain {
  readonly roles: Record<PartRole, GainNode>;
  /** Hiss and crackles connect here. */
  readonly tape: GainNode;
  readonly pump: GainNode;
  /** Output of the wobble LFO in cents: connect it to an oscillator's `detune`. */
  readonly wobble: GainNode;
  /** The tune's own level (entry, menu, stop fades) into the music bus. */
  readonly fader: GainNode;
  private readonly air: BiquadFilterNode;
  private readonly lfo: OscillatorNode;
  private readonly nodes: AudioNode[];
  private reverb: { send: GainNode; nodes: AudioNode[] } | null = null;
  private mix: MusicMix;
  /** The chain sounds (a tune plays or has just stopped): the reverb may exist. */
  private awake = true;
  private connected = true;

  constructor(
    private readonly ctx: BaseAudioContext,
    private readonly bus: AudioNode,
    private readonly tally: NodeTally,
    mix: MusicMix = DEFAULT_MUSIC_MIX,
  ) {
    this.mix = { ...mix };
    const b = MUSIC_BUS;
    const gain = (value: number): GainNode => {
      const node = ctx.createGain();
      node.gain.value = value;
      return node;
    };
    const lowpass = (cutoff: number, q: number): BiquadFilterNode => {
      const node = ctx.createBiquadFilter();
      node.type = 'lowpass';
      node.frequency.value = cutoff;
      node.Q.value = q;
      return node;
    };
    this.roles = { keys: gain(1), melody: gain(1), bass: gain(1), drums: gain(1) };
    const keysFilter = lowpass(b.keysCutoff, b.keysQ);
    this.pump = gain(1);
    const drive = ctx.createWaveShaper();
    drive.curve = saturationCurve(b.curveSize, b.drive);
    drive.oversample = '2x';
    this.air = lowpass(b.airCutoff, b.airQ);
    this.tape = gain(0);
    this.fader = gain(0);
    this.wobble = gain(b.wobble.depthCents);
    this.lfo = ctx.createOscillator();
    this.lfo.type = 'sine';
    this.lfo.frequency.value = b.wobble.rateHz;

    this.roles.keys.connect(keysFilter);
    this.roles.melody.connect(keysFilter);
    keysFilter.connect(this.pump);
    this.roles.bass.connect(this.pump);
    this.pump.connect(drive);
    this.roles.drums.connect(drive);
    drive.connect(this.air);
    this.air.connect(this.fader);
    this.tape.connect(this.fader);
    this.fader.connect(bus);
    this.lfo.connect(this.wobble);
    this.lfo.start();

    this.nodes = [
      ...Object.values(this.roles),
      keysFilter,
      this.pump,
      drive,
      this.air,
      this.tape,
      this.fader,
      this.wobble,
      this.lfo,
    ];
    tally.add(this.nodes);
    this.applyMix(0);
  }

  /** Sets the knobs and the reverb switch; levels glide over `ramp` seconds. */
  setMix(mix: Partial<MusicMix>, ramp: number = MUSIC_BUS.reverb.switchSec): void {
    this.mix = { ...this.mix, ...mix };
    this.applyMix(ramp);
  }

  get currentMix(): MusicMix {
    return { ...this.mix };
  }

  /**
   * The tune stops at `now` and its voices are cut at `cutAt`: the kick dips still scheduled for
   * its notes are cancelled and the reverb is let go once the cut has passed, so nothing of the
   * old tune rises with the next one.
   */
  release(now: number, cutAt: number): void {
    this.awake = false;
    this.pump.gain.cancelScheduledValues(now);
    this.pump.gain.setValueAtTime(1, cutAt);
    this.dropReverb((cutAt - now) * MS_PER_SECOND);
  }

  /** After a stop has settled: nothing sounds, so the whole chain leaves the bus and is not computed. */
  idle(): void {
    if (!this.connected) return;
    this.connected = false;
    this.fader.disconnect(this.bus);
  }

  /** Back for a tune: onto the bus, with the reverb if it is wanted. */
  wake(): void {
    this.awake = true;
    if (!this.connected) {
      this.connected = true;
      this.fader.connect(this.bus);
    }
    if (this.mix.reverb) this.buildReverb();
  }

  /** Dips the music (not the drums) at context time `at` for a kick of strength `share` (0..1). */
  kick(at: number, share: number): void {
    const p = MUSIC_BUS.pump;
    const dip = fromDb(-p.depthDb * Math.max(0, Math.min(1, share)));
    this.pump.gain.setTargetAtTime(dip, at, p.attackSec / 3);
    this.pump.gain.setTargetAtTime(1, at + p.attackSec, p.releaseSec);
  }

  private applyMix(ramp: number): void {
    const now = this.ctx.currentTime;
    const glide = (param: AudioParam, value: number): void => {
      if (ramp <= 0) param.setValueAtTime(value, now);
      else param.setTargetAtTime(value, now, ramp);
    };
    glide(this.roles.drums.gain, this.mix.drums);
    glide(this.roles.melody.gain, this.mix.melody);
    glide(this.tape.gain, this.mix.tape);
    if (this.mix.reverb && this.awake) this.buildReverb();
    else if (!this.mix.reverb) this.dropReverb();
  }

  /** Four damped feedback delay lines, two per side, fed from the air filter. */
  private buildReverb(): void {
    if (this.reverb) return;
    const { ctx } = this;
    const r = MUSIC_BUS.reverb;
    const send = ctx.createGain();
    send.gain.value = 0;
    send.gain.setTargetAtTime(r.wet, ctx.currentTime, r.switchSec);
    const merger = ctx.createChannelMerger(2);
    const nodes: AudioNode[] = [send, merger];
    r.delays.forEach((seconds, i) => {
      const delay = ctx.createDelay(seconds * 2);
      delay.delayTime.value = seconds;
      const damp = ctx.createBiquadFilter();
      damp.type = 'lowpass';
      damp.frequency.value = r.damping;
      const feedback = ctx.createGain();
      feedback.gain.value = r.feedback;
      send.connect(delay);
      delay.connect(damp);
      damp.connect(feedback);
      feedback.connect(delay);
      damp.connect(merger, 0, i % 2);
      nodes.push(delay, damp, feedback);
    });
    this.air.connect(send);
    merger.connect(this.fader);
    this.tally.add(nodes);
    this.reverb = { send, nodes };
  }

  /** Fades the reverb out, then disconnects its nodes once its tail has died (after `delayMs`). */
  private dropReverb(delayMs: number = MUSIC_BUS.reverb.tailSec * MS_PER_SECOND): void {
    const reverb = this.reverb;
    if (!reverb) return;
    this.reverb = null;
    const r = MUSIC_BUS.reverb;
    reverb.send.gain.setTargetAtTime(0, this.ctx.currentTime, r.switchSec);
    setTimeout(() => {
      this.air.disconnect(reverb.send);
      for (const node of reverb.nodes) node.disconnect();
      this.tally.release(reverb.nodes);
    }, delayMs);
  }
}

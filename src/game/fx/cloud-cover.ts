import type * as Phaser from 'phaser';
import type { EffectLevel } from '../../data/effect-levels';
import { RULE_ANIM } from '../../data/rule-anim';
import { LOGICAL_SIZE } from '../../data/screen';
import { clamp01, lerp, oscillate01, sineWave, smoothstep } from '../../util/math';
import { effectsMode } from '../effects-mode';
import { scatter } from '../objects/creature-art/primitives';
import { FLYING_FX_DEPTH } from './flying-fx-depth';
import { createFxTextures, FX_TEXTURES } from './fx-textures';
import { createTreasureTextures, TREASURE_TEXTURES } from './treasure-textures';

const cfg = RULE_ANIM.cloud;
const nebula = cfg.nebula;
const stars = nebula.stars;
/** Stars a bank keeps ready: the most any level shows. */
const STAR_SLOTS = Math.max(...Object.values(stars.count));

/** The bank spans the whole screen plus the padding: the flying layer is always inside it. */
const BANK_SPAN = LOGICAL_SIZE.width + cfg.pad * 2;
const PUFF_COUNT = Math.min(cfg.maxPuffs, Math.ceil(BANK_SPAN / cfg.spacing) + 1);
const PUFF_STEP = BANK_SPAN / (PUFF_COUNT - 1);
const MS_PER_S = 1000;
/** A rise of the time to arrival bigger than this means the awaited cloud has come. */
const ARRIVAL_JUMP_MS = 30;

/**
 * Time until the cloud arrives, ms, from the track left before it (`aheadPx`, -1 when none is
 * due) and the current flight speed; a layer that stands still (wind-up, fake-out stop) uses its
 * nominal speed. `Infinity` when no cloud is due.
 */
export function cloudEtaMs(aheadPx: number, speed: number, nominalSpeed: number): number {
  if (aheadPx < 0) return Infinity;
  const pxPerS = speed > 0 ? speed : nominalSpeed;
  return pxPerS > 0 ? (aheadPx / pxPerS) * MS_PER_S : Infinity;
}

/**
 * Moves the approach on by one frame. It only ever grows, and it closes the gap to 1 at the rate
 * that makes it reach 1 when the cloud arrives (`etaMs` from now): an estimate that jumps (a
 * new speed, a late look-ahead) bends the curve but never makes it step back or jump.
 */
export function stepApproach(progress: number, dtMs: number, etaMs: number): number {
  if (dtMs <= 0) return progress;
  if (etaMs <= dtMs) return 1;
  return clamp01(progress + ((1 - progress) * dtMs) / etaMs);
}

/** Smooth start, sharper end: how a value that should ease out goes from 0 to 1. */
function easeOutCubic(t: number): number {
  const c = 1 - clamp01(t);
  return 1 - c * c * c;
}

export type CloudPhase = 'idle' | 'approach' | 'cover' | 'leave';

/** What a bank is drawn as: the dense white cloud, or the see-through nebula of the Space zone. */
export type CloudLook = 'cloud' | 'nebula';

/** A bank takes the wanted look only while it is idle (unseen): it keeps its look until it has left. */
export function pickLook(phase: CloudPhase, current: CloudLook, wanted: CloudLook): CloudLook {
  return phase === 'idle' ? wanted : current;
}

/**
 * The densest a bank of `look` is drawn, 0..1: the nebula has its own cap, and `share` (the
 * meringue "Not scary" factor, 1 otherwise) lowers either.
 */
export function densityCap(look: CloudLook, share: number): number {
  return (look === 'nebula' ? nebula.maxDensity : 1) * share;
}

/** How many stars twinkle over a nebula bank on this effects level. */
export function starCount(level: EffectLevel): number {
  return stars.count[level];
}

/** Whether star `slot` of `slots` twinkles when `count` of them do: the shown ones are spread evenly. */
export function starActive(slot: number, slots: number, count: number): boolean {
  if (count <= 0 || slots <= 0) return false;
  return Math.floor(((slot + 1) * count) / slots) > Math.floor((slot * count) / slots);
}

/**
 * Whether the cloud hides the flying layer (the golden shine and the gaze of the tower go with
 * it): not under the see-through "Not scary" cloud and not under the nebula, whose density is
 * low enough to show the silhouette.
 */
export function layerHidden(
  ghostMaster: boolean,
  nebulaShown: boolean,
  covered: boolean,
  amount: number,
): boolean {
  return !ghostMaster && !nebulaShown && (covered || amount > 0);
}

/** Every puff of a nebula bank billows, except on the minimal level; the cloud always does. */
export function puffsBillow(look: CloudLook, level: EffectLevel): boolean {
  return look === 'cloud' || level !== 'minimal';
}

/** Where a star is in its pulse, 0..1; each star has its own phase. */
export function starPulse(timeMs: number, slot: number): number {
  return oscillate01(timeMs, stars.periodMs, slot * stars.phaseStep);
}

/** The scale (multiplier of the star's own scale) and alpha of a star at `pulse` (0..1). */
export function starLook(pulse: number): { scale: number; alpha: number } {
  return {
    scale: 1 + stars.pulse * (pulse - 0.5) * 2,
    alpha: lerp(stars.alpha[0], stars.alpha[1], pulse),
  };
}

/** What the bank looks like this frame: offset along its drift, rise, opacity and size. */
export interface CloudPose {
  x: number;
  rise: number;
  alpha: number;
  scale: number;
}

/** What the run tells the cloud each frame. */
export interface CloudInput {
  /** The sim hides the layer right now. */
  covering: boolean;
  /** A layer is in the air (not dropped). */
  flying: boolean;
  /** Time until the next cloud arrives, `Infinity` when none is due. */
  etaMs: number;
  /** Height of the flying row; the bank keeps the height it came at. */
  y: number;
  /** The way the layer flies; the bank comes from behind and drifts that way. */
  dir: 1 | -1;
  /** The meringue master makes the cloud see-through: the share of the look's own density cap (1 without it). */
  maxAlpha: number;
  /** The cloud belongs to a Space layer: a bank that starts now is drawn as the nebula. */
  nebula: boolean;
}

/**
 * The cloud of the clouds zone as a little state machine driven only by frame time:
 * idle → approach (floats in from the side, see-through) → cover (solid while the sim hides the
 * layer) → leave (drifts on faster, rises, fades) → idle. Every value it draws is a continuous
 * function of time inside a phase, and each phase starts from where the previous one ended, so
 * nothing jumps whatever the frame rate. Pure: the view below only draws its pose.
 */
export class CloudMotion {
  phase: CloudPhase = 'idle';
  /** Time spent in the current phase. */
  ageMs = 0;
  /** How far the approach has come, 0..1. */
  progress = 0;
  dir: 1 | -1 = 1;
  /** Height the bank came at; it stays there until it is gone. */
  y = 0;
  /** Leaving after the layer was dropped, or after a cloud that never came. */
  private leaveMs: number = cfg.outMs;
  /** The time to arrival seen last frame; it only falls while this cloud is still coming. */
  private lastEtaMs = Infinity;
  /** The pose at the start of the current phase. */
  private readonly from: CloudPose = { x: 0, rise: 0, alpha: 0, scale: 1 };
  readonly pose: CloudPose = { x: 0, rise: 0, alpha: 0, scale: 1 };

  update(dtMs: number, input: Readonly<CloudInput>): Readonly<CloudPose> {
    this.ageMs += dtMs;
    switch (this.phase) {
      case 'idle':
        if (input.covering) this.enter('cover', input);
        else if (input.flying && input.etaMs <= cfg.leadMs) {
          this.enter('approach', input);
          this.progress = 0;
          this.lastEtaMs = input.etaMs;
        }
        break;
      case 'approach': {
        // This cloud has come once the time to the next one jumps up (or no cloud is due any more).
        const arrived = input.etaMs > this.lastEtaMs + ARRIVAL_JUMP_MS;
        this.lastEtaMs = input.etaMs;
        if (arrived && input.covering) this.enter('cover', input);
        else if (arrived || !input.flying) this.leave(cfg.abortMs);
        else this.progress = stepApproach(this.progress, dtMs, input.etaMs);
        break;
      }
      case 'cover':
        if (!input.covering) this.leave(input.flying ? cfg.outMs : cfg.dropOutMs);
        break;
      case 'leave':
        if (this.ageMs >= this.leaveMs) this.reset();
        else if (input.covering) this.enter('cover', input);
        break;
    }
    return this.computePose();
  }

  /** How much the cloud hides the layer, 0..1 (the shine and guides around the layer go with it). */
  get amount(): number {
    if (this.phase === 'cover') return 1;
    return this.phase === 'leave' ? this.pose.alpha : 0;
  }

  /**
   * How dense the cloud is over the layer, 0..1: the opacity it is drawn with. Unlike `amount`
   * it never steps: it grows while the cloud floats in, reaches 1 as it turns solid and fades
   * as it leaves.
   */
  get density(): number {
    return this.phase === 'idle' ? 0 : this.pose.alpha;
  }

  get visible(): boolean {
    return this.phase !== 'idle' && this.pose.alpha > 0;
  }

  private enter(phase: CloudPhase, input: Readonly<CloudInput>): void {
    if (this.phase === 'idle') {
      this.dir = input.dir;
      this.y = input.y;
      Object.assign(this.pose, this.restPose());
      // A cloud that comes without a warning grows in place instead of sliding in.
      if (phase === 'cover') this.pose.x = 0;
    }
    Object.assign(this.from, this.pose);
    this.phase = phase;
    this.ageMs = 0;
  }

  private leave(durationMs: number): void {
    Object.assign(this.from, this.pose);
    this.phase = 'leave';
    this.ageMs = 0;
    this.leaveMs = durationMs;
  }

  private reset(): void {
    this.phase = 'idle';
    this.ageMs = 0;
    this.progress = 0;
    Object.assign(this.pose, this.restPose());
  }

  /** The pose of a cloud that is still out to the side, invisible. */
  private restPose(): CloudPose {
    return { x: -this.dir * cfg.enterPx, rise: 0, alpha: 0, scale: cfg.enterScale };
  }

  private computePose(): Readonly<CloudPose> {
    const p = this.pose;
    const from = this.from;
    const t = this.ageMs;
    switch (this.phase) {
      case 'idle':
        return p;
      case 'approach': {
        const k = this.progress;
        // Starts and settles gently: no sudden start when the cloud shows up.
        p.x = -this.dir * cfg.enterPx * (1 - smoothstep(k));
        p.alpha = cfg.approachAlpha * smoothstep(k);
        p.scale = cfg.enterScale + (1 - cfg.enterScale) * easeOutCubic(k);
        p.rise = 0;
        return p;
      }
      case 'cover': {
        const k = smoothstep(t / cfg.inMs);
        // Whatever is left of the slide closes while it turns solid, so it covers the whole row.
        p.x = from.x * (1 - k) + (this.dir * cfg.driftSpeed * t) / MS_PER_S;
        p.alpha = from.alpha + (1 - from.alpha) * k;
        p.scale = from.scale + (1 - from.scale) * k;
        p.rise = from.rise;
        return p;
      }
      case 'leave': {
        const s = t / MS_PER_S;
        const k = smoothstep(t / this.leaveMs);
        p.x = from.x + this.dir * (cfg.driftSpeed * s + (cfg.leaveAccel * s * s) / 2);
        p.alpha = from.alpha * (1 - k);
        p.scale = from.scale * (1 + cfg.leaveGrow * k);
        p.rise = from.rise + cfg.slidePx * k;
        return p;
      }
    }
  }
}

/** A bank of puffs and the motion that drives it. */
class CloudBank {
  private readonly puffs: Phaser.GameObjects.Image[] = [];
  /** Twinkling stars of the nebula, made up front and only shown, moved and tinted afterwards. */
  private readonly stars: Phaser.GameObjects.Image[] = [];
  readonly motion = new CloudMotion();
  look: CloudLook = 'cloud';

  constructor(scene: Phaser.Scene) {
    for (let i = 0; i < PUFF_COUNT; i++) {
      this.puffs.push(
        scene.add
          .image(0, 0, TREASURE_TEXTURES.cloud)
          .setDepth(FLYING_FX_DEPTH.cloud)
          .setVisible(false),
      );
    }
    for (let i = 0; i < STAR_SLOTS; i++) {
      const tint = stars.tints[i % stars.tints.length] ?? 0xffffff;
      this.stars.push(
        scene.add
          .image(0, 0, FX_TEXTURES.star)
          .setDepth(FLYING_FX_DEPTH.cloudStars)
          .setTint(tint)
          .setVisible(false),
      );
    }
  }

  /** The cap on how dense this bank is drawn, 0..1. */
  cap(share: number): number {
    return densityCap(this.look, share);
  }

  update(dtMs: number, timeMs: number, input: Readonly<CloudInput>): void {
    const look = pickLook(this.motion.phase, this.look, input.nebula ? 'nebula' : 'cloud');
    if (look !== this.look) {
      this.look = look;
      const key = look === 'nebula' ? TREASURE_TEXTURES.nebula : TREASURE_TEXTURES.cloud;
      for (const puff of this.puffs) puff.setTexture(key);
    }
    const pose = this.motion.update(dtMs, input);
    const shown = this.motion.visible;
    const level = effectsMode.level;
    const billow = puffsBillow(this.look, level);
    const sway = sineWave(timeMs, cfg.driftPeriodMs) * cfg.driftPx;
    const [minScale, maxScale] = cfg.scale;
    const alpha = Math.min(pose.alpha, this.cap(input.maxAlpha));
    for (let i = 0; i < this.puffs.length; i++) {
      const puff = this.puffs[i];
      if (!puff) continue;
      puff.setVisible(shown);
      if (!shown) continue;
      const phase = i * cfg.bobPhaseStep;
      const bob = billow ? sineWave(timeMs, cfg.bobPeriodMs, phase) * cfg.bobPx : 0;
      const own = billow ? sineWave(timeMs, cfg.swayPeriodMs, phase) * cfg.swayPx : 0;
      const breathe = billow ? 1 + sineWave(timeMs, cfg.breathePeriodMs, phase) * cfg.breathe : 1;
      puff
        .setPosition(
          -cfg.pad + PUFF_STEP * i + pose.x + sway + own,
          this.motion.y + bob - pose.rise,
        )
        .setScale((minScale + (maxScale - minScale) * scatter(i)) * pose.scale * breathe)
        .setAlpha(alpha);
    }
    this.updateStars(shown && this.look === 'nebula', timeMs, level, pose, sway, input.maxAlpha);
  }

  /** The stars of the nebula ride on the bank and each twinkles on its own phase. */
  private updateStars(
    shown: boolean,
    timeMs: number,
    level: EffectLevel,
    pose: Readonly<CloudPose>,
    sway: number,
    share: number,
  ): void {
    const count = shown ? starCount(level) : 0;
    const [minScale, maxScale] = stars.scale;
    for (let i = 0; i < this.stars.length; i++) {
      const star = this.stars[i];
      if (!star) continue;
      const on = starActive(i, STAR_SLOTS, count);
      star.setVisible(on);
      if (!on) continue;
      const { scale, alpha } = starLook(starPulse(timeMs, i));
      const x = -cfg.pad + (BANK_SPAN * (i + 0.5)) / STAR_SLOTS;
      star
        .setPosition(
          x + (scatter(i, 0.3) - 0.5) * PUFF_STEP + pose.x + sway,
          this.motion.y - pose.rise + (scatter(i, 0.6) - 0.5) * 2 * stars.spreadPx,
        )
        .setScale((minScale + (maxScale - minScale) * scatter(i)) * pose.scale * scale)
        .setAlpha(alpha * pose.alpha * share);
    }
  }
}

/**
 * What a bank that only finishes leaving takes from the live input: where the layer flies and how
 * dense the puffs may be (a leaving see-through cloud stays see-through), never a new cover.
 */
export function followInput(passive: CloudInput, input: Readonly<CloudInput>): void {
  passive.flying = input.flying;
  passive.y = input.y;
  passive.dir = input.dir;
  passive.maxAlpha = input.maxAlpha;
  passive.nebula = input.nebula;
}

/**
 * The cloud that hides the flying layer: a bank of cloud puffs side by side across the whole
 * flying row. It is fixed in the world while it hangs there (it does not follow the layer, so
 * the player cannot aim by it) and billows: every puff bobs, sways and breathes on its own phase.
 * It is drawn over the layer, its coats and everything around it. Two banks take turns: when the
 * next cloud is due while the last one is still leaving, the other bank floats in, so a leaving
 * cloud never turns back. All motion comes from `CloudMotion`.
 */
export class CloudCover {
  private readonly banks: readonly CloudBank[];
  /** What a bank with nothing to do is told: no cloud for it, it just finishes leaving. */
  private readonly passive: CloudInput = {
    covering: false,
    flying: true,
    etaMs: Infinity,
    y: 0,
    dir: 1,
    maxAlpha: 1,
    nebula: false,
  };
  /** The share of the density cap that "Not scary" leaves: what the cover reports is scaled by it. */
  private maxAlpha = 1;
  /** What a free bank is told when it should start floating in the coming cloud. */
  private readonly coming: CloudInput = { ...this.passive };

  constructor(scene: Phaser.Scene) {
    createTreasureTextures(scene);
    createFxTextures(scene);
    this.banks = [new CloudBank(scene), new CloudBank(scene)];
  }

  /** How much a cloud hides the layer, 0..1 (a see-through cloud hides no more than it shows). */
  get amount(): number {
    return Math.max(...this.banks.map((bank) => bank.motion.amount * bank.cap(this.maxAlpha)));
  }

  /** A bank drawn as the nebula is on screen. */
  get nebulaShown(): boolean {
    return this.banks.some((bank) => bank.look === 'nebula' && bank.motion.visible);
  }

  /** Smooth 0..1 density of the densest bank (see `CloudMotion.density`). */
  get density(): number {
    return Math.max(...this.banks.map((bank) => bank.motion.density * bank.cap(this.maxAlpha)));
  }

  /**
   * Roles each frame: a bank that covers keeps covering until the sim stops hiding the layer; a
   * bank that floats in follows the coming cloud; a free bank takes the coming cloud as soon as
   * it is `leadMs` away, even while the other one still covers or leaves, so every cloud gets its
   * full warning; a cloud that comes without one grows in place in a free bank.
   */
  update(dtMs: number, timeMs: number, input: Readonly<CloudInput>): void {
    const phases = this.banks.map((bank) => bank.motion.phase);
    let needsApproach = !phases.includes('approach') && input.flying && input.etaMs <= cfg.leadMs;
    let needsCover = input.covering && !phases.includes('cover') && !phases.includes('approach');
    followInput(this.passive, input);
    this.maxAlpha = input.maxAlpha;
    Object.assign(this.coming, input, { covering: false });
    for (const bank of this.banks) {
      const phase = bank.motion.phase;
      if (phase === 'cover' || phase === 'approach') {
        bank.update(dtMs, timeMs, input);
      } else if (phase === 'idle' && needsApproach) {
        needsApproach = false;
        bank.update(dtMs, timeMs, this.coming);
      } else if (phase === 'idle' && needsCover) {
        needsCover = false;
        bank.update(dtMs, timeMs, input);
      } else {
        bank.update(dtMs, timeMs, this.passive);
      }
    }
  }
}

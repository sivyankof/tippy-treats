import type * as Phaser from 'phaser';
import { RULE_ANIM } from '../../data/rule-anim';
import { LOGICAL_SIZE } from '../../data/screen';
import { clamp01, sineWave, smoothstep } from '../../util/math';
import { scatter } from '../objects/creature-art/primitives';
import { FLYING_FX_DEPTH } from './flying-fx-depth';
import { createTreasureTextures, TREASURE_TEXTURES } from './treasure-textures';

const cfg = RULE_ANIM.cloud;

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
  readonly motion = new CloudMotion();

  constructor(scene: Phaser.Scene) {
    for (let i = 0; i < PUFF_COUNT; i++) {
      this.puffs.push(
        scene.add
          .image(0, 0, TREASURE_TEXTURES.cloud)
          .setDepth(FLYING_FX_DEPTH.cloud)
          .setVisible(false),
      );
    }
  }

  update(dtMs: number, timeMs: number, input: Readonly<CloudInput>): void {
    const pose = this.motion.update(dtMs, input);
    const shown = this.motion.visible;
    const sway = sineWave(timeMs, cfg.driftPeriodMs) * cfg.driftPx;
    const [minScale, maxScale] = cfg.scale;
    for (let i = 0; i < this.puffs.length; i++) {
      const puff = this.puffs[i];
      if (!puff) continue;
      puff.setVisible(shown);
      if (!shown) continue;
      const phase = i * cfg.bobPhaseStep;
      const bob = sineWave(timeMs, cfg.bobPeriodMs, phase) * cfg.bobPx;
      const own = sineWave(timeMs, cfg.swayPeriodMs, phase) * cfg.swayPx;
      const breathe = 1 + sineWave(timeMs, cfg.breathePeriodMs, phase) * cfg.breathe;
      puff
        .setPosition(
          -cfg.pad + PUFF_STEP * i + pose.x + sway + own,
          this.motion.y + bob - pose.rise,
        )
        .setScale((minScale + (maxScale - minScale) * scatter(i)) * pose.scale * breathe)
        .setAlpha(pose.alpha);
    }
  }
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
  };
  /** What a free bank is told when it should start floating in the coming cloud. */
  private readonly coming: CloudInput = { ...this.passive };

  constructor(scene: Phaser.Scene) {
    createTreasureTextures(scene);
    this.banks = [new CloudBank(scene), new CloudBank(scene)];
  }

  /** How much a cloud hides the layer, 0..1. */
  get amount(): number {
    return Math.max(...this.banks.map((bank) => bank.motion.amount));
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
    this.passive.flying = input.flying;
    this.passive.y = input.y;
    this.passive.dir = input.dir;
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

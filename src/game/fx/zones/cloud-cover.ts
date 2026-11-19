import type * as Phaser from 'phaser';
import type { EffectLevel } from '../../../data/app/effect-levels';
import { RULE_ANIM } from '../../../data/zones/rule-anim';
import { LOGICAL_SIZE } from '../../../data/app/screen';
import { clamp01, lerp, oscillate01, sineWave, smoothstep } from '../../../util/math';
import { effectsMode } from '../../effects-mode';
import { scatter } from '../../objects/creature-art/primitives';
import { PrepQueue } from '../../objects/backdrop/zone-prep';
import { collectBakeSteps } from '../../ui/bake-texture';
import { bakeCloudFigure, cloudTopBaked, verticalRoom, type VerticalRoom } from './cloud-figure';
import { FLYING_FX_DEPTH } from '../tower/flying-fx-depth';
import {
  bakeNebulaArms,
  frameOrigin,
  NEBULA_FRAMES,
  nebulaFrameRects,
  nebulaLayout,
  nebulaTop,
  nebulaYScale,
} from './nebula-arms';
import { createFxTextures, FX_TEXTURES } from '../common/fx-textures';
import { createTreasureTextures, TREASURE_TEXTURES } from '../economy/treasure-textures';

const cfg = RULE_ANIM.cloud;
const nebula = cfg.nebula;
const stars = nebula.stars;
const motionCfg = nebula.motion;
/** Stars a bank keeps ready: the most any level shows. */
const STAR_SLOTS = stars.spots.length;
const LOGICAL_CENTER_X = LOGICAL_SIZE.width / 2;

const MS_PER_S = 1000;
/** Where a star that does not twinkle (lite level) stands in its pulse. */
const STILL_PULSE = 0.75;
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
  const step = etaMs <= dtMs ? 1 - progress : ((1 - progress) * dtMs) / etaMs;
  // Never faster than `approachMinMs` for the whole way: a late look-ahead does not jump the cloud in.
  return clamp01(progress + Math.min(step, dtMs / cfg.approachMinMs));
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
 * The densest a bank of `look` is drawn, 0..1: the nebula has its own cap, and the meringue
 * "Not scary" (`ghost`) lowers either by the share of that look (taken from the look the bank
 * really has, not from the zone of the layer: at a zone boundary they differ).
 */
export function densityCap(look: CloudLook, ghost: boolean): number {
  return (
    (look === 'nebula' ? nebula.maxDensity : cfg.maxDensity) * ghostShare(ghost, look === 'nebula')
  );
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

/**
 * The share of the density cap that "Not scary" leaves, 1 without it. The nebula has its own
 * (it is lighter than the cloud to begin with and has to read clearly more see-through).
 */
export function ghostShare(ghostMaster: boolean, nebulaLook: boolean): number {
  if (!ghostMaster) return 1;
  return nebulaLook ? nebula.ghostMaxDensity : cfg.ghostMaxDensity;
}

/** The figure of a nebula bank billows, except on the minimal level; the cloud always does. */
export function puffsBillow(look: CloudLook, level: EffectLevel): boolean {
  return look === 'cloud' || level !== 'minimal';
}

/** Whether the stars of the nebula (but the core one) twinkle on this effects level. */
export function starsTwinkle(level: EffectLevel): boolean {
  return stars.twinkle[level];
}

/**
 * How bright the glowing arms of the nebula are added over a veil shown at `figureAlpha`: full at the
 * density cap, so they fade in and out with the veil (and dim with "Not scary").
 */
export function armAlpha(figureAlpha: number): number {
  return clamp01(figureAlpha / nebula.maxDensity);
}

/**
 * How the arms of the nebula move at `timeMs`: the pink one flows along its wave by `flow` baked px
 * (the blue one by as much the other way) and turns by `sway` radians round the centre (the blue one
 * `blueSway` as much the other way). Still when the figure does not billow.
 */
export function armMotion(timeMs: number, billow: boolean): { flow: number; sway: number } {
  if (!billow) return { flow: 0, sway: 0 };
  return {
    flow: sineWave(timeMs, motionCfg.flowPeriodMs) * motionCfg.flowPx,
    sway: sineWave(timeMs, motionCfg.swayPeriodMs) * motionCfg.swayRad,
  };
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

/** The texture of the figure of a look. */
function figureKey(look: CloudLook): string {
  return look === 'nebula' ? TREASURE_TEXTURES.nebula : TREASURE_TEXTURES.cloud;
}

/** The frame of the figure of a look (the nebula's veil; the cloud has one picture). */
function figureFrame(look: CloudLook): string | undefined {
  return look === 'nebula' ? NEBULA_FRAMES.veil : undefined;
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
  /** The meringue master makes the cloud see-through: each bank lowers its own look's density cap. */
  ghost: boolean;
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
  /** Share of the leave's rise and growth the screen leaves room for (`verticalRoom`). */
  lift = 1;
  /** The cloud was given up while it floated in (its time to arrival jumped): it may still resume. */
  private gaveUp = false;
  /** How far to the side this cloud slides in from: less when it was found late. */
  private slidePx: number = cfg.enterPx;
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
          this.slidePx = cfg.enterPx * clamp01(input.etaMs / cfg.leadMs);
          this.enter('approach', input);
          this.progress = 0;
          this.lastEtaMs = input.etaMs;
        }
        break;
      case 'approach': {
        // This cloud has come once the time to the next one jumps up (or no cloud is due any more).
        const arrived = input.etaMs > this.lastEtaMs + ARRIVAL_JUMP_MS;
        this.lastEtaMs = input.etaMs;
        if (arrived && input.covering) {
          this.enter('cover', input);
          // This frame's time already counts: the run goes on without a still frame.
          this.ageMs = dtMs;
        } else if (arrived || !input.flying) this.leave(cfg.abortMs);
        else this.progress = stepApproach(this.progress, dtMs, input.etaMs);
        break;
      }
      case 'cover':
        if (!input.covering) this.leave(input.flying ? cfg.outMs : cfg.dropOutMs);
        break;
      case 'leave':
        if (this.ageMs >= this.leaveMs) this.reset();
        else if (input.covering) {
          this.enter('cover', input);
          this.ageMs = dtMs;
        }
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
    this.gaveUp = false;
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

  /**
   * A cloud given up a moment ago while it floated in (its time to arrival jumped a frame before the sim
   * began the cover): this bank should take that cover and turn solid from where it is.
   */
  get resumable(): boolean {
    return this.phase === 'leave' && this.gaveUp && this.ageMs < cfg.inMs;
  }

  private leave(durationMs: number): void {
    this.gaveUp = this.phase === 'approach';
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
    return { x: -this.dir * this.slidePx, rise: 0, alpha: 0, scale: cfg.enterScale };
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
        p.x = -this.dir * this.slidePx * (1 - smoothstep(k));
        p.alpha = cfg.approachAlpha * smoothstep(k);
        p.scale = cfg.enterScale + (1 - cfg.enterScale) * easeOutCubic(k);
        p.rise = 0;
        return p;
      }
      case 'cover': {
        // Whatever is left of the slide closes while it turns solid, at an even pace (no still frame):
        // full density `inMs` after the cover starts, whatever the warning was. That is the game role.
        const k = Math.min(1, t / cfg.inMs);
        p.x = from.x * (1 - k) + (this.dir * cfg.driftSpeed * t) / MS_PER_S;
        p.alpha = from.alpha + (1 - from.alpha) * k;
        p.scale = from.scale + (1 - from.scale) * k;
        p.rise = from.rise * (1 - k);
        return p;
      }
      case 'leave': {
        const s = t / MS_PER_S;
        const k = smoothstep(t / this.leaveMs);
        p.x = from.x + this.dir * (cfg.driftSpeed * s + (cfg.leaveAccel * s * s) / 2);
        p.alpha = from.alpha * (1 - k);
        // A screen with no room above keeps it from rising: it fades instead.
        p.scale = from.scale * (1 + cfg.leaveGrow * k * this.lift);
        p.rise = from.rise + cfg.slidePx * k * this.lift;
        return p;
      }
    }
  }
}

/** How the nebula pictures sit on this screen: their origins (the figure centre) and the stars' offset share. */
interface NebulaFit {
  origins: Record<'veil' | 'blue' | 'pink', { x: number; y: number }>;
  yScale: number;
  /** How far up each look may move on this screen (`verticalRoom`). */
  rooms: Record<CloudLook, VerticalRoom>;
}

/**
 * Where a bank's figure stands: its centre y and its scale, from the pose, the bob and breath waves
 * (-1..1) and the room the screen leaves above: the upward half of the bob and of the breath only goes
 * as far as `room.billow` allows, so the top never comes nearer the plates than `hudGapPx`.
 */
export function placeFigure(
  motionY: number,
  pose: Readonly<CloudPose>,
  bobWave: number,
  breatheWave: number,
  billow: boolean,
  room: Readonly<VerticalRoom>,
): { y: number; scale: number } {
  const y = motionY + room.drop - pose.rise;
  if (!billow) return { y, scale: cfg.figure.scale * pose.scale };
  const bob = bobWave * cfg.bobPx * (bobWave < 0 ? room.billow : 1);
  const breathe = 1 + breatheWave * cfg.breathe * (breatheWave > 0 ? room.billow : 1);
  return { y: y + bob, scale: cfg.figure.scale * pose.scale * breathe };
}

/**
 * Dev only: `window.tippyCloudHold = true` keeps a covering cloud or nebula on screen at full density
 * (for looking at its motion); never in a build.
 */
function cloudHeld(): boolean {
  return (
    import.meta.env.DEV && (globalThis as { tippyCloudHold?: boolean }).tippyCloudHold === true
  );
}

/** A bank: one figure (the cloud or the nebula) with its twinkling stars, and the motion that drives it. */
class CloudBank {
  private readonly figure: Phaser.GameObjects.Image;
  /** Twinkling stars of the nebula, made up front and only shown, moved and tinted afterwards. */
  private readonly stars: Phaser.GameObjects.Image[] = [];
  /** The two glowing arms of the nebula (blue behind, pink in front), added over its veil. */
  private readonly arms: Phaser.GameObjects.Image[] = [];
  readonly motion = new CloudMotion();
  look: CloudLook = 'cloud';

  constructor(
    scene: Phaser.Scene,
    /** Where the nebula pictures are cut and how far its stars sit from the row on this screen. */
    private readonly nebulaFit: NebulaFit,
  ) {
    this.figure = scene.add
      .image(LOGICAL_CENTER_X, 0, TREASURE_TEXTURES.cloud)
      .setDepth(FLYING_FX_DEPTH.cloud)
      .setVisible(false);
    for (let i = 0; i < STAR_SLOTS; i++) {
      const tint = i === 0 ? stars.core.tint : (stars.tints[i % stars.tints.length] ?? 0xffffff);
      this.stars.push(
        scene.add
          .image(0, 0, FX_TEXTURES.star)
          .setDepth(FLYING_FX_DEPTH.cloudStars)
          // Added light, like the arms: a star over the layer does not hide it more.
          .setBlendMode('ADD')
          .setTint(tint)
          .setVisible(false),
      );
    }
    for (let i = 0; i < 2; i++) {
      this.arms.push(
        scene.add
          .image(LOGICAL_CENTER_X, 0, TREASURE_TEXTURES.cloud)
          .setDepth(FLYING_FX_DEPTH.cloudArms)
          .setBlendMode('ADD')
          .setVisible(false),
      );
    }
  }

  /** The cap on how dense this bank is drawn, 0..1. */
  cap(ghost: boolean): number {
    return densityCap(this.look, ghost);
  }

  update(dtMs: number, timeMs: number, input: Readonly<CloudInput>): void {
    const look = pickLook(this.motion.phase, this.look, input.nebula ? 'nebula' : 'cloud');
    // The key is checked too: a figure baked again at run load (another screen height) is picked up.
    // The nebula picture is baked lazily: until it exists keep the old look and retry next frame.
    const baked = look !== 'nebula' || this.figure.scene.textures.exists(TREASURE_TEXTURES.nebula);
    if (baked && (look !== this.look || this.figure.texture.key !== figureKey(look))) {
      this.look = look;
      this.figure.setTexture(figureKey(look), figureFrame(look));
      const o = this.nebulaFit.origins;
      if (look === 'nebula') {
        this.figure.setOrigin(o.veil.x, o.veil.y);
        this.arms[0]?.setTexture(TREASURE_TEXTURES.nebula, NEBULA_FRAMES.blue);
        this.arms[0]?.setOrigin(o.blue.x, o.blue.y);
        this.arms[1]?.setTexture(TREASURE_TEXTURES.nebula, NEBULA_FRAMES.pink);
        this.arms[1]?.setOrigin(o.pink.x, o.pink.y);
      } else {
        this.figure.setOrigin(0.5, 0.5);
      }
    }
    const room = this.nebulaFit.rooms[this.look];
    this.motion.lift = room.leave;
    const pose = this.motion.update(dtMs, input);
    const shown = this.motion.visible;
    const level = effectsMode.level;
    const billow = puffsBillow(this.look, level);
    const sway = sineWave(timeMs, cfg.driftPeriodMs) * cfg.driftPx;
    const own = billow ? sineWave(timeMs, cfg.swayPeriodMs) * cfg.swayPx : 0;
    const x = LOGICAL_CENTER_X + pose.x + sway + own;
    const { y, scale } = placeFigure(
      this.motion.y,
      pose,
      sineWave(timeMs, cfg.bobPeriodMs),
      sineWave(timeMs, cfg.breathePeriodMs),
      billow,
      room,
    );
    this.figure
      .setVisible(shown)
      .setPosition(x, y)
      .setScale(scale)
      .setAlpha(Math.min(pose.alpha, this.cap(input.ghost)));
    this.updateStars(
      shown && this.look === 'nebula',
      timeMs,
      level,
      { x, y, scale },
      pose.alpha,
      ghostShare(input.ghost, this.look === 'nebula'),
    );
    this.updateArms(shown && this.look === 'nebula', timeMs, billow, { x, y, scale });
  }

  /** The arms of the nebula ride on its veil, flow towards each other along their wave and sway a little. */
  private updateArms(
    shown: boolean,
    timeMs: number,
    billow: boolean,
    at: { x: number; y: number; scale: number },
  ): void {
    const { flow, sway } = armMotion(timeMs, billow);
    const alpha = armAlpha(this.figure.alpha);
    this.arms.forEach((arm, i) => {
      arm.setVisible(shown);
      if (!shown) return;
      // The blue arm (0) moves the other way round from the pink one (1).
      const sign = i === 0 ? -1 : 1;
      const turn = i === 0 ? -motionCfg.blueSway : 1;
      arm
        .setPosition(at.x + sign * flow * at.scale, at.y)
        .setRotation(sway * turn)
        .setScale(at.scale)
        .setAlpha(alpha);
    });
  }

  /** The stars of the nebula sit on the figure and ride on it; each twinkles on its own phase. */
  private updateStars(
    shown: boolean,
    timeMs: number,
    level: EffectLevel,
    at: { x: number; y: number; scale: number },
    poseAlpha: number,
    share: number,
  ): void {
    const count = shown ? starCount(level) : 0;
    const [minScale, maxScale] = stars.scale;
    for (let i = 0; i < this.stars.length; i++) {
      const star = this.stars[i];
      if (!star) continue;
      const spot = stars.spots[i];
      const on = spot !== undefined && starActive(i, STAR_SLOTS, count);
      star.setVisible(on);
      if (!on) continue;
      // The first star is the core's: bigger and warm, it pulses on every level that shows it.
      const isCore = i === 0;
      const pulse = isCore
        ? oscillate01(timeMs, stars.core.periodMs, 0)
        : starsTwinkle(level)
          ? starPulse(timeMs, i)
          : STILL_PULSE;
      const { scale, alpha } = starLook(pulse);
      const base = isCore ? stars.core.scale : minScale + (maxScale - minScale) * scatter(i);
      star
        .setPosition(
          at.x + spot.x * cfg.figure.width * at.scale,
          at.y + spot.y * this.nebulaFit.yScale * at.scale,
        )
        .setScale(base * (at.scale / cfg.figure.scale) * scale)
        .setAlpha(alpha * poseAlpha * Math.min(1, share));
    }
  }
}

/**
 * Which bank takes a cover the sim has just started, by phases: none while one covers or floats in (that
 * one has it), else a bank that gave up its cloud a moment ago (it resumes from where it is instead of a
 * new one popping in), else a free one; -1 when there is none.
 */
export function coverTaker(motions: readonly CloudMotion[]): number {
  if (motions.some((m) => m.phase === 'cover' || m.phase === 'approach')) return -1;
  const resuming = motions.findIndex((m) => m.resumable);
  return resuming >= 0 ? resuming : motions.findIndex((m) => m.phase === 'idle');
}

/**
 * What a bank that only finishes leaving takes from the live input: where the layer flies and how
 * dense the puffs may be (a leaving see-through cloud stays see-through), never a new cover.
 */
export function followInput(passive: CloudInput, input: Readonly<CloudInput>): void {
  passive.flying = input.flying;
  passive.y = input.y;
  passive.dir = input.dir;
  passive.ghost = input.ghost;
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
    ghost: false,
    nebula: false,
  };
  /** The slices of the nebula bake, run within a small budget each frame from run load. */
  private readonly nebulaPrep = new PrepQueue();
  /** The first frame of the run has passed (a run that starts in Space bakes the nebula at it). */
  private started = false;
  /** What a covering bank is told while the dev hold keeps it on screen. */
  private readonly held: CloudInput = { ...this.passive };
  /** "Not scary" is on: what the cover reports is scaled by the share of each bank's own look. */
  private ghost = false;
  /** What a free bank is told when it should start floating in the coming cloud. */
  private readonly coming: CloudInput = { ...this.passive };

  constructor(scene: Phaser.Scene) {
    // At run load the figures are baked again if the screen height asks for another top line.
    bakeCloudFigure(scene, TREASURE_TEXTURES.cloud, true);
    const screenH = scene.scale.height;
    const layout = nebulaLayout(screenH);
    const rects = nebulaFrameRects(layout);
    // The nebula is computed pixel by pixel, in slices within a small budget a frame from run load:
    // done long before Space (it shows only there).
    this.nebulaPrep.add(
      collectBakeSteps(() => bakeNebulaArms(scene, TREASURE_TEXTURES.nebula, layout, rects)),
    );
    createTreasureTextures(scene);
    createFxTextures(scene);
    const fit: NebulaFit = {
      origins: {
        veil: frameOrigin(rects.veil),
        blue: frameOrigin(rects.blue),
        pink: frameOrigin(rects.pink),
      },
      yScale: nebulaYScale(layout),
      rooms: {
        cloud: verticalRoom(screenH, cloudTopBaked(screenH)),
        nebula: verticalRoom(screenH, nebulaTop(layout)),
      },
    };
    this.banks = [new CloudBank(scene, fit), new CloudBank(scene, fit)];
  }

  /**
   * Runs this frame's share of the nebula bake. A run that starts in Space (a debug start) bakes it at
   * its first frame, still part of the load; a nebula due before the slices are done (never in play: Space
   * is minutes away) gets the rest at once rather than no picture.
   */
  private prepNebula(input: Readonly<CloudInput>): void {
    const first = !this.started;
    this.started = true;
    if (this.nebulaPrep.pending === 0) return;
    const due = input.nebula && (input.covering || input.etaMs <= cfg.leadMs);
    if (due || (first && input.nebula)) this.nebulaPrep.flush();
    else this.nebulaPrep.work(nebula.bake.budgetMs, () => performance.now());
  }

  /** How much a cloud hides the layer, 0..1 (a see-through cloud hides no more than it shows). */
  get amount(): number {
    return Math.max(...this.banks.map((bank) => bank.motion.amount * bank.cap(this.ghost)));
  }

  /** A bank drawn as the nebula is on screen. */
  get nebulaShown(): boolean {
    return this.banks.some((bank) => bank.look === 'nebula' && bank.motion.visible);
  }

  /** Smooth 0..1 density of the densest bank (see `CloudMotion.density`). */
  get density(): number {
    return Math.max(...this.banks.map((bank) => bank.motion.density * bank.cap(this.ghost)));
  }

  /**
   * Roles each frame: a bank that covers keeps covering until the sim stops hiding the layer; a
   * bank that floats in follows the coming cloud; a free bank takes the coming cloud as soon as
   * it is `leadMs` away, even while the other one still covers or leaves, so every cloud gets its
   * full warning; a cloud that comes without one grows in place in a free bank.
   */
  update(dtMs: number, timeMs: number, input: Readonly<CloudInput>): void {
    this.prepNebula(input);
    const phases = this.banks.map((bank) => bank.motion.phase);
    let needsApproach = !phases.includes('approach') && input.flying && input.etaMs <= cfg.leadMs;
    let taker = input.covering ? coverTaker(this.banks.map((bank) => bank.motion)) : -1;
    const hold = cloudHeld() && phases.includes('cover');
    if (hold) {
      Object.assign(this.held, input, { covering: true });
      // The held bank stays alone on screen: no other one floats in.
      needsApproach = false;
      taker = -1;
    }
    followInput(this.passive, input);
    this.ghost = input.ghost;
    Object.assign(this.coming, input, { covering: false });
    this.banks.forEach((bank, i) => {
      const phase = bank.motion.phase;
      if (phase === 'cover' || phase === 'approach') {
        bank.update(dtMs, timeMs, hold && phase === 'cover' ? this.held : input);
      } else if (i === taker) {
        // A free bank, or one that gave up its cloud a moment ago and resumes it.
        bank.update(dtMs, timeMs, input);
      } else if (phase === 'idle' && needsApproach) {
        needsApproach = false;
        bank.update(dtMs, timeMs, this.coming);
      } else {
        bank.update(dtMs, timeMs, this.passive);
      }
    });
  }
}

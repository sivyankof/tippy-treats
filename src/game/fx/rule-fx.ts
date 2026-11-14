import type * as Phaser from 'phaser';
import type { SimEvent, TowerState } from '../../core/tower-sim';
import { RULE_ANIM } from '../../data/rule-anim';
import { LOGICAL_SIZE } from '../../data/screen';
import { ZONE_RULES } from '../../data/zones';
import { clamp01 } from '../../util/math';
import { effectsMode } from '../effects-mode';
import type { FlyingLayerView } from '../objects/flying-layer-view';
import { CloudCover } from './cloud-cover';
import { hopHeight, type Point } from './coin-flight-math';
import { FLYING_FX_DEPTH } from './flying-fx-depth';
import { FX_TEXTURES } from './fx-textures';
import { coneBurst } from './particle-motion';
import type { Particles } from './particles';
import { RushOutline } from './rush-outline';
import { restPose, RushWindup, type RushPose } from './rush-windup';
import { idleVisual, ruleVisual, type RuleVisual } from './rule-state';
import { SpeedStreaks } from './speed-streaks';
import { starBurst } from './sparkle-fx';

const windup = RULE_ANIM.windup;
const fakeout = RULE_ANIM.fakeout;
/** Direction of a particle cone that points straight up (degrees, screen y runs down). */
const UP_DEG = -90;
/** Directions of a particle cone (degrees, 0 is right): behind a layer that flies right or left. */
const LEFT_DEG = 180;
const RIGHT_DEG = 0;
const PUFF_TINTS = [RULE_ANIM.colors.rushPuff, RULE_ANIM.colors.rushStreak] as const;

/** Where the flying layer was drawn last, kept so that the outline fades and a cloud can leave after the layer is gone. */
interface Spot extends Point {
  width: number;
  dir: 1 | -1;
}

/**
 * The look of the zone rules on the flying layer, so that each one reads without words: the red
 * outline, the wind-up and the speed streaks of a rush, the roof wind, the cloud that hides
 * the layer and the surprised stop of the stars fake-out.
 */
export class RuleFx {
  private readonly outline: RushOutline;
  private readonly streaks: SpeedStreaks;
  private readonly cloud: CloudCover;
  private readonly visual: RuleVisual = idleVisual();
  private readonly spot: Spot = { x: 0, y: 0, width: 0, dir: 1 };
  private readonly windup = new RushWindup();
  /** What the layer is drawn like this frame (the squash is dropped in "fewer effects"). */
  private readonly pose: RushPose = restPose();
  private lastIndex = -1;
  /** Time since the layer spawned and since the rush let go; the outline and the flare run on them. */
  private ageMs = 0;
  private sinceReleaseMs = Infinity;
  /** Time since the fake-out jolt; the jolt is over once it passes `joltMs`. */
  private joltAgeMs: number = fakeout.joltMs;

  constructor(
    scene: Phaser.Scene,
    private readonly flying: FlyingLayerView,
    private readonly particles: Particles,
  ) {
    this.outline = new RushOutline(scene);
    this.streaks = new SpeedStreaks(scene);
    this.cloud = new CloudCover(scene);
  }

  /** Events of one sim step: the fake-out stop gets its stars and its surprised face. */
  handleEvents(events: readonly SimEvent[]): void {
    for (const event of events) {
      if (event.type !== 'fakeout') continue;
      this.joltAgeMs = 0;
      this.flying.react(fakeout.face, event.stopMs + fakeout.faceExtraMs);
      const y = this.flying.position()?.y ?? this.spot.y;
      starBurst(this.particles, event.x, y, fakeout.stars, UP_DEG, fakeout.style, fakeout.tints);
    }
  }

  /**
   * Call after the flying view was synced. `pos` is the centre of the flying layer, `null`
   * while none flies. Returns whether a cloud hides the layer (the shine around it must go too).
   */
  update(
    dtMs: number,
    timeMs: number,
    state: Readonly<TowerState>,
    pos: Readonly<Point> | null,
  ): boolean {
    const layer = state.flying;
    const v = ruleVisual(layer, state.phase, this.visual);
    if (layer && pos) {
      this.startLayer(layer.index, layer.rush);
      // The shake moves the picture and `pos` together, so that everything laid around the
      // layer (outline, streaks, coats, sparkles) follows the shifted picture.
      this.shake(dtMs, timeMs, v, layer.dir, layer.width, pos, state.phase === 'flying');
      const spot = this.spot;
      spot.x = pos.x;
      spot.y = pos.y;
      spot.width = layer.width;
      spot.dir = layer.dir;
    } else {
      this.lastIndex = -1;
      this.windup.reset();
    }

    const at = this.spot;
    const shown = layer !== null && pos !== null;
    const pose = this.pose;
    this.outline.update(
      shown && v.outline,
      at.x,
      at.y,
      at.width,
      timeMs,
      this.ageMs,
      this.flash(),
      pose.scaleX,
      pose.scaleY,
    );
    this.streaks.update(shown ? v.streaks : 0, v.streakKind, at.x, at.y, at.width, at.dir, timeMs);
    this.cloud.update(
      dtMs,
      timeMs,
      shown && v.covered,
      !shown || state.phase !== 'flying',
      at.y,
      at.dir,
    );
    return v.covered || this.cloud.amount > 0;
  }

  /** A fresh layer starts: a rush one gathers itself with a scrunched face. */
  private startLayer(index: number, rush: boolean): void {
    if (index === this.lastIndex) return;
    this.lastIndex = index;
    this.joltAgeMs = fakeout.joltMs;
    this.ageMs = 0;
    this.sinceReleaseMs = Infinity;
    this.windup.reset();
    if (rush) this.flying.react(windup.face, ZONE_RULES.rush.windupMs);
  }

  /** The flare of the release, 1 at the release down to 0; none in "fewer effects". */
  private flash(): number {
    if (effectsMode.reduced) return 0;
    return 1 - clamp01(this.sinceReleaseMs / RULE_ANIM.outline.flashMs);
  }

  /**
   * The wind-up draws the layer back against its flight and squeezes it; the release lets it
   * snap forward from there. A fake-out jolts it up. All of it moves the picture only.
   * "Fewer effects" keeps the pull-back and drops the squash and the flare.
   */
  private shake(
    dtMs: number,
    timeMs: number,
    v: RuleVisual,
    dir: 1 | -1,
    width: number,
    pos: Readonly<Point>,
    flying: boolean,
  ): void {
    this.ageMs += dtMs;
    this.sinceReleaseMs += dtMs;
    const { pull, scaleX, scaleY } = this.windup.update(dtMs, v.winding, v.windupProgress);
    const extras = !effectsMode.reduced;
    this.pose.pull = pull;
    this.pose.scaleX = extras ? scaleX : 1;
    this.pose.scaleY = extras ? scaleY : 1;
    const dx = -dir * pull;
    if (this.windup.released && flying && extras)
      this.release(timeMs, pos.x + dx, pos.y, width, dir);
    let dy = 0;
    if (this.joltAgeMs < fakeout.joltMs) {
      this.joltAgeMs += dtMs;
      dy = -hopHeight(this.joltAgeMs / fakeout.joltMs, fakeout.joltPx);
    }
    if (dx !== 0 || dy !== 0) this.flying.nudge(dx, dy);
    if (this.pose.scaleX !== 1 || this.pose.scaleY !== 1) {
      this.flying.stretch(this.pose.scaleX, this.pose.scaleY);
    }
  }

  /** The rush lets go: the outline flares, a puff comes off the back edge and the streaks burst out. */
  private release(timeMs: number, x: number, y: number, width: number, dir: 1 | -1): void {
    this.sinceReleaseMs = 0;
    this.streaks.burst(timeMs);
    const puff = windup.puff;
    const inset = puff.screenInsetPx;
    const backX = Math.min(LOGICAL_SIZE.width - inset, Math.max(inset, x - (dir * width) / 2));
    this.particles.emit(
      puff.count,
      (n) => coneBurst(backX, y, dir === 1 ? LEFT_DEG : RIGHT_DEG, n, puff.style),
      { texture: FX_TEXTURES.halo, tints: PUFF_TINTS, depth: FLYING_FX_DEPTH.behind },
    );
  }
}

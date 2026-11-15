import * as Phaser from 'phaser';
import { Rng } from '../../core/rng';
import type { SimEvent, TowerState } from '../../core/tower-sim';
import { BALANCE } from '../../data/balance';
import type { Range } from '../../data/backdrop-life';
import { faceRecipe } from '../../data/creature-looks';
import { TOWER_GUEST, TOWER_GUESTS, type GuestLook } from '../../data/tower-guest';
import { ZONES } from '../../data/zones';
import {
  clamp01,
  DEG_TO_RAD,
  easeInQuad,
  easeOutQuad,
  flapScale,
  lerp,
  pickRange,
  sineWave,
} from '../../util/math';
import { DEPTH } from '../depth';
import { effectsMode } from '../effects-mode';
import { faceHalfSpan } from '../fx/glaze-growth';
import type { Particles } from '../fx/particles';
import { starBurst } from '../fx/sparkle-fx';
import type { GuestSource, SourcePoint } from './backdrop/guest-source';
import { plainLooks } from './plain-look';
import { bakeGuestFlat, drawGuestLegs } from './tower-guest-art';
import {
  clearOfFace,
  flightPoint,
  flinchPose,
  GuestScheduler,
  layerCovers,
  layerOverGuest,
  shouldFlinch,
  siteOffset,
  splatShape,
  type FlightPoint,
  type GuestPhase,
  type GuestShape,
  type Span,
} from './tower-guest-plan';
import type { LayerPose, TowerView } from './tower-view';

const { splat, flap, rub, shy } = TOWER_GUEST;
const HALF_LAYER = BALANCE.layer.height / 2;

/** What the guest needs to know about the frame. */
export interface GuestContext {
  state: Readonly<TowerState>;
  /** World scroll of the camera and the logical screen size. */
  cam: { scrollY: number; width: number; height: number };
  /** The shadow of the flying layer on the tower (world x of its centre). */
  shadow: Readonly<{ x: number; visible: boolean }>;
}

/** Sounds of the guest; the run wires them to the audio service. */
export interface GuestSounds {
  splat: () => void;
  squeak: () => void;
  buzz: () => void;
}

/** Style of one flight: zigzag turns and how far up it climbs when it leaves. */
interface FlightSpec {
  zigzagPx: number;
  zigzagCycles: number;
}

/** A layer of the tower the guest is tied to and where on it. */
interface Anchor {
  index: number;
  /** The top surface (sitting) or the lower edge (pressed under the layer above). */
  edge: 'top' | 'bottom';
  /** Offset from the centre of the layer, pixels. */
  dx: number;
}

/**
 * The guest of the tower (docs/06, "Гость на башне"): in a zone that has one, it flies in now and
 * then, sits on the top layer beside the face, rubs its legs and flies away. A layer that lands on
 * it flattens it (squash, a flat pancake with bulging eyes and stars, the layer above looks down),
 * then it peels off, shakes itself into shape and flees, offended. In the air it shies from a flying
 * layer that stays over it and bolts when the tower sneezes. The timing comes from the cosmetic
 * stream of the run: nothing of this touches the rules, and "fewer effects" keeps the guest away.
 */
export class TowerGuest {
  private readonly random: Rng;
  private readonly scheduler: GuestScheduler;
  private readonly root: Phaser.GameObjects.Container;
  private readonly body: Phaser.GameObjects.Image;
  private readonly legs: Phaser.GameObjects.Graphics;
  private look: GuestLook | null = null;
  private phase: GuestPhase = 'away';
  private phaseMs = 0;
  private clockMs = 0;
  /** Length of the flight, the hold or the sit now going. */
  private spanMs = 0;
  private anchor: Anchor = { index: 0, edge: 'top', dx: 0 };
  private readonly pos: FlightPoint = { x: 0, y: 0 };
  private readonly from: FlightPoint = { x: 0, y: 0 };
  private readonly to: FlightPoint = { x: 0, y: 0 };
  private readonly scratchPose: LayerPose = {
    x: 0,
    y: 0,
    width: 0,
    angle: 0,
    cut: null,
    look: { kind: 'plain' },
  };
  private readonly shape: GuestShape = { flat: false, scaleX: 1, scaleY: 1, tilt: 0 };
  /** Tilt of the layer the guest is tied to, radians. */
  private swayTilt = 0;
  private zigzag: FlightSpec = { zigzagPx: 0, zigzagCycles: 0 };
  private ease: (t: number) => number = easeOutQuad;
  private facing: -1 | 1 = 1;
  /** A flying layer was near the guest in the last frame. */
  private wasOver = false;
  /** Time into the flinch going now; negative when there is none. */
  private flinchMs = -1;
  private flinchAway: -1 | 1 = 1;
  private flinchCooldownMs = 0;
  private readonly flinch = { lift: 0, lean: 0 };
  /** The creature of the backdrop this guest came from (hidden there while the guest is out). */
  private getSource: () => GuestSource | null = () => null;
  private source: GuestSource | null = null;
  private readonly sourcePoint: SourcePoint = { x: 0, y: 0, scale: 1 };
  /** The drawn size the arrival starts at (the backdrop creature's), growing to the guest's own. */
  private scaleFrom = 1;
  /** A layer landed on the guest: it slides from `from` to `to` (offsets from the layer centre). */
  private readonly slide = { from: 0, to: 0 };
  private last: GuestContext | null = null;
  private shownFlat: boolean | null = null;

  constructor(
    scene: Phaser.Scene,
    private readonly tower: TowerView,
    private readonly particles: Particles,
    private readonly sounds: GuestSounds,
  ) {
    this.random = new Rng(plainLooks.cosmeticSeed).fork(TOWER_GUEST.stream);
    this.scheduler = new GuestScheduler(() => this.random.next());
    for (const look of Object.values(TOWER_GUESTS)) bakeGuestFlat(scene, look);
    this.body = new Phaser.GameObjects.Image(scene, 0, 0, '__DEFAULT');
    this.legs = new Phaser.GameObjects.Graphics(scene);
    this.root = new Phaser.GameObjects.Container(scene, 0, 0, [this.body, this.legs]);
    this.root.setDepth(DEPTH.pieces).setVisible(false);
    scene.add.existing(this.root);
  }

  /** Where the guest's backdrop creature is; the guest flies out of it and hides it while out. */
  setSource(get: () => GuestSource | null): void {
    this.getSource = get;
  }

  /** Per frame, after the tower is placed. */
  update(dtMs: number, ctx: GuestContext): void {
    this.last = ctx;
    this.clockMs += dtMs;
    if (this.phase === 'away') {
      this.tickAway(dtMs, ctx);
      return;
    }
    if (!this.runIsOn(ctx.state)) {
      this.hide();
      return;
    }
    this.phaseMs += dtMs;
    if (!this.follow(ctx.state)) return;
    switch (this.phase) {
      case 'arrive':
        this.flyArrive();
        break;
      case 'sit':
        this.tickSit(dtMs, ctx);
        break;
      case 'leave':
      case 'flee':
        this.flyAway();
        break;
      default:
        this.tickSplat();
        break;
    }
    if (this.root.visible) this.draw();
  }

  /** Reacts to the events of one sim step: a landing, a sneeze. Call it after the tower is synced. */
  handleEvents(events: readonly SimEvent[], state: Readonly<TowerState>): void {
    if (this.phase !== 'arrive' && this.phase !== 'sit') return;
    if (events.some((e) => e.type === 'wobble_sneeze')) {
      this.startLeave('startle');
      return;
    }
    if (!events.some((e) => e.type === 'land')) return;
    const top = state.layers.length - 1;
    const pose = this.phase === 'sit' && this.anchor.index === top - 1 ? this.poseOf(top) : null;
    if (pose && layerCovers(this.pos.x, pose.x, pose.width)) this.startSplat(top, pose);
    else this.startLeave('startle');
  }

  /** Dev tool: a guest sits on the top layer right away; true when one could. */
  landNow(): boolean {
    const ctx = this.last;
    if (!ctx || this.phase !== 'away') return false;
    const look = this.lookFor(ctx.state);
    const top = ctx.state.layers.length - 1;
    const pose = look && top >= 0 ? this.poseOf(top) : null;
    if (!look || !pose) return false;
    const dx = this.pickSite(look, pose, null);
    if (dx === null) return false;
    this.begin(look, top, dx);
    this.source?.suspend(true);
    this.enter('sit', this.pick(TOWER_GUEST.sitMs));
    this.facing = this.headTo(dx < 0 ? 1 : -1);
    this.anchorPoint(this.pos);
    this.draw();
    return true;
  }

  private pick(range: Range): number {
    return pickRange(range, () => this.random.next());
  }

  private tickAway(dtMs: number, ctx: GuestContext): void {
    if (effectsMode.reduced) return;
    this.scheduler.tick(dtMs);
    if (this.scheduler.ready && !this.tryArrive(ctx)) this.scheduler.retry();
  }

  private runIsOn(state: Readonly<TowerState>): boolean {
    return state.phase !== 'over' && state.phase !== 'await_continue';
  }

  /** The guest of the zone the tower is in, if it has one and its picture is baked. */
  private lookFor(state: Readonly<TowerState>): GuestLook | null {
    const look = TOWER_GUESTS[ZONES[state.zoneIndex]?.id ?? 'kitchen'];
    return look && this.root.scene.textures.exists(look.texture) ? look : null;
  }

  /** The visit may start: the tower is calm, its top layer is on screen and there is room beside its face. */
  private tryArrive(ctx: GuestContext): boolean {
    const { state, cam } = ctx;
    const look = this.lookFor(state);
    const top = state.layers.length - 1;
    const view = this.tower.topView();
    if (!look || !view || top < 0 || !this.tower.isCalm || state.phase === 'falling') return false;
    if (!this.runIsOn(state) || view.y < cam.scrollY || view.y > cam.scrollY + cam.height) {
      return false;
    }
    const pose = this.poseOf(top);
    if (!pose) return false;
    const dx = this.pickSite(look, pose, this.shadowSpan(ctx, pose));
    if (dx === null) return false;
    this.begin(look, top, dx);
    const { arrive, offscreenPx } = TOWER_GUEST;
    const fromLeft = this.random.next() < 0.5;
    this.from.x = fromLeft ? -offscreenPx : cam.width + offscreenPx;
    const above = this.pick(arrive.abovePx);
    this.from.y = Math.max(cam.scrollY + arrive.abovePx[0] / 2, pose.y - HALF_LAYER - above);
    // The creature of the backdrop that is in view peels off its path and flies on from there.
    if (this.source?.peek(this.sourcePoint)) {
      this.from.x = this.sourcePoint.x;
      this.from.y = this.sourcePoint.y + cam.scrollY;
      this.scaleFrom = this.sourcePoint.scale;
    }
    this.source?.suspend(true);
    this.zigzag = arrive;
    this.ease = easeOutQuad;
    this.enter('arrive', this.pick(arrive.flightMs));
    this.pos.x = this.from.x;
    this.pos.y = this.from.y;
    this.facing = this.headTo(this.from.x < pose.x ? 1 : -1);
    this.draw();
    return true;
  }

  /** The shadow of the flying layer as offsets from the centre of the top layer; `null` when there is none. */
  private shadowSpan(ctx: GuestContext, pose: LayerPose): Span | null {
    const flying = ctx.state.flying;
    if (!flying || !ctx.shadow.visible) return null;
    const half = flying.width / 2;
    return { left: ctx.shadow.x - half - pose.x, right: ctx.shadow.x + half - pose.x };
  }

  /** Half of the width the face of a layer takes. */
  private faceHalfOf(pose: LayerPose): number {
    const creature = pose.look.kind === 'creature' ? (pose.look.creature ?? null) : null;
    return faceHalfSpan(pose.width, creature ? faceRecipe(creature) : null);
  }

  private pickSite(look: GuestLook, pose: LayerPose, avoid: Span | null): number | null {
    const face = this.faceHalfOf(pose);
    const side: -1 | 1 = this.random.next() < 0.5 ? -1 : 1;
    const reach = this.pick(TOWER_GUEST.site.reach);
    return siteOffset(pose.width, face, look.halfWidthPx * look.scale, side, reach, avoid);
  }

  /** Starts a visit on the layer `index` at `dx` from its centre. */
  private begin(look: GuestLook, index: number, dx: number): void {
    this.look = look;
    this.anchor = { index, edge: 'top', dx };
    this.wasOver = false;
    this.flinchMs = -1;
    this.flinchCooldownMs = 0;
    this.scaleFrom = look.scale;
    this.source = this.getSource();
    this.scheduler.started();
    this.legs.setPosition(-look.size.width / 2, -look.feetY);
    this.root.setVisible(true);
    this.shownFlat = null;
  }

  private enter(phase: GuestPhase, spanMs = 0): void {
    this.phase = phase;
    this.phaseMs = 0;
    this.spanMs = spanMs;
  }

  /** The `facing` that makes the guest look towards `dir` (its picture looks to `headSide`). */
  private headTo(dir: -1 | 1): -1 | 1 {
    return dir === this.look?.headSide ? 1 : -1;
  }

  private poseOf(index: number): LayerPose | null {
    return this.tower.layerPoseInto(this.scratchPose, index);
  }

  /** Puts `out` where the guest is tied to its layer, sway included; false when the layer is gone. */
  private anchorPoint(out: FlightPoint): boolean {
    const pose = this.poseOf(this.anchor.index);
    if (!pose) return false;
    const a = pose.angle * DEG_TO_RAD;
    const edgeY = this.anchor.edge === 'top' ? -HALF_LAYER + TOWER_GUEST.site.sinkPx : HALF_LAYER;
    out.x = pose.x + this.anchor.dx * Math.cos(a) - edgeY * Math.sin(a);
    out.y = pose.y + edgeY * Math.cos(a) + this.anchor.dx * Math.sin(a);
    this.swayTilt = a;
    return true;
  }

  /**
   * Keeps a tied guest on its layer. A visitor whose layer is no longer the top one, or that the
   * "fewer effects" mode turned on, takes off. False when the guest is gone.
   */
  private follow(state: Readonly<TowerState>): boolean {
    if (this.phase === 'leave' || this.phase === 'flee') return true;
    const visiting = this.phase === 'arrive' || this.phase === 'sit';
    if (visiting && (this.anchor.index !== state.layers.length - 1 || effectsMode.reduced)) {
      this.startLeave('startle');
      return true;
    }
    if (this.phase === 'arrive') return true;
    if (this.phase === 'squash') {
      this.anchor.dx = lerp(this.slide.from, this.slide.to, clamp01(this.phaseMs / this.spanMs));
    }
    if (this.anchorPoint(this.pos)) return true;
    this.hide();
    return false;
  }

  private flyArrive(): void {
    const t = this.phaseMs / this.spanMs;
    if (!this.anchorPoint(this.to)) {
      this.hide();
      return;
    }
    this.fly(t);
    this.facing = this.headTo(this.to.x >= this.from.x ? 1 : -1);
    if (t >= 1) {
      this.enter('sit', this.pick(TOWER_GUEST.sitMs));
      this.facing = this.headTo(this.anchor.dx < 0 ? 1 : -1);
    }
  }

  /** Places the guest `t` of the way along the flight from `from` to `to`. */
  private fly(t: number): void {
    const { zigzagPx, zigzagCycles } = this.zigzag;
    flightPoint(
      this.from.x,
      this.from.y,
      this.to.x,
      this.to.y,
      t,
      zigzagPx,
      zigzagCycles,
      this.ease,
      this.pos,
    );
  }

  private tickSit(dtMs: number, ctx: GuestContext): void {
    const flying = ctx.state.flying;
    const over = flying !== null && layerOverGuest(this.pos.x, flying.x, flying.width);
    this.flinchCooldownMs -= dtMs;
    if (flying && shouldFlinch(over, this.wasOver, this.flinchCooldownMs)) {
      this.flinchMs = 0;
      this.flinchCooldownMs = shy.cooldownMs;
      this.flinchAway = flying.x < this.pos.x ? 1 : -1;
    }
    this.wasOver = over;
    if (this.flinchMs >= 0) {
      this.flinchMs += dtMs;
      if (this.flinchMs >= shy.hopMs) this.flinchMs = -1;
    }
    if (this.phaseMs >= this.spanMs) this.startLeave('leave');
  }

  /** The guest takes off for the nearer screen edge: calmly (`leave`) or in a hurry (`startle`: a miss, a sneeze). */
  private startLeave(kind: 'leave' | 'startle'): void {
    this.flyOff(TOWER_GUEST[kind]);
    this.enter('leave', this.pick(TOWER_GUEST[kind].flightMs));
  }

  /** Aims a flight from where the guest is to beyond the nearer screen edge, climbing. */
  private flyOff(spec: FlightSpec & { risePx: Range }): void {
    const width = this.last?.cam.width ?? BALANCE.tray.centerX * 2;
    const toRight = this.pos.x >= width / 2;
    this.from.x = this.pos.x;
    this.from.y = this.pos.y;
    this.to.x = toRight ? width + TOWER_GUEST.offscreenPx : -TOWER_GUEST.offscreenPx;
    this.to.y = this.pos.y - this.pick(spec.risePx);
    this.zigzag = spec;
    this.ease = easeInQuad;
    this.facing = this.headTo(toRight ? 1 : -1);
  }

  private flyAway(): void {
    const t = this.phaseMs / this.spanMs;
    this.fly(t);
    if (t >= 1) this.hide();
  }

  /** A layer landed on the guest: it is tied to the new layer's lower edge and squashes. */
  private startSplat(index: number, pose: LayerPose): void {
    const look = this.look;
    const from = this.pos.x - pose.x;
    // The pancake stays clear of the new layer's face: the guest is nudged aside as it is pressed.
    const half = look ? Math.max(look.halfWidthPx, look.flat.halfWidthPx) * look.scale : 0;
    this.slide.from = from;
    this.slide.to = clearOfFace(from, this.faceHalfOf(pose), half, pose.width);
    this.anchor = { index, edge: 'bottom', dx: from };
    this.enter('squash', splat.squashMs);
    this.sounds.splat();
  }

  private tickSplat(): void {
    if (this.phaseMs < this.spanMs) return;
    switch (this.phase) {
      case 'squash':
        this.enter('hold', this.pick(splat.holdMs));
        this.onFlat();
        break;
      case 'hold':
        this.enter('peel', splat.peelMs);
        this.sounds.squeak();
        break;
      case 'peel':
        this.enter('shake', splat.shakeMs);
        break;
      case 'shake':
        this.flyOff(splat.flee);
        this.enter('flee', this.pick(splat.flee.flightMs));
        this.sounds.buzz();
        break;
      default:
        break;
    }
  }

  /** The pancake pops in: stars fly out and the layer above looks down at it, surprised. */
  private onFlat(): void {
    const { stars, surprise } = splat;
    starBurst(this.particles, this.pos.x, this.pos.y, stars.count, -90, stars.style, stars.tints);
    const view = this.tower.viewAt(this.anchor.index);
    if (!view) return;
    const face = view.faceView;
    const scale = face.faceScale || 1;
    const ms = this.spanMs + splat.peelMs + surprise.extraMs;
    face.react(surprise.reaction, ms);
    face.glanceAt(
      (this.pos.x - view.x - face.x) / scale,
      (this.pos.y - view.y - face.y) / scale,
      ms,
    );
  }

  private hide(): void {
    this.source?.suspend(false);
    this.source = null;
    this.phase = 'away';
    this.root.setVisible(false);
    this.legs.clear();
  }

  /** The shape of this frame: the splat stages, or the flight and the rest. */
  private fillShape(): GuestShape {
    const shape = this.shape;
    const phase = this.phase;
    if (phase === 'squash' || phase === 'hold' || phase === 'peel' || phase === 'shake') {
      splatShape(phase, this.phaseMs, shape);
      shape.tilt += this.swayTilt;
      return shape;
    }
    shape.flat = false;
    shape.scaleX = 1;
    if (phase === 'sit') {
      shape.scaleY = 1;
      shape.tilt =
        this.swayTilt +
        this.flinch.lean +
        rub.twitchDeg * DEG_TO_RAD * sineWave(this.clockMs, rub.twitchPeriodMs);
      return shape;
    }
    // Flying: wing beats flatten the picture and the body tilts with the buzz; both fade in at
    // take-off (and out at landing) so the shape does not jump.
    const ramp = this.flightRamp();
    shape.scaleY = lerp(1, flapScale(this.clockMs, flap), ramp);
    shape.tilt =
      ramp *
      TOWER_GUEST.tiltDeg *
      DEG_TO_RAD *
      sineWave(this.clockMs, flap.ms * TOWER_GUEST.tiltPeriodMul);
    return shape;
  }

  /** 0 to 1: how much of the flight's buzz shows now. */
  private flightRamp(): number {
    const { flightRampMs } = TOWER_GUEST;
    const landing = this.phase === 'arrive' ? (this.spanMs - this.phaseMs) / flightRampMs : 1;
    return clamp01(Math.min(this.phaseMs / flightRampMs, landing));
  }

  /** Places and shapes the picture for this frame. */
  private draw(): void {
    const look = this.look;
    if (!look) return;
    if (this.flinchMs >= 0) flinchPose(this.flinchMs, this.flinchAway, this.flinch);
    else this.flinch.lift = this.flinch.lean = 0;
    const shape = this.fillShape();
    if (this.shownFlat !== shape.flat) {
      this.shownFlat = shape.flat;
      const { flat } = look;
      this.body.setTexture(shape.flat ? flat.texture : look.texture);
      const height = shape.flat ? flat.height : look.size.height;
      const feet = shape.flat ? flat.height * flat.feetShare : look.feetY;
      this.body.setOrigin(0.5, feet / height);
    }
    const resting = this.phase === 'sit';
    this.legs.setVisible(resting);
    if (resting) drawGuestLegs(this.legs, look, this.clockMs, look.headSide);
    const size =
      this.phase === 'arrive'
        ? lerp(this.scaleFrom, look.scale, clamp01(this.phaseMs / this.spanMs))
        : look.scale;
    this.root.setPosition(this.pos.x, this.pos.y - this.flinch.lift);
    this.root.setRotation(shape.tilt);
    this.root.setScale(this.facing * size * shape.scaleX, size * shape.scaleY);
  }
}

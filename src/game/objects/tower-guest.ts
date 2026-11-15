import * as Phaser from 'phaser';
import { Rng } from '../../core/rng';
import type { SimEvent, TowerState } from '../../core/tower-sim';
import { ANIM } from '../../data/anim';
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
  stepToward,
} from '../../util/math';
import { DEPTH } from '../depth';
import { effectsMode } from '../effects-mode';
import { FX_TEXTURES } from '../fx/fx-textures';
import { faceHalfSpan } from '../fx/glaze-growth';
import type { LandingFx } from '../fx/landing-fx';
import { starBurst } from '../fx/sparkle-fx';
import type { GuestSource, SourcePoint } from './backdrop/guest-source';
import type { LayerView } from './layer-view';
import { plainLooks } from './plain-look';
import { bakeGuestFlat, drawFlatLimbs, drawGuestLegs } from './tower-guest-art';
import {
  aimedByShadowOnly,
  chooseSite,
  clearOfFace,
  clearOfSpan,
  flightPoint,
  flinchPose,
  GuestScheduler,
  layerCovers,
  layerOverGuest,
  orbitStar,
  shouldFlinch,
  SPLAT_STAGES,
  splatShape,
  stageMs,
  type FlightPoint,
  type GuestPhase,
  type GuestShape,
  type OrbitStar,
  type Span,
  type Stagger,
} from './tower-guest-plan';
import type { LayerPose, TowerView } from './tower-view';

const { splat, flap, rub, shy, shadowFit } = TOWER_GUEST;
const { impact, orbit, neighbours } = splat;
const HALF_LAYER = BALANCE.layer.height / 2;

/** What the guest needs to know about the frame. */
export interface GuestContext {
  state: Readonly<TowerState>;
  /** World scroll of the camera and the logical screen size. */
  cam: { scrollY: number; width: number; height: number };
  /** The shadow of the flying layer on the tower (world x of its centre). */
  shadow: Readonly<{ x: number; visible: boolean }>;
}

/** Sounds and the camera kick of the guest; the run wires them to the audio service and its camera. */
export interface GuestCues {
  splat: () => void;
  peel: () => void;
  buzz: () => void;
  giggle: () => void;
  /** Kicks the camera `mul` times a normal landing. */
  kick: (mul: number) => void;
}

/** Style of one flight: zigzag turns, an optional reel, and how far up it climbs when it leaves. */
interface FlightSpec {
  zigzagPx: number;
  zigzagCycles: number;
  stagger?: Stagger;
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
 * it splats it: the layer holds its squash and dips at that spot, the camera kicks, the guest goes
 * flat (crossed-out eyes, trembling legs, stars and a clap ring; the neighbours glance, one may
 * giggle), then it peels off, inflates back, shakes its head under circling stars and staggers away.
 * In the air it shies from a flying layer that stays over it and bolts when the tower sneezes.
 * Every choice comes from the cosmetic stream of the run: nothing of this touches the rules.
 * "Fewer effects" keeps the guest away and cuts a splat down to the flattening and the flight.
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
  /** This visit is bound for the path of the next layer (`TOWER_GUEST.site.pathChance`). */
  private onPath = false;
  /** The wing beat of this flight is already going (a turned arrival): it does not fade in again. */
  private rampedMs = 0;
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
  /** The shadow of the flying layer as offsets from the centre of the anchor layer (reused). */
  private readonly shadowBox: Span = { left: 0, right: 0 };
  /** The shadow of the flying layer is near the guest now (the guest hides the aim hint if it stays big). */
  private nearShadow = false;
  /** Share of the full size the guest is drawn at: small over the aim hint (`TOWER_GUEST.shadowFit`). */
  private shrink = 1;
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
  /** The visit was started by the dev trigger: it stays in "fewer effects". */
  private forced = false;
  /** The splat now going is the "fewer effects" one: flattening and the flight away only. */
  private plainSplat = false;
  /** Stars circling over the guest's head, and the time they have been circling (negative: none). */
  private readonly orbitStars: Phaser.GameObjects.Image[];
  private orbitMs = -1;
  private readonly orbitPoint: OrbitStar = { x: 0, y: 0, scale: 1, front: true };
  /** A neighbour that giggles at the pancake once `giggleInMs` runs out. */
  private giggler: LayerView | null = null;
  private giggleInMs = 0;

  constructor(
    scene: Phaser.Scene,
    private readonly tower: TowerView,
    private readonly fx: LandingFx,
    private readonly cues: GuestCues,
  ) {
    this.random = new Rng(plainLooks.cosmeticSeed).fork(TOWER_GUEST.stream);
    this.scheduler = new GuestScheduler(() => this.random.next());
    for (const look of Object.values(TOWER_GUESTS)) bakeGuestFlat(scene, look);
    this.body = new Phaser.GameObjects.Image(scene, 0, 0, '__DEFAULT');
    this.legs = new Phaser.GameObjects.Graphics(scene);
    this.root = new Phaser.GameObjects.Container(scene, 0, 0, [this.body, this.legs]);
    this.root.setDepth(DEPTH.pieces).setVisible(false);
    scene.add.existing(this.root);
    this.orbitStars = Array.from({ length: orbit.count }, (_, i) =>
      scene.add
        .image(0, 0, FX_TEXTURES.star)
        .setTint(orbit.tints[i % orbit.tints.length] ?? orbit.tints[0])
        .setVisible(false),
    );
  }

  /** Where the guest's backdrop creature is; the guest flies out of it and hides it while out. */
  setSource(get: () => GuestSource | null): void {
    this.getSource = get;
  }

  /** Per frame, after the tower is placed. */
  update(dtMs: number, ctx: GuestContext): void {
    this.last = ctx;
    this.clockMs += dtMs;
    // The wait runs during a visit too: visits start `intervalMs` apart.
    this.scheduler.tick(dtMs);
    this.tickGiggle(dtMs);
    if (this.phase === 'away') {
      this.tickAway(ctx);
      return;
    }
    if (!this.runIsOn(ctx.state)) {
      this.hide();
      return;
    }
    this.phaseMs += dtMs;
    if (!this.follow(ctx.state)) return;
    this.nearShadow =
      this.phase === 'arrive' || this.phase === 'sit' ? this.shadowIsNear(ctx) : false;
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
    this.stepShrink(dtMs);
    if (this.root.visible) this.draw();
    this.drawOrbit(dtMs);
  }

  /** Reacts to the events of one sim step: a landing, a sneeze. Call it after the tower is synced. */
  handleEvents(events: readonly SimEvent[], state: Readonly<TowerState>): void {
    if (this.phase !== 'arrive' && this.phase !== 'sit') return;
    if (events.some((e) => e.type === 'wobble_sneeze')) {
      this.startLeave('startle');
      return;
    }
    if (!events.some((e) => e.type === 'land')) return;
    if (this.phase === 'arrive') {
      if (!this.retarget(state)) this.startLeave('startle');
      return;
    }
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
    this.onPath = this.rollOnPath(ctx.state);
    const dx = this.pickSite(look, pose, ctx.state, null);
    if (dx === null) return false;
    this.begin(look, top, dx);
    this.forced = true;
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

  /** "Fewer effects" keeps the guest away (unless the data lets it come, or the dev trigger brought it). */
  private keptAway(): boolean {
    return effectsMode.reduced && !TOWER_GUEST.reducedVisits && !this.forced;
  }

  private tickAway(ctx: GuestContext): void {
    if (effectsMode.reduced && !TOWER_GUEST.reducedVisits) return;
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
    this.onPath = this.rollOnPath(state);
    // A visit bound for the path of the next layer may sit under its shadow; any other keeps clear of it.
    const avoid = this.onPath ? null : this.shadowSpan(ctx, pose);
    const dx = this.pickSite(look, pose, state, avoid);
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

  /**
   * Whether this visit is bound for the path of the next layer. The draw is always taken (so the
   * stream does not depend on the rule); a layer aimed by its shadow alone gets no such visit.
   */
  private rollOnPath(state: Readonly<TowerState>): boolean {
    const roll = this.random.next();
    return roll < TOWER_GUEST.site.pathChance && !aimedByShadowOnly(state.flying?.rule ?? null);
  }

  /** The shadow of the flying layer as offsets from the centre of `pose`; `null` when there is none. Reused: read it at once. */
  private shadowSpan(ctx: GuestContext, pose: LayerPose): Span | null {
    const flying = ctx.state.flying;
    if (!flying || !ctx.shadow.visible) return null;
    const half = flying.width / 2;
    this.shadowBox.left = ctx.shadow.x - half - pose.x;
    this.shadowBox.right = ctx.shadow.x + half - pose.x;
    return this.shadowBox;
  }

  /** The shadow of the flying layer is within the guest's full-size body plus the shadow gap of it. */
  private shadowIsNear(ctx: GuestContext): boolean {
    const look = this.look;
    const pose = look ? this.poseOf(this.anchor.index) : null;
    if (!look || !pose) return false;
    const half = look.halfWidthPx * look.scale;
    return !clearOfSpan(this.pos.x - pose.x, half, this.shadowSpan(ctx, pose));
  }

  /** The drawn size follows the aim hint: small on the path of the next layer or when the shadow is near, full otherwise. */
  private stepShrink(dtMs: number): void {
    const visiting = this.phase === 'arrive' || this.phase === 'sit';
    const small = visiting && (this.onPath || this.nearShadow);
    const step = ((1 - shadowFit.scale) * dtMs) / shadowFit.rampMs;
    this.shrink = stepToward(this.shrink, small ? shadowFit.scale : 1, step);
  }

  /** Half of the width the face of a layer takes. */
  private faceHalfOf(pose: LayerPose): number {
    const creature = pose.look.kind === 'creature' ? (pose.look.creature ?? null) : null;
    return faceHalfSpan(pose.width, creature ? faceRecipe(creature) : null);
  }

  /** Where on the top layer (`pose`) the guest sits; the next layer is the flying one, or as wide as the top. */
  private pickSite(
    look: GuestLook,
    pose: LayerPose,
    state: Readonly<TowerState>,
    avoid: Span | null,
  ): number | null {
    const face = this.faceHalfOf(pose);
    const next = state.flying?.width ?? pose.width;
    const half = look.halfWidthPx * look.scale;
    const random = (): number => this.random.next();
    return chooseSite(pose.width, face, half, next, this.onPath, random, avoid);
  }

  /**
   * A layer landed while the guest was still coming: one bound for the path of the next layer
   * turns to the new top layer and lands there instead, from where it is now. False for any other
   * guest, or when there is no room on that layer.
   */
  private retarget(state: Readonly<TowerState>): boolean {
    const look = this.look;
    if (!this.onPath) return false;
    const top = state.layers.length - 1;
    const pose = look ? this.poseOf(top) : null;
    if (!look || !pose) return false;
    const dx = this.pickSite(look, pose, state, null);
    if (dx === null) return false;
    this.scaleFrom = this.drawnScale(look);
    this.anchor = { index: top, edge: 'top', dx };
    this.from.x = this.pos.x;
    this.from.y = this.pos.y;
    this.enter('arrive', this.pick(TOWER_GUEST.arrive.retargetMs));
    this.rampedMs = TOWER_GUEST.flightRampMs;
    return true;
  }

  /** Starts a visit on the layer `index` at `dx` from its centre. */
  private begin(look: GuestLook, index: number, dx: number): void {
    this.look = look;
    this.anchor = { index, edge: 'top', dx };
    this.wasOver = false;
    this.flinchMs = -1;
    this.flinchCooldownMs = 0;
    this.scaleFrom = look.scale;
    this.shrink = 1;
    this.nearShadow = false;
    this.source = this.getSource();
    this.scheduler.started();
    this.forced = false;
    this.root.setVisible(true);
    this.shownFlat = null;
  }

  private enter(phase: GuestPhase, spanMs = 0): void {
    this.phase = phase;
    this.phaseMs = 0;
    this.spanMs = spanMs;
    this.rampedMs = 0;
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
    // A layer pressed down on the guest pushes it down with the dip.
    const dip =
      this.anchor.edge === 'bottom'
        ? (this.tower.viewAt(this.anchor.index)?.pressDropAt(this.anchor.dx) ?? 0)
        : 0;
    out.x = pose.x + this.anchor.dx * Math.cos(a) - (edgeY + dip) * Math.sin(a);
    out.y = pose.y + (edgeY + dip) * Math.cos(a) + this.anchor.dx * Math.sin(a);
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
    if (visiting && (this.anchor.index !== state.layers.length - 1 || this.keptAway())) {
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
      this.zigzag.stagger ?? null,
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
    // The shadow is the only aim there: a guest it has come to gives the place up.
    if (this.nearShadow && aimedByShadowOnly(flying?.rule ?? null)) {
      this.startLeave('startle');
      return;
    }
    if (this.flinchMs >= 0) {
      this.flinchMs += dtMs;
      if (this.flinchMs >= shy.hopMs) this.flinchMs = -1;
    }
    if (this.phaseMs >= this.spanMs) this.startLeave('leave');
  }

  /** The guest takes off for the nearer screen edge: calmly (`leave`) or in a hurry (`startle`: a miss, a sneeze). */
  private startLeave(kind: 'leave' | 'startle'): void {
    this.flinchMs = -1;
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

  /**
   * A layer landed on the guest: it is tied to the new layer's lower edge and squashes. The layer
   * holds its squash for a moment and dips at that spot, and the camera kicks as for a heavy layer
   * (not in "fewer effects").
   */
  private startSplat(index: number, pose: LayerPose): void {
    const look = this.look;
    const from = this.pos.x - pose.x;
    // The pancake stays clear of the new layer's face: the guest is nudged aside as it is pressed.
    const half = look ? Math.max(look.halfWidthPx, look.flat.halfWidthPx) * look.scale : 0;
    this.slide.from = from;
    this.slide.to = clearOfFace(from, this.faceHalfOf(pose), half, pose.width);
    this.anchor = { index, edge: 'bottom', dx: from };
    this.flinchMs = -1;
    this.shrink = 1;
    this.plainSplat = effectsMode.reduced;
    this.enter('squash', splat.squashMs);
    this.cues.splat();
    if (this.plainSplat) return;
    this.tower.viewAt(index)?.playPress(this.slide.to, {
      scaleX: impact.squashX,
      scaleY: impact.squashY,
      holdMs: impact.hitstopMs,
      settleMs: impact.settleMs,
      squashEase: ANIM.land.ease,
      dipPx: impact.dipPx,
      dipEase: impact.dipEase,
    });
    this.cues.kick(impact.kickMul);
  }

  private tickSplat(): void {
    if (this.phaseMs < this.spanMs) return;
    switch (this.phase) {
      case 'squash':
        this.enter('hold', this.pick(splat.holdMs));
        this.onFlat();
        break;
      case 'hold':
        if (this.plainSplat) {
          this.flee();
          break;
        }
        this.enter('peel', stageMs('peel'));
        // The sound pulls up while the pancake stretches and pops as the guest comes off.
        this.cues.peel();
        break;
      case 'peel':
        this.enter('inflate', stageMs('inflate'));
        break;
      case 'inflate':
        this.enter('shake', stageMs('shake'));
        this.orbitMs = 0;
        break;
      case 'shake':
        this.flee();
        break;
      default:
        break;
    }
  }

  /** The offended flight away: staggering, with a rattling buzz ("fewer effects": a plain zigzag). */
  private flee(): void {
    const { stagger, ...plain } = splat.flee;
    this.flyOff(this.plainSplat ? plain : { ...plain, stagger });
    this.enter('flee', this.pick(splat.flee.flightMs));
    this.cues.buzz();
  }

  /**
   * The pancake pops in: stars fly out, a clap ring spreads, the layer above looks down at it,
   * surprised, and the neighbours below glance at it. "Fewer effects" keeps none of it.
   */
  private onFlat(): void {
    if (this.plainSplat) return;
    const { stars, surprise, ring } = splat;
    starBurst(
      this.fx.particles,
      this.pos.x,
      this.pos.y,
      stars.count,
      -90,
      stars.style,
      stars.tints,
    );
    const look = this.look;
    if (look) {
      const width = look.flat.halfWidthPx * 2 * look.scale * ring.widthMul;
      this.fx.ring.play(this.pos.x, this.pos.y, width, { tint: ring.tint });
    }
    const lookMs = this.spanMs + splat.peelMs + surprise.extraMs;
    const view = this.tower.viewAt(this.anchor.index);
    if (view) {
      view.faceView.react(surprise.reaction, lookMs);
      this.glance(view, lookMs);
    }
    this.glanceNeighbours(lookMs);
  }

  /** The face of `view` looks at the guest for `ms`. */
  private glance(view: LayerView, ms: number): void {
    view.glanceAtWorld(this.pos.x, this.pos.y, ms);
  }

  /** The layers under the seam may glance at the pancake, and one of them may giggle. */
  private glanceNeighbours(ms: number): void {
    const glancers: LayerView[] = [];
    for (let k = 1; k <= neighbours.depth; k++) {
      const view = this.tower.viewAt(this.anchor.index - k);
      if (!view || !view.visible || view.faceView.licking) continue;
      if (this.random.next() >= neighbours.glanceChance) continue;
      this.glance(view, ms);
      glancers.push(view);
    }
    if (glancers.length === 0 || this.random.next() >= neighbours.giggleChance) return;
    this.giggler = glancers[Math.floor(this.random.next() * glancers.length)] ?? null;
    this.giggleInMs = neighbours.giggleDelayMs;
  }

  private hide(): void {
    this.source?.suspend(false);
    this.source = null;
    this.phase = 'away';
    this.forced = false;
    this.giggler = null;
    this.giggleInMs = -1;
    this.root.setVisible(false);
    this.legs.clear();
    this.orbitMs = -1;
    for (const star of this.orbitStars) star.setVisible(false);
  }

  /** The shape of this frame: the splat stages, or the flight and the rest. */
  private fillShape(): GuestShape {
    const shape = this.shape;
    const phase = this.phase;
    if (SPLAT_STAGES.includes(phase)) {
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
    const tiltDeg = phase === 'flee' && !this.plainSplat ? splat.flee.tiltDeg : TOWER_GUEST.tiltDeg;
    shape.scaleY = lerp(1, flapScale(this.clockMs, flap), ramp);
    shape.tilt =
      ramp * tiltDeg * DEG_TO_RAD * sineWave(this.clockMs, flap.ms * TOWER_GUEST.tiltPeriodMul);
    return shape;
  }

  /** 0 to 1: how much of the flight's buzz shows now. */
  private flightRamp(): number {
    const { flightRampMs } = TOWER_GUEST;
    const landing = this.phase === 'arrive' ? (this.spanMs - this.phaseMs) / flightRampMs : 1;
    return clamp01(Math.min((this.phaseMs + this.rampedMs) / flightRampMs, landing));
  }

  /** The drawn size now: growing from the backdrop creature's size while it arrives. */
  private drawnScale(look: GuestLook): number {
    if (this.phase !== 'arrive') return look.scale;
    return lerp(this.scaleFrom, look.scale, clamp01(this.phaseMs / this.spanMs));
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
      const width = shape.flat ? flat.width : look.size.width;
      this.legs.setPosition(-width / 2, -feet);
    }
    const resting = this.phase === 'sit';
    this.legs.setVisible(resting || shape.flat);
    if (shape.flat) drawFlatLimbs(this.legs, look, this.clockMs, !this.plainSplat);
    else if (resting) drawGuestLegs(this.legs, look, this.clockMs, look.headSide);
    const size = this.drawnScale(look) * this.shrink;
    this.root.setDepth(this.pressed() ? this.pressedDepth() : DEPTH.pieces);
    this.root.setPosition(this.pos.x, this.pos.y - this.flinch.lift);
    this.root.setRotation(shape.tilt);
    this.root.setScale(this.facing * size * shape.scaleX, size * shape.scaleY);
  }

  /** The guest lies squashed under the layer that landed on it (it peels off in front of it). */
  private pressed(): boolean {
    return this.phase === 'squash' || this.phase === 'hold';
  }

  /** Between the layer that pressed the guest and the one under it: the layer hides what it covers. */
  private pressedDepth(): number {
    return DEPTH.tower + (this.anchor.index - DEPTH.guestPressedStep) * DEPTH.towerLayerStep;
  }

  /** The neighbour picked to giggle does it once its delay runs out: a happy face and a "хи-хи-хи". */
  private tickGiggle(dtMs: number): void {
    const view = this.giggler;
    if (!view) return;
    this.giggleInMs -= dtMs;
    if (this.giggleInMs > 0) return;
    this.giggler = null;
    if (!view.visible || effectsMode.reduced) return;
    view.faceView.react(neighbours.giggle, neighbours.giggleMs);
    this.cues.giggle();
  }

  /** Stars circle over the guest's head while it shakes and fade out as it flies away. */
  private drawOrbit(dtMs: number): void {
    if (this.orbitMs < 0) return;
    const shaking = this.phase === 'shake';
    if (!shaking && this.phase !== 'flee') {
      this.orbitMs = -1;
      for (const star of this.orbitStars) star.setVisible(false);
      return;
    }
    this.orbitMs += dtMs;
    const alpha = shaking ? 1 : 1 - clamp01(this.phaseMs / orbit.fadeMs);
    this.orbitStars.forEach((star, i) => {
      const p = orbitStar(i, this.orbitMs, this.orbitPoint);
      star
        .setVisible(alpha > 0)
        .setAlpha(alpha)
        .setPosition(this.pos.x + p.x, this.pos.y + p.y)
        .setScale(p.scale)
        .setDepth(p.front ? DEPTH.guestStarsFront : DEPTH.guestStarsBack);
    });
    if (alpha <= 0) this.orbitMs = -1;
  }
}

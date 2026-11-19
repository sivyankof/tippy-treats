import type * as Phaser from 'phaser';
import { Rng } from '../../core/common/rng';
import type { SimEvent, TowerState } from '../../core/tower/tower-sim';
import { BALANCE } from '../../data/tower/balance';
import type { Range } from '../../data/backdrop/backdrop-life';
import { TOWER_GUEST, TOWER_GUESTS, type GuestLook } from '../../data/guests/tower-guest';
import { ZONES } from '../../data/zones/zones';
import { clamp01, DEG_TO_RAD, lerp, stepToward } from '../../util/math';
import { DEPTH } from '../depth';
import { effectsMode } from '../effects-mode';
import type { LandingFx } from '../fx/landing-fx';
import type { GuestSource, SourcePoint } from './backdrop/guest-source';
import { plainLooks } from './plain-look';
import { bakeGuestFlat } from './tower-guest-art';
import { GuestPicture } from './tower-guest-picture';
import {
  aimedByShadowOnly,
  GuestScheduler,
  layerCovers,
  stageMs,
  type FlightPoint,
  type GuestPhase,
  type GuestShape,
} from './tower-guest-plan';
import { GuestFlight } from './tower-guest-flight';
import { fillGuestShape, type ShapeInput } from './tower-guest-shape';
import { GuestShy } from './tower-guest-shy';
import { GuestSplat } from './tower-guest-splat';
import { GuestVisitPlanner } from './tower-guest-visit';
import type { Anchor, FlightSpec, GuestContext, GuestCues } from './tower-guest-types';
import type { LayerPose, TowerView } from './tower-view';

export type { GuestContext, GuestCues } from './tower-guest-types';

const { splat, shadowFit } = TOWER_GUEST;
const HALF_LAYER = BALANCE.layer.height / 2;

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
  private readonly picture: GuestPicture;
  private readonly press: GuestSplat;
  private readonly plan: GuestVisitPlanner;
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
  private readonly flight = new GuestFlight();
  private readonly shy = new GuestShy();
  private readonly pos = this.flight.pos;
  private readonly from = this.flight.from;
  private readonly to = this.flight.to;
  private readonly scratchPose: LayerPose = {
    x: 0,
    y: 0,
    width: 0,
    angle: 0,
    cut: null,
    look: { kind: 'plain' },
  };
  /** The shadow of the flying layer is near the guest now (the guest hides the aim hint if it stays big). */
  private nearShadow = false;
  /** Share of the full size the guest is drawn at: small over the aim hint (`TOWER_GUEST.shadowFit`). */
  private shrink = 1;
  private readonly shape: GuestShape = { flat: false, scaleX: 1, scaleY: 1, tilt: 0 };
  private readonly shapeIn: ShapeInput = {
    phase: 'away',
    phaseMs: 0,
    spanMs: 0,
    rampedMs: 0,
    clockMs: 0,
    swayTilt: 0,
    flinchLean: 0,
    plainSplat: false,
  };
  /** Tilt of the layer the guest is tied to, radians. */
  private swayTilt = 0;
  private facing: -1 | 1 = 1;
  /** The creature of the backdrop this guest came from (hidden there while the guest is out). */
  private getSource: () => GuestSource | null = () => null;
  private source: GuestSource | null = null;
  private readonly sourcePoint: SourcePoint = { x: 0, y: 0, scale: 1 };
  /** The drawn size the arrival starts at (the backdrop creature's), growing to the guest's own. */
  private scaleFrom = 1;
  private last: GuestContext | null = null;
  /** The visit was started by the dev trigger: it stays in "fewer effects". */
  private forced = false;

  constructor(
    scene: Phaser.Scene,
    private readonly tower: TowerView,
    fx: LandingFx,
    private readonly cues: GuestCues,
  ) {
    this.random = new Rng(plainLooks.cosmeticSeed).fork(TOWER_GUEST.stream);
    this.scheduler = new GuestScheduler(() => this.random.next());
    for (const look of Object.values(TOWER_GUESTS)) bakeGuestFlat(scene, look);
    this.picture = new GuestPicture(scene);
    this.plan = new GuestVisitPlanner(this.random);
    this.press = new GuestSplat(scene, tower, fx, this.cues, this.random);
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
    this.press.tickGiggle(dtMs);
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
    if (this.picture.root.visible) this.draw();
    this.press.drawOrbit(dtMs, this.phase, this.phaseMs, this.pos.x, this.pos.y);
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
    this.onPath = this.plan.rollOnPath(ctx.state);
    const dx = this.plan.pickSite(look, pose, ctx.state, this.onPath, null, this.topperSide());
    if (dx === null) return false;
    this.begin(look, top, dx);
    this.forced = true;
    this.source?.suspend(true);
    this.enter('sit', this.plan.pick(TOWER_GUEST.sitMs));
    this.facing = this.headTo(dx < 0 ? 1 : -1);
    this.anchorPoint(this.pos);
    this.draw();
    return true;
  }

  /** The side of the face the topper of the top layer stands on now (`null`: none shown). */
  private topperSide(): -1 | 1 | null {
    return this.tower.topView()?.topperSide() ?? null;
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
    return look && this.picture.root.scene.textures.exists(look.texture) ? look : null;
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
    this.onPath = this.plan.rollOnPath(state);
    // A visit bound for the path of the next layer may sit under its shadow; any other keeps clear of it.
    const avoid = this.plan.avoidSpan(ctx, pose, this.onPath);
    const dx = this.plan.pickSite(look, pose, state, this.onPath, avoid, this.topperSide());
    if (dx === null) return false;
    this.begin(look, top, dx);
    const { arrive } = TOWER_GUEST;
    this.plan.arrivalStart(cam, pose, this.from);
    // The creature of the backdrop that is in view peels off its path and flies on from there.
    if (this.source?.peek(this.sourcePoint)) {
      this.from.x = this.sourcePoint.x;
      this.from.y = this.sourcePoint.y + cam.scrollY;
      this.scaleFrom = this.sourcePoint.scale;
    }
    this.source?.suspend(true);
    this.flight.setArrival(arrive);
    this.enter('arrive', this.plan.pick(arrive.flightMs));
    this.pos.x = this.from.x;
    this.pos.y = this.from.y;
    this.facing = this.headTo(this.from.x < pose.x ? 1 : -1);
    this.draw();
    return true;
  }

  /** The shadow of the flying layer is near the guest's full-size body. */
  private shadowIsNear(ctx: GuestContext): boolean {
    const look = this.look;
    const pose = look ? this.poseOf(this.anchor.index) : null;
    return !!look && !!pose && this.plan.shadowIsNear(ctx, look, pose, this.pos.x);
  }

  /** The drawn size follows the aim hint: small on the path of the next layer or when the shadow is near, full otherwise. */
  private stepShrink(dtMs: number): void {
    const visiting = this.phase === 'arrive' || this.phase === 'sit';
    const small = visiting && (this.onPath || this.nearShadow);
    const step = ((1 - shadowFit.scale) * dtMs) / shadowFit.rampMs;
    this.shrink = stepToward(this.shrink, small ? shadowFit.scale : 1, step);
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
    const dx = this.plan.pickSite(look, pose, state, this.onPath, null, this.topperSide());
    if (dx === null) return false;
    this.scaleFrom = this.drawnScale(look);
    this.anchor = { index: top, edge: 'top', dx };
    this.from.x = this.pos.x;
    this.from.y = this.pos.y;
    this.enter('arrive', this.plan.pick(TOWER_GUEST.arrive.retargetMs));
    this.rampedMs = TOWER_GUEST.flightRampMs;
    return true;
  }

  /** Starts a visit on the layer `index` at `dx` from its centre. */
  private begin(look: GuestLook, index: number, dx: number): void {
    this.look = look;
    this.anchor = { index, edge: 'top', dx };
    this.shy.reset();
    this.scaleFrom = look.scale;
    this.shrink = 1;
    this.nearShadow = false;
    this.source = this.getSource();
    this.scheduler.started();
    this.forced = false;
    this.picture.show();
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
      const { from, to } = this.press.slide;
      this.anchor.dx = lerp(from, to, clamp01(this.phaseMs / this.spanMs));
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
    this.flight.fly(t);
    this.facing = this.headTo(this.to.x >= this.from.x ? 1 : -1);
    if (t >= 1) {
      this.enter('sit', this.plan.pick(TOWER_GUEST.sitMs));
      this.facing = this.headTo(this.anchor.dx < 0 ? 1 : -1);
    }
  }

  private tickSit(dtMs: number, ctx: GuestContext): void {
    const flying = ctx.state.flying;
    this.shy.notice(dtMs, flying, this.pos.x);
    // The shadow is the only aim there: a guest it has come to gives the place up.
    if (this.nearShadow && aimedByShadowOnly(flying)) {
      this.startLeave('startle');
      return;
    }
    this.shy.advance(dtMs);
    if (this.phaseMs >= this.spanMs) this.startLeave('leave');
  }

  /** The guest takes off for the nearer screen edge: calmly (`leave`) or in a hurry (`startle`: a miss, a sneeze). */
  private startLeave(kind: 'leave' | 'startle'): void {
    this.shy.cancel();
    this.flyOff(TOWER_GUEST[kind]);
    this.enter('leave', this.plan.pick(TOWER_GUEST[kind].flightMs));
  }

  /** Aims a flight from where the guest is to beyond the nearer screen edge, climbing. */
  private flyOff(spec: FlightSpec & { risePx: Range }): void {
    const width = this.last?.cam.width ?? BALANCE.tray.centerX * 2;
    const toRight = this.pos.x >= width / 2;
    this.flight.aimOff(spec, width, toRight, this.plan.pick(spec.risePx));
    this.facing = this.headTo(toRight ? 1 : -1);
  }

  private flyAway(): void {
    const t = this.phaseMs / this.spanMs;
    this.flight.fly(t);
    if (t >= 1) this.hide();
  }

  /** A layer landed on the guest: it is tied to the new layer's lower edge and squashes. */
  private startSplat(index: number, pose: LayerPose): void {
    this.press.start(this.look, this.pos.x, index, pose);
    this.anchor = { index, edge: 'bottom', dx: this.press.slide.from };
    this.shy.cancel();
    this.shrink = 1;
    this.enter('squash', splat.squashMs);
  }

  private tickSplat(): void {
    if (this.phaseMs < this.spanMs) return;
    switch (this.phase) {
      case 'squash':
        this.enter('hold', this.plan.pick(splat.holdMs));
        this.press.onFlat(this.look, this.pos.x, this.pos.y, this.anchor.index, this.spanMs);
        break;
      case 'hold':
        if (this.press.plain) {
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
        this.press.startOrbit();
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
    this.flyOff(this.press.plain ? plain : { ...plain, stagger });
    this.enter('flee', this.plan.pick(splat.flee.flightMs));
    this.cues.buzz();
  }

  private hide(): void {
    this.source?.suspend(false);
    this.source = null;
    this.phase = 'away';
    this.forced = false;
    this.press.reset();
    this.picture.hide();
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
    this.shy.update();
    const input = this.shapeIn;
    input.phase = this.phase;
    input.phaseMs = this.phaseMs;
    input.spanMs = this.spanMs;
    input.rampedMs = this.rampedMs;
    input.clockMs = this.clockMs;
    input.swayTilt = this.swayTilt;
    input.flinchLean = this.shy.pose.lean;
    input.plainSplat = this.press.plain;
    const shape = fillGuestShape(input, this.shape);
    // The guest lies squashed under the layer that landed on it (it peels off in front of it); the
    // layer hides what it covers, so it goes between that layer and the one under it.
    const pressed = this.phase === 'squash' || this.phase === 'hold';
    this.picture.draw(look, shape, {
      x: this.pos.x,
      y: this.pos.y - this.shy.pose.lift,
      facing: this.facing,
      size: this.drawnScale(look) * this.shrink,
      resting: this.phase === 'sit',
      pressedDepth: pressed
        ? DEPTH.tower + (this.anchor.index - DEPTH.guestPressedStep) * DEPTH.towerLayerStep
        : null,
      clockMs: this.clockMs,
      lively: !this.press.plain,
    });
  }
}
